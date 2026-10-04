import type { Metadata } from "next";
import "./globals.css";
import { getT } from "@/i18n";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:15169"),
  title: { default: "Lotus Academy — Pharmacy Education & Professional Development", template: "%s | Lotus Academy" },
  description: "Evidence-based professional courses for pharmacists, with progress tracking and verifiable certificates.",
  icons: { icon: "/favicon.svg" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir } = await getT();
  return (
    <html lang={locale} dir={dir}>
      <body className="flex min-h-screen flex-col">
        <Header />
        <main id="main" className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
