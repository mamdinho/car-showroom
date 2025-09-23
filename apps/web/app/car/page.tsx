"use client";

import { Suspense } from "react";
import CarPageInner from "./page.inner";

export default function CarPage() {
  // Keep this file minimal and wrap the inner component with Suspense
  return (
    <Suspense fallback={<div className="p-6">Loading…</div>}>
      <CarPageInner />
    </Suspense>
  );
}
