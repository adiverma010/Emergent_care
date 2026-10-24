"use client";

import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../../context/AppContext";
import { parsePrescription, scheduleReminders } from "../../lib/api";
import {
  ParsedMedicine,
  PrescriptionParseResponse,
  MedicationReminder,
} from "../../lib/types";
import { ListenButton } from "../../components/ListenButton";

const REMINDERS_STORAGE_KEY = "carecompass_prescriptions_reminders";

export default function PrescriptionsPage() {
  const { profile, speakText } = useApp();

  // Mode: "upload" | "text"
  const [activeTab, setActiveTab] = useState<"upload" | "text">("upload");
  const [prescriptionText, setPrescriptionText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Loading & Data states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<PrescriptionParseResponse | null>(null);
  const [reminders, setReminders] = useState<MedicationReminder[]>([]);

  // Browser Notification state
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [activeNotificationMessage, setActiveNotificationMessage] = useState<string | null>(null);
  const schedulerTimersRef = useRef<NodeJS.Timeout[]>([]);

  // Load saved reminders from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMINDERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.reminders && parsed.reminders.length > 0) {
          setReminders(parsed.reminders);
          setParseResult(parsed.parseResult || null);
        }
      }
    } catch (e) {
      console.warn("Failed to load saved reminders:", e);
    }

    if (typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  // Save reminders to localStorage
  const saveRemindersToStorage = (updatedReminders: MedicationReminder[], result: PrescriptionParseResponse | null) => {
    try {
      localStorage.setItem(
        REMINDERS_STORAGE_KEY,
        JSON.stringify({ reminders: updatedReminders, parseResult: result })
      );
    } catch (e) {
      console.warn("Storage save failed:", e);
    }
  };

  // Browser Notification Permission Request
  const requestNotificationAccess = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const perm = await Notification.requestPermission();
        setNotificationPermission(perm);
        if (perm === "granted") {
          new Notification("CareCompass Sathi Reminders Active", {
            body: "You will receive alerts for medicine dosages while this app is open.",
            icon: "/favicon.ico",
          });
        }
      } catch (e) {
        console.warn("Permission request failed:", e);
      }
    }
  };

  // Test immediate browser notification
  const triggerTestNotification = () => {
    if (notificationPermission === "granted") {
      new Notification("CareCompass Sathi: Medicine Reminder", {
        body: "Time for Paracetamol 650mg (After food with warm water).",
        icon: "/favicon.ico",
      });
    } else {
      setActiveNotificationMessage("Medicine Reminder: Paracetamol 650mg - Take 1 tablet after food with warm water.");
      speakText("Medicine reminder: Time to take Paracetamol 650 milligrams after food.");
      setTimeout(() => setActiveNotificationMessage(null), 6000);
    }
  };

  // Setup setTimeout scheduler while app is open for upcoming reminders
  useEffect(() => {
    // Clear old timers
    schedulerTimersRef.current.forEach((t) => clearTimeout(t));
    schedulerTimersRef.current = [];

    if (reminders.length === 0) return;

    // Simulate in-app notification alerts for demonstration purposes (schedule an alert in 45s)
    const demoTimer = setTimeout(() => {
      const pendingMed = reminders.find((r) => r.status === "pending");
      if (pendingMed) {
        const title = `Time to take: ${pendingMed.medicine_name}`;
        const body = `Dosage: ${pendingMed.dosage} (${pendingMed.relation_to_food.replace("_", " ")}).`;

        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          new Notification(title, { body, icon: "/favicon.ico" });
        } else {
          setActiveNotificationMessage(`${title} - ${body}`);
          speakText(`Reminder: Time to take your medicine, ${pendingMed.medicine_name}.`);
        }
      }
    }, 45000);

    schedulerTimersRef.current.push(demoTimer);

    return () => {
      schedulerTimersRef.current.forEach((t) => clearTimeout(t));
    };
  }, [reminders, speakText]);

  // Handle Image File selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Submit Prescription to /prescription/parse & /reminders/schedule
  const handleParseAndSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Step 1: POST /prescription/parse
      const result = await parsePrescription({
        text: activeTab === "text" ? prescriptionText : undefined,
        file: activeTab === "upload" ? selectedFile : undefined,
      });

      setParseResult(result);

      // Step 2: POST /reminders/schedule
      const scheduled = await scheduleReminders(result.medicines, profile.name);
      setReminders(scheduled);
      saveRemindersToStorage(scheduled, result);

      speakText(
        `Prescription analyzed. ${result.medicines.length} medicines scheduled into morning, afternoon, and night timings.`
      );
    } catch (err: any) {
      setError(err.message || "Failed to parse prescription.");
    } finally {
      setLoading(false);
    }
  };

  // Toggle "Taken" status on a reminder item
  const handleToggleTaken = (id: string) => {
    const updated = reminders.map((r) => {
      if (r.id === id) {
        const isNowTaken = r.status !== "taken";
        return {
          ...r,
          status: (isNowTaken ? "taken" : "pending") as "taken" | "pending",
          takenAt: isNowTaken
            ? new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : undefined,
        };
      }
      return r;
    });
    setReminders(updated);
    saveRemindersToStorage(updated, parseResult);
  };

  // Quick Prescription test buttons
  const loadSamplePrescription = (sampleText: string) => {
    setActiveTab("text");
    setPrescriptionText(sampleText);
  };

  const isHindi = profile.language === "hi";

  // Group reminders by time slot
  const morningReminders = reminders.filter((r) => r.time_slot === "morning");
  const afternoonReminders = reminders.filter((r) => r.time_slot === "afternoon");
  const nightReminders = reminders.filter((r) => r.time_slot === "night");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Page Title & Guidance */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <span className="icon-symbol text-3xl text-teal-600">prescriptions</span>
            <span>{isHindi ? "दवा पर्ची व समय सारणी" : "Prescriptions & Medication Timetable"}</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            {isHindi
              ? "डॉक्टर की पर्ची अपलोड करें या दवाइयां लिखें। हम खुराक की पुष्टि करेंगे और दैनिक रिमाइंडर सेट करेंगे।"
              : "Upload prescription photo or enter medicine names. We extract dosage, schedule, and food instructions."}
          </p>
        </div>

        {/* Browser Notification Bell Button */}
        <div className="flex items-center gap-2">
          {notificationPermission !== "granted" ? (
            <button
              onClick={requestNotificationAccess}
              className="flex items-center gap-1.5 rounded-full border border-teal-300 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100 transition"
              title="Allow browser notifications for medicine times"
            >
              <span className="icon-symbol text-base text-teal-700">notifications_active</span>
              <span>Enable Browser Alerts</span>
            </button>
          ) : (
            <button
              onClick={triggerTestNotification}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              title="Test reminder notification"
            >
              <span className="icon-symbol text-base text-emerald-600">check_circle</span>
              <span>Test Alert</span>
            </button>
          )}
        </div>
      </div>

      {/* In-app Notification Banner (when active) */}
      {activeNotificationMessage && (
        <div className="mb-6 rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 shadow-md flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-3">
            <span className="icon-symbol text-2xl text-amber-600 animate-bounce">alarm</span>
            <div>
              <strong className="text-sm font-extrabold text-amber-950 block">Medication Reminder</strong>
              <p className="text-xs text-amber-900 font-medium">{activeNotificationMessage}</p>
            </div>
          </div>
          <button
            onClick={() => setActiveNotificationMessage(null)}
            className="rounded-lg p-1 text-amber-800 hover:bg-amber-100"
          >
            <span className="icon-symbol text-xl">close</span>
          </button>
        </div>
      )}

      {/* Prescription Input Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm mb-8">
        {/* Tab Switcher: Photo Upload vs Text Paste */}
        <div className="flex border-b border-slate-200 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`flex items-center gap-2 pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition ${
              activeTab === "upload"
                ? "border-teal-700 text-teal-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="icon-symbol text-lg">add_a_photo</span>
            <span>Upload or Capture Photo</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("text")}
            className={`flex items-center gap-2 pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition ${
              activeTab === "text"
                ? "border-teal-700 text-teal-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span className="icon-symbol text-lg">description</span>
            <span>Paste or Type Prescription</span>
          </button>
        </div>

        <form onSubmit={handleParseAndSchedule}>
          {activeTab === "upload" ? (
            <div>
              <label
                htmlFor="prescription-file-input"
                className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50/40 p-6 sm:p-10 cursor-pointer hover:bg-teal-50 transition"
              >
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
                  <span className="icon-symbol text-3xl">photo_camera</span>
                </div>
                <span className="text-sm font-bold text-slate-800 text-center">
                  Click to take a photo or select prescription file
                </span>
                <span className="mt-1 text-xs text-slate-500">Supports JPG, PNG, WebP (Camera or Gallery)</span>

                <input
                  id="prescription-file-input"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>

              {filePreview && (
                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <img
                    src={filePreview}
                    alt="Prescription preview"
                    className="h-16 w-16 rounded-xl object-cover border border-slate-300"
                  />
                  <div className="flex-1">
                    <p className="text-xs font-bold text-slate-800">{selectedFile?.name}</p>
                    <span className="text-[11px] text-slate-500">
                      {(selectedFile?.size ? selectedFile.size / 1024 : 0).toFixed(1)} KB • Ready to extract
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setFilePreview(null);
                    }}
                    className="text-slate-400 hover:text-rose-600 p-2"
                  >
                    <span className="icon-symbol text-lg">delete</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label htmlFor="rx-text-area" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                Prescription Text & Dosage Notes
              </label>
              <textarea
                id="rx-text-area"
                value={prescriptionText}
                onChange={(e) => setPrescriptionText(e.target.value)}
                rows={4}
                placeholder="Paste doctor's note, e.g.
Tab Paracetamol 650mg - 1 tab twice daily after food for fever
Cap Amoxicillin 500mg - 1 cap thrice daily after food for 5 days
Tab Pantoprazole 40mg - 1 tab once daily before breakfast"
                className="w-full rounded-2xl border border-slate-300 p-4 text-sm font-medium text-slate-900 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              />
            </div>
          )}

          {/* Quick Sample Buttons */}
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">Quick Samples:</span>
            <button
              type="button"
              onClick={() =>
                loadSamplePrescription(
                  "Tab Paracetamol 650mg twice daily after meals. Tab Pantoprazole 40mg once daily before breakfast. Tab Cetirizine 10mg at bedtime."
                )
              }
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] hover:bg-slate-100"
            >
              Fever & Acidity Sample
            </button>
            <button
              type="button"
              onClick={() =>
                loadSamplePrescription(
                  "Tab Metformin 500mg twice daily with meals for diabetes. Tab Telmisartan 40mg once daily in morning for high blood pressure."
                )
              }
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] hover:bg-slate-100"
            >
              Diabetes & BP Sample
            </button>
          </div>

          {/* Action CTA */}
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={loading || (activeTab === "upload" && !selectedFile) || (activeTab === "text" && !prescriptionText.trim())}
              className="flex items-center gap-2 rounded-xl bg-teal-700 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-teal-800 disabled:opacity-50 transition touch-target"
            >
              {loading ? (
                <>
                  <span className="icon-symbol text-lg animate-spin">progress_activity</span>
                  <span>Extracting Medicines & Timetable...</span>
                </>
              ) : (
                <>
                  <span>Extract & Schedule Medicines</span>
                  <span className="icon-symbol text-lg">calendar_month</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 text-sm flex items-center gap-2">
          <span className="icon-symbol text-rose-600">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Parsed Medicines Section */}
      {parseResult && (
        <div className="space-y-6 mb-10">
          <div className="rounded-3xl border border-teal-200 bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
                <span className="icon-symbol text-teal-600">medication</span>
                <span>Parsed Prescription Medicines ({parseResult.medicines.length})</span>
              </h2>
              <ListenButton
                text={`Parsed ${parseResult.medicines.length} medicines: ${parseResult.medicines
                  .map((m) => `${m.name}, ${m.explanation}`)
                  .join(". ")}`}
                label="Listen"
              />
            </div>

            {/* Doctor Note */}
            {parseResult.doctor_notes && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 mb-4 text-xs text-slate-700">
                <strong className="font-bold text-slate-800 block mb-0.5">Doctor's Clinical Notes:</strong>
                <p>{parseResult.doctor_notes}</p>
              </div>
            )}

            {/* Medicines List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {parseResult.medicines.map((med, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="text-base font-extrabold text-slate-900">{med.name}</h3>
                      <span className="rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                        {med.dosage}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-3 text-xs">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                        {med.frequency}
                      </span>
                      <span className="rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 font-bold text-amber-800">
                        {med.relation_to_food === "before_food"
                          ? "Before Food"
                          : med.relation_to_food === "after_food"
                          ? "After Food"
                          : "With Food"}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed mb-3">
                      <strong className="font-semibold text-slate-800">Simple explanation:</strong> {med.explanation}
                    </p>

                    <div className="rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-600">
                      <strong className="font-semibold text-slate-700">Instructions:</strong> {med.instructions}
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-100 flex justify-end">
                    <ListenButton text={`${med.name}. ${med.explanation}. ${med.instructions}`} label="Listen" />
                  </div>
                </div>
              ))}
            </div>

            {/* Mandatory "Confirm with doctor" note per Rule 9 */}
            <div className="mt-6 rounded-2xl border border-amber-300 bg-amber-50/80 p-4 text-xs text-amber-900 leading-relaxed">
              <strong className="font-bold flex items-center gap-1 mb-1">
                <span className="icon-symbol text-base text-amber-700">verified</span>
                <span>Important Medical Verification Note:</span>
              </strong>
              <span>
                Dosages shown are extracted directly from the uploaded prescription without alteration. Never adjust or invent dosages on your own. Always confirm instructions with your treating physician or licensed pharmacist.
              </span>
            </div>
          </div>

          {/* Daily Timing Chart (Morning / Afternoon / Night) */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <div>
                <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
                  <span className="icon-symbol text-teal-600">schedule</span>
                  <span>Daily Medication Timing Chart & Taken Checklist</span>
                </h2>
                <span className="text-xs text-slate-500">
                  Tap checkbox as you take each dose to keep an accurate daily log
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Morning Slot */}
              <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-200">
                  <span className="icon-symbol text-2xl text-amber-600">wb_sunny</span>
                  <div>
                    <h3 className="text-sm font-extrabold text-amber-950">Morning (सुबह)</h3>
                    <span className="text-[11px] font-semibold text-amber-800">7:00 AM - 10:00 AM</span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {morningReminders.length > 0 ? (
                    morningReminders.map((rem) => (
                      <div
                        key={rem.id}
                        className={`rounded-xl border p-3 transition ${
                          rem.status === "taken"
                            ? "border-emerald-300 bg-emerald-50/70 opacity-80"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={rem.status === "taken"}
                            onChange={() => handleToggleTaken(rem.id)}
                            className="h-5 w-5 mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                            aria-label={`Mark ${rem.medicine_name} as taken`}
                          />
                          <div className="flex-1">
                            <span className={`text-xs font-bold block ${rem.status === "taken" ? "line-through text-slate-500" : "text-slate-900"}`}>
                              {rem.medicine_name}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              {rem.time} • {rem.dosage} ({rem.relation_to_food.replace("_", " ")})
                            </span>
                            {rem.takenAt && (
                              <span className="text-[10px] font-bold text-emerald-700 block mt-0.5">
                                ✓ Taken at {rem.takenAt}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic block py-2">No morning medicines</span>
                  )}
                </div>
              </div>

              {/* Afternoon Slot */}
              <div className="rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-sky-200">
                  <span className="icon-symbol text-2xl text-sky-600">light_mode</span>
                  <div>
                    <h3 className="text-sm font-extrabold text-sky-950">Afternoon (दोपहर)</h3>
                    <span className="text-[11px] font-semibold text-sky-800">1:00 PM - 3:00 PM</span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {afternoonReminders.length > 0 ? (
                    afternoonReminders.map((rem) => (
                      <div
                        key={rem.id}
                        className={`rounded-xl border p-3 transition ${
                          rem.status === "taken"
                            ? "border-emerald-300 bg-emerald-50/70 opacity-80"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={rem.status === "taken"}
                            onChange={() => handleToggleTaken(rem.id)}
                            className="h-5 w-5 mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                            aria-label={`Mark ${rem.medicine_name} as taken`}
                          />
                          <div className="flex-1">
                            <span className={`text-xs font-bold block ${rem.status === "taken" ? "line-through text-slate-500" : "text-slate-900"}`}>
                              {rem.medicine_name}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              {rem.time} • {rem.dosage} ({rem.relation_to_food.replace("_", " ")})
                            </span>
                            {rem.takenAt && (
                              <span className="text-[10px] font-bold text-emerald-700 block mt-0.5">
                                ✓ Taken at {rem.takenAt}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic block py-2">No afternoon medicines</span>
                  )}
                </div>
              </div>

              {/* Night Slot */}
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-indigo-200">
                  <span className="icon-symbol text-2xl text-indigo-600">bedtime</span>
                  <div>
                    <h3 className="text-sm font-extrabold text-indigo-950">Night (रात)</h3>
                    <span className="text-[11px] font-semibold text-indigo-800">8:00 PM - 10:00 PM</span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {nightReminders.length > 0 ? (
                    nightReminders.map((rem) => (
                      <div
                        key={rem.id}
                        className={`rounded-xl border p-3 transition ${
                          rem.status === "taken"
                            ? "border-emerald-300 bg-emerald-50/70 opacity-80"
                            : "border-slate-200 bg-white"
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={rem.status === "taken"}
                            onChange={() => handleToggleTaken(rem.id)}
                            className="h-5 w-5 mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                            aria-label={`Mark ${rem.medicine_name} as taken`}
                          />
                          <div className="flex-1">
                            <span className={`text-xs font-bold block ${rem.status === "taken" ? "line-through text-slate-500" : "text-slate-900"}`}>
                              {rem.medicine_name}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              {rem.time} • {rem.dosage} ({rem.relation_to_food.replace("_", " ")})
                            </span>
                            {rem.takenAt && (
                              <span className="text-[10px] font-bold text-emerald-700 block mt-0.5">
                                ✓ Taken at {rem.takenAt}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic block py-2">No night medicines</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
