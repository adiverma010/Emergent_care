"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSettings } from "@/lib/settings";
import {
  getLocation,
  assess,
  createDispatch,
  getDispatch,
  getNearbyHospitals,
  getLiveHospitals,
  type TriageResponse,
  type AssessResponse,
  type DispatchResponse,
  type NearbyHospital,
  type LiveHospital,
  type Turn,
} from "@/lib/api";
import { speak, stopSpeaking } from "@/lib/speech";
import { EMERGENCY_TEXT, ADVICE_TEXT, CARE_LABEL, pick } from "@/lib/text";
import { ListenButton } from "@/components/ListenButton";

const FALLBACK_HOSPITALS: NearbyHospital[] = [
  { name: "AIIMS New Delhi Emergency", lat: 28.5672, lng: 77.21, phone: "011-26588500", emergency: true, distance_km: 2.4 },
  { name: "Safdarjung Hospital Emergency", lat: 28.5688, lng: 77.2066, phone: "011-26165060", emergency: true, distance_km: 2.8 },
  { name: "Max Super Speciality Hospital Saket", lat: 28.5275, lng: 77.2066, phone: "011-26515050", emergency: true, distance_km: 4.1 },
  { name: "Apollo Hospital Emergency", lat: 28.5407, lng: 77.283, phone: "011-71791090", emergency: true, distance_km: 5.2 },
];

