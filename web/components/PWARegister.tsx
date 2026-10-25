"use client";
import React, { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const PWA_DISMISSED_KEY = "sathi_pwa_dismissed";

export function PWARegister() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Check if dismissed previously
    try {
      const stored = localStorage.getItem(PWA_DISMISSED_KEY);
      if (stored !== "true") {
        setDismissed(false);
      }
    } catch {}

    // Register Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("CareCompass SW registered:", reg.scope);
        })
        .catch((err) => {
          console.warn("CareCompass SW registration failed:", err);
        });
    }

    // Capture beforeinstallprompt for PWA installation
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setInstallPrompt(null);
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(PWA_DISMISSED_KEY, "true");
    } catch {}
  };

  if (!installPrompt || isInstalled || dismissed) {
    return null;
  }

  return (
    <aside
      aria-label="Install App"
      className="fixed bottom-38 left-4 right-4 sm:left-auto sm:right-24 z-30 max-w-sm rounded-2xl border border-primary/20 bg-white/95 backdrop-blur-md p-3 shadow-lg"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-xl text-white">
          📲
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-ink truncate">Install CareCompass Sathi</p>
          <p className="text-[11px] text-muted truncate">Quick access to voice triage &amp; SOS</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="min-h-[40px] rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-primary"
          >
            Install
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="min-h-[40px] px-2 py-1.5 text-xs font-semibold text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
          >
            Later
          </button>
        </div>
      </div>
    </aside>
  );
}
