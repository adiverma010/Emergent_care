"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSettings } from "@/lib/settings";
import type { Lang } from "@/lib/api";

const LANGS: { id: Lang; label: string }[] = [
  { id: "hindi", label: "हिंदी" },
  { id: "english", label: "English" },
  { id: "hinglish", label: "Hinglish" },
];
const CONDITIONS = ["Diabetes", "BP", "Asthma", "Heart", "Thyroid", "Kidney"];

export default function Onboarding() {
  const router = useRouter();
  const { profile, update } = useSettings();
  const [name, setName] = useState(profile.name);
  const [nameError, setNameError] = useState("");
  const [age, setAge] = useState(String(profile.age));
  const [language, setLanguage] = useState<Lang>(profile.language);
  const [allergies, setAllergies] = useState(profile.allergies.join(", "));
  const [history, setHistory] = useState<string[]>(profile.history);

  const toggle = (c: string) =>
    setHistory((h) => (h.includes(c) ? h.filter((x) => x !== c) : [...h, c]));

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(
        language === "hindi"
          ? "कृपया अपना नाम दर्ज करें"
          : language === "hinglish"
          ? "Kripya apna naam enter karein"
          : "Please enter your name"
      );
      return;
    }

    update({
      name: trimmed,
      age: Math.max(1, Math.min(110, parseInt(age) || 30)),
      language,
      allergies: allergies.split(",").map((s) => s.trim()).filter(Boolean),
      history,
      onboarded: true,
    });
    router.push("/");
  };

  return (
    <main className="mx-auto max-w-xl p-4 space-y-4">
      <h1 className="text-3xl font-bold text-primary">Namaste! Welcome to CareCompass Sathi</h1>
      <p className="text-muted">आपकी सेहत का साथी. Tell us a little so we can help safely.</p>

      <section className="rounded-3xl bg-white p-4 shadow-sm space-y-2">
        <h2 className="font-semibold">Language / भाषा</h2>
        <div className="flex gap-2">
          {LANGS.map((l) => (
            <button
              key={l.id}
              onClick={() => setLanguage(l.id)}
              className={`flex-1 rounded-2xl py-3 font-semibold ${
                language === l.id ? "bg-primary text-white" : "bg-primary-soft text-primary"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-sm space-y-2">
        <h2 className="font-semibold">Name &amp; age / नाम और उम्र</h2>
        <div>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError("");
            }}
            placeholder="Your name *"
            aria-required="true"
            aria-invalid={!!nameError}
            className={`w-full rounded-2xl bg-beige/50 px-4 py-3 ${
              nameError ? "border-2 border-danger" : ""
            }`}
          />
          {nameError && (
            <p className="mt-1 text-sm font-bold text-danger" role="alert">
              ⚠️ {nameError}
            </p>
          )}
        </div>
        <input
          value={age}
          onChange={(e) => setAge(e.target.value)}
          inputMode="numeric"
          placeholder="Age"
          className="w-full rounded-2xl bg-beige/50 px-4 py-3"
        />
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-sm space-y-2">
        <h2 className="font-semibold">Medical history / बीमारी का इतिहास</h2>
        <div className="flex flex-wrap gap-2">
          {CONDITIONS.map((c) => (
            <button
              key={c}
              onClick={() => toggle(c)}
              className={`rounded-full px-4 py-2 font-semibold ${
                history.includes(c) ? "bg-ok text-white" : "bg-beige text-muted"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <h2 className="font-semibold pt-2">Allergies to medicine / दवा से एलर्जी</h2>
        <input
          value={allergies}
          onChange={(e) => setAllergies(e.target.value)}
          placeholder="e.g. Penicillin, Sulfa (or leave empty)"
          className="w-full rounded-2xl bg-beige/50 px-4 py-3"
        />
      </section>

      <label className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-sm">
        <input
          type="checkbox"
          className="h-6 w-6"
          checked={profile.elderMode}
          onChange={(e) => update({ elderMode: e.target.checked })}
        />
        <span className="font-semibold">Elder mode: bigger text / बड़े अक्षर</span>
      </label>

      <button
        onClick={save}
        className="w-full rounded-full bg-primary py-4 text-xl font-bold text-white shadow-md hover:bg-primary/95 transition"
      >
        Continue / आगे बढ़ें
      </button>
    </main>
  );
}
