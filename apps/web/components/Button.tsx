import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
};

const styles: Record<NonNullable<Props["variant"]>, string> = {
  primary: "bg-blue-600 hover:bg-blue-700 text-white",
  secondary: "bg-white hover:bg-gray-50 text-gray-900 border border-gray-300",
  danger: "bg-rose-600 hover:bg-rose-700 text-white",
};

export function Button({ variant="primary", className="", ...props }: Props) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium shadow-sm ${styles[variant]} ${className}`}
    />
  );
}
