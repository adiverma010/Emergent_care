"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApp } from "../context/AppContext";

export default function HomePage() {
  const router = useRouter();
  const { profile, greetingData, speakText } = useApp();
  const [symptomInput, setSymptomInput] = useState("");

  const handleSubmitSymptom = (e: React.FormEvent) => {
    e.preventDefault();
    if (symptomInput.trim()) {
      const q = encodeURIComponent(symptomInput.trim());
      router.push(`/triage?q=${q}`);
    }
  };

  const handleQuickPrompt = (query: string) => {
    if (query.startsWith("/")) {
      router.push(query);
    } else {
      router.push(`/triage?q=${encodeURIComponent(query)}`);
    }
  };

  const isHindi = profile.language === "hi";
  const isHinglish = profile.language === "hinglish";

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      {/* Dynamic Greeting Hero Card */}
      <section className="mb-8 rounded-3xl border border-slate-200/90 bg-gradient-to-br from-teal-50 via-white to-emerald-50/50 p-6 sm:p-10 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-100/80 px-3 py-1 text-xs font-bold text-teal-800 mb-3">
              <span className="icon-symbol text-sm">waving_hand</span>
              <span>
                {isHindi ? "दैनिक स्वास्थ्य साथी" : isHinglish ? "Daily Health Sathi" : "Personal Health Navigator"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
              {greetingData?.greeting ||
                (isHindi
                  ? "नमस्ते, आज आप कैसा महसूस कर रहे हैं?"
                  : isHinglish
                  ? "Namaste, aaj kaisa feel ho raha hai?"
                  : "Welcome, how are you feeling today?")}
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
              {greetingData?.subtext ||
                (isHindi
                  ? "अपनी परेशानी बोलकर या लिखकर बताएं। हम आपको सही देखभाल, नर्स या डॉक्टर से जोड़ेंगे।"
                  : "Describe your symptoms by voice or text. We will safely route you to the right homecare, clinic, or emergency aid.")}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() =>
                speakText(
                  greetingData?.greeting
                    ? `${greetingData.greeting}. ${greetingData.subtext}`
                    : "Welcome to CareCompass Sathi."
                )
              }
              className="flex items-center gap-1.5 rounded-full border border-teal-200 bg-white px-4 py-2 text-xs font-bold text-teal-800 shadow-xs hover:bg-teal-50 transition"
              aria-label="Listen to greeting"
            >
              <span className="icon-symbol text-base">volume_up</span>
              <span>{isHindi ? "सुनिए" : "Listen"}</span>
            </button>
          </div>
        </div>

        {/* Primary Symptom Intake Box */}
        <form onSubmit={handleSubmitSymptom} className="mt-6">
          <div className="relative rounded-2xl border-2 border-teal-600/30 bg-white p-2 shadow-md transition-all focus-within:border-teal-600 focus-within:ring-4 focus-within:ring-teal-100">
            <label htmlFor="home-symptom-input" className="sr-only">
              Describe your health concern
            </label>
            <textarea
              id="home-symptom-input"
              value={symptomInput}
              onChange={(e) => setSymptomInput(e.target.value)}
              placeholder={
                isHindi
                  ? "अपनी समस्या यहाँ लिखें... (उदा: पापा को दो दिन से बुखार और सूखी खांसी है)"
                  : isHinglish
                  ? "Apni pareshani yahan likhein... (e.g., Mummy ko severe back pain hai, injection lagwana hai)"
                  : "Describe what's bothering you... (e.g., High fever and shivering since yesterday)"
              }
              rows={3}
              className="w-full resize-none rounded-xl p-3 text-sm sm:text-base font-medium text-slate-900 outline-none placeholder:text-slate-400"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-2 pt-2">
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <span className="icon-symbol text-base text-teal-600">mic</span>
                <span>
                  {isHindi
                    ? "नीचे 'बोलिए' बटन से भी बोल सकते हैं"
                    : isHinglish
                    ? "Bottom 'Boliye' button se voice use karein"
                    : "Or tap 'Boliye' below for voice input"}
                </span>
              </span>
              <button
                type="submit"
                disabled={!symptomInput.trim()}
                className="flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-teal-800 active:scale-95 disabled:opacity-50 transition touch-target"
              >
                <span>{isHindi ? "जांच शुरू करें" : isHinglish ? "Triage Shuru Karein" : "Analyze Symptoms"}</span>
                <span className="icon-symbol text-lg">arrow_forward</span>
              </button>
            </div>
          </div>
        </form>

        {/* Dynamic Quick Action Chips */}
        {greetingData?.quick_actions && greetingData.quick_actions.length > 0 && (
          <div className="mt-5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
              {isHindi ? "त्वरित सुझाव" : isHinglish ? "Quick Options" : "Suggested Actions"}
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {greetingData.quick_actions.map((qa, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickPrompt(qa.query)}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-left transition hover:border-teal-400 hover:shadow-sm"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                    <span className="icon-symbol text-xl">{qa.icon || "medical_services"}</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-snug">{qa.title}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{qa.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Main Core Pathways Grid */}
      <section className="mb-10">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
          <span className="icon-symbol text-teal-600">health_and_safety</span>
          <span>
            {isHindi ? "मुख्य स्वास्थ्य सेवाएं" : isHinglish ? "Core Health Services" : "Healthcare Services"}
          </span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pathway 1: Triage */}
          <Link
            href="/triage"
            className="group relative flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-xs transition hover:border-teal-500 hover:shadow-md"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 mb-4 group-hover:bg-teal-600 group-hover:text-white transition">
                <span className="icon-symbol text-2xl">stethoscope</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-teal-700 transition">
                {isHindi ? "लक्षण जांच एवं देखभाल" : isHinglish ? "Symptom Check & Triage" : "Symptom Care Routing"}
              </h3>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                {isHindi
                  ? "घर पर नर्स, पैरामेडिक या डॉक्टर की आवश्यकता का सटीक विश्लेषण और बुकिंग।"
                  : "Intelligent clinical routing matching you to verified nurses, paramedics, or video consults."}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-teal-700">
              <span>{isHindi ? "शुरू करें" : "Start Triage"}</span>
              <span className="icon-symbol text-sm group-hover:translate-x-1 transition">arrow_forward</span>
            </div>
          </Link>

          {/* Pathway 2: Prescriptions */}
          <Link
            href="/prescriptions"
            className="group relative flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-xs transition hover:border-teal-500 hover:shadow-md"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 mb-4 group-hover:bg-emerald-600 group-hover:text-white transition">
                <span className="icon-symbol text-2xl">prescriptions</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-teal-700 transition">
                {isHindi ? "दवा पर्ची व समय सारणी" : isHinglish ? "Prescriptions & Timetable" : "Prescription Timetable"}
              </h3>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                {isHindi
                  ? "पर्ची स्कैन करें, सरल भाषा में दवा समझें और समय पर दवा लेने के रिमाइंडर सेट करें।"
                  : "Upload a photo or text prescription. View daily morning, afternoon, and night timing."}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-emerald-700">
              <span>{isHindi ? "दवाइयां देखें" : "View Schedule"}</span>
              <span className="icon-symbol text-sm group-hover:translate-x-1 transition">arrow_forward</span>
            </div>
          </Link>

          {/* Pathway 3: Emergency */}
          <Link
            href="/emergency"
            className="group relative flex flex-col justify-between rounded-3xl border border-rose-200 bg-rose-50/50 p-6 shadow-xs transition hover:border-rose-400 hover:shadow-md"
          >
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-700 mb-4 group-hover:bg-rose-600 group-hover:text-white transition">
                <span className="icon-symbol text-2xl">e911_emergency</span>
              </div>
              <h3 className="text-base font-bold text-rose-950 group-hover:text-rose-700 transition">
                {isHindi ? "आपातकालीन 112 सहायता" : isHinglish ? "Emergency 112 & Ambulance" : "112 Emergency Dispatch"}
              </h3>
              <p className="mt-1.5 text-xs text-rose-800/80 leading-relaxed">
                {isHindi
                  ? "सीने में दर्द, सांस की तकलीफ या गंभीर चोट पर तुरंत एम्बुलेंस ट्रैकिंग और अस्पताल सहायता।"
                  : "Instant 112 dialer, live ambulance dispatch timeline, audio first-aid steps, and hospital ICU beds."}
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-bold text-rose-700">
              <span>{isHindi ? "आपातकालीन केंद्र" : "Emergency Center"}</span>
              <span className="icon-symbol text-sm group-hover:translate-x-1 transition">arrow_forward</span>
            </div>
          </Link>
        </div>
      </section>

      {/* Safety & Non-Diagnosis Disclaimer */}
      <footer className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
        <p className="text-xs text-slate-500 leading-relaxed max-w-3xl mx-auto">
          <strong className="font-semibold text-slate-700">Safety Notice:</strong> CareCompass Sathi provides AI-assisted healthcare navigation and triage routing. It is not a clinical diagnosis engine. In case of acute emergencies, unconsciousness, or severe bleeding, please call 112 immediately.
        </p>
      </footer>
    </div>
  );
}
