"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { loadSession } from "@/lib/session";
import { isAdminFromIdToken } from "@/lib/authz";
import { Button } from "@/components/Button";
import { Card, CardBody } from "@/components/Card";

type Car = {
  carId: string;
  brand: string;
  model: string;
  price?: number;
  year?: number;
  imageKey?: string;
  mileage?: number;
  drivetrain?: string;
  exteriorColor?: string;
  engine?: string;
  transmission?: string;
  fuelConsumption?: string;
  fuelType?: string;
  hasBackupCamera?: boolean;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
const rawCdn = (process.env.NEXT_PUBLIC_CDN_BASE || "").trim();
const CDN_BASE = (() => {
  if (!rawCdn) return "";
  const withScheme = /^https?:\/\//i.test(rawCdn) ? rawCdn : `https://${rawCdn}`;
  return withScheme.replace(/\/+$/, "");
})();

const cdnUrl = (key?: string | null) => (key && CDN_BASE ? `${CDN_BASE}/${key}` : null);
const toNum = (s: string) => (s.trim() === "" ? undefined : Number(s));

export default function CarPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const id = sp.get("id") || "";

  const [car, setCar] = useState<Car | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [idToken, setIdToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // edit state: store numerics as strings to avoid TS union headaches
  const [edit, setEdit] = useState(false);
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");          // string
  const [price, setPrice] = useState("");        // string
  const [mileage, setMileage] = useState("");    // string
  const [drivetrain, setDrivetrain] = useState("");
  const [exteriorColor, setExteriorColor] = useState("");
  const [engine, setEngine] = useState("");
  const [transmission, setTransmission] = useState("");
  const [fuelConsumption, setFuelConsumption] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [hasBackupCamera, setHasBackupCamera] = useState(false);

  // image picker ref
  const filePicker = useRef<HTMLInputElement | null>(null);

  // session
  useEffect(() => {
    const sess = loadSession();
    const token = sess?.idToken ?? null;
    setIdToken(token);
    setIsAdmin(isAdminFromIdToken(token ?? undefined));
  }, []);

  // load car
  useEffect(() => {
    if (!id) {
      setErr("Missing car id.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch(`${API_BASE}/cars/${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error(await res.text());
        const c: Car = await res.json();
        setCar(c);

        // seed edit fields from car
        setBrand(c.brand ?? "");
        setModel(c.model ?? "");
        setYear(c.year != null ? String(c.year) : "");
        setPrice(c.price != null ? String(c.price) : "");
        setMileage(c.mileage != null ? String(c.mileage) : "");
        setDrivetrain(c.drivetrain ?? "");
        setExteriorColor(c.exteriorColor ?? "");
        setEngine(c.engine ?? "");
        setTransmission(c.transmission ?? "");
        setFuelConsumption(c.fuelConsumption != null ? String(c.fuelConsumption) : "");
        setFuelType(c.fuelType ?? "");
        setHasBackupCamera(!!c.hasBackupCamera);
      } catch (e: any) {
        setErr(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const img = useMemo(() => cdnUrl(car?.imageKey), [car]);

  const save = async () => {
    if (!idToken || !car) { setErr("Please sign in as admin."); return; }
    try {
      setErr(null);
      setMsg(null);

      const payload = {
        brand: brand.trim() || car.brand,
        model: model.trim() || car.model,
        year: toNum(year),
        price: toNum(price),
        mileage: toNum(mileage),
        drivetrain: drivetrain || undefined,
        exteriorColor: exteriorColor || undefined,
        engine: engine || undefined,
        transmission: transmission || undefined,
        fuelConsumption: fuelConsumption || undefined,
        fuelType: fuelType || undefined,
        hasBackupCamera,
      };

      const res = await fetch(`${API_BASE}/cars/${encodeURIComponent(car.carId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      const updated = await res.json();
      setCar(updated);
      setEdit(false);
      setMsg("Saved.");
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  };

  const openPicker = () => filePicker.current?.click();

  const uploadImage = async (file: File) => {
    if (!idToken || !car) { setErr("Please sign in as admin."); return; }
    if (!file.type.startsWith("image/")) { setErr("Please choose an image file."); return; }
    try {
      setErr(null);
      setMsg(null);

      const presign = await fetch(`${API_BASE}/cars/${encodeURIComponent(car.carId)}/image-upload-url`, {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
      if (!presign.ok) throw new Error(await presign.text());
      const { uploadUrl, key } = await presign.json();

      const put = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error(await put.text());

      const upd = await fetch(`${API_BASE}/cars/${encodeURIComponent(car.carId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ imageKey: key }),
      });
      if (!upd.ok) throw new Error(await upd.text());
      const updated = await upd.json();
      setCar(updated);
      setMsg("Photo updated.");
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  };

  if (loading) return <div className="p-6">Loading…</div>;
  if (err) return <div className="p-6 text-rose-600 whitespace-pre-wrap">{err}</div>;
  if (!car) return <div className="p-6">Not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="mr-auto text-2xl font-bold">{car.brand} {car.model}</h1>
        {car.year ? <span className="rounded-full bg-gray-100 px-3 py-1 text-sm">{car.year}</span> : null}
      </div>

      <Card>
        <div className="aspect-[16/9] bg-gray-100 rounded-t-2xl overflow-hidden flex items-center justify-center">
          {img
            ? <img src={img} alt={`${car.brand} ${car.model}`} className="w-full h-full object-cover" />
            : <span className="text-gray-400">{car.brand} {car.model}</span>}
        </div>

        <CardBody className="space-y-6">
          {msg && <p className="text-emerald-600">{msg}</p>}
          {err && <p className="text-rose-600 whitespace-pre-wrap">{err}</p>}

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => router.push("/cars")}>Back to list</Button>
            <Button onClick={() => router.push(`/bookings?carId=${encodeURIComponent(car.carId)}`)}>Book test drive</Button>
            {isAdmin && (
              <>
                <input
                  ref={filePicker}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files && uploadImage(e.target.files[0])}
                />
                <Button onClick={openPicker}>{car.imageKey ? "Replace photo" : "Upload photo"}</Button>
                <Button variant={edit ? "secondary" : "primary"} onClick={() => setEdit((v) => !v)}>
                  {edit ? "Cancel edit" : "Edit details"}
                </Button>
                {edit && <Button onClick={save}>Save</Button>}
              </>
            )}
          </div>

          {/* Details / Edit form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Brand" value={brand} onChange={setBrand} readOnly={!edit} />
            <Field label="Model" value={model} onChange={setModel} readOnly={!edit} />
            <Field label="Year" value={year} onChange={setYear} readOnly={!edit} inputMode="numeric" />
            <Field label="Price" value={price} onChange={setPrice} readOnly={!edit} inputMode="numeric" />
            <Field label="Mileage" value={mileage} onChange={setMileage} readOnly={!edit} inputMode="numeric" />
            <Field label="Drivetrain" value={drivetrain} onChange={setDrivetrain} readOnly={!edit} />
            <Field label="Exterior color" value={exteriorColor} onChange={setExteriorColor} readOnly={!edit} />
            <Field label="Engine" value={engine} onChange={setEngine} readOnly={!edit} />
            <Field label="Transmission" value={transmission} onChange={setTransmission} readOnly={!edit} />
            <Field label="Fuel consumption" value={fuelConsumption} onChange={setFuelConsumption} readOnly={!edit} />
            <Field label="Fuel type" value={fuelType} onChange={setFuelType} readOnly={!edit} />
            <Toggle label="Backup camera" checked={hasBackupCamera} onChange={setHasBackupCamera} readOnly={!edit} />
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  readOnly,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  inputMode?: "text" | "numeric";
}) {
  return (
    <div>
      <div className="text-gray-500 text-sm mb-1">{label}</div>
      <input
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        inputMode={inputMode}
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  readOnly,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  readOnly?: boolean;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <span className="text-gray-500 text-sm">{label}</span>
      <input
        type="checkbox"
        className="h-5 w-5"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={readOnly}
      />
    </label>
  );
}
