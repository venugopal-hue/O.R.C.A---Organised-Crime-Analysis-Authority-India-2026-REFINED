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
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="shortcut icon" href="/logo.png" type="image/png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link id="leaflet-css-cdn" rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script id="leaflet-js-cdn" src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" defer></script>
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