export default function EmergencyPage() {
  const router = useRouter();
  const { profile } = useSettings();
  const lang = profile.language;

  // Triage state & history
  const [triageData, setTriageData] = useState<(TriageResponse & Partial<AssessResponse>) | null>(null);
  const sessionHistoryRef = useRef<Turn[]>([]);
  const [describeText, setDescribeText] = useState("");
  const [triageLoading, setTriageLoading] = useState(false);

  // Dispatch state
  const [dispatch, setDispatch] = useState<DispatchResponse | null>(null);
  const [isDemoDispatch, setIsDemoDispatch] = useState(false);
  const [notifiedTime, setNotifiedTime] = useState<string | null>(null);
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const simTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoDispatchedRef = useRef(false);

  // Hospitals state
  const [hospitals, setHospitals] = useState<NearbyHospital[]>(FALLBACK_HOSPITALS);
  const [liveHospitals, setLiveHospitals] = useState<LiveHospital[] | null>(null);
  const [liveSource, setLiveSource] = useState<string | null>(null);
  const [hospitalsOpen, setHospitalsOpen] = useState(false);

  // Start simulated dispatch fallback advancing over ~20s
  const startDemoSimulation = (
    loc: { lat: number; lng: number },
    summaryText: string,
    activeT?: (TriageResponse & Partial<AssessResponse>) | null
  ) => {
    setIsDemoDispatch(true);
    setNotifiedTime((prev) => prev || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    const startTime = Date.now();
    const demoHospital = hospitals[0] || FALLBACK_HOSPITALS[0];
    const tData = activeT !== undefined ? activeT : triageData;

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
          distance_km: demoHospital.distance_km || 2.5,
          phone: demoHospital.phone,
        },
        packet: {
          patient: {
            name: profile.name || "Patient",
            age: profile.age,
            allergies: profile.allergies,
            history: profile.history,
          },
          red_flag: tData?.red_flags?.[0] || "emergency_112",
          summary: summaryText,
        },
      });
    };

    updateSim();
    simTimerRef.current = setInterval(updateSim, 1500);
  };

  // Trigger ambulance & hospital dispatch
  const handleNotifyDispatch = async (customTriage?: (TriageResponse & Partial<AssessResponse>) | null) => {
    if (dispatchLoading || dispatch) return;
    setDispatchLoading(true);

    const activeTriage = customTriage !== undefined ? customTriage : triageData;
    const loc = await getLocation();
    const summaryText =
      activeTriage?.reasoning ||
      activeTriage?.advice?.summary ||
      describeText.trim() ||
      "Emergency assistance requested via CareCompass SOS";

    const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setNotifiedTime(timeStr);

    try {
      const data = {
        patient: {
          name: profile.name || "Patient",
          age: profile.age,
          allergies: profile.allergies,
          history: profile.history,
        },
        location: loc,
        red_flag: activeTriage?.red_flags?.[0] || "emergency_112",
        summary: summaryText,
      };

      const res = await createDispatch(data);
      if (res && res.dispatch_id) {
        setDispatch(res);
        setIsDemoDispatch(Boolean(res.is_simulated || res.dispatch_id.startsWith("DEMO")));

        // Poll GET /dispatch/{id} every 3 seconds
        pollTimerRef.current = setInterval(async () => {
          try {
            const updated = await getDispatch(res.dispatch_id);
            setDispatch(updated);
          } catch {}
        }, 3000);
      } else {
        startDemoSimulation(loc, summaryText, activeTriage);
      }
    } catch {
      startDemoSimulation(loc, summaryText, activeTriage);
    } finally {
      setDispatchLoading(false);
    }
  };

  const handleNotifyDispatchRef = useRef(handleNotifyDispatch);
  useEffect(() => {
    handleNotifyDispatchRef.current = handleNotifyDispatch;
  });

  // 1. On Mount: Check sessionStorage for triage/assess result passed from Home
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("sathi_emergency_triage");
      if (stored) {
        const parsed: (TriageResponse & Partial<AssessResponse>) & { user_input?: string } = JSON.parse(stored);
        setTriageData(parsed);
        if (parsed.user_input) {
          sessionHistoryRef.current = [{ role: "user", text: parsed.user_input }];
        }
        const steps =
          parsed.first_aid_steps && parsed.first_aid_steps.length > 0
            ? parsed.first_aid_steps
            : parsed.advice?.do_now || [];
        if (steps.length > 0) {
          speak([pick(lang, EMERGENCY_TEXT.call_112), ...steps].join(". "), lang);
        }

        // Auto-dispatch on load if dispatch_recommended is true (no tap required)
        if (parsed.dispatch_recommended && !autoDispatchedRef.current) {
          autoDispatchedRef.current = true;
          handleNotifyDispatchRef.current(parsed);
        }
      }
    } catch {}

    return () => {
      stopSpeaking();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (simTimerRef.current) clearInterval(simTimerRef.current);
    };
  }, [lang]);

  // 2. Fetch nearby hospitals immediately + live probe in background
  useEffect(() => {
    getLocation().then(async (loc) => {
      try {
        const res = await getNearbyHospitals(loc.lat, loc.lng);
        if (res && res.hospitals && res.hospitals.length > 0) {
          setHospitals(res.hospitals);
        }
      } catch {}

      // Background probe for GET /hospitals/live without blocking
      getLiveHospitals().then((liveRes) => {
        if (liveRes && liveRes.live_hospitals && liveRes.live_source === "tinyfish") {
          setLiveHospitals(liveRes.live_hospitals);
          setLiveSource("tinyfish");
        }
      });
    });
  }, []);

  // Handle describing what happened or answering follow-up questions
  const handleTriageCall = async (userInput: string) => {
    const textToSend = userInput.trim();
    if (!textToSend || triageLoading) return;
    setTriageLoading(true);
    stopSpeaking();

    try {
      const res = await assess(
        textToSend,
        lang,
        {
          name: profile.name,
          age: profile.age,
          allergies: profile.allergies,
          history: profile.history,
        },
        null,
        null
      );
      setTriageData(res);
      setDescribeText("");

      // Update session history
      if (res.follow_up_question) {
        sessionHistoryRef.current.push(
          { role: "user", text: textToSend },
          { role: "assistant", text: res.follow_up_question }
        );
        speak(res.follow_up_question, lang);
      } else {
        const summaryMsg = res.reasoning || res.advice?.summary || "";
        sessionHistoryRef.current.push(
          { role: "user", text: textToSend },
          { role: "assistant", text: summaryMsg }
        );

        const isEmerg =
          res.care_type === "emergency_112" ||
          Boolean(res.red_flags && res.red_flags.length > 0) ||
          res.status === "emergency" ||
          Boolean(res.dispatch_recommended);

        const steps =
          res.first_aid_steps && res.first_aid_steps.length > 0
            ? res.first_aid_steps
            : res.advice?.do_now || [];

        if (isEmerg) {
          const speakText = [
            pick(lang, EMERGENCY_TEXT.call_112),
            ...steps,
          ].join(". ");
          speak(speakText, lang);

          if (res.dispatch_recommended && !dispatch && !dispatchLoading) {
            handleNotifyDispatch(res);
          }
        } else {
          speak(
            `${pick(lang, EMERGENCY_TEXT.not_emergency_title)}. ${summaryMsg}`,
            lang
          );
        }
      }
    } catch {
      // Keep existing state
    } finally {
      setTriageLoading(false);
    }
  };

  // Determine Triage-Aware Screen State:
  const isEmergency =
    !!triageData &&
    (triageData.care_type === "emergency_112" ||
      Boolean(triageData.red_flags && triageData.red_flags.length > 0) ||
      triageData.status === "emergency" ||
      Boolean(triageData.dispatch_recommended));

  const isFollowUp = !!triageData && !isEmergency && !!triageData.follow_up_question;

  const isNotEmergency =
    !!triageData && !isEmergency && !isFollowUp && !!triageData.care_type;

  const hasNoTriage = !triageData;

  const displaySteps =
    triageData?.first_aid_steps && triageData.first_aid_steps.length > 0
      ? triageData.first_aid_steps
      : triageData?.advice?.do_now || [];

  return (
    <main
      className={`min-h-screen p-4 pb-36 text-ink transition-colors ${
        isEmergency ? "bg-danger-soft/40" : "bg-cream"
      }`}
    >
      <div className="mx-auto max-w-2xl space-y-4">
        {/* Top Header */}
        <header
          className={`rounded-3xl p-4 text-center shadow-md ${
            isEmergency
              ? "border-4 border-danger bg-danger text-white"
              : "bg-white border border-beige text-ink"
          }`}
        >
          <p className="text-xs font-bold uppercase tracking-wider opacity-90">
            {lang === "hindi" ? "आपातकालीन सेवा" : "Emergency Care Support"}
          </p>
          <h1 className="text-2xl sm:text-3xl font-black">
            {isEmergency
              ? lang === "hindi"
                ? "🚨 आपातकालीन स्थिति"
                : "🚨 Emergency Situation"
              : isNotEmergency
              ? lang === "hindi"
                ? "स्वास्थ्य स्थिति जांच"
                : "Triage Assessment"
              : "CareCompass 112 SOS"}
          </h1>
        </header>

        {/* STATE (a): EMERGENCY */}
        {isEmergency && (
          <>
            {/* Prominent Demo Simulation Notice */}
            {isDemoDispatch && (
              <div
                role="status"
                aria-label="Simulation notice"
                className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-center font-bold text-amber-950 shadow-sm text-sm sm:text-base"
              >
                ⚠️ {pick(lang, EMERGENCY_TEXT.demo_banner)}
              </div>
            )}

            {/* Ambulance Notified at HH:MM Banner */}
            {notifiedTime && (
              <div
                role="status"
                className="flex items-center justify-center gap-2 rounded-2xl border-2 border-danger/40 bg-white p-3.5 text-center font-bold text-danger text-base sm:text-lg shadow-sm"
              >
                <span className="text-xl" aria-hidden="true">🚑</span>
                <span>
                  {pick(lang, ADVICE_TEXT.ambulance_notified_at)} {notifiedTime}
                </span>
              </div>
            )}

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

            {/* First-Aid Steps from Response */}
            {displaySteps.length > 0 && (
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
                    text={[pick(lang, EMERGENCY_TEXT.call_112), ...displaySteps].join(". ")}
                  />
                </div>

                <ol className="space-y-3 pl-2">
                  {displaySteps.map((step, idx) => (
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
            )}

            {/* Notify Ambulance and Hospital Card */}
            <section
              aria-label="Notify Responder"
              className="rounded-3xl bg-white p-5 shadow-sm space-y-4 border border-beige"
            >
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-ink">
                  {pick(lang, EMERGENCY_TEXT.dispatch_title)}
                </h2>
                <p className="text-xs text-muted">
                  {pick(lang, EMERGENCY_TEXT.dispatch_desc)}
                </p>
              </div>

              {!dispatch && (
                <button
                  type="button"
                  onClick={() => handleNotifyDispatch()}
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

              {/* Dispatch Timeline */}
              {dispatch && (
                <div className="space-y-4 pt-1">
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

                  <div className="rounded-2xl bg-primary-soft/50 p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-bold uppercase text-primary">Hospital</span>
                        <h3 className="text-lg font-bold text-ink">{dispatch.hospital.name}</h3>
                        <p className="text-xs text-muted">{dispatch.hospital.distance_km} km away</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold uppercase text-primary">ETA</span>
                        <p className="text-2xl font-black text-danger">~{dispatch.eta_minutes} min</p>
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
                </div>
              )}
            </section>
          </>
        )}

        {/* STATE (b): NOT AN EMERGENCY */}
        {isNotEmergency && (
          <section className="rounded-3xl bg-white p-6 shadow-sm border border-beige space-y-4">
            <div className="rounded-2xl bg-ok-soft p-4 border border-ok/30 flex items-start gap-3">
              <span className="text-3xl" aria-hidden="true">
                🟢
              </span>
              <div>
                <h2 className="text-xl font-bold text-ok">
                  {pick(lang, EMERGENCY_TEXT.not_emergency_title)}
                </h2>
                <p className="text-xs text-ink/80 mt-1">
                  {pick(lang, EMERGENCY_TEXT.not_emergency_desc)}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary-soft px-4 py-1 text-sm font-bold text-primary">
                  {pick(
                    lang,
                    CARE_LABEL[triageData.care_type!] || {
                      en: triageData.care_type!,
                      hi: triageData.care_type!,
                    }
                  )}
                </span>
              </div>
              <p className="text-base text-ink leading-relaxed">{triageData.reasoning}</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="min-h-[48px] w-full sm:w-auto flex-1 rounded-2xl bg-primary px-5 py-3 font-bold text-white hover:bg-primary/90 transition focus-visible:outline-3 focus-visible:outline-primary"
              >
                {pick(lang, EMERGENCY_TEXT.open_home_btn)}
              </button>
              <a
                href="tel:112"
                className="min-h-[48px] w-full sm:w-auto flex items-center justify-center gap-1.5 rounded-2xl border border-danger/40 bg-white px-5 py-3 font-bold text-sm text-danger hover:bg-danger-soft/40 transition focus-visible:outline-3 focus-visible:outline-primary"
              >
                <span>📞</span>
                <span>Call 112 Anyway</span>
              </a>
            </div>
          </section>
        )}

        {/* STATE (c): FOLLOW-UP QUESTION */}
        {isFollowUp && (
          <section className="rounded-3xl bg-white p-5 shadow-sm border border-beige space-y-4">
            <div className="rounded-2xl bg-beige/60 p-4 border border-beige space-y-2">
              <p className="text-lg font-bold text-ink">{triageData.follow_up_question}</p>
              <ListenButton text={triageData.follow_up_question || ""} />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={describeText}
                onChange={(e) => setDescribeText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTriageCall(describeText)}
                placeholder="Type your answer here..."
                className="flex-1 min-h-[48px] rounded-2xl bg-beige/40 px-4 py-3 text-base focus-visible:outline-3 focus-visible:outline-primary"
              />
              <button
                type="button"
                onClick={() => handleTriageCall(describeText)}
                disabled={triageLoading || !describeText.trim()}
                className="min-h-[48px] rounded-2xl bg-primary px-5 py-3 font-bold text-white disabled:opacity-50 hover:bg-primary/90 transition focus-visible:outline-3 focus-visible:outline-primary"
              >
                {triageLoading ? "..." : "Send"}
              </button>
            </div>
          </section>
        )}

        {/* INITIAL STATE: Arrived with no text / SOS pressed directly with no prior triage */}
        {hasNoTriage && (
          <section className="rounded-3xl bg-white p-5 shadow-sm space-y-4 border border-beige">
            <div className="rounded-2xl bg-danger-soft/60 p-4 border border-danger/30 text-sm font-semibold text-danger">
              ⚠️ {pick(lang, EMERGENCY_TEXT.generic_emergency_block)}
            </div>

            {/* Huge CALL 112 button */}
            <a
              href="tel:112"
              aria-label="Call 112 immediately"
              className="flex min-h-[64px] w-full items-center justify-center gap-3 rounded-2xl bg-danger py-4 text-center text-2xl font-black text-white shadow-lg hover:bg-danger/90 active:scale-98 transition focus-visible:outline-4 focus-visible:outline-white"
            >
              <span>📞</span>
              <span>{pick(lang, EMERGENCY_TEXT.call_112)}</span>
            </a>

            {/* Describe what happened input box */}
            <div className="space-y-2 pt-2">
              <label htmlFor="emergency-describe-input" className="block text-sm font-bold text-ink">
                {pick(lang, EMERGENCY_TEXT.describe_label)}
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="emergency-describe-input"
                  value={describeText}
                  onChange={(e) => setDescribeText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleTriageCall(describeText)}
                  placeholder={pick(lang, EMERGENCY_TEXT.describe_placeholder)}
                  className="flex-1 min-h-[48px] rounded-2xl bg-beige/40 px-4 py-3 text-base focus-visible:outline-3 focus-visible:outline-primary"
                />
                <button
                  type="button"
                  onClick={() => handleTriageCall(describeText)}
                  disabled={triageLoading || !describeText.trim()}
                  className="min-h-[48px] rounded-2xl bg-primary px-5 py-3 font-bold text-white disabled:opacity-50 hover:bg-primary/90 transition focus-visible:outline-3 focus-visible:outline-primary"
                >
                  {triageLoading ? "..." : pick(lang, EMERGENCY_TEXT.describe_btn)}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Collapsible Hospitals Section: Static Nearby + Live TinyFish Badge if available */}
        <section className="rounded-3xl bg-white p-5 shadow-sm space-y-3 border border-beige">
          <button
            type="button"
            onClick={() => setHospitalsOpen((prev) => !prev)}
            aria-expanded={hospitalsOpen}
            className="flex min-h-[48px] w-full items-center justify-between text-left font-bold text-lg text-ink focus-visible:outline-3 focus-visible:outline-primary rounded-xl"
          >
            <div className="flex items-center gap-2">
              <span>🏥 {pick(lang, EMERGENCY_TEXT.nearby_hospitals_title)}</span>
              {liveSource === "tinyfish" && (
                <span className="rounded-full bg-ok-soft border border-ok px-2.5 py-0.5 text-xs font-bold text-ok">
                  {pick(lang, EMERGENCY_TEXT.live_badge)}
                </span>
              )}
            </div>
            <span className="text-xl text-muted" aria-hidden="true">
              {hospitalsOpen ? "▲" : "▼"}
            </span>
          </button>

          {hospitalsOpen && (
            <div className="space-y-3 pt-2">
              {/* Show Live TinyFish Results if available */}
              {liveHospitals && liveHospitals.length > 0 && (
                <div className="space-y-2 mb-3">
                  <p className="text-xs font-bold text-ok uppercase tracking-wider">
                    {pick(lang, EMERGENCY_TEXT.live_badge)}
                  </p>
                  {liveHospitals.map((h, i) => (
                    <div
                      key={`live-${i}`}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-ok-soft/30 p-3.5 border border-ok/40"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-ink truncate">{h.name}</p>
                        <p className="text-xs text-muted">
                          {h.distance_km ? `${h.distance_km} km • ` : ""}
                          {h.phone || "Emergency Line"}
                        </p>
                      </div>
                      {h.phone && (
                        <a
                          href={`tel:${h.phone}`}
                          className="flex min-h-[48px] min-w-[72px] items-center justify-center rounded-full bg-ok px-4 py-2 font-bold text-sm text-white shadow-sm hover:bg-ok/90 focus-visible:outline-3 focus-visible:outline-ok"
                        >
                          📞 {pick(lang, EMERGENCY_TEXT.call_btn)}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Static Nearby Hospitals */}
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
