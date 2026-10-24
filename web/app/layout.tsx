import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SettingsProvider } from "@/lib/settings";
import { SharedShell } from "@/components/SharedShell";

export const metadata: Metadata = {
  title: "CareCompass Sathi",
  description: "Care navigation and caregiver matching",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#cce5ff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SettingsProvider>
          {children}
          <SharedShell />
        </SettingsProvider>
      </body>
    </html>
  );
}
