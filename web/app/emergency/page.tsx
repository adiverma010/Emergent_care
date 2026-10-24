"use client";
import React, { useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings";
import {
  getLocation,
  triage,
  createDispatch,
  getDispatch,
  getNearbyHospitals,
  type TriageResponse,
  type DispatchResponse,
  type NearbyHospital,
} from "@/lib/api";
import { speak, stopSpeaking } from "@/lib/speech";
import { EMERGENCY_TEXT, pick } from "@/lib/text";
import { ListenButton } from "@/components/ListenButton";

const FALLBACK_HOSPITALS: NearbyHospital[] = [
  { name: "AIIMS New Delhi Emergency", lat: 28.5672, lng: 77.21, phone: "011-26588500", emergency: true, distance_km: 2.4 },
  { name: "Safdarjung Hospital Emergency", lat: 28.5688, lng: 77.2066, phone: "011-26165060", emergency: true, distance_km: 2.8 },
  { name: "Max Super Speciality Hospital Saket", lat: 28.5275, lng: 77.2066, phone: "011-26515050", emergency: true, distance_km: 4.1 },
  { name: "Apollo Hospital Emergency", lat: 28.5407, lng: 77.283, phone: "011-71791090", emergency: true, distance_km: 5.2 },
];

export default function EmergencyPage() {
  const { profile } = useSettings();
  const lang = profile.language;

  // Triage state & first-aid steps
  const [triageData, setTriageData] = useState<TriageResponse | null>(null);
  const [steps, setSteps] = useState<string[]>([]);
  const [describeText, setDescribeText] = useState("");
  const [triageLoading, setTriageLoading] = useState(false);

  // Dispatch state
  const [dispatch, setDispatch] = useState<DispatchResponse | null>(null);
  const [isDemoDispatch, setIsDemoDispatch] = useState(false);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const simTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Hospitals state
  const [hospitals, setHospitals] = useState<NearbyHospital[]>([]);
  const [hospitalsOpen, setHospitalsOpen] = useState(false);
  const [isDemoHospitals, setIsDemoHospitals] = useState(false);

  // 1. On Mount: Check sessionStorage for triage result passed from Home
  useEffect(() => {
    let initialSteps: string[] = [];
    try {
      const stored = sessionStorage.getItem("sathi_emergency_triage");
      if (stored) {
        const parsed: TriageResponse = JSON.parse(stored);
        setTriageData(parsed);
        if (parsed.first_aid_steps && parsed.first_aid_steps.length > 0) {
          initialSteps = parsed.first_aid_steps;
        }
      }
    } catch {}

    if (initialSteps.length === 0) {
      initialSteps = EMERGENCY_TEXT.default_steps[lang] || EMERGENCY_TEXT.default_steps.en;
    }
    setSteps(initialSteps);

    // Read aloud first-aid steps automatically on load
    const speakText = [
      pick(lang, EMERGENCY_TEXT.call_112),
      ...initialSteps,
    ].join(". ");
    speak(speakText, lang);

    return () => {
      stopSpeaking();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, [lang]);

  // 2. Fetch nearby hospitals
  useEffect(() => {
    getLocation().then(async (loc) => {
      try {
        const res = await getNearbyHospitals(loc.lat, loc.lng);
        if (res && res.hospitals && res.hospitals.length > 0) {
          setHospitals(res.hospitals);
          setIsDemoHospitals(false);
        } else {
          setHospitals(FALLBACK_HOSPITALS);
          setIsDemoHospitals(true);
        }
      } catch {
        setHospitals(FALLBACK_HOSPITALS);
        setIsDemoHospitals(true);
      }
    });
  }, []);

  // Handle describing what happened if SOS pressed with no prior triage
  const handleDescribe = async () => {
    if (!describeText.trim() || triageLoading) return;
    setTriageLoading(true);
    try {
      const res = await triage(describeText.trim(), lang, []);
      setTriageData(res);
      const newSteps = res.first_aid_steps && res.first_aid_steps.length > 0
        ? res.first_aid_steps
        : EMERGENCY_TEXT.default_steps[lang] || EMERGENCY_TEXT.default_steps.en;
      setSteps(newSteps);
      speak([pick(lang, EMERGENCY_TEXT.call_112), ...newSteps].join(". "), lang);
    } catch {
      // Keep existing default steps
    } finally {
      setTriageLoading(false);
    }
  };

  // Start simulated dispatch fallback advancing over ~20s
  const startDemoSimulation = (loc: { lat: number; lng: number }, summaryText: string) => {
    setIsDemoDispatch(true);
    const startTime = Date.now();
    const demoHospital = FALLBACK_HOSPITALS[0];

    const updateSim = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      let status: "notified" | "ambulance_assigned" | "en_route" = "notified";
      let eta = 18;

      if (elapsed >= 14) {
        status = "en_route";
        eta = 10;
      } else if (elapsed >= 6) {
        status = "ambulance_assigned";
        eta = 14;
      }

      setDispatch({
        dispatch_id: "DEMO-" + Math.floor(startTime / 1000),
        status,
        eta_minutes: eta,
        hospital: {
          name: demoHospital.name,
          distance_km: demoHospital.distance_km,
          phone: demoHospital.phone,
        },
        packet: {
          patient: {
            name: profile.name || "Patient",
            age: profile.age,
            allergies: profile.allergies,
            history: profile.history,
          },
          red_flag: triageData?.red_flags?.[0] || "emergency_112",
          summary: summaryText,
        },
      });
    };

    updateSim();
    simTimerRef.current = setInterval(updateSim, 1500);
  };

  // Trigger ambulance & hospital dispatch
  const handleNotifyDispatch = async () => {
    if (dispatchLoading || dispatch) return;
    setDispatchLoading(true);

    const loc = await getLocation();
    const summaryText =
      triageData?.reasoning || describeText.trim() || "Emergency assistance requested via CareCompass SOS";

    try {
      const data = {
        patient: {
          name: profile.name || "Patient",
          age: profile.age,
          allergies: profile.allergies,
          history: profile.history,
        },
        location: loc,
        red_flag: triageData?.red_flags?.[0] || "emergency_112",
        summary: summaryText,
      };

      const res = await createDispatch(data);
      if (res && res.dispatch_id) {
        setDispatch(res);
        setIsDemoDispatch(false);

        // Poll GET /dispatch/{id} every 3 seconds
        pollTimerRef.current = setInterval(async () => {
          try {
            const updated = await getDispatch(res.dispatch_id);
            setDispatch(updated);
          } catch {
            // Keep current status if a poll fails
          }
        }, 3000);
      } else {
        startDemoSimulation(loc, summaryText);
      }
    } catch {
      startDemoSimulation(loc, summaryText);
    } finally {
      setDispatchLoading(false);
    }
  };

  const statusLabel = (s: string) => {
    if (s === "en_route") return pick(lang, EMERGENCY_TEXT.status_enroute);
    if (s === "ambulance_assigned") return pick(lang, EMERGENCY_TEXT.status_assigned);
    return pick(lang, EMERGENCY_TEXT.status_notified);
  };

  return (
    <main className="min-h-screen bg-danger-soft/40 p-4 pb-32 text-ink">
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Top Emergency Alert Bar */}
        <header className="rounded-3xl border-4 border-danger bg-danger p-4 text-center text-white shadow-lg">
          <p className="text-sm font-bold uppercase tracking-wider opacity-90">
            {lang === "hindi" ? "आपातकालीन स्थिति" : "Emergency Situation"}
          </p>
          <h1 className="text-3xl font-black">
            {lang === "hindi" ? "मदद बुलाई जा रही है" : "Emergency Assistance"}
          </h1>
        </header>

        {/* Huge CALL 112 Button */}
        <section aria-label="Call 112">
          <a
            href="tel:112"
            aria-label="Call 112 immediately"
            className="flex min-h-[72px] w-full items-center justify-center gap-3 rounded-3xl bg-danger py-6 text-center text-3xl sm:text-4xl font-black text-white shadow-xl hover:bg-danger/90 active:scale-98 transition focus-visible:outline-4 focus-visible:outline-white"
          >
            <span aria-hidden="true" className="text-4xl animate-bounce">
              📞
            </span>
            <span>{pick(lang, EMERGENCY_TEXT.call_112)}</span>
          </a>
        </section>

        {/* Numbered First-Aid Steps */}
        <section
          aria-label="First-Aid Instructions"
          className="rounded-3xl border-2 border-danger/30 bg-white p-5 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-danger">
                {pick(lang, EMERGENCY_TEXT.first_aid_title)}
              </h2>
              {lang !== "english" && (
                <p className="text-xs text-muted">First-Aid Instructions</p>
              )}
            </div>
            <ListenButton
              text={[pick(lang, EMERGENCY_TEXT.call_112), ...steps].join(". ")}
            />
          </div>

          <ol className="space-y-3 pl-2">
            {steps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger text-sm font-black text-white">
                  {idx + 1}
                </span>
                <p className="text-base sm:text-lg font-semibold leading-snug pt-0.5">
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Describe what happened (if SOS pressed directly with no triage) */}
        {(!triageData || !triageData.red_flags || triageData.red_flags.length === 0) && (
          <section className="rounded-3xl bg-white p-5 shadow-sm space-y-3">
            <label htmlFor="emergency-desc" className="block font-bold">
              {pick(lang, EMERGENCY_TEXT.describe_label)}
              {lang !== "english" && (
                <span className="block text-xs font-normal text-muted">
                  Describe what happened
                </span>
              )}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="emergency-desc"
                value={describeText}
                onChange={(e) => setDescribeText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleDescribe()}
                placeholder={pick(lang, EMERGENCY_TEXT.describe_placeholder)}
                className="flex-1 rounded-2xl bg-beige/50 px-4 py-3 text-base focus-visible:outline-3 focus-visible:outline-primary"
              />
              <button
                type="button"
                onClick={handleDescribe}
                disabled={triageLoading || !describeText.trim()}
                className="min-h-[48px] rounded-2xl bg-primary px-5 py-3 font-bold text-white disabled:opacity-50 hover:bg-primary/90 transition focus-visible:outline-3 focus-visible:outline-primary"
              >
                {triageLoading ? "..." : pick(lang, EMERGENCY_TEXT.describe_btn)}
              </button>
            </div>
          </section>
        )}

        {/* Notify Ambulance and Hospital Card */}
        <section
          aria-label="Notify Responder"
          className="rounded-3xl bg-white p-5 shadow-sm space-y-4 border border-beige"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-ink">
                {pick(lang, EMERGENCY_TEXT.dispatch_title)}
              </h2>
              <p className="text-xs text-muted">
                {pick(lang, EMERGENCY_TEXT.dispatch_desc)}
              </p>
            </div>
          </div>

          {!dispatch && (
            <button
              type="button"
              onClick={handleNotifyDispatch}
              disabled={dispatchLoading}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-lg font-bold text-white shadow-md hover:bg-primary/90 active:scale-98 transition disabled:opacity-50 focus-visible:outline-3 focus-visible:outline-primary"
            >
              <span aria-hidden="true">🚑</span>
              <span>
                {dispatchLoading
                  ? pick(lang, EMERGENCY_TEXT.dispatch_sending)
                  : pick(lang, EMERGENCY_TEXT.dispatch_btn)}
              </span>
            </button>
          )}

          {/* Dispatch Status Timeline */}
          {dispatch && (
            <div className="space-y-4 pt-1">
              {/* Simulation Banner if demo mode */}
              {isDemoDispatch && (
                <div
                  role="status"
                  className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-900"
                >
                  ⚠️ {pick(lang, EMERGENCY_TEXT.demo_banner)}
                </div>
              )}

              {/* Status Stepper */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                <div
                  className={`rounded-xl p-2.5 ${
                    dispatch.status === "notified" ||
                    dispatch.status === "ambulance_assigned" ||
                    dispatch.status === "en_route"
                      ? "bg-ok-soft text-ok border-2 border-ok"
                      : "bg-beige/40 text-muted"
                  }`}
                >
                  ✓ {pick(lang, EMERGENCY_TEXT.status_notified)}
                </div>
                <div
                  className={`rounded-xl p-2.5 ${
                    dispatch.status === "ambulance_assigned" ||
                    dispatch.status === "en_route"
                      ? "bg-ok-soft text-ok border-2 border-ok"
                      : dispatch.status === "notified"
                      ? "bg-amber-100 text-amber-900 animate-pulse"
                      : "bg-beige/40 text-muted"
                  }`}
                >
                  {dispatch.status === "ambulance_assigned" || dispatch.status === "en_route" ? "✓ " : ""}
                  {pick(lang, EMERGENCY_TEXT.status_assigned)}
                </div>
                <div
                  className={`rounded-xl p-2.5 ${
                    dispatch.status === "en_route"
                      ? "bg-ok-soft text-ok border-2 border-ok"
                      : "bg-beige/40 text-muted"
                  }`}
                >
                  {dispatch.status === "en_route" ? "✓ " : ""}
                  {pick(lang, EMERGENCY_TEXT.status_enroute)}
                </div>
              </div>

              {/* Assigned Hospital & ETA */}
              <div className="rounded-2xl bg-primary-soft/50 p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold uppercase text-primary">
                      {lang === "hindi" ? "अस्पताल" : "Hospital"}
                    </span>
                    <h3 className="text-lg font-bold text-ink">
                      {dispatch.hospital.name}
                    </h3>
                    <p className="text-xs text-muted">
                      {dispatch.hospital.distance_km} km away
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold uppercase text-primary">ETA</span>
                    <p className="text-2xl font-black text-danger">
                      ~{dispatch.eta_minutes} min
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <a
                    href={`tel:${dispatch.hospital.phone}`}
                    className="inline-flex min-h-[48px] items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary/90 focus-visible:outline-3 focus-visible:outline-primary"
                  >
                    <span>📞 {pick(lang, EMERGENCY_TEXT.call_btn)}</span>
                    <span>{dispatch.hospital.phone}</span>
                  </a>
                </div>
              </div>

              {/* Patient summary sent */}
              <div className="rounded-2xl bg-beige/40 p-4 space-y-1.5 text-xs text-muted">
                <p className="font-bold text-ink uppercase tracking-wide">
                  {pick(lang, EMERGENCY_TEXT.patient_summary_title)}
                </p>
                <p>
                  <strong className="text-ink">Patient:</strong> {dispatch.packet.patient.name || "Self"} (Age: {dispatch.packet.patient.age})
                </p>
                {dispatch.packet.patient.allergies?.length > 0 && (
                  <p>
                    <strong className="text-ink">Allergies:</strong> {dispatch.packet.patient.allergies.join(", ")}
                  </p>
                )}
                {dispatch.packet.patient.history?.length > 0 && (
                  <p>
                    <strong className="text-ink">History:</strong> {dispatch.packet.patient.history.join(", ")}
                  </p>
                )}
                <p>
                  <strong className="text-ink">Details:</strong> {dispatch.packet.summary}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Collapsible Nearby Hospitals */}
        <section className="rounded-3xl bg-white p-5 shadow-sm space-y-3">
          <button
            type="button"
            onClick={() => setHospitalsOpen((prev) => !prev)}
            aria-expanded={hospitalsOpen}
            className="flex min-h-[48px] w-full items-center justify-between text-left font-bold text-lg text-ink focus-visible:outline-3 focus-visible:outline-primary rounded-xl"
          >
            <span>
              🏥 {pick(lang, EMERGENCY_TEXT.nearby_hospitals_title)} ({hospitals.length})
            </span>
            <span className="text-2xl text-muted" aria-hidden="true">
              {hospitalsOpen ? "▲" : "▼"}
            </span>
          </button>

          {hospitalsOpen && (
            <div className="space-y-3 pt-2">
              {isDemoHospitals && (
                <p className="text-xs font-semibold text-muted bg-beige/40 p-2 rounded-xl">
                  ℹ️ {pick(lang, EMERGENCY_TEXT.demo_banner)}
                </p>
              )}
              {hospitals.map((h, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-cream p-3.5 border border-beige"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-ink truncate">{h.name}</p>
                    <p className="text-xs text-muted">
                      {h.distance_km} km • {h.phone}
                    </p>
                  </div>
                  <a
                    href={`tel:${h.phone}`}
                    aria-label={`Call ${h.name} at ${h.phone}`}
                    className="flex min-h-[48px] min-w-[72px] items-center justify-center rounded-full bg-danger px-4 py-2 font-bold text-sm text-white shadow-sm hover:bg-danger/90 focus-visible:outline-3 focus-visible:outline-primary"
                  >
                    📞 {pick(lang, EMERGENCY_TEXT.call_btn)}
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
