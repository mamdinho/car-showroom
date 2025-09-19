"use client";

import { useEffect, useState } from "react";
import { loadSession, subscribe } from "./session";
import { useRouter } from "next/navigation";

function loadSafe() {
  try { return loadSession(); } catch { return null; }
}

export function useSession() {
  const [session, setSession] = useState(loadSafe());

  useEffect(() => {
    const un = subscribe(() => setSession(loadSafe()));
    return () => { un(); };
  }, []);

  return session;
}

/** Redirects to /login if no session */
export function useRequireAuth() {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (!session) {
      router.replace("/login");
    }
  }, [session, router]);

  return session;
}
