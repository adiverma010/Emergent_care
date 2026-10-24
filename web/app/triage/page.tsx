"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "../../context/AppContext";
import { triageSymptoms, bookHomecare } from "../../lib/api";
import {
  TriageResponse,
  ConversationTurn,
  CaregiverMatch,
  HomecareBookingResponse,
  CareType,
  UrgencyLevel,
} from "../../lib/types";
import { InitialsAvatar } from "../../components/InitialsAvatar";

function TriageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const { profile, speakText, isSpeaking, stopSpeaking, setAutoRead } = useApp();

  const [inputConcern, setInputConcern] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Conversation history
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [followUpAnswer, setFollowUpAnswer] = useState("");

  // Result state
  const [triageResult, setTriageResult] = useState<TriageResponse | null>(null);

  // Booking Modal
  const [selectedCaregiver, setSelectedCaregiver] = useState<CaregiverMatch | null>(null);
  const [bookingDate, setBookingDate] = useState("Tomorrow");
  const [bookingSlot, setBookingSlot] = useState("Morning Slot (9:00 AM - 11:00 AM)");
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState<HomecareBookingResponse | null>(null);

  // Consultation preparation notes
  const [prepQuestions, setPrepQuestions] = useState<string[]>([
    "Kitne din tak yeh dawai leni hogi?",
    "Kya koi khaane-peene ka parhez (diet restriction) hai?",
    "Aise kaun se lakshan hain jinke badhne par turant hospital jaana chahiye?",
  ]);
  const [newQuestion, setNewQuestion] = useState("");

  // Run triage function
  const runTriage = useCallback(
    async (text: string, history: ConversationTurn[]) => {
      if (!text.trim()) return;

      setLoading(true);
      setError(null);

      try {
        const response = await triageSymptoms({
          user_input: text.trim(),
          language: profile.language,
          location: {
            lat: 28.54,
            lng: 77.27,
            address: "South Delhi, Delhi",
          },
          conversation_history: history,
        });

        // Safety override check: If emergency detected, immediately route to /emergency
        if (
          response.care_type === "emergency_112" ||
          response.urgency === "emergency" ||
          (response.red_flags && response.red_flags.length > 0)
        ) {
          const emergencyType = response.red_flags?.[0] || "emergency";
          router.push(`/emergency?type=${emergencyType}`);
          return;
        }

        setTriageResult(response);

        // Auto-read answers if enabled
        if (profile.autoRead && response.reasoning) {
          speakText(response.reasoning);
        }
      } catch (err: any) {
        setError(err.message || "Failed to process symptoms. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [profile.language, profile.autoRead, router, speakText]
  );

  // Automatically submit if initialQuery was present in URL params
  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      runTriage(initialQuery, []);
    }
  }, [initialQuery, runTriage]);

  const handleInitialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputConcern.trim()) return;
    setConversationHistory([]);
    setTriageResult(null);
    runTriage(inputConcern, []);
  };

  const handleFollowUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpAnswer.trim() || !triageResult?.follow_up_question) return;

    const newHistory: ConversationTurn[] = [
      ...conversationHistory,
      { role: "user", content: inputConcern },
      { role: "assistant", content: triageResult.follow_up_question },
    ];

    setConversationHistory(newHistory);
    runTriage(followUpAnswer, newHistory);
    setFollowUpAnswer("");
  };

  const handleReset = () => {
    setInputConcern("");
    setConversationHistory([]);
    setTriageResult(null);
    setSelectedCaregiver(null);
    setBookingConfirmed(null);
    setError(null);
    stopSpeaking();
  };

  const handleConfirmBooking = async () => {
    if (!selectedCaregiver) return;
    setBookingLoading(true);

    try {
      const res = await bookHomecare({
        caregiver_id: selectedCaregiver.caregiver_id,
        user_name: profile.name || "Patient",
        care_type: triageResult?.care_type || "homecare",
        date: bookingDate,
        time_slot: bookingSlot,
      });
      setBookingConfirmed(res);
    } catch (e) {
      console.warn("Booking failed:", e);
    } finally {
      setBookingLoading(false);
    }
  };

  const addPrepQuestion = () => {
    if (newQuestion.trim()) {
      setPrepQuestions([...prepQuestions, newQuestion.trim()]);
      setNewQuestion("");
    }
  };

  const removePrepQuestion = (idx: number) => {
    setPrepQuestions(prepQuestions.filter((_, i) => i !== idx));
  };

  const isHindi = profile.language === "hi";
  const isHinglish = profile.language === "hinglish";

  const getCareTypeLabel = (type: CareType | null) => {
    switch (type) {
      case "home_nursing":
        return isHindi ? "घर पर नर्स सेवा (Home Nursing)" : "Home Nursing Visit";
      case "paramedic_home_visit":
        return isHindi ? "पैरामेडिक गृह सेवा (Paramedic Care)" : "Paramedic Home Visit";
      case "lab_test_home":
        return isHindi ? "घर पर खून जांच (Lab Sample Collection)" : "Lab Test at Home";
      case "teleconsultation":
        return isHindi ? "ऑनलाइन डॉक्टर परामर्श (Teleconsultation)" : "Online Video Teleconsultation";
      default:
        return "Specialized Healthcare";
    }
  };

  const getUrgencyBadge = (urgency: UrgencyLevel | null) => {
    if (urgency === "emergency") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-black text-rose-800 border border-rose-300">
          <span className="icon-symbol text-base text-rose-600 animate-pulse">emergency</span>
          Urgent Emergency 112
        </span>
      );
    }
    if (urgency === "same_day") {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-300">
          <span className="icon-symbol text-base text-amber-600">schedule</span>
          {isHindi ? "आज ही सेवा आवश्यक (Same Day)" : "Same Day Attention"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800 border border-teal-300">
        <span className="icon-symbol text-base text-teal-600">event_available</span>
        {isHindi ? "नियमित अपॉइंटमेंट (Scheduled)" : "Scheduled Care"}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header & Accessibility Bar */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <span className="icon-symbol text-3xl text-teal-600">stethoscope</span>
            <span>{isHindi ? "लक्षण जांच एवं देखभाल" : isHinglish ? "Symptom Triage & Matching" : "Symptom Triage"}</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            {isHindi
              ? "अपनी समस्या साझा करें। साथी आपको सबसे उपयुक्त स्वास्थ्य सेवा और प्रमाणित देखभालकर्ता से जोड़ेगा।"
              : "Describe your concern. We safely assess urgency and match you to top-rated verified caregivers."}
          </p>
        </div>

        {/* Auto-read Toggle Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRead(!profile.autoRead)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              profile.autoRead
                ? "border-teal-500 bg-teal-50 text-teal-800"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
            aria-pressed={profile.autoRead}
            title="Automatically read clinical reasoning aloud"
          >
            <span className="icon-symbol text-base text-teal-600">record_voice_over</span>
            <span>{profile.autoRead ? "Auto-Read ON" : "Auto-Read OFF"}</span>
          </button>

          {triageResult && (
            <button
              onClick={handleReset}
              className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Start Over
            </button>
          )}
        </div>
      </div>

      {/* Main Intake Form (When no result or asking new concern) */}
      {!triageResult && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm mb-6">
          <form onSubmit={handleInitialSubmit}>
            <label htmlFor="symptom-textarea" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Describe Symptoms / स्वास्थ्य संबंधी परेशानी बताएं
            </label>
            <textarea
              id="symptom-textarea"
              value={inputConcern}
              onChange={(e) => setInputConcern(e.target.value)}
              rows={4}
              placeholder={
                isHindi
                  ? "उदाहरण: पिताजी को दो दिन से 102 बुखार है, शरीर में दर्द है और सांस लेने में हल्की परेशानी हो रही है..."
                  : isHinglish
                  ? "Example: Papa ko 2 din se tez bukhar aur khansi hai, injection aur BP check karwana hai..."
                  : "e.g. My father has severe throat pain, difficulty swallowing, and moderate fever since 2 days..."
              }
              className="w-full rounded-2xl border border-slate-300 p-4 text-sm sm:text-base font-medium text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              required
            />

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">Quick tests:</span>
                <button
                  type="button"
                  onClick={() => setInputConcern("Ghar par sterile injection lagwana hai aur wound dressing karni hai")}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] hover:bg-slate-100"
                >
                  Home Injection
                </button>
                <button
                  type="button"
                  onClick={() => setInputConcern("Pet me dard ho raha hai")}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] hover:bg-slate-100"
                >
                  Stomach Pain (Multi-turn)
                </button>
                <button
                  type="button"
                  onClick={() => setInputConcern("Severe chest pain, heavy pressure on chest and cold sweat")}
                  className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-100"
                >
                  Chest Pain (Emergency)
                </button>
              </div>

              <button
                type="submit"
                disabled={loading || !inputConcern.trim()}
                className="flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-6 py-3 text-xs sm:text-sm font-extrabold text-white shadow-md hover:bg-teal-800 disabled:opacity-50 transition touch-target"
              >
                {loading ? (
                  <>
                    <span className="icon-symbol text-lg animate-spin">progress_activity</span>
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <span>{isHindi ? "जांच करें" : "Assess Urgency"}</span>
                    <span className="icon-symbol text-lg">arrow_forward</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Loading state indicator */}
      {loading && (
        <div className="rounded-3xl border border-teal-200 bg-teal-50/60 p-8 text-center my-6 animate-pulse">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 text-white">
            <span className="icon-symbol text-3xl animate-spin">progress_activity</span>
          </div>
          <h3 className="text-lg font-bold text-teal-950">Safety checks & clinical routing in progress</h3>
          <p className="mt-1 text-xs text-teal-800">
            Scanning for emergency red flags, checking caregiver availability and proximity...
          </p>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 text-sm mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="icon-symbol text-rose-600">error</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => runTriage(inputConcern, conversationHistory)}
            className="rounded-lg bg-rose-700 px-3 py-1 text-xs font-bold text-white hover:bg-rose-800"
          >
            Retry
          </button>
        </div>
      )}

      {/* Follow-up question Chat Bubble View */}
      {triageResult && triageResult.follow_up_question && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm mb-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-teal-700 mb-4 flex items-center gap-1.5">
            <span className="icon-symbol text-lg">forum</span>
            <span>Follow-up Clarification / अतिरिक्त जानकारी</span>
          </h2>

          <div className="space-y-4 mb-6">
            {/* User turn */}
            <div className="flex justify-end">
              <div className="max-w-md rounded-2xl rounded-tr-xs bg-teal-700 px-4 py-3 text-sm text-white shadow-xs">
                <p className="font-medium">{inputConcern}</p>
                <span className="mt-1 block text-[10px] text-teal-200 text-right">You</span>
              </div>
            </div>

            {/* Assistant follow up question bubble */}
            <div className="flex justify-start">
              <div className="max-w-lg rounded-2xl rounded-tl-xs bg-slate-100 border border-slate-200 px-4 py-3.5 text-sm text-slate-900 shadow-xs">
                <div className="flex items-center gap-2 mb-1 text-teal-700 font-bold text-xs">
                  <span className="icon-symbol text-base">support_agent</span>
                  <span>CareCompass Sathi</span>
                </div>
                <p className="font-semibold text-slate-800 leading-relaxed">
                  {triageResult.follow_up_question}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => speakText(triageResult.follow_up_question || "")}
                    className="flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:text-teal-900"
                  >
                    <span className="icon-symbol text-sm">volume_up</span>
                    <span>Listen</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Follow up answer form */}
          <form onSubmit={handleFollowUpSubmit} className="flex gap-2">
            <input
              type="text"
              value={followUpAnswer}
              onChange={(e) => setFollowUpAnswer(e.target.value)}
              placeholder="Type your answer (e.g. Bukhar 101 hai aur ulti bhi ho rahi hai)..."
              className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              autoFocus
              required
            />
            <button
              type="submit"
              disabled={loading || !followUpAnswer.trim()}
              className="rounded-xl bg-teal-700 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50 transition"
            >
              Reply
            </button>
          </form>
        </div>
      )}

      {/* Final Triage Outcome (Care Type, Urgency, Rationale, Caregiver Matches) */}
      {triageResult && !triageResult.follow_up_question && triageResult.care_type && (
        <div className="space-y-6">
          {/* Main Triage Decision Card */}
          <div className="rounded-3xl border border-teal-200 bg-white p-6 sm:p-8 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="icon-symbol text-2xl text-teal-700">verified</span>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                    Recommended Care Route
                  </span>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    {getCareTypeLabel(triageResult.care_type)}
                  </h2>
                </div>
              </div>
              <div>{getUrgencyBadge(triageResult.urgency)}</div>
            </div>

            {/* Clinical Reasoning with Listen button */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <span className="icon-symbol text-base text-teal-600">psychology_alt</span>
                  <span>Clinical Reasoning & Assessment</span>
                </span>
                <button
                  onClick={() => speakText(triageResult.reasoning)}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                    isSpeaking
                      ? "border-amber-500 bg-amber-50 text-amber-800"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                  }`}
                  aria-label="Listen to clinical reasoning"
                >
                  <span className="icon-symbol text-sm">{isSpeaking ? "stop" : "volume_up"}</span>
                  <span>{isSpeaking ? "Stop" : "Listen"}</span>
                </button>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed font-medium">
                {triageResult.reasoning}
              </p>
            </div>
          </div>

          {/* Matched Caregiver Cards */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <span className="icon-symbol text-teal-600">people</span>
                <span>Verified Available Caregivers ({triageResult.matched_caregivers.length})</span>
              </h3>
              <span className="text-xs text-slate-500">Ranked by proximity, role fit & rating</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {triageResult.matched_caregivers.map((cg) => (
                <div
                  key={cg.caregiver_id}
                  className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-teal-400 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start gap-3.5 mb-3">
                      <InitialsAvatar name={cg.name} size="lg" role={cg.role} />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-base font-bold text-slate-900">{cg.name}</h4>
                          <span className="rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-[11px] font-black text-teal-800">
                            {Math.round(cg.score * 100)}% Match
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-teal-700">{cg.role}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {cg.rating && (
                            <span className="flex items-center gap-0.5 font-bold text-amber-600">
                              <span className="icon-symbol text-xs text-amber-500">star</span>
                              {cg.rating}
                            </span>
                          )}
                          {cg.distance_km !== undefined && (
                            <span>• {cg.distance_km === 0 ? "Online Teleconsult" : `${cg.distance_km} km away`}</span>
                          )}
                          {cg.tier && <span className="rounded bg-slate-100 px-1.5 text-[10px]">{cg.tier}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Grounded Match Reason */}
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 mb-3 text-xs text-slate-700 leading-relaxed">
                      <strong className="font-bold text-slate-800">Why matched:</strong> {cg.reason}
                    </div>

                    {/* Skills pills */}
                    {cg.skills && cg.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {cg.skills.slice(0, 3).map((skill, i) => (
                          <span key={i} className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Caregiver Actions: Listen + Book Button */}
                  <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => speakText(`${cg.name}, ${cg.role}. Match reason: ${cg.reason}`)}
                      className="flex items-center justify-center rounded-xl border border-slate-200 p-2.5 text-slate-700 hover:bg-slate-50"
                      aria-label={`Listen to details for ${cg.name}`}
                      title="Read caregiver profile aloud"
                    >
                      <span className="icon-symbol text-lg">volume_up</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedCaregiver(cg);
                        setBookingConfirmed(null);
                      }}
                      className="flex-1 rounded-xl bg-teal-700 py-2.5 px-4 text-xs font-extrabold text-white shadow-xs hover:bg-teal-800 transition touch-target flex items-center justify-center gap-1.5"
                    >
                      <span>Book Visit (Mock)</span>
                      <span className="icon-symbol text-base">calendar_month</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Consultation Preparation Handoff Note */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-2 flex items-center gap-2">
              <span className="icon-symbol text-teal-600">clinical_notes</span>
              <span>Your Consultation Preparation Note</span>
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Share or review this quick summary when speaking to the visiting nurse or physician:
            </p>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Reported Concern
              </span>
              <p className="text-sm font-semibold text-slate-800">{inputConcern}</p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800 block">Questions to ask your provider:</span>
              <ul className="space-y-1.5">
                {prepQuestions.map((q, idx) => (
                  <li key={idx} className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5 text-xs text-slate-800 border border-slate-200">
                    <span className="font-medium">{q}</span>
                    <button
                      onClick={() => removePrepQuestion(idx)}
                      className="text-slate-400 hover:text-rose-600 font-bold p-1"
                      aria-label="Remove question"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addPrepQuestion();
                    }
                  }}
                  placeholder="Add custom question to ask..."
                  className="flex-1 rounded-xl border border-slate-300 p-2.5 text-xs outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
                <button
                  type="button"
                  onClick={addPrepQuestion}
                  className="rounded-xl bg-slate-100 px-4 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  + Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Confirmation Modal */}
      {selectedCaregiver && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="Book Caregiver Appointment"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl">
            {!bookingConfirmed ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <h3 className="text-lg font-bold text-slate-900">Confirm Caregiver Visit</h3>
                  <button
                    onClick={() => setSelectedCaregiver(null)}
                    className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
                  >
                    <span className="icon-symbol text-xl">close</span>
                  </button>
                </div>

                <div className="flex items-center gap-3 rounded-2xl bg-teal-50 p-3.5 mb-4 border border-teal-200">
                  <InitialsAvatar name={selectedCaregiver.name} size="md" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{selectedCaregiver.name}</h4>
                    <p className="text-xs text-teal-800">{selectedCaregiver.role}</p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Appointment Date</label>
                    <select
                      value={bookingDate}
                      onChange={(e) => setBookingDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold text-slate-800 outline-none"
                    >
                      <option value="Today">Today (Immediate same-day dispatch)</option>
                      <option value="Tomorrow">Tomorrow</option>
                      <option value="Day after tomorrow">Day after tomorrow</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Time Window</label>
                    <select
                      value={bookingSlot}
                      onChange={(e) => setBookingSlot(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-semibold text-slate-800 outline-none"
                    >
                      <option value="Morning Slot (9:00 AM - 11:00 AM)">Morning (9:00 AM - 11:00 AM)</option>
                      <option value="Afternoon Slot (1:00 PM - 3:00 PM)">Afternoon (1:00 PM - 3:00 PM)</option>
                      <option value="Evening Slot (5:00 PM - 7:00 PM)">Evening (5:00 PM - 7:00 PM)</option>
                    </select>
                  </div>

                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                    <strong className="font-bold">Demo Mode:</strong> No live payment is deducted. A mock appointment will be confirmed with realistic booking ID.
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedCaregiver(null)}
                    className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmBooking}
                    disabled={bookingLoading}
                    className="flex-1 rounded-xl bg-teal-700 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50"
                  >
                    {bookingLoading ? "Confirming..." : "Confirm Booking"}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <span className="icon-symbol text-4xl">check_circle</span>
                </div>
                <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-800 mb-2">
                  BOOKING CONFIRMED (DEMO)
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mb-1">
                  ID: {bookingConfirmed.booking_id}
                </h3>
                <p className="text-xs text-slate-600 mb-4">{bookingConfirmed.message}</p>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-xs space-y-1 mb-6">
                  <div><strong>Caregiver:</strong> {bookingConfirmed.caregiver_name}</div>
                  <div><strong>Scheduled:</strong> {bookingConfirmed.scheduled_time}</div>
                  <div><strong>Care Type:</strong> {bookingConfirmed.care_type}</div>
                </div>

                <button
                  onClick={() => {
                    setSelectedCaregiver(null);
                    setBookingConfirmed(null);
                  }}
                  className="w-full rounded-xl bg-teal-700 py-3 text-xs font-bold text-white shadow-sm hover:bg-teal-800"
                >
                  Close & Back to Results
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TriagePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl p-8 text-center text-slate-500">
          <span className="icon-symbol text-4xl animate-spin text-teal-600">progress_activity</span>
          <p className="mt-2 text-sm font-semibold">Loading CareCompass Triage...</p>
        </div>
      }
    >
      <TriageContent />
    </Suspense>
  );
}
