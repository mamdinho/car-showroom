"use client";

import { useEffect, useRef, useState } from "react";
import { apiGet, apiPut, apiPost } from "@/lib/api";
import { loadSession } from "@/lib/session";
import { Button } from "@/components/Button";
import { Card, CardBody } from "@/components/Card";

type UserRow = {
  userId: string;
  email?: string;
  name?: string;
  phone?: string;
  status?: string;
  avatarKey?: string;
};

const CDN_BASE = (() => {
  const raw = (process.env.NEXT_PUBLIC_CDN_BASE || "").trim();
  if (!raw) return "";
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withScheme.replace(/\/+$/, "");
})();

export default function ProfilePage() {
  // ensure deterministic SSR/CSR
  const [mounted, setMounted] = useState(false);
  const [idToken, setIdToken] = useState<string | null>(null);

  const [me, setMe] = useState<UserRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // editable fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
 

  // file input ref
  const filePicker = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setMounted(true);
    const s = loadSession();
    setIdToken(s?.idToken ?? null);
  }, []);

  const load = async (token: string) => {
    try {
      setErr(null);
      const row: UserRow = await apiGet("/users/me", token);
      setMe(row);
      setName(row.name || "");
      setPhone(row.phone || "");
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  };

  useEffect(() => {
    if (!mounted) return;
    if (idToken) void load(idToken);
    else setMe(null);
  }, [mounted, idToken]);

  const avatarUrl =
    me?.avatarKey && CDN_BASE ? `${CDN_BASE}/${me.avatarKey}` : null;

  const save = async () => {
    if (!idToken) return;
    try {
      setErr(null);
      setMsg(null);
      const updated: UserRow = await apiPut("/users/me", idToken, {
        name: name || undefined,
        phone: phone || undefined,
        status: status || undefined,
      });
      setMe(updated);
      setMsg("Profile updated.");
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  };

  const pickFile = () => filePicker.current?.click();

  const uploadAvatar = async (file: File) => {
    if (!idToken) return;
    try {
      setErr(null);
      setMsg(null);
      // 1) presign
      const presign = await apiPost("/users/me/avatar-upload-url", idToken, {
        contentType: file.type || "image/jpeg",
      });
      // 2) upload to S3
      const putRes = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "image/jpeg" },
        body: file,
      });
      if (!putRes.ok) throw new Error("Upload failed");
      // 3) refresh profile (backend stores avatarKey)
      await load(idToken);
      setMsg("Avatar uploaded. Click “Save changes” to persist profile fields.");
    } catch (e: any) {
      setErr(e.message || String(e));
    }
  };

  return (
    <div className="space-y-6">
      <h1>Profile</h1>

      {!idToken && mounted && (
        <Card>
          <CardBody className="flex items-center justify-between gap-4">
            <p className="text-gray-600">
              Please sign in to edit your profile.
            </p>
            <a href="/login">
              <Button>Sign in</Button>
            </a>
          </CardBody>
        </Card>
      )}

      {idToken && (
        <Card>
          <CardBody className="space-y-6">
            {err && <p className="text-rose-600 whitespace-pre-wrap">{err}</p>}
            {msg && <p className="text-emerald-600">{msg}</p>}

            <div className="flex items-center gap-4">
              <div className="h-24 w-24 rounded-full bg-gray-200 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-gray-500">
                    No photo
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm text-gray-500 mb-1">Change photo</div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={pickFile}>
                    Choose file…
                  </Button>
                  <input
                    ref={(el) => {
                      // explicit void return keeps TS happy with the callback ref type
                      filePicker.current = el;
                    }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadAvatar(f);
                    }}
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  JPEG/PNG recommended, ~1–5 MB.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Name" value={name} onChange={setName} />
              <Field label="Phone" value={phone} onChange={setPhone} />
              <Field label="Email" value={me?.email || ""} readOnly />
            </div>

            <div className="flex gap-3">
              <Button onClick={save}>Save changes</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setName(me?.name || "");
                  setPhone(me?.phone || "");
                  setMsg(null);
                  setErr(null);
                }}
              >
                Reset
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div>
      <div className="text-gray-500 text-sm mb-1">{label}</div>
      <input
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={readOnly}
      />
    </div>
  );
}
