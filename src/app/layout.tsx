import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { IntelligenceProvider } from "@/context/IntelligenceContext";

export const metadata: Metadata = {
  title: "O.R.C.A — Organized Crime Analysis Authority",
  description: "Secure operational command center and intelligence auditing workspace for Karnataka State Crime Intelligence Portal.",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full w-full antialiased" suppressHydrationWarning>
      {/*
        Leaflet used to be loaded here from unpkg.com for EVERY route — the
        login screen, /support and /report-issue included, none of which show a
        map. The only two map screens no longer use it: the district map is now
        an inline SVG, and MapPicker draws OpenStreetMap raster tiles directly.
        A CDN script on every page load is a third-party request per visitor for
        a library nothing imports.
      */}
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="shortcut icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
      </head>
      {/* O.R.C.A body: #f8fafc off-white background, Inter font, navy text */}
      <body
        className="h-screen w-screen overflow-hidden flex flex-col"
        style={{
          fontFamily: "'Inter', sans-serif",
          color: "#1e293b",
          backgroundColor: "#f8fafc"
        }}
      >
        <AuthProvider>
          <IntelligenceProvider>
            {children}
          </IntelligenceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
