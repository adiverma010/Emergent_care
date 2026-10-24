"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AppLanguage, UserProfile, DynamicGreeting } from "../lib/types";
import { getGreeting } from "../lib/api";

const STORAGE_KEY = "carecompass_sathi_profile";

const DEFAULT_PROFILE: UserProfile = {
  name: "",
  age: null,
  gender: "",
  language: "hinglish",
  allergies: [],
  history: [],
  elderMode: false,
  autoRead: false,
  isOnboarded: false,
};

interface AppContextType {
  profile: UserProfile;
  updateProfile: (fields: Partial<UserProfile>) => void;
  setLanguage: (lang: AppLanguage) => void;
  setElderMode: (enabled: boolean) => void;
  setAutoRead: (enabled: boolean) => void;
  resetProfile: () => void;
  greetingData: DynamicGreeting | null;
  refreshGreeting: () => Promise<void>;
  // Text to Speech
  speakText: (text: string) => void;
  stopSpeaking: () => void;
  isSpeaking: boolean;
  activeSpeechText: string | null;
  // Hydration state
  isHydrated: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<UserProfile>(DEFAULT_PROFILE);
  const [isHydrated, setIsHydrated] = useState(false);
  const [greetingData, setGreetingData] = useState<DynamicGreeting | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeSpeechText, setActiveSpeechText] = useState<string | null>(null);

  const router = useRouter();
  const pathname = usePathname();

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setProfileState((prev) => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.warn("Failed to load profile from localStorage:", e);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Save to localStorage whenever profile changes
  const updateProfile = useCallback((fields: Partial<UserProfile>) => {
    setProfileState((prev) => {
      const updated = { ...prev, ...fields };
      // When elderMode is turned on, automatically turn autoRead on too per Rule 6
      if (fields.elderMode === true) {
        updated.autoRead = true;
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn("Failed to save profile to localStorage:", e);
      }
      return updated;
    });
  }, []);

  const setLanguage = useCallback((lang: AppLanguage) => {
    updateProfile({ language: lang });
  }, [updateProfile]);

  const setElderMode = useCallback((enabled: boolean) => {
    updateProfile({ elderMode: enabled });
  }, [updateProfile]);

  const setAutoRead = useCallback((enabled: boolean) => {
    updateProfile({ autoRead: enabled });
  }, [updateProfile]);

  const resetProfile = useCallback(() => {
    setProfileState(DEFAULT_PROFILE);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // ignore
    }
    router.push("/onboarding");
  }, [router]);

  // Synchronize dynamic greeting
  const refreshGreeting = useCallback(async () => {
    try {
      const res = await getGreeting(profile.age, profile.language, profile.name);
      setGreetingData(res);
    } catch (e) {
      console.warn("Greeting refresh error:", e);
    }
  }, [profile.age, profile.language, profile.name]);

  useEffect(() => {
    if (isHydrated) {
      refreshGreeting();
    }
  }, [isHydrated, profile.age, profile.language, profile.name, refreshGreeting]);

  // Toggle elder-mode HTML class
  useEffect(() => {
    if (typeof document !== "undefined") {
      if (profile.elderMode) {
        document.documentElement.classList.add("elder-mode");
      } else {
        document.documentElement.classList.remove("elder-mode");
      }
    }
  }, [profile.elderMode]);

  // First visit check: redirect to /onboarding if not onboarded
  useEffect(() => {
    if (isHydrated) {
      if (!profile.isOnboarded && pathname !== "/onboarding") {
        router.push("/onboarding");
      }
    }
  }, [isHydrated, profile.isOnboarded, pathname, router]);

  // Web Speech Synthesis (TTS)
  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setActiveSpeechText(null);
    }
  }, []);

  const speakText = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        console.warn("SpeechSynthesis not supported on this browser.");
        return;
      }

      window.speechSynthesis.cancel();

      if (!text || text.trim() === "") {
        setIsSpeaking(false);
        setActiveSpeechText(null);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      // Select appropriate language voice: hi-IN for Hindi or en-IN for Hinglish/English
      const targetLang = profile.language === "hi" ? "hi-IN" : "en-IN";
      utterance.lang = targetLang;

      // Rate slightly slower for elder mode
      utterance.rate = profile.elderMode ? 0.88 : 0.98;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const matchedVoice =
        voices.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase()) ||
        voices.find((v) => v.lang.startsWith(targetLang.slice(0, 2)));

      if (matchedVoice) {
        utterance.voice = matchedVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        setActiveSpeechText(text);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setActiveSpeechText(null);
      };

      utterance.onerror = (e) => {
        console.warn("Speech error:", e);
        setIsSpeaking(false);
        setActiveSpeechText(null);
      };

      window.speechSynthesis.speak(utterance);
    },
    [profile.language, profile.elderMode]
  );

  return (
    <AppContext.Provider
      value={{
        profile,
        updateProfile,
        setLanguage,
        setElderMode,
        setAutoRead,
        resetProfile,
        greetingData,
        refreshGreeting,
        speakText,
        stopSpeaking,
        isSpeaking,
        activeSpeechText,
        isHydrated,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
