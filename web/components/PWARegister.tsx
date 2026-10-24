"use client";

import React, { useEffect, useState } from "react";

export function PWARegister() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Register Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("CareCompass SW registered:", reg.scope);
          })
          .catch((err) => {
            console.warn("CareCompass SW registration failed:", err);
          });
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
      className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-24 z-30 max-w-sm rounded-2xl border border-teal-200 bg-white p-4 shadow-xl animate-in slide-in-from-bottom"
      aria-label="Install App"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white">
          <span className="icon-symbol text-2xl">install_mobile</span>
        </div>
        <div className="flex-1">
          <strong className="text-xs font-bold text-slate-900 block">Install CareCompass Sathi</strong>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Add to home screen for faster voice triage and 112 emergency SOS access even offline.
          </p>
          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-teal-800"
            >
              Install App
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
