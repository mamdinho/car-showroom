"use client";

import { useEffect } from "react";
import { signOut } from "aws-amplify/auth";
import { clearSession } from "@/lib/session";

const DOMAIN = (process.env.NEXT_PUBLIC_COGNITO_DOMAIN || "").replace(/\/+$/, "");
const CLIENT_ID = process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID!;
const LOGOUT_REDIRECT = process.env.NEXT_PUBLIC_LOGOUT_REDIRECT_URI || "http://localhost:3000/";

export default function LogoutPage() {
  useEffect(() => {
    (async () => {
      try {
        // clear our app tokens
        clearSession();
        // try Amplify signOut (no-op if not signed in via Amplify)
        await signOut({ global: true }).catch(() => {});
      } finally {
        // redirect to Cognito Hosted UI logout to clear Cognito cookies
        const url = new URL(`${DOMAIN}/logout`);
        url.searchParams.set("client_id", CLIENT_ID);
        url.searchParams.set("logout_uri", LOGOUT_REDIRECT);
        window.location.href = url.toString();
      }
    })();
  }, []);
  return <div className="p-6">Signing you out…</div>;
}
