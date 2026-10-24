"use client";
import React, { useState } from "react";
import { useSettings } from "@/lib/settings";
import type { Lang } from "@/lib/api";
import { PROFILE_TEXT, pick } from "@/lib/text";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { ListenButton } from "@/components/ListenButton";

const CONDITIONS = [
  "Diabetes",
  "BP",
  "Asthma",
  "Heart",
  "Thyroid",
  "Kidney",
  "Arthritis",
  "None / कोई नहीं",
];

const LANGUAGES: { id: Lang; label: string; sub: string }[] = [
  { id: "hindi", label: "हिंदी", sub: "Hindi" },
  { id: "english", label: "English", sub: "अंग्रेज़ी" },
  { id: "hinglish", label: "Hinglish", sub: "मिक्स" },
];

export default function ProfilePage() {
  const { profile, update, clear } = useSettings();
  const lang = profile.language;

  // Form local state
  const [name, setName] = useState(profile.name);
  const [age, setAge] = useState(String(profile.age || ""));
  const [selectedLang, setSelectedLang] = useState<Lang>(profile.language);
  const [allergiesText, setAllergiesText] = useState(profile.allergies.join(", "));
  const [history, setHistory] = useState<string[]>(profile.history || []);
  const [elderMode, setElderMode] = useState(profile.elderMode);
  const [savedToast, setSavedToast] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Toggle medical history chip
  const toggleCondition = (cond: string) => {
    if (cond.includes("None")) {
      setHistory([]);
      return;
    }
    setHistory((prev) =>
      prev.includes(cond) ? prev.filter((c) => c !== cond) : [...prev.filter((c) => !c.includes("None")), cond]
    );
  };

  // Save changes
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAge = parseInt(age, 10);
    const validAge = isNaN(parsedAge) ? profile.age : Math.max(1, Math.min(120, parsedAge));
    const allergiesList = allergiesText
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);

    update({
      name: name.trim(),
      age: validAge,
      language: selectedLang,
      allergies: allergiesList,
      history,
      elderMode,
      onboarded: true,
    });

    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  // Clear data handler
  const handleClearData = () => {
    clear();
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    setName("");
    setAge("");
    setAllergiesText("");
    setHistory([]);
    setElderMode(false);
    setShowClearConfirm(false);
  };

  const profileSummary = `${profile.name || "User"}, age ${profile.age}. Language ${profile.language}. History: ${
    profile.history.join(", ") || "none"
  }. Allergies: ${profile.allergies.join(", ") || "none"}.`;

  return (
    <main className="min-h-screen bg-cream p-4 pb-32 text-ink">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Top Header Card */}
        <header className="rounded-3xl bg-white p-5 shadow-sm border border-beige flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <InitialsAvatar name={profile.name || "Sathi"} size="lg" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-ink">
                  {profile.name || (lang === "hindi" ? "मेरी प्रोफाइल" : "My Profile")}
                </h1>
                {profile.age > 0 && (
                  <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-bold text-primary">
                    {profile.age} {lang === "hindi" ? "वर्ष" : "yrs"}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted">
                {profile.history.length > 0
                  ? profile.history.join(" • ")
                  : lang === "hindi"
                  ? "कोई पूर्व बीमारी दर्ज नहीं"
                  : "No prior conditions recorded"}
              </p>
            </div>
          </div>
          <ListenButton text={profileSummary} />
        </header>

        {/* Honest Privacy Note */}
        <aside
          role="note"
          className="rounded-2xl bg-primary-soft/60 p-3.5 text-xs font-semibold text-primary border border-primary/20 flex items-center gap-2"
        >
          <span className="text-base" aria-hidden="true">
            🔒
          </span>
          <span>{pick(lang, PROFILE_TEXT.privacy_note)}</span>
        </aside>

        {/* Saved Toast */}
        {savedToast && (
          <div
            role="status"
            className="rounded-2xl bg-ok-soft border border-ok p-3 text-center text-sm font-bold text-ok"
          >
            ✓ {pick(lang, PROFILE_TEXT.saved_toast)}
          </div>
        )}

        {/* Edit Form */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* 1. Language Selection */}
          <section
            aria-label="Language selection"
            className="rounded-3xl bg-white p-5 shadow-sm space-y-3 border border-beige"
          >
            <h2 className="text-base font-bold text-ink">
              {pick(lang, PROFILE_TEXT.lang_label)}
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {LANGUAGES.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedLang(l.id)}
                  aria-pressed={selectedLang === l.id}
                  className={`flex min-h-[52px] flex-col items-center justify-center rounded-2xl py-2 font-bold transition focus-visible:outline-3 focus-visible:outline-primary ${
                    selectedLang === l.id
                      ? "bg-primary text-white shadow-sm"
                      : "bg-beige/40 text-muted hover:bg-beige/70"
                  }`}
                >
                  <span className="text-sm">{l.label}</span>
                  <span className="text-[10px] font-normal opacity-80">{l.sub}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 2. Name & Age */}
          <section
            aria-label="Personal Details"
            className="rounded-3xl bg-white p-5 shadow-sm space-y-3 border border-beige"
          >
            <div>
              <label htmlFor="profile-name" className="block text-xs font-bold text-ink mb-1">
                {pick(lang, PROFILE_TEXT.name_label)}
              </label>
              <input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full min-h-[48px] rounded-2xl bg-beige/40 px-4 py-3 text-base focus-visible:outline-3 focus-visible:outline-primary"
              />
            </div>

            <div>
              <label htmlFor="profile-age" className="block text-xs font-bold text-ink mb-1">
                {pick(lang, PROFILE_TEXT.age_label)}
              </label>
              <input
                id="profile-age"
                type="number"
                inputMode="numeric"
                min="1"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Age in years"
                className="w-full min-h-[48px] rounded-2xl bg-beige/40 px-4 py-3 text-base focus-visible:outline-3 focus-visible:outline-primary"
              />
            </div>
          </section>

          {/* 3. Medical History & Allergies */}
          <section
            aria-label="Health Information"
            className="rounded-3xl bg-white p-5 shadow-sm space-y-4 border border-beige"
          >
            <div>
              <p className="text-xs font-bold text-ink mb-2">
                {pick(lang, PROFILE_TEXT.history_label)}
              </p>
              <div className="flex flex-wrap gap-2">
                {CONDITIONS.map((c) => {
                  const active = history.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCondition(c)}
                      aria-pressed={active}
                      className={`min-h-[48px] rounded-full px-4 py-2 text-xs font-bold transition focus-visible:outline-3 focus-visible:outline-primary ${
                        active
                          ? "bg-ok text-white shadow-xs"
                          : "bg-beige/50 text-muted hover:bg-beige"
                      }`}
                    >
                      {active ? "✓ " : ""}{c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2">
              <label htmlFor="profile-allergies" className="block text-xs font-bold text-ink mb-1">
                {pick(lang, PROFILE_TEXT.allergies_label)}
              </label>
              <input
                id="profile-allergies"
                value={allergiesText}
                onChange={(e) => setAllergiesText(e.target.value)}
                placeholder={pick(lang, PROFILE_TEXT.allergies_placeholder)}
                className="w-full min-h-[48px] rounded-2xl bg-beige/40 px-4 py-3 text-base focus-visible:outline-3 focus-visible:outline-primary"
              />
              <p className="text-[11px] text-muted mt-1">
                Separate with commas (e.g. Penicillin, Aspirin, Sulfa)
              </p>
            </div>
          </section>

          {/* 4. Elder Mode Toggle */}
          <section
            aria-label="Accessibility Settings"
            className="rounded-3xl bg-white p-5 shadow-sm border border-beige"
          >
            <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
              <div className="flex-1">
                <span className="block text-base font-bold text-ink">
                  {pick(lang, PROFILE_TEXT.elder_mode)}
                </span>
                <span className="block text-xs text-muted">
                  Scales all screen text up for comfortable reading
                </span>
              </div>
              <input
                type="checkbox"
                checked={elderMode}
                onChange={(e) => {
                  setElderMode(e.target.checked);
                  update({ elderMode: e.target.checked });
                }}
                className="h-7 w-7 accent-primary rounded cursor-pointer"
                aria-label={pick(lang, PROFILE_TEXT.elder_mode)}
              />
            </label>
          </section>

          {/* Primary Action Button */}
          <button
            type="submit"
            className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-primary py-3.5 text-lg font-bold text-white shadow-md hover:bg-primary/90 active:scale-98 transition focus-visible:outline-3 focus-visible:outline-primary"
          >
            {lang === "hindi" ? "सुरक्षित करें" : "Save Changes"}
          </button>
        </form>

        {/* Clear My Data Button */}
        <section aria-label="Data Reset" className="pt-2">
          {!showClearConfirm ? (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="flex min-h-[48px] w-full items-center justify-center rounded-2xl border border-danger/40 bg-white py-3 text-sm font-bold text-danger hover:bg-danger-soft/40 transition focus-visible:outline-3 focus-visible:outline-primary"
            >
              🗑️ {pick(lang, PROFILE_TEXT.clear_btn)}
            </button>
          ) : (
            <div className="rounded-3xl border-2 border-danger bg-danger-soft p-4 space-y-3">
              <p className="text-xs font-bold text-danger">
                {pick(lang, PROFILE_TEXT.clear_confirm)}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClearData}
                  className="flex-1 min-h-[48px] rounded-xl bg-danger py-2 text-xs font-bold text-white shadow-xs focus-visible:outline-3 focus-visible:outline-primary"
                >
                  Yes, Clear Everything
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 min-h-[48px] rounded-xl bg-white py-2 text-xs font-bold text-ink focus-visible:outline-3 focus-visible:outline-primary"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
