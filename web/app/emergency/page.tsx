"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useApp } from "../../context/AppContext";
import {
  createDispatch,
  getDispatchStatus,
  getNearbyHospitals,
} from "../../lib/api";
import {
  DispatchStatus,
  NearbyHospital,
} from "../../lib/types";
import { MOCK_FIRST_AID_STEPS } from "../../lib/mock";
import { ListenButton } from "../../components/ListenButton";

function EmergencyContent() {
  const searchParams = useSearchParams();
  const emergencyType = searchParams.get("type") || "chest_pain";

  const { profile, speakText, stopSpeaking, isSpeaking } = useApp();

  const [hospitals, setHospitals] = useState<NearbyHospital[]>([]);
  const [dispatch, setDispatch] = useState<DispatchStatus | null>(null);
  const [pollTick, setPollTick] = useState(0);
  const [isDispatching, setIsDispatching] = useState(false);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Retrieve numbered first-aid steps based on emergency type
  const firstAidSteps = MOCK_FIRST_AID_STEPS[emergencyType] || MOCK_FIRST_AID_STEPS.default;

  // Read aloud first aid steps automatically on page load
  useEffect(() => {
    const textToRead = `Emergency assistance mode activated. Call 112 immediately. First aid instructions: ${firstAidSteps.join(". ")}`;
    speakText(textToRead);

    return () => {
      stopSpeaking();
    };
  }, [emergencyType, firstAidSteps, speakText, stopSpeaking]);

  // Load nearby hospitals
  useEffect(() => {
    getNearbyHospitals(28.54, 77.27).then((res) => {
      setHospitals(res);
    });
  }, []);

  // Initiate automatic dispatch request
  useEffect(() => {
    let isMounted = true;
    setIsDispatching(true);

    createDispatch({
      emergency_type: emergencyType,
      location: {
        lat: 28.54,
        lng: 77.27,
        address: "South Delhi, New Delhi",
      },
      user_name: profile.name || "Patient",
      contact: "112 Emergency Relay",
    }).then((res) => {
      if (isMounted) {
        setDispatch(res);
        setIsDispatching(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [emergencyType, profile.name]);

  // Live polling for dispatch timeline updates every 4 seconds
  useEffect(() => {
    if (!dispatch?.dispatch_id) return;

    pollTimerRef.current = setInterval(() => {
      setPollTick((prev) => {
        const nextTick = prev + 1;
        getDispatchStatus(dispatch.dispatch_id, nextTick).then((updated) => {
          setDispatch(updated);
        });
        return nextTick;
      });
    }, 4000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [dispatch?.dispatch_id]);

  const isHindi = profile.language === "hi";
  const isHinglish = profile.language === "hinglish";

  const getEmergencyHeading = () => {
    if (emergencyType.includes("chest") || emergencyType.includes("heart")) {
      return isHindi ? "सीने में तेज दर्द / दिल का दौरा आपातकाल" : "Chest Pain & Cardiac Red Flag Alert";
    }
    if (emergencyType.includes("breath")) {
      return isHindi ? "गंभीर सांस की तकलीफ" : "Severe Respiratory Distress Alert";
    }
    if (emergencyType.includes("stroke") || emergencyType.includes("paralysis")) {
      return isHindi ? "स्ट्रोक / फालिज आपातकाल" : "Acute Stroke Symptoms Detected";
    }
    if (emergencyType.includes("bleed")) {
      return isHindi ? "गंभीर रक्तस्राव आपातकाल" : "Severe Bleeding & Hemorrhage Alert";
    }
    return isHindi ? "चिकित्सीय आपातकालीन स्थिति" : "Medical Emergency Override Active";
  };

  return (
    <div className="min-h-screen bg-rose-50/80 px-4 py-6 sm:py-10 transition-colors">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Top Emergency Action Header */}
        <div className="rounded-3xl border-2 border-rose-300 bg-white p-6 sm:p-8 shadow-xl text-center">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-600 text-white shadow-lg ring-8 ring-rose-200 mb-4 animate-bounce">
            <span className="icon-symbol text-5xl">e911_emergency</span>
          </div>

          <span className="inline-block rounded-full bg-rose-100 border border-rose-300 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-rose-800 mb-2">
            CRITICAL SAFETY OVERRIDE ACTIVE
          </span>

          <h1 className="text-2xl sm:text-4xl font-black text-rose-950 tracking-tight">
            {getEmergencyHeading()}
          </h1>

          <p className="mt-2 text-sm sm:text-base font-semibold text-rose-800/90 max-w-2xl mx-auto">
            {isHindi
              ? "लक्षणों के आधार पर तत्काल आपातकालीन सहायता की आवश्यकता है। कृपया तुरंत 112 डायल करें।"
              : isHinglish
              ? "Acute symptoms detected. Turant 112 par call karein aur ambulance team ka intezar karein."
              : "High-risk red flag detected. All routine appointments are halted. Please call 112 immediately."}
          </p>

          {/* Large Call 112 Button */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="tel:112"
              className="flex w-full sm:w-auto items-center justify-center gap-3 rounded-2xl bg-rose-600 px-10 py-5 text-xl font-black text-white shadow-xl shadow-rose-600/30 transition hover:bg-rose-700 active:scale-95 touch-target ring-4 ring-rose-300"
              aria-label="Call Emergency Services 112 immediately"
            >
              <span className="icon-symbol text-3xl animate-pulse">call</span>
              <span>CALL 112 NOW (आपातकालीन कॉल)</span>
            </a>

            <button
              onClick={() => {
                const fullText = `Emergency instructions: ${firstAidSteps.join(". ")}`;
                speakText(fullText);
              }}
              className="flex items-center justify-center gap-2 rounded-2xl border-2 border-rose-200 bg-white px-6 py-5 text-sm font-bold text-rose-800 hover:bg-rose-50 transition"
              aria-label="Replay audio instructions"
            >
              <span className="icon-symbol text-xl text-rose-600">volume_up</span>
              <span>{isHindi ? "निर्देश फिर से सुनें" : "Replay Instructions"}</span>
            </button>
          </div>
        </div>

        {/* Live Ambulance Dispatch Timeline */}
        <div className="rounded-3xl border border-rose-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="icon-symbol text-2xl text-rose-600">ambulance</span>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  {isHindi ? "लाइव एम्बुलेंस डिस्पैच स्थिति" : "Live Ambulance Dispatch Status"}
                </h2>
                <span className="text-xs text-slate-500">
                  Dispatch ID: {dispatch?.dispatch_id || "DISP-Connecting..."}
                </span>
              </div>
            </div>

            {dispatch && (
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800">
                  {dispatch.status === "arrived"
                    ? "ARRIVED AT SCENE"
                    : dispatch.status === "en_route"
                    ? `EN ROUTE • ETA ${dispatch.eta_minutes} MINS`
                    : dispatch.status === "ambulance_assigned"
                    ? `ASSIGNED (${dispatch.ambulance_id})`
                    : "DISPATCH NOTIFIED"}
                </span>
              </div>
            )}
          </div>

          {dispatch ? (
            <div className="space-y-4">
              {/* ETA & Vehicle Info Pill */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-2xl bg-rose-50/60 border border-rose-200/80 p-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Assigned Unit:</span>
                  <strong className="text-sm font-extrabold text-slate-900">{dispatch.ambulance_id}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Destination Facility:</span>
                  <strong className="text-sm font-extrabold text-slate-900">{dispatch.hospital_name}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Estimated Arrival:</span>
                  <strong className="text-sm font-extrabold text-rose-700">
                    {dispatch.eta_minutes > 0 ? `${dispatch.eta_minutes} Minutes` : "Arrived"}
                  </strong>
                </div>
              </div>

              {/* Timeline Steps */}
              <div className="space-y-3 pt-2">
                {dispatch.timeline.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        step.done
                          ? "bg-emerald-600 text-white ring-2 ring-emerald-200"
                          : "bg-slate-100 text-slate-400 border border-slate-300"
                      }`}
                    >
                      {step.done ? <span className="icon-symbol text-base">check</span> : idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold ${step.done ? "text-slate-900" : "text-slate-500"}`}>
                          {step.step}
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500">{step.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-slate-500">
              <span className="icon-symbol text-2xl animate-spin text-rose-600">progress_activity</span>
              <p className="mt-1">Connecting to 112 emergency routing service...</p>
            </div>
          )}
        </div>

        {/* Numbered First Aid Steps (Read Aloud Automatically) */}
        <div className="rounded-3xl border border-amber-300 bg-amber-50/60 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-extrabold text-amber-950 flex items-center gap-2">
              <span className="icon-symbol text-amber-700">healing</span>
              <span>
                {isHindi ? "महत्वपूर्ण प्राथमिक चिकित्सा (First Aid Steps)" : "Immediate First-Aid Instructions"}
              </span>
            </h2>
            <ListenButton text={firstAidSteps.join(". ")} label="Listen" />
          </div>

          <ol className="space-y-3">
            {firstAidSteps.map((step, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 rounded-2xl border border-amber-200/80 bg-white p-4 shadow-xs"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-black text-white">
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 leading-relaxed">{step}</p>
                </div>
                <button
                  onClick={() => speakText(step)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-amber-800 hover:bg-amber-50 transition"
                  aria-label={`Listen to step ${idx + 1}`}
                  title="Read step aloud"
                >
                  <span className="icon-symbol text-lg">volume_up</span>
                </button>
              </li>
            ))}
          </ol>
        </div>

        {/* Nearby Verified Emergency Hospitals with Call Buttons */}
        <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <h2 className="text-lg font-extrabold text-slate-900 mb-4 flex items-center gap-2">
            <span className="icon-symbol text-teal-600">local_hospital</span>
            <span>{isHindi ? "नजदीकी आपातकालीन अस्पताल" : "Nearby Emergency Hospitals"}</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hospitals.map((hosp) => (
              <div
                key={hosp.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-teal-400 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-base font-bold text-slate-900">{hosp.name}</h3>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                      {hosp.distance_km} km
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">{hosp.address}</p>

                  <div className="flex flex-wrap gap-1.5 mb-4">
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                      <span className="icon-symbol text-xs text-emerald-600">bed</span>
                      {hosp.emergency_beds_available} Emergency Beds
                    </span>
                    {hosp.has_icu && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                        <span className="icon-symbol text-xs text-blue-600">vital_signs</span>
                        ICU Ready
                      </span>
                    )}
                  </div>
                </div>

                <a
                  href={`tel:${hosp.phone}`}
                  className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 px-4 text-xs font-extrabold text-white transition hover:bg-slate-800 active:scale-95 touch-target"
                  aria-label={`Call emergency desk at ${hosp.name}`}
                >
                  <span className="icon-symbol text-base text-rose-400">call</span>
                  <span>Call Emergency Desk ({hosp.phone})</span>
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Back / Start Over Controls */}
        <div className="flex justify-between items-center pt-2">
          <Link
            href="/"
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
          >
            <span className="icon-symbol text-base">arrow_back</span>
            <span>Back to Home</span>
          </Link>
          <Link
            href="/triage"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            Start Non-Emergency Triage
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function EmergencyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-rose-50 flex items-center justify-center p-6 text-center text-rose-800 font-bold">
          <span className="icon-symbol text-4xl animate-spin">progress_activity</span>
          <p className="mt-2 text-base">Activating Emergency Services...</p>
        </div>
      }
    >
      <EmergencyContent />
    </Suspense>
  );
}
