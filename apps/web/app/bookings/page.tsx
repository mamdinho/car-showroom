"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, apiPatch } from "@/lib/api";
import { loadSession } from "@/lib/session";
import { Button } from "@/components/Button";
import { Card, CardBody } from "@/components/Card";

type Car = { carId: string; brand: string; model: string; year?: number };
type Booking = { bookingId: string; carId: string; slotTime: string; status: string };

export default function BookingsPage() {
  // ——— stable first render ———
  const [mounted, setMounted] = useState(false);
  const [idToken, setIdToken] = useState<string | null>(null);

  // data
  const [cars, setCars] = useState<Car[]>([]);
  const [mine, setMine] = useState<Booking[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // form
  const [carId, setCarId] = useState("");
  const [date, setDate] = useState(""); // yyyy-mm-dd
  const [time, setTime] = useState(""); // HH:mm

  useEffect(() => {
    setMounted(true);
    const s = loadSession();
    setIdToken(s?.idToken ?? null);
  }, []);

  const carLookup = useMemo(
    () => Object.fromEntries(cars.map((c) => [c.carId, c])),
    [cars]
  );

  // load cars always (public)
  useEffect(() => {
    if (!mounted) return;
    (async () => {
      try {
        setErr(null);
        const list: Car[] = await apiGet("/cars");
        setCars(list);
        if (!carId && list[0]) setCarId(list[0].carId);
      } catch (e: any) {
        setErr(e.message || String(e));
      }
    })();
  }, [mounted]); // only after mount

  // load my bookings only when we have a token
  const loadMine = async (token: string) => {
    setLoading(true);
    try {
      setErr(null);
      const my: Booking[] = await apiGet("/bookings/me", token);
      setMine(my);
    } catch (e: any) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!mounted) return;
    if (idToken) void loadMine(idToken);
    else setMine([]); // deterministic UI
  }, [mounted, idToken]);

  const onCreate = async () => {
    if (!idToken) {
      setErr("Please sign in to book a test drive.");
      return;
    }
    if (!carId || !date || !time) {
      setErr("Pick a car, date and time.");
      return;
    }
    try {
      setMsg(null);
      setErr(null);
      const iso = new Date(`${date}T${time}:00Z`).toISOString();
      await apiPost("/bookings", idToken, { carId, slotTime: iso });
      setMsg("Booking created!");
      setDate("");
      setTime("");
      await loadMine(idToken);
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  };

  const onCancel = async (bookingId: string) => {
    if (!idToken) return;
    try {
      setMsg(null);
      setErr(null);
      await apiPatch(`/bookings/${bookingId}`, idToken, { status: "cancelled" });
      await loadMine(idToken);
      setMsg("Booking cancelled.");
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  };

  // ——— UI ———
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="mr-auto">My Bookings</h1>
        <Button variant="secondary" onClick={() => idToken && loadMine(idToken)}>
          Refresh
        </Button>
      </div>

      {/* Sign-in prompt if not logged in */}
      {mounted && !idToken && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between gap-4">
              <p className="text-gray-600">
                Please sign in to create and manage your bookings.
              </p>
              <a href="/login">
                <Button>Sign in</Button>
              </a>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Booking form – always shown so users can see the flow */}
      <Card>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_160px_auto] gap-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">Car</div>
              <select
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                value={carId}
                onChange={(e) => setCarId(e.target.value)}
              >
                {cars.map((c) => (
                  <option key={c.carId} value={c.carId}>
                    {c.brand} {c.model} {c.year ? `(${c.year})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Date</div>
              <input
                type="date"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-1">Time</div>
              <input
                type="time"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>

            <div className="self-end">
              <Button onClick={onCreate} disabled={!idToken}>
                Book
              </Button>
            </div>
          </div>
          {!idToken && (
            <p className="text-xs text-gray-500 mt-2">
              Sign in to enable the “Book” button.
            </p>
          )}
        </CardBody>
      </Card>

      {err && <p className="text-rose-600 whitespace-pre-wrap">{err}</p>}
      {msg && <p className="text-emerald-600">{msg}</p>}

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mine.map((b) => {
          const car = carLookup[b.carId];
          return (
            <Card key={b.bookingId}>
              <CardBody className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">
                    {car ? `${car.brand} ${car.model}` : b.carId}
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(b.slotTime).toLocaleString()}
                  </div>
                  <div className="text-sm mt-1">{b.status}</div>
                </div>
                {b.status !== "cancelled" && (
                  <Button variant="danger" onClick={() => onCancel(b.bookingId)}>
                    Cancel
                  </Button>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
