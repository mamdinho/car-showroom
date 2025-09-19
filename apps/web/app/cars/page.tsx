"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { loadSession } from "@/lib/session";
import { isAdminFromIdToken } from "@/lib/authz";
import { Button } from "@/components/Button";
import { Card, CardBody } from "@/components/Card";
import { Badge } from "@/components/Badge";

type Car = {
  carId: string;
  brand: string;
  model: string;
  price?: number;
  year?: number;
  imageKey?: string;
};

const rawCdn = (process.env.NEXT_PUBLIC_CDN_BASE || "").trim();
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
const CDN_BASE = (() => {
  if (!rawCdn) return "";
  const withScheme = /^https?:\/\//i.test(rawCdn) ? rawCdn : `https://${rawCdn}`;
  return withScheme.replace(/\/+$/, "");
})();

export default function CarsPage() {
  const router = useRouter();

  const [cars, setCars] = useState<Car[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Admin add form – store number-like fields as strings, convert on save
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");           // string
  const [price, setPrice] = useState("");         // string
  const [mileage, setMileage] = useState("");     // string
  const [drivetrain, setDrivetrain] = useState("");
  const [exteriorColor, setExteriorColor] = useState("");
  const [engine, setEngine] = useState("");
  const [transmission, setTransmission] = useState("");
  const [fuelConsumption, setFuelConsumption] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [hasBackupCamera, setHasBackupCamera] = useState(false);

  // refs for file inputs keyed by carId
  const filePickers = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    setMounted(true);
    const sess = loadSession();
    const token = sess?.idToken ?? null;
    setIdToken(token);
    setIsAdmin(isAdminFromIdToken(token ?? undefined));
  }, []);

  const load = async () => {
    try {
      setErr(null);
      setMsg(null);
      setCars(await apiGet("/cars"));
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  };
  useEffect(() => { void load(); }, []);

  const toNum = (s: string) => (s.trim() === "" ? undefined : Number(s));
  const toStr = (s: string) => (s.trim() === "" ? undefined : s.trim());

  const addCar = async () => {
    if (!idToken) { alert("Login as admin first."); return; }
    if (!brand.trim() || !model.trim()) { setErr("Brand and model are required."); return; }
    try {
      setErr(null);
      setMsg(null);
      const res = await fetch(`${API_BASE}/cars`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          brand: brand.trim(),
          model: model.trim(),
          year: toNum(year),
          price: toNum(price),
          mileage: toNum(mileage),
          drivetrain: toStr(drivetrain),
          exteriorColor: toStr(exteriorColor),
          engine: toStr(engine),
          transmission: toStr(transmission),
          fuelConsumption: toStr(fuelConsumption),
          fuelType: toStr(fuelType),
          hasBackupCamera,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const c = await res.json();
      setCars((prev) => [c, ...prev]);
      setMsg("Car added.");

      // reset form
      setBrand(""); setModel(""); setYear(""); setPrice(""); setMileage("");
      setDrivetrain(""); setExteriorColor(""); setEngine(""); setTransmission("");
      setFuelConsumption(""); setFuelType(""); setHasBackupCamera(false);
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  };

  const book = (car: Car) => {
    window.location.href = `/bookings?carId=${encodeURIComponent(car.carId)}`;
  };

  const imgUrl = (car: Car) => (car.imageKey && CDN_BASE ? `${CDN_BASE}/${car.imageKey}` : null);

  const uploadImage = async (car: Car, file: File) => {
    if (!idToken) { alert("Login as admin first."); return; }
    if (!file.type.startsWith("image/")) { setErr("Please choose an image file."); return; }

    try {
      setBusyId(car.carId);
      setErr(null);
      setMsg(null);

      const res = await fetch(`${API_BASE}/cars/${car.carId}/image-upload-url`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
      if (!res.ok) throw new Error(`presign failed: ${res.status} ${await res.text()}`);
      const { uploadUrl, key } = await res.json();

      const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error(`upload failed: ${put.status} ${await put.text()}`);

      const upd = await fetch(`${API_BASE}/cars/${car.carId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ imageKey: key }),
      });
      if (!upd.ok) throw new Error(await upd.text());

      setCars((cs) => cs.map((x) => (x.carId === car.carId ? { ...x, imageKey: key } : x)));
      setMsg("Image uploaded.");
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setBusyId(null);
    }
  };

  const openPicker = (carId: string) => filePickers.current[carId]?.click();
  const goDetails = (carId: string) => router.push(`/car?id=${encodeURIComponent(carId)}`);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="mr-auto">Cars</h1>
        <Button variant="secondary" onClick={load}>Refresh</Button>
      </div>

      {mounted && isAdmin && (
        <Card>
          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
              <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} />
              <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Year" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />

              <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
              <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Mileage" inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value)} />
              <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Drivetrain" value={drivetrain} onChange={(e) => setDrivetrain(e.target.value)} />

              <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Exterior color" value={exteriorColor} onChange={(e) => setExteriorColor(e.target.value)} />
              <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Engine" value={engine} onChange={(e) => setEngine(e.target.value)} />
              <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Transmission" value={transmission} onChange={(e) => setTransmission(e.target.value)} />

              <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Fuel consumption" value={fuelConsumption} onChange={(e) => setFuelConsumption(e.target.value)} />
              <input className="rounded-lg border border-gray-300 px-3 py-2" placeholder="Fuel type" value={fuelType} onChange={(e) => setFuelType(e.target.value)} />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" className="h-4 w-4" checked={hasBackupCamera} onChange={(e) => setHasBackupCamera(e.target.checked)} />
                Backup camera
              </label>

              <div className="md:col-span-3">
                <Button onClick={addCar}>Add (admin)</Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {err && <p className="text-rose-600 whitespace-pre-wrap">{err}</p>}
      {msg && <p className="text-emerald-600">{msg}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cars.map((c) => {
          const url = imgUrl(c);
          return (
            <div
              key={c.carId}
              className="cursor-pointer transition hover:shadow-xl rounded-2xl"
              onClick={() => goDetails(c.carId)}
            >
              <Card>
                <div className="aspect-[16/9] bg-gray-100 rounded-t-2xl overflow-hidden flex items-center justify-center">
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={`${c.brand} ${c.model}`} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-400 text-sm">{c.brand} {c.model}</span>
                  )}
                </div>

                <CardBody className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{c.brand} {c.model}</div>
                    {c.year ? <Badge>{c.year}</Badge> : null}
                  </div>
                  {c.price ? <div className="text-gray-700">${c.price.toLocaleString()}</div> : <div className="text-gray-400">Price on request</div>}

                  <div className="flex flex-wrap gap-2 items-center">
                    <Button
                      variant="secondary"
                      onClick={(e) => { e.stopPropagation(); book(c); }}
                    >
                      Book test
                    </Button>

                    {/* ✅ details uses query page, not dynamic route */}
                    <Link href={`/car?id=${encodeURIComponent(c.carId)}`} onClick={(e) => e.stopPropagation()} className="inline-block">
                      <Button variant="secondary">View details</Button>
                    </Link>

                    {isAdmin && (
                      <>
                        <input
                          ref={(el) => { filePickers.current[c.carId] = el; }}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => e.target.files && uploadImage(c, e.target.files[0])}
                          disabled={busyId === c.carId}
                        />
                        <Button
                          onClick={(e) => { e.stopPropagation(); openPicker(c.carId); }}
                          disabled={busyId === c.carId}
                        >
                          {busyId === c.carId ? "Uploading…" : c.imageKey ? "Replace photo" : "Upload photo"}
                        </Button>
                      </>
                    )}
                  </div>
                </CardBody>
              </Card>
            </div>
          );
        })}
      </div>

      {cars.length === 0 && (
        <div className="text-gray-500">
          No cars yet. {mounted && isAdmin ? "Use the form above to add one." : ""}
        </div>
      )}
    </div>
  );
}
