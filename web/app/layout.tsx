import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppProvider } from "../context/AppContext";
import { TopBar } from "../components/TopBar";
import { FloatingBar } from "../components/FloatingBar";
import { PWARegister } from "../components/PWARegister";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CareCompass Sathi | Multilingual Care Navigation",
  description:
    "Safety-first care navigation app with voice triage in Hindi, Hinglish, and English, caregiver matching, 112 emergency routing, and prescription timetable.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "CareCompass Sathi",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#0f766e",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} h-full antialiased`}>
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-teal-200 selection:text-teal-900">
        <AppProvider>
          <TopBar />
          <main className="flex-1 pb-28">{children}</main>
          <FloatingBar />
          <PWARegister />
        </AppProvider>
      </body>
    </html>
  );
}
