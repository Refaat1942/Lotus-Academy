import type { Metadata, Viewport } from "next";
import { getBrand } from "@/lib/brand";
import "./globals.css";
import { getT } from "@/i18n";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { PwaRegister } from "@/components/PwaRegister";

export const viewport: Viewport = { themeColor: "#0e5e57", width: "device-width", initialScale: 1 };

export async function generateMetadata(): Promise<Metadata> {
  const brand = await getBrand();
  return { ...baseMetadata, icons: { icon: brand.favicon ? `/api/brand/favicon?v=${brand.favicon}` : brand.logo ? `/api/brand/logo?v=${brand.logo}` : "/favicon.svg", apple: "/api/app-icon/apple" } };
}

const baseMetadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:15169"),
  title: { default: "Lotus Academy — Pharmacy Education & Professional Development", template: "%s | Lotus Academy" },
  description: "Evidence-based professional courses for pharmacists, with progress tracking and verifiable certificates.",
  appleWebApp: { capable: true, title: "Lotus Academy", statusBarStyle: "default" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir } = await getT();
  return (
    <html lang={locale} dir={dir}>
      <body className="flex min-h-screen flex-col">
        <Header />
        <main id="main" className="flex-1">{children}</main>
        <Footer />
        <PwaRegister />
      </body>
    </html>
  );
}
