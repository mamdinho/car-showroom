"use client";
import Link from "next/link";
import { Button } from "@/components/Button";

export default function HomePage() {
  return (
    <main className="min-h-[70vh] bg-gradient-to-b from-indigo-50 via-white to-white">
      <div className="mx-auto max-w-6xl px-4 pt-16 pb-24">
        {/* Hero */}
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-100 text-indigo-700 px-3 py-1 text-xs font-medium">
              🚗 Car Showroom • Cloud-native
            </span>
            <h1 className="mt-4 text-5xl font-extrabold tracking-tight">
              Find your next ride
            </h1>
            <p className="mt-4 text-gray-600 text-lg">
              Browse an ever-growing collection, book test drives, and manage your profile securely with AWS Cognito.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/cars"><Button>Browse cars</Button></Link>
              <Link href="/login"><Button variant="secondary">Sign in</Button></Link>
            </div>

            <div className="mt-6 text-sm text-gray-500">
              Serverless • DynamoDB • Lambda • API Gateway • CloudFront
            </div>
          </div>

          {/* Animation */}
          <div className="relative">
            <div className="h-64 md:h-72 rounded-3xl bg-white shadow-xl ring-1 ring-black/5 overflow-hidden relative">
              {/* Road */}
              <div className="absolute bottom-10 left-0 right-0 h-2 bg-gray-200" />
              <div className="absolute bottom-[38px] left-0 right-0 h-2 bg-gray-200" />

              {/* Moving stripes */}
              <div className="absolute bottom-[30px] left-0 right-0 h-0.5 overflow-hidden">
                <div className="animate-road flex gap-8">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className="w-10 h-0.5 bg-gray-400/60 rounded" />
                  ))}
                </div>
              </div>

              {/* Car */}
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 animate-car">
                <CarSVG className="w-[320px] h-auto drop-shadow-xl" />
              </div>

              {/* Clouds */}
              <div className="absolute inset-x-0 top-6 h-8 overflow-hidden">
                <div className="animate-clouds flex gap-10 opacity-70">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="w-16 h-6 bg-gray-100 rounded-full" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Styles */}
        <style jsx global>{`
          @keyframes road {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          @keyframes car {
            0%,100% { transform: translate(-50%, 0); }
            50% { transform: translate(-50%, -2px); }
          }
          @keyframes clouds {
            0% { transform: translateX(0); }
            100% { transform: translateX(-25%); }
          }
          .animate-road { width: 200%; animation: road 3s linear infinite; }
          .animate-car { animation: car 2.2s ease-in-out infinite; }
          .animate-clouds { width: 125%; animation: clouds 18s linear infinite; }
        `}</style>
      </div>
    </main>
  );
}

function CarSVG({ className = "" }: { className?: string }) {
  // simple stylized coupe
  return (
    <svg viewBox="0 0 300 120" className={className} aria-hidden>
      {/* body */}
      <rect x="30" y="50" width="220" height="28" rx="10" fill="#4f46e5" />
      <path d="M60 50 C90 20, 210 20, 240 50" fill="#4f46e5" />
      {/* windows */}
      <path d="M95 50 C120 30, 180 30, 205 50 L95 50 Z" fill="#e0e7ff" />
      {/* wheels */}
      <circle cx="95" cy="82" r="14" fill="#111827" />
      <circle cx="95" cy="82" r="6" fill="#9ca3af" />
      <circle cx="215" cy="82" r="14" fill="#111827" />
      <circle cx="215" cy="82" r="6" fill="#9ca3af" />
      {/* headlight */}
      <rect x="245" y="56" width="10" height="6" rx="2" fill="#fde68a" />
      {/* tail light */}
      <rect x="35" y="56" width="10" height="6" rx="2" fill="#fca5a5" />
    </svg>
  );
}
