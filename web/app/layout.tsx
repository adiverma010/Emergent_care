import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SettingsProvider } from "@/lib/settings";
import { SharedShell } from "@/components/SharedShell";
import { PWARegister } from "@/components/PWARegister";

export const metadata: Metadata = {
  title: "CareCompass Sathi",
  description: "Care navigation and caregiver matching",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#cce5ff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SettingsProvider>
          {children}
          <SharedShell />
          <PWARegister />
        </SettingsProvider>
      </body>
    </html>
  );
}
