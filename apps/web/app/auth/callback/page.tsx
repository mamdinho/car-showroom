"use client";
import { exchangeCodeForTokens } from "@/lib/auth";
import { saveSession } from "@/lib/session";
import { useEffect, useState } from "react";

export default function Callback() {
  const [msg, setMsg] = useState("Completing sign-in...");

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const expected = sessionStorage.getItem("oauth_state");
      const verifier = sessionStorage.getItem("pkce_verifier") || "";
      if (!code || !state || !expected || state !== expected || !verifier) {
        setMsg("Invalid OAuth state. Please try logging in again.");
        return;
      }
      try {
        const tokens = await exchangeCodeForTokens(code, verifier);
        saveSession(tokens);
        sessionStorage.removeItem("oauth_state");
        sessionStorage.removeItem("pkce_verifier");
        window.location.replace("/cars");
      } catch (e:any) {
        setMsg("Token exchange failed: " + e.message);
      }
    })();
  }, []);

  return <main><p>{msg}</p></main>;
}
