"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import LoginModal from "@/components/LoginModal";

function buildHostedLoginUrl(returnTo?: string) {
  const domain = (process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "").replace(/\/+$/, "");
  const clientId = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID!;
  const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI!;
  const scopes = ["openid", "email", "profile"].join(" ");
  const state = Math.random().toString(36).slice(2);
  if (typeof window !== "undefined") {
    sessionStorage.setItem("oauth_state", state);
    if (returnTo) sessionStorage.setItem("oauth_returnTo", returnTo);
  }
  const url = new URL(`${domain}/oauth2/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

export default function LoginPage() {
  const [open, setOpen] = useState(false);
  const loginUrl = useMemo(() => buildHostedLoginUrl(), []);

  return (
    <div className="min-h-[70vh] bg-gradient-to-b from-indigo-50 via-white to-white">
      <div className="mx-auto max-w-3xl px-4 pt-14 pb-20">
        {/* Hero */}
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 text-indigo-700 px-3 py-1 text-xs font-medium">
            🚗 Car Showroom <span className="hidden sm:inline">• Secure sign in</span>
          </span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight">Welcome back</h1>
          <p className="mt-3 text-gray-600">
            Sign in to manage bookings, update your profile, and—if you’re an admin—add cars.
          </p>
        </div>

        {/* Card */}
        <div className="mx-auto max-w-xl rounded-2xl bg-white shadow-xl ring-1 ring-black/[0.05] p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="hidden sm:block w-14 h-14 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2a6 6 0 1 0 4.472 10.03l3.249 3.248a1 1 0 0 1 .279.707V18a1 1 0 0 1-1 1h-1v1a1 1 0 0 1-1 1h-1v1a1 1 0 0 1-1 1h-2.586A2 2 0 0 1 12 21.586l-1.293-1.293 2.121-2.121.586.586H15v-1h1v-1h1v-.586l-3.248-3.249A6 6 0 0 0 14 2Zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">Sign in</h2>
              <p className="mt-1 text-sm text-gray-600">
                Use our embedded sign-in for a seamless experience, or the Cognito Hosted UI.
              </p>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                {/* Embedded modal sign-in (with Cancel/close) */}
                <Button className="w-full sm:w-auto" onClick={() => setOpen(true)}>
                  Sign in here (embedded)
                </Button>

                {/* Fallback to Hosted UI */}
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => (window.location.href = loginUrl)}
                >
                  Use Cognito Hosted UI
                </Button>

                {/* Guest */}
                <Link href="/cars" className="w-full sm:w-auto">
                  <Button variant="secondary" className="w-full sm:w-auto">
                    Continue as guest
                  </Button>
                </Link>
              </div>

              <div className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
                <p className="font-medium text-gray-800 mb-1">Tips</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Admins see “Add car” controls after sign in.</li>
                  <li>Guests can browse cars; booking requires sign in.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer line */}
        <p className="text-center text-sm text-gray-500 mt-10">
          By continuing you agree to our <span className="underline underline-offset-2">Terms</span> &{" "}
          <span className="underline underline-offset-2">Privacy Policy</span>.
        </p>
      </div>

      {/* Modal */}
      <LoginModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
