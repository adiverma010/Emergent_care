"use client";

import React, { useState } from "react";
import { useApp } from "../../context/AppContext";
import { AppLanguage } from "../../lib/types";
import { InitialsAvatar } from "../../components/InitialsAvatar";

export default function ProfilePage() {
  const { profile, updateProfile, resetProfile, greetingData } = useApp();

  const [name, setName] = useState(profile.name || "");
  const [age, setAge] = useState<string>(profile.age ? profile.age.toString() : "");
  const [language, setLanguage] = useState<AppLanguage>(profile.language || "hinglish");
  const [allergyInput, setAllergyInput] = useState("");
  const [allergies, setAllergies] = useState<string[]>(profile.allergies || []);
  const [historyInput, setHistoryInput] = useState("");
  const [history, setHistory] = useState<string[]>(profile.history || []);
  const [elderMode, setElderMode] = useState<boolean>(profile.elderMode || false);
  const [autoRead, setAutoRead] = useState<boolean>(profile.autoRead || false);
  const [savedSuccess, setSavedSuccess] = useState(false);

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

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAge = age ? parseInt(age, 10) : null;
    updateProfile({
      name: name.trim(),
      age: isNaN(parsedAge as number) ? null : parsedAge,
      language,
      allergies,
      history,
      elderMode,
      autoRead,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Top Banner Card with Initials Avatar */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          <InitialsAvatar name={profile.name || "Sathi User"} size="xl" />
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl font-extrabold text-slate-900">{profile.name || "Guest Patient"}</h1>
              {profile.age && (
                <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-bold text-slate-700">
                  {profile.age} yrs
                </span>
              )}
              {profile.elderMode && (
                <span className="rounded-full bg-amber-100 px-3 py-0.5 text-xs font-bold text-amber-800">
                  Elder Mode Active
                </span>
              )}
            </div>
            <p className="mt-1 text-sm font-medium text-teal-800">
              {greetingData?.greeting || "Namaste, Welcome to CareCompass Sathi"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Language: {profile.language.toUpperCase()} • {allergies.length} Allergies • {history.length} Medical Conditions
            </p>
          </div>
        </div>
      </div>

      {/* Profile Edit Form */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <span className="icon-symbol text-teal-600">manage_accounts</span>
          <span>Edit Health Profile</span>
        </h2>

        {savedSuccess && (
          <div className="mb-6 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-800 text-sm font-bold flex items-center gap-2">
            <span className="icon-symbol text-emerald-600">check_circle</span>
            <span>Profile successfully updated! Changes saved to local storage.</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm font-medium text-slate-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">Age</label>
              <input
                type="number"
                min={1}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm font-medium text-slate-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none"
              />
            </div>
          </div>

          {/* Language Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">Primary App Language</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { code: "en" as AppLanguage, label: "English" },
                { code: "hi" as AppLanguage, label: "हिंदी (Hindi)" },
                { code: "hinglish" as AppLanguage, label: "Hinglish" },
              ].map((l) => (
                <button
                  type="button"
                  key={l.code}
                  onClick={() => setLanguage(l.code)}
                  className={`rounded-xl border p-2.5 text-xs font-bold transition ${
                    language === l.code
                      ? "border-teal-600 bg-teal-50 text-teal-800 ring-2 ring-teal-500/20"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>

          {/* Accessibility Settings */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Accessibility Preferences</h3>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-bold text-slate-900 block">Elder Mode</span>
                <span className="text-xs text-slate-500">Larger text font scale, maximum contrast, high-visibility buttons</span>
              </div>
              <input
                type="checkbox"
                checked={elderMode}
                onChange={(e) => setElderMode(e.target.checked)}
                className="h-5 w-5 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
              />
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-3">
              <div>
                <span className="text-sm font-bold text-slate-900 block">Auto-Read Answers (Voice Readout)</span>
                <span className="text-xs text-slate-500">Automatically read clinical reasoning & first aid steps aloud</span>
              </div>
              <input
                type="checkbox"
                checked={autoRead}
                onChange={(e) => setAutoRead(e.target.checked)}
                className="h-5 w-5 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Allergies */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Known Allergies</label>
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
                placeholder="Add new allergy"
                className="flex-1 rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
              <button
                type="button"
                onClick={() => addAllergy(allergyInput)}
                className="rounded-xl bg-slate-100 px-4 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                + Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {allergies.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-800"
                >
                  <span>{a}</span>
                  <button
                    type="button"
                    onClick={() => removeAllergy(a)}
                    className="text-rose-500 hover:text-rose-800 font-bold"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Medical History */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">Medical History & Conditions</label>
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
                placeholder="Add condition, e.g. Hypertension"
                className="flex-1 rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              />
              <button
                type="button"
                onClick={() => addHistory(historyInput)}
                className="rounded-xl bg-slate-100 px-4 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                + Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {history.map((h) => (
                <span
                  key={h}
                  className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-semibold text-teal-800"
                >
                  <span>{h}</span>
                  <button
                    type="button"
                    onClick={() => removeHistory(h)}
                    className="text-teal-600 hover:text-teal-900 font-bold"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Save & Reset Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={resetProfile}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800 underline"
            >
              Reset Data & Onboard Again
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto rounded-xl bg-teal-700 px-8 py-3 text-xs font-extrabold text-white shadow-md hover:bg-teal-800 transition touch-target"
            >
              Save Profile Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
