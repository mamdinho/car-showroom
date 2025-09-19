import "./globals.css";
import "@/lib/amplify";
import Providers from "./providers"

export const metadata = { title: "Car Showroom" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">
        <Providers>
        <nav className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-200">
          <div className="mx-auto max-w-6xl px-4 py-3 flex gap-4 items-center">
            <a className="font-semibold" href="/">Car Showroom</a>
            <div className="ml-auto flex gap-4 text-sm">
              <a className="hover:underline" href="/cars">Cars</a>
              <a className="hover:underline" href="/bookings">Bookings</a>
              <a className="hover:underline" href="/profile">Profile</a>
              <a className="hover:underline" href="/login">Login</a>
              <a className="hover:underline" href="/logout">Logout</a>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-10 text-xs text-gray-500">
          © {new Date().getFullYear()} Car Showroom
        </footer>
        </Providers>
      </body>
    </html>
  );
}
