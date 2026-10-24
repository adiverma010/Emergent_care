"use client";
import React, { useEffect, useState } from "react";

export function PWARegister() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
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
      setInstallPrompt(e);
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
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setInstallPrompt(null);
  };

  if (!installPrompt || isInstalled || dismissed) {
    return null;
  }

  return (
    <aside
      className="fixed bottom-24 left-4 right-4 sm:left-auto sm:right-6 z-30 max-w-sm rounded-3xl border border-primary/20 bg-white p-4 shadow-xl"
      aria-label="Install App"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl text-white">
          📲
        </div>
        <div className="flex-1">
          <strong className="text-sm font-bold text-ink block">Install CareCompass Sathi</strong>
          <p className="text-xs text-muted mt-0.5">
            Add to home screen for faster voice triage and emergency SOS access.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={handleInstallClick}
              className="min-h-[48px] rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90 focus-visible:outline-3 focus-visible:outline-primary"
            >
              Install App / इनस्टॉल
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="min-h-[48px] px-3 py-2 text-xs font-semibold text-muted hover:text-ink focus-visible:outline-3 focus-visible:outline-primary"
            >
              Later
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
