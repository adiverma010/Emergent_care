"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "../../context/AppContext";
import { AppLanguage } from "../../lib/types";

export default function OnboardingPage() {
  const router = useRouter();
  const { profile, updateProfile, speakText } = useApp();

  const [name, setName] = useState(profile.name || "");
  const [age, setAge] = useState<string>(profile.age ? profile.age.toString() : "");
  const [language, setLanguage] = useState<AppLanguage>(profile.language || "hinglish");
  const [allergyInput, setAllergyInput] = useState("");
  const [allergies, setAllergies] = useState<string[]>(profile.allergies || []);
  const [historyInput, setHistoryInput] = useState("");
  const [history, setHistory] = useState<string[]>(profile.history || []);
  const [elderMode, setElderMode] = useState<boolean>(profile.elderMode || false);

  const commonAllergies = ["Penicillin", "Sulfa drugs", "Paracetamol", "Aspirin", "Ibuprofen", "Dust / Pollen"];
  const commonConditions = ["Hypertension (High BP)", "Type 2 Diabetes", "Asthma", "Heart Condition", "Thyroid", "Kidney Disease"];

  // Handle Age change and auto-suggest Elder Mode
  const handleAgeChange = (val: string) => {
    setAge(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 60 && !elderMode) {
      setElderMode(true);
    }
  };

  const addAllergy = (item: string) => {
    const trimmed = item.trim();
    if (trimmed && !allergies.includes(trimmed)) {
      setAllergies([...allergies, trimmed]);
    }
    setAllergyInput("");
  };

  const removeAllergy = (item: string) => {
    setAllergies(allergies.filter((a) => a !== item));
  };

  const addHistory = (item: string) => {
    const trimmed = item.trim();
    if (trimmed && !history.includes(trimmed)) {
      setHistory([...history, trimmed]);
    }
    setHistoryInput("");
  };

  const removeHistory = (item: string) => {
    setHistory(history.filter((h) => h !== item));
  };

  const handleComplete = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAge = age ? parseInt(age, 10) : null;

    updateProfile({
      name: name.trim(),
      age: isNaN(parsedAge as number) ? null : parsedAge,
      language,
      allergies,
      history,
      elderMode,
      autoRead: elderMode ? true : false,
      isOnboarded: true,
    });

    // Voice welcome
    const welcomeVoice =
      language === "hi"
        ? `नमस्ते ${name || "साथी"}, केयर कम्पास साथी में आपका स्वागत है।`
        : language === "hinglish"
        ? `Namaste ${name || "ji"}, CareCompass Sathi me aapka swagat hai.`
        : `Welcome to CareCompass Sathi, ${name || "friend"}. Your health navigator is ready.`;
    speakText(welcomeVoice);

    router.push("/");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-10 shadow-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-md ring-4 ring-teal-100 mb-3">
            <span className="icon-symbol text-3xl font-bold">medical_information</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            {language === "hi"
              ? "केयर कम्पास साथी में आपका स्वागत है"
              : language === "hinglish"
              ? "CareCompass Sathi me Swagat Hai"
              : "Welcome to CareCompass Sathi"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {language === "hi"
              ? "कृपया अपनी बुनियादी स्वास्थ्य जानकारी साझा करें ताकि हम आपको सुरक्षित और सटीक सहायता दे सकें।"
              : language === "hinglish"
              ? "Apni basic health details batayein taaki sahi doctor, nurse aur safe advice mil sake."
              : "Please tell us a little about yourself for safer clinical triage and personalized guidance."}
          </p>
        </div>

        <form onSubmit={handleComplete} className="space-y-6">
          {/* Preferred Language */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Preferred Language / आपकी पसंदीदा भाषा
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { code: "en" as AppLanguage, title: "English", desc: "Clear & simple English" },
                { code: "hi" as AppLanguage, title: "हिंदी", desc: "शुद्ध हिंदी भाषा" },
                { code: "hinglish" as AppLanguage, title: "Hinglish", desc: "Everyday Hindi + English" },
              ].map((item) => (
                <button
                  type="button"
                  key={item.code}
                  onClick={() => setLanguage(item.code)}
                  className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition ${
                    language === item.code
                      ? "border-teal-600 bg-teal-50 text-teal-900 ring-2 ring-teal-500/20 font-bold"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                  aria-pressed={language === item.code}
                >
                  <span className="text-sm font-bold">{item.title}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name & Age */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="user-name" className="block text-xs font-bold text-slate-800 mb-1">
                Full Name / आपका नाम <span className="text-rose-500">*</span>
              </label>
              <input
                id="user-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ramesh Verma / शर्मा जी"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                aria-label="Full Name"
              />
            </div>
            <div>
              <label htmlFor="user-age" className="block text-xs font-bold text-slate-800 mb-1">
                Age / आयु <span className="text-rose-500">*</span>
              </label>
              <input
                id="user-age"
                type="number"
                required
                min={1}
                max={120}
                value={age}
                onChange={(e) => handleAgeChange(e.target.value)}
                placeholder="e.g. 64"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                aria-label="Age in years"
              />
            </div>
          </div>

          {/* Elder Mode Card */}
          <div
            className={`flex items-start gap-3 rounded-2xl border p-4 transition ${
              elderMode
                ? "border-amber-400 bg-amber-50/80 ring-2 ring-amber-300/40"
                : "border-slate-200 bg-slate-50/60"
            }`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <span className="icon-symbol text-2xl">elderly</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">
                  Elder Mode (वरिष्ठ नागरिक सुविधा)
                </span>
                <input
                  type="checkbox"
                  id="elder-mode-toggle"
                  checked={elderMode}
                  onChange={(e) => setElderMode(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  aria-label="Toggle Elder Mode"
                />
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Larger fonts, higher contrast, big touch targets, and automatic voice readout for easier reading.
              </p>
            </div>
          </div>

          {/* Known Allergies */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Known Allergies / किसी दवा या चीज़ से एलर्जी
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={allergyInput}
                onChange={(e) => setAllergyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAllergy(allergyInput);
                  }
                }}
                placeholder="Type and press Enter, e.g. Penicillin"
                className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
              <button
                type="button"
                onClick={() => addAllergy(allergyInput)}
                className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                + Add
              </button>
            </div>

            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {commonAllergies.map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => addAllergy(item)}
                  className="rounded-full border border-dashed border-slate-300 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:border-teal-600 hover:text-teal-700"
                >
                  + {item}
                </button>
              ))}
            </div>

            {/* Selected badges */}
            {allergies.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-100/70 border border-slate-200">
                {allergies.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => removeAllergy(item)}
                      className="text-rose-600 hover:text-rose-900"
                      aria-label={`Remove allergy ${item}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Medical History */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Medical History / Chronic Conditions / पुरानी बीमारियां
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={historyInput}
                onChange={(e) => setHistoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addHistory(historyInput);
                  }
                }}
                placeholder="e.g. Hypertension, Diabetes, Thyroid"
                className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
              <button
                type="button"
                onClick={() => addHistory(historyInput)}
                className="rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                + Add
              </button>
            </div>

            {/* Quick chips */}
            <div className="flex flex-wrap gap-1.5 mb-2">
              {commonConditions.map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => addHistory(item)}
                  className="rounded-full border border-dashed border-slate-300 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:border-teal-600 hover:text-teal-700"
                >
                  + {item}
                </button>
              ))}
            </div>

            {/* Selected badges */}
            {history.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-100/70 border border-slate-200">
                {history.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => removeHistory(item)}
                      className="text-teal-600 hover:text-teal-900"
                      aria-label={`Remove history ${item}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Submit CTA */}
          <div className="pt-4">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 py-3.5 px-6 text-sm font-extrabold text-white shadow-lg shadow-teal-700/20 transition hover:bg-teal-800 active:scale-[0.99] touch-target"
            >
              <span>
                {language === "hi"
                  ? "साथी के साथ आगे बढ़ें"
                  : language === "hinglish"
                  ? "Sathi ke sath Shuru Karein"
                  : "Save & Start Care Navigation"}
              </span>
              <span className="icon-symbol text-xl">arrow_forward</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
