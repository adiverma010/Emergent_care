"use client";
import React, { useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings";
import {
  parsePrescription,
  scheduleReminders,
  type ParsedMedicine,
  type ScheduledMedicine,
} from "@/lib/api";
import { speak, stopSpeaking } from "@/lib/speech";
import { PRESCRIPTION_TEXT, pick } from "@/lib/text";
import { ListenButton } from "@/components/ListenButton";

const STORAGE_KEY_MEDS = "sathi_prescriptions_v1";

export default function PrescriptionsPage() {
  const { profile } = useSettings();
  const lang = profile.language;

  // Input states
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [prescriptionText, setPrescriptionText] = useState("");
  const [loading, setLoading] = useState(false);
  const [parseNote, setParseNote] = useState("");
  const [isManualFallback, setIsManualFallback] = useState(false);

  // Manual fallback form inputs
  const [manualName, setManualName] = useState("");
  const [manualDosage, setManualDosage] = useState("");
  const [manualMorning, setManualMorning] = useState(true);
  const [manualAfternoon, setManualAfternoon] = useState(false);
  const [manualNight, setManualNight] = useState(true);
  const [manualWithFood, setManualWithFood] = useState(true);

  // Parsed results & timetable
  const [medicines, setMedicines] = useState<ParsedMedicine[]>([]);
  const [timetable, setTimetable] = useState<ScheduledMedicine[]>([]);
  const [takenDoses, setTakenDoses] = useState<Record<string, boolean>>({});

  // Notification & reminder state
  const [notifPermission, setNotifPermission] = useState<string>("default");
  const [activeBanner, setActiveBanner] = useState<string | null>(null);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  // Today's date key for taken tracking
  const todayKey = "sathi_taken_" + new Date().toISOString().slice(0, 10);

  // Load saved state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MEDS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.medicines) setMedicines(parsed.medicines);
        if (parsed.timetable) setTimetable(parsed.timetable);
        if (parsed.parseNote) setParseNote(parsed.parseNote);
      }
      const savedTaken = localStorage.getItem(todayKey);
      if (savedTaken) {
        setTakenDoses(JSON.parse(savedTaken));
      }
    } catch {}

    if (typeof window !== "undefined" && "Notification" in window) {
      setNotifPermission(Notification.permission);
    }

    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, [todayKey]);

  // Request browser notification permission
  const requestNotificationPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotifPermission(perm);
        if (perm === "granted") {
          new Notification("CareCompass Sathi", {
            body: pick(lang, PRESCRIPTION_TEXT.notifications_enabled),
            icon: "/favicon.ico",
          });
        }
      } catch {}
    }
  };

  // Schedule timers for doses today
  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (timetable.length === 0) return;

    const now = new Date();

    timetable.forEach((item) => {
      item.times.forEach((t) => {
        const [h, m] = t.split(":").map(Number);
        const target = new Date();
        target.setHours(h, m, 0, 0);

        const diff = target.getTime() - now.getTime();
        // If due within the next 24 hours
        if (diff > 0 && diff < 24 * 60 * 60 * 1000) {
          const timerId = setTimeout(() => {
            const reminderMsg = `${pick(lang, PRESCRIPTION_TEXT.due_banner)}: ${item.medicine}`;
            setActiveBanner(reminderMsg);
            speak(reminderMsg, lang);

            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
              new Notification("CareCompass Sathi", {
                body: `${item.medicine} - ${item.with_food ? pick(lang, PRESCRIPTION_TEXT.after_food) : pick(lang, PRESCRIPTION_TEXT.before_food)}`,
                icon: "/favicon.ico",
              });
            }
          }, diff);
          timersRef.current.push(timerId);
        }
      });
    });

    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, [timetable, lang]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      const url = URL.createObjectURL(f);
      setFilePreview(url);
    }
  };

  // Parse Prescription Action
  const handleAnalyze = async () => {
    if (!file && !prescriptionText.trim()) return;
    setLoading(true);
    stopSpeaking();
    setIsManualFallback(false);

    try {
      const res = await parsePrescription({
        file: file || undefined,
        text: prescriptionText.trim() || undefined,
        language: lang,
      });

      if (res && res.medicines && res.medicines.length > 0) {
        setMedicines(res.medicines);
        setParseNote(res.note || "");

        // Call backend schedule
        try {
          const sched = await scheduleReminders(res.medicines);
          if (sched && sched.timetable) {
            setTimetable(sched.timetable);
            saveMeds(res.medicines, sched.timetable, res.note);
          }
        } catch {
          // Fallback schedule locally if backend schedule route fails
          const fallbackTable = generateLocalTimetable(res.medicines);
          setTimetable(fallbackTable);
          saveMeds(res.medicines, fallbackTable, res.note);
        }
      } else {
        // If OCR or parsing could not extract medicines
        setParseNote(res.note || "Could not read medicines.");
        setIsManualFallback(true);
      }
    } catch {
      // Backend route failed: enable manual fallback
      setParseNote("Could not reach prescription parser. Please add your medicine manually below.");
      setIsManualFallback(true);
    } finally {
      setLoading(false);
    }
  };

  // Save to localStorage
  const saveMeds = (meds: ParsedMedicine[], table: ScheduledMedicine[], note: string) => {
    try {
      localStorage.setItem(
        STORAGE_KEY_MEDS,
        JSON.stringify({ medicines: meds, timetable: table, parseNote: note })
      );
    } catch {}
  };

  // Fallback timetable generator if schedule endpoint fails
  const generateLocalTimetable = (meds: ParsedMedicine[]): ScheduledMedicine[] => {
    return meds.map((m) => {
      const f = (m.frequency || "").toUpperCase();
      let times = ["08:00"];
      if (f.includes("BD") || f.includes("TWICE")) times = ["08:00", "20:00"];
      else if (f.includes("TDS") || f.includes("THREE")) times = ["08:00", "14:00", "20:00"];
      else if (f.includes("QID") || f.includes("FOUR")) times = ["08:00", "12:00", "16:00", "20:00"];
      return {
        medicine: m.name,
        times,
        with_food: m.with_food,
        days: m.duration,
      };
    });
  };

  // Add medicine manually
  const handleAddManual = () => {
    if (!manualName.trim()) return;
    const times: string[] = [];
    if (manualMorning) times.push("08:00");
    if (manualAfternoon) times.push("14:00");
    if (manualNight) times.push("20:00");

    const newMed: ParsedMedicine = {
      name: manualName.trim(),
      dosage_as_written: manualDosage.trim() || "1 dose",
      frequency: times.length === 1 ? "OD" : times.length === 2 ? "BD" : "TDS",
      duration: "As prescribed",
      with_food: manualWithFood,
      food_note: manualWithFood ? "after food" : "before food",
      explanation: pick(lang, {
        en: "Take as prescribed with food instructions.",
        hi: "पर्चे के अनुसार भोजन के नियमों का पालन करते हुए लें।",
        hinglish: "Prescription ke hisaab se khane ke niyam follow karein.",
      }),
    };

    const newScheduled: ScheduledMedicine = {
      medicine: newMed.name,
      times,
      with_food: manualWithFood,
      days: "As prescribed",
    };

    const updatedMeds = [...medicines, newMed];
    const updatedTimetable = [...timetable, newScheduled];
    setMedicines(updatedMeds);
    setTimetable(updatedTimetable);
    saveMeds(updatedMeds, updatedTimetable, parseNote);

    setManualName("");
    setManualDosage("");
  };

  // Allergy check helper
  const hasAllergy = (medName: string): boolean => {
    if (!profile.allergies || profile.allergies.length === 0) return false;
    const nameLower = medName.toLowerCase();
    return profile.allergies.some((al) => {
      const a = al.toLowerCase().trim();
      return a.length > 2 && (nameLower.includes(a) || a.includes(nameLower));
    });
  };

  // Toggle "Taken" dose checkbox
  const toggleTaken = (doseId: string) => {
    setTakenDoses((prev) => {
      const next = { ...prev, [doseId]: !prev[doseId] };
      try {
        localStorage.setItem(todayKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Group timetable items into Morning, Afternoon, Night columns
  const morningDoses = timetable.filter((t) => t.times.some((tm) => parseInt(tm) < 12));
  const afternoonDoses = timetable.filter((t) => t.times.some((tm) => parseInt(tm) >= 12 && parseInt(tm) < 17));
  const nightDoses = timetable.filter((t) => t.times.some((tm) => parseInt(tm) >= 17));

  return (
    <main className="min-h-screen bg-cream p-4 pb-32 text-ink">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* In-app Reminder Alert Banner */}
        {activeBanner && (
          <aside
            role="alert"
            className="rounded-3xl border-2 border-ok bg-ok-soft p-4 shadow-lg flex items-center justify-between gap-3 animate-bounce"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden="true">
                ⏰
              </span>
              <p className="font-bold text-ok text-base sm:text-lg">{activeBanner}</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveBanner(null)}
              className="rounded-full bg-white px-3 py-1 text-xs font-bold text-ok shadow-xs"
            >
              OK
            </button>
          </aside>
        )}

        {/* Header */}
        <header className="rounded-3xl bg-primary-soft p-5">
          <h1 className="text-2xl sm:text-3xl font-black text-primary">
            {pick(lang, PRESCRIPTION_TEXT.title)}
          </h1>
          {lang !== "english" && (
            <p className="text-xs text-muted">Prescriptions &amp; Dose Reminders</p>
          )}
        </header>

        {/* 1. Upload or Paste Prescription Card */}
        <section
          aria-label="Upload Prescription"
          className="rounded-3xl bg-white p-5 shadow-sm space-y-4 border border-beige"
        >
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-ink">
              {pick(lang, PRESCRIPTION_TEXT.upload_title)}
            </h2>
            <p className="text-xs text-muted">
              {pick(lang, PRESCRIPTION_TEXT.upload_help)}
            </p>
          </div>

          {/* Camera / File Input */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <label
              htmlFor="presc-file-input"
              className="flex min-h-[48px] w-full sm:w-auto cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary-soft px-5 py-3 text-sm font-bold text-primary hover:bg-primary/20 transition focus-within:outline-3 focus-within:outline-primary"
            >
              <span aria-hidden="true" className="text-xl">
                📷
              </span>
              <span>{file ? file.name : "Choose Photo / कैमरा"}</span>
              <input
                id="presc-file-input"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="sr-only"
                aria-label="Upload prescription photo"
              />
            </label>
            {file && (
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setFilePreview(null);
                }}
                className="text-xs font-bold text-danger underline p-2"
              >
                Remove
              </button>
            )}
          </div>

          {filePreview && (
            <div className="overflow-hidden rounded-2xl border border-beige">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={filePreview}
                alt="Prescription preview"
                className="max-h-48 w-full object-cover"
              />
            </div>
          )}

          {/* Paste Text Area */}
          <div className="space-y-1.5 pt-2">
            <label htmlFor="presc-text" className="block text-sm font-bold text-ink">
              {pick(lang, PRESCRIPTION_TEXT.paste_title)}
            </label>
            <textarea
              id="presc-text"
              rows={3}
              value={prescriptionText}
              onChange={(e) => setPrescriptionText(e.target.value)}
              placeholder={pick(lang, PRESCRIPTION_TEXT.paste_placeholder)}
              className="w-full rounded-2xl bg-beige/40 p-4 text-sm focus-visible:outline-3 focus-visible:outline-primary"
            />
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={loading || (!file && !prescriptionText.trim())}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-lg font-bold text-white shadow-md hover:bg-primary/90 active:scale-98 transition disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-primary"
          >
            <span>{loading ? pick(lang, PRESCRIPTION_TEXT.parsing) : pick(lang, PRESCRIPTION_TEXT.parse_btn)}</span>
          </button>

          {parseNote && (
            <p className="text-xs text-muted bg-beige/30 p-2.5 rounded-xl font-medium">
              ℹ️ {parseNote}
            </p>
          )}
        </section>

        {/* 2. Medicine Cards */}
        {medicines.length > 0 && (
          <section aria-label="Prescribed Medicines" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-ink">
                {lang === "hindi" ? "दवाइयां" : "Medicines"} ({medicines.length})
              </h2>
              <span className="text-xs font-semibold text-muted">
                {pick(lang, PRESCRIPTION_TEXT.doctor_confirm_note)}
              </span>
            </div>

            <div className="space-y-3">
              {medicines.map((med, idx) => {
                const allergyAlert = hasAllergy(med.name);
                return (
                  <article
                    key={idx}
                    className={`rounded-3xl p-5 shadow-sm space-y-3 border ${
                      allergyAlert
                        ? "border-4 border-danger bg-danger-soft/60"
                        : "border-beige bg-white"
                    }`}
                  >
                    {/* Allergy Warning if matches profile */}
                    {allergyAlert && (
                      <div
                        role="alert"
                        className="rounded-2xl bg-danger p-3 text-white text-xs font-black flex items-center gap-2"
                      >
                        <span className="text-lg">⚠️</span>
                        <span>{pick(lang, PRESCRIPTION_TEXT.allergy_warning)}</span>
                      </div>
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-xl font-extrabold text-ink">{med.name}</h3>
                        <p className="text-sm font-bold text-primary mt-0.5">
                          {med.dosage_as_written}
                        </p>
                      </div>
                      <ListenButton
                        text={`${med.name}. ${med.dosage_as_written}. ${med.food_note || ""}. ${med.explanation}`}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs font-bold">
                      {med.frequency && (
                        <span className="rounded-full bg-primary-soft px-3 py-1 text-primary">
                          {med.frequency}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-3 py-1 ${
                          med.with_food
                            ? "bg-ok-soft text-ok"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {med.with_food
                          ? pick(lang, PRESCRIPTION_TEXT.after_food)
                          : pick(lang, PRESCRIPTION_TEXT.before_food)}
                      </span>
                      {med.duration && (
                        <span className="rounded-full bg-beige px-3 py-1 text-muted">
                          {med.duration}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-ink/80 pt-1 leading-relaxed">
                      {med.explanation}
                    </p>

                    <p className="text-xs text-muted italic">
                      * {pick(lang, PRESCRIPTION_TEXT.doctor_confirm_note)}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* 3. Daily Timing Chart (Morning, Afternoon, Night) */}
        {timetable.length > 0 && (
          <section
            aria-label="Daily Dose Timing Chart"
            className="rounded-3xl bg-white p-5 shadow-sm space-y-4 border border-beige"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-ink">
                  {pick(lang, PRESCRIPTION_TEXT.daily_chart_title)}
                </h2>
                {lang !== "english" && (
                  <p className="text-xs text-muted">Daily timing chart</p>
                )}
              </div>

              {/* Notification Permission Request */}
              {notifPermission !== "granted" ? (
                <button
                  type="button"
                  onClick={requestNotificationPermission}
                  className="inline-flex min-h-[48px] items-center gap-1.5 rounded-full bg-primary-soft px-4 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition focus-visible:outline-3 focus-visible:outline-primary"
                >
                  <span aria-hidden="true">🔔</span>
                  <span>{pick(lang, PRESCRIPTION_TEXT.notifications_enable)}</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-ok">
                  <span>✓</span>
                  <span>{pick(lang, PRESCRIPTION_TEXT.notifications_enabled)}</span>
                </span>
              )}
            </div>

            {/* 3 Columns: Morning, Afternoon, Night */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Morning Column */}
              <div className="rounded-2xl bg-amber-50/60 p-4 border border-amber-200/60 space-y-3">
                <div className="flex items-center gap-2 border-b border-amber-200 pb-2">
                  <span className="text-xl" aria-hidden="true">
                    🌅
                  </span>
                  <div>
                    <h3 className="font-extrabold text-amber-900 text-sm">
                      {pick(lang, PRESCRIPTION_TEXT.morning)}
                    </h3>
                    <span className="text-[11px] text-muted font-medium">8:00 AM</span>
                  </div>
                </div>

                {morningDoses.length === 0 ? (
                  <p className="text-xs text-muted py-2 text-center">No morning doses</p>
                ) : (
                  <div className="space-y-2">
                    {morningDoses.map((d, i) => {
                      const doseId = `${d.medicine}_morning`;
                      const isTaken = !!takenDoses[doseId];
                      return (
                        <div
                          key={i}
                          className="rounded-xl bg-white p-2.5 shadow-xs border border-beige flex items-start justify-between gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-ink truncate">
                              {d.medicine}
                            </p>
                            <span className="text-[10px] font-semibold text-muted">
                              {d.with_food
                                ? pick(lang, PRESCRIPTION_TEXT.after_food)
                                : pick(lang, PRESCRIPTION_TEXT.before_food)}
                            </span>
                          </div>
                          <label className="flex items-center gap-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isTaken}
                              onChange={() => toggleTaken(doseId)}
                              className="h-5 w-5 accent-ok rounded cursor-pointer"
                              aria-label={`Mark ${d.medicine} morning dose as taken`}
                            />
                            <span className={`text-[11px] font-bold ${isTaken ? "text-ok" : "text-muted"}`}>
                              {pick(lang, PRESCRIPTION_TEXT.taken)}
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Afternoon Column */}
              <div className="rounded-2xl bg-sky-50/60 p-4 border border-sky-200/60 space-y-3">
                <div className="flex items-center gap-2 border-b border-sky-200 pb-2">
                  <span className="text-xl" aria-hidden="true">
                    ☀️
                  </span>
                  <div>
                    <h3 className="font-extrabold text-sky-900 text-sm">
                      {pick(lang, PRESCRIPTION_TEXT.afternoon)}
                    </h3>
                    <span className="text-[11px] text-muted font-medium">2:00 PM</span>
                  </div>
                </div>

                {afternoonDoses.length === 0 ? (
                  <p className="text-xs text-muted py-2 text-center">No afternoon doses</p>
                ) : (
                  <div className="space-y-2">
                    {afternoonDoses.map((d, i) => {
                      const doseId = `${d.medicine}_afternoon`;
                      const isTaken = !!takenDoses[doseId];
                      return (
                        <div
                          key={i}
                          className="rounded-xl bg-white p-2.5 shadow-xs border border-beige flex items-start justify-between gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-ink truncate">
                              {d.medicine}
                            </p>
                            <span className="text-[10px] font-semibold text-muted">
                              {d.with_food
                                ? pick(lang, PRESCRIPTION_TEXT.after_food)
                                : pick(lang, PRESCRIPTION_TEXT.before_food)}
                            </span>
                          </div>
                          <label className="flex items-center gap-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isTaken}
                              onChange={() => toggleTaken(doseId)}
                              className="h-5 w-5 accent-ok rounded cursor-pointer"
                              aria-label={`Mark ${d.medicine} afternoon dose as taken`}
                            />
                            <span className={`text-[11px] font-bold ${isTaken ? "text-ok" : "text-muted"}`}>
                              {pick(lang, PRESCRIPTION_TEXT.taken)}
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Night Column */}
              <div className="rounded-2xl bg-indigo-50/60 p-4 border border-indigo-200/60 space-y-3">
                <div className="flex items-center gap-2 border-b border-indigo-200 pb-2">
                  <span className="text-xl" aria-hidden="true">
                    🌙
                  </span>
                  <div>
                    <h3 className="font-extrabold text-indigo-900 text-sm">
                      {pick(lang, PRESCRIPTION_TEXT.night)}
                    </h3>
                    <span className="text-[11px] text-muted font-medium">8:00 PM</span>
                  </div>
                </div>

                {nightDoses.length === 0 ? (
                  <p className="text-xs text-muted py-2 text-center">No night doses</p>
                ) : (
                  <div className="space-y-2">
                    {nightDoses.map((d, i) => {
                      const doseId = `${d.medicine}_night`;
                      const isTaken = !!takenDoses[doseId];
                      return (
                        <div
                          key={i}
                          className="rounded-xl bg-white p-2.5 shadow-xs border border-beige flex items-start justify-between gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-ink truncate">
                              {d.medicine}
                            </p>
                            <span className="text-[10px] font-semibold text-muted">
                              {d.with_food
                                ? pick(lang, PRESCRIPTION_TEXT.after_food)
                                : pick(lang, PRESCRIPTION_TEXT.before_food)}
                            </span>
                          </div>
                          <label className="flex items-center gap-1 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isTaken}
                              onChange={() => toggleTaken(doseId)}
                              className="h-5 w-5 accent-ok rounded cursor-pointer"
                              aria-label={`Mark ${d.medicine} night dose as taken`}
                            />
                            <span className={`text-[11px] font-bold ${isTaken ? "text-ok" : "text-muted"}`}>
                              {pick(lang, PRESCRIPTION_TEXT.taken)}
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 4. Manual Fallback Form (labeled clearly) */}
        <section
          aria-label="Manual Medicine Entry"
          className="rounded-3xl bg-white p-5 shadow-sm space-y-4 border border-beige"
        >
          <div>
            <h2 className="text-lg font-bold text-ink">
              {pick(lang, PRESCRIPTION_TEXT.manual_title)}
            </h2>
            {isManualFallback && (
              <p className="text-xs font-semibold text-amber-900 bg-amber-50 p-2 rounded-xl mt-1">
                ⚠️ {pick(lang, PRESCRIPTION_TEXT.manual_note)}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label htmlFor="manual-name" className="block text-xs font-bold text-ink mb-1">
                {pick(lang, PRESCRIPTION_TEXT.med_name)}
              </label>
              <input
                id="manual-name"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="e.g. Paracetamol 650mg"
                className="w-full rounded-2xl bg-beige/40 px-4 py-3 text-sm focus-visible:outline-3 focus-visible:outline-primary"
              />
            </div>

            <div>
              <label htmlFor="manual-dosage" className="block text-xs font-bold text-ink mb-1">
                Dosage
              </label>
              <input
                id="manual-dosage"
                value={manualDosage}
                onChange={(e) => setManualDosage(e.target.value)}
                placeholder="e.g. 1 tablet"
                className="w-full rounded-2xl bg-beige/40 px-4 py-3 text-sm focus-visible:outline-3 focus-visible:outline-primary"
              />
            </div>

            <div>
              <p className="text-xs font-bold text-ink mb-1">Dose Times</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setManualMorning((prev) => !prev)}
                  className={`min-h-[48px] rounded-2xl px-4 py-2 text-xs font-bold transition focus-visible:outline-3 focus-visible:outline-primary ${
                    manualMorning ? "bg-primary text-white" : "bg-beige/50 text-muted"
                  }`}
                >
                  🌅 {pick(lang, PRESCRIPTION_TEXT.morning)}
                </button>
                <button
                  type="button"
                  onClick={() => setManualAfternoon((prev) => !prev)}
                  className={`min-h-[48px] rounded-2xl px-4 py-2 text-xs font-bold transition focus-visible:outline-3 focus-visible:outline-primary ${
                    manualAfternoon ? "bg-primary text-white" : "bg-beige/50 text-muted"
                  }`}
                >
                  ☀️ {pick(lang, PRESCRIPTION_TEXT.afternoon)}
                </button>
                <button
                  type="button"
                  onClick={() => setManualNight((prev) => !prev)}
                  className={`min-h-[48px] rounded-2xl px-4 py-2 text-xs font-bold transition focus-visible:outline-3 focus-visible:outline-primary ${
                    manualNight ? "bg-primary text-white" : "bg-beige/50 text-muted"
                  }`}
                >
                  🌙 {pick(lang, PRESCRIPTION_TEXT.night)}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={manualWithFood}
                  onChange={(e) => setManualWithFood(e.target.checked)}
                  className="h-5 w-5 accent-primary rounded cursor-pointer"
                />
                <span>{pick(lang, PRESCRIPTION_TEXT.after_food)}</span>
              </label>
            </div>

            <button
              type="button"
              onClick={handleAddManual}
              disabled={!manualName.trim()}
              className="min-h-[48px] w-full rounded-2xl bg-primary px-5 py-3 font-bold text-white hover:bg-primary/90 transition disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-primary"
            >
              {pick(lang, PRESCRIPTION_TEXT.add_med_btn)}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
