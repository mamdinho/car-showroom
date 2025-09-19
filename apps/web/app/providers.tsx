"use client";
import "@/lib/amplify"; // side-effect import configures Amplify once
import { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
