import React from "react";

export function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl bg-white shadow-card border border-gray-100">{children}</div>;
}

export function CardBody({ children, className="" }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
