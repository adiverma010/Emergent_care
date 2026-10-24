"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Lang } from "./api";

export type Profile = {
  name: string;
  age: number;
  language: Lang;
  allergies: string[];
  history: string[];
  elderMode: boolean;
  onboarded: boolean;
};

const DEFAULT: Profile = {
  name: "", age: 30, language: "hinglish",
  allergies: [], history: [], elderMode: false, onboarded: false,
};
const KEY = "sathi_profile_v1";

type Ctx = { profile: Profile; ready: boolean; update: (p: Partial<Profile>) => void };
const SettingsCtx = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(DEFAULT);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setProfile({ ...DEFAULT, ...JSON.parse(raw) });
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--text-scale", profile.elderMode ? "1.3" : "1");
  }, [profile.elderMode]);

  const update = (p: Partial<Profile>) =>
    setProfile((prev) => {
      const next = { ...prev, ...p };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });

  return <SettingsCtx.Provider value={{ profile, ready, update }}>{children}</SettingsCtx.Provider>;
}

export function useSettings() {
  const c = useContext(SettingsCtx);
  if (!c) throw new Error("SettingsProvider missing");
  return c;
}