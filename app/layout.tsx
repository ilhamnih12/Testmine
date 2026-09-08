import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Luanti Web — Main Luanti (Minetest) di Browser",
  description:
    "Luanti (Minetest) asli — engine voxel C++ yang dikompilasi ke WebAssembly — berjalan 100% di browser. Singleplayer, world tersimpan di browser, tanpa backend. Dioptimalkan untuk mobile.",
  applicationName: "Luanti Web",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Luanti",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b0e12",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
