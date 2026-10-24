"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useApp } from "../context/AppContext";

// Window typing for Web Speech API
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export function FloatingBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, speakText, stopSpeaking, isSpeaking, activeSpeechText } = useApp();

  // Dragging state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });
  const barRef = useRef<HTMLDivElement>(null);

  // Speech Recognition state (Boliye)
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [speechSupported, setSpeechSupported] = useState(true);
  const [showTextInputFallback, setShowTextInputFallback] = useState(false);
  const [fallbackInput, setFallbackInput] = useState("");
  const recognitionRef = useRef<any>(null);

  // Initialize SpeechRecognition
  useEffect(() => {
    if (typeof window !== "undefined") {
      const win = window as unknown as IWindow;
      const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSpeechSupported(false);
      }
    }
  }, []);

  // Handle Voice Input (Boliye)
  const startListening = () => {
    if (isSpeaking) {
      stopSpeaking();
    }

    if (typeof window === "undefined") return;
    const win = window as unknown as IWindow;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setShowTextInputFallback(true);
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      // hi-IN for Hindi, en-IN for Hinglish/English
      recognition.lang = profile.language === "hi" ? "hi-IN" : "en-IN";

      recognition.onstart = () => {
        setIsListening(true);
        setLiveTranscript("");
      };

      recognition.onresult = (event: any) => {
        let currentText = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentText += event.results[i][0].transcript;
        }
        setLiveTranscript(currentText);
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsListening(false);
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setShowTextInputFallback(true);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.warn("Speech recognition start failed:", e);
      setIsListening(false);
      setShowTextInputFallback(true);
    }
  };

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);

    if (liveTranscript && liveTranscript.trim().length > 0) {
      const query = encodeURIComponent(liveTranscript.trim());
      setLiveTranscript("");
      router.push(`/triage?q=${query}`);
    }
  }, [liveTranscript, router]);

  // Read Aloud (Suno)
  const handleSuno = () => {
    if (isSpeaking) {
      stopSpeaking();
      return;
    }

    // Determine current page context to read aloud
    let textToRead = "";
    if (pathname === "/") {
      textToRead =
        profile.language === "hi"
          ? "केयर कम्पास साथी में आपका स्वागत है। बोलिए बटन दबाकर अपनी बीमारी या तकलीफ बताएं, या नीचे दिए गए विकल्पों में से चुनें।"
          : profile.language === "hinglish"
          ? "CareCompass Sathi me aapka swagat hai. Boliye button dabakar apni bimari ya pareshani describe karein, ya quick options choose karein."
          : "Welcome to CareCompass Sathi. Tap Boliye to speak your health concern, or select from quick care options.";
    } else if (pathname === "/emergency") {
      textToRead =
        profile.language === "hi"
          ? "आपातकालीन सहायता सक्रिय है। तुरंत 112 डायल करें या नीचे दिए गए फर्स्ट एड निर्देशों का पालन करें।"
          : profile.language === "hinglish"
          ? "Emergency assistance active hai. Turant 112 call karein ya first aid steps follow karein."
          : "Emergency assistance is active. Call 112 immediately or follow the numbered first aid steps below.";
    } else if (pathname === "/prescriptions") {
      textToRead =
        profile.language === "hi"
          ? "दवाइयां और समय सारणी। पर्ची अपलोड करें या दवाई का नाम लिखकर सही समय और खुराक जानें।"
          : profile.language === "hinglish"
          ? "Dawai timetable aur reminders. Prescription upload karein ya text daalkar schedule banayein."
          : "Prescription schedule and daily reminders. Upload your prescription or view daily medicine timings.";
    } else {
      textToRead =
        profile.language === "hi"
          ? "केयर कम्पास साथी। सुरक्षित स्वास्थ्य मार्गदर्शन और नजदीकी स्वास्थ्य सेवा।"
          : profile.language === "hinglish"
          ? "CareCompass Sathi. Safe health triage aur verified healthcare assistance."
          : "CareCompass Sathi. Safe healthcare navigation and caregiver assistance.";
    }

    speakText(textToRead);
  };

  // Draggable logic
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag when clicking the drag handle or background, not inner action buttons
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest("input")) {
      return;
    }

    setIsDragging(true);
    const rect = barRef.current?.getBoundingClientRect();
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: rect?.left || 0,
      initialY: rect?.top || 0,
    };
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStartRef.current.startX;
      const deltaY = e.clientY - dragStartRef.current.startY;
      const newX = dragStartRef.current.initialX + deltaX;
      const newY = dragStartRef.current.initialY + deltaY;

      // Bound within window
      const maxX = window.innerWidth - (barRef.current?.offsetWidth || 340);
      const maxY = window.innerHeight - (barRef.current?.offsetHeight || 80);

      setPosition({
        x: Math.max(10, Math.min(newX, maxX)),
        y: Math.max(10, Math.min(newY, maxY)),
      });
    },
    [isDragging]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("button") || target.closest("a") || target.closest("input")) {
      return;
    }
    const touch = e.touches[0];
    setIsDragging(true);
    const rect = barRef.current?.getBoundingClientRect();
    dragStartRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      initialX: rect?.left || 0,
      initialY: rect?.top || 0,
    };
  };

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStartRef.current.startX;
      const deltaY = touch.clientY - dragStartRef.current.startY;
      const newX = dragStartRef.current.initialX + deltaX;
      const newY = dragStartRef.current.initialY + deltaY;

      const maxX = window.innerWidth - (barRef.current?.offsetWidth || 340);
      const maxY = window.innerHeight - (barRef.current?.offsetHeight || 80);

      setPosition({
        x: Math.max(10, Math.min(newX, maxX)),
        y: Math.max(10, Math.min(newY, maxY)),
      });
    },
    [isDragging]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleTouchEnd);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  const submitFallbackInput = () => {
    if (fallbackInput.trim()) {
      const q = encodeURIComponent(fallbackInput.trim());
      setFallbackInput("");
      setShowTextInputFallback(false);
      router.push(`/triage?q=${q}`);
    }
  };

  // Labels
  const sunoLabel = profile.language === "hi" ? "सुनो" : profile.language === "hinglish" ? "Suno" : "Listen";
  const boliyeLabel = profile.language === "hi" ? "बोलिए" : profile.language === "hinglish" ? "Boliye" : "Speak";

  return (
    <>
      {/* Live Voice Input Modal / Overlay */}
      {isListening && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="Listening for your voice input"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl text-center">
            <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-teal-100 text-teal-700">
              <span className="absolute inset-0 rounded-full bg-teal-400 opacity-30 animate-ping"></span>
              <span className="icon-symbol text-4xl">mic</span>
            </div>
            <h3 className="text-xl font-extrabold text-slate-900">
              {profile.language === "hi"
                ? "साथी सुन रहा है..."
                : profile.language === "hinglish"
                ? "Sathi sun raha hai..."
                : "Listening to your health concern..."}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {profile.language === "hi"
                ? "अपनी भाषा में सामान्य रूप से बोलें"
                : "Speak naturally in Hindi, English, or Hinglish"}
            </p>

            <div className="my-5 min-h-[72px] rounded-xl border border-teal-200 bg-teal-50/60 p-4 text-left">
              <p className="text-sm font-medium text-slate-800 italic">
                {liveTranscript || (
                  <span className="text-slate-400">
                    {profile.language === "hi" ? "बोलना शुरू करें..." : "Speak now..."}
                  </span>
                )}
              </p>
            </div>

            <div className="flex gap-2 justify-center">
              <button
                onClick={stopListening}
                className="flex items-center gap-1.5 rounded-full bg-teal-700 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-teal-800 transition"
                aria-label="Done speaking, analyze concern"
              >
                <span className="icon-symbol text-lg">check_circle</span>
                <span>
                  {profile.language === "hi"
                    ? "जांच करें"
                    : profile.language === "hinglish"
                    ? "Triage Karein"
                    : "Analyze Concern"}
                </span>
              </button>
              <button
                onClick={() => {
                  if (recognitionRef.current) recognitionRef.current.abort();
                  setIsListening(false);
                  setLiveTranscript("");
                }}
                className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
                aria-label="Cancel voice input"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Text Input Fallback Modal when Speech Recognition not supported or denied */}
      {showTextInputFallback && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-label="Type your symptom concern"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="icon-symbol text-teal-600">edit_note</span>
                {profile.language === "hi" ? "अपनी समस्या लिखें" : "Describe your symptom"}
              </h3>
              <button
                onClick={() => setShowTextInputFallback(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100"
                aria-label="Close"
              >
                <span className="icon-symbol text-xl">close</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              {!speechSupported
                ? "Voice recognition is not supported in this browser. Please type your concern below."
                : "Microphone access was unavailable. You can type your health question directly."}
            </p>
            <textarea
              value={fallbackInput}
              onChange={(e) => setFallbackInput(e.target.value)}
              placeholder={
                profile.language === "hi"
                  ? "उदाहरण: पापा को दो दिन से तेज बुखार और खांसी है..."
                  : "e.g., Severe back pain and low grade fever since 2 days..."
              }
              className="w-full rounded-xl border border-slate-300 p-3 text-sm focus:border-teal-600 focus:ring-2 focus:ring-teal-100 outline-none"
              rows={3}
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowTextInputFallback(false)}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={submitFallbackInput}
                disabled={!fallbackInput.trim()}
                className="rounded-lg bg-teal-700 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50"
              >
                Submit to Triage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Draggable Bottom Dock */}
      <div
        ref={barRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={
          position
            ? {
                position: "fixed",
                left: `${position.x}px`,
                top: `${position.y}px`,
                transform: "none",
                zIndex: 45,
              }
            : {
                position: "fixed",
                left: "50%",
                bottom: "24px",
                transform: "translateX(-50%)",
                zIndex: 45,
              }
        }
        className={`touch-none select-none rounded-full border border-slate-200/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-md transition-shadow hover:shadow-2xl ${
          isDragging ? "cursor-grabbing shadow-2xl ring-2 ring-teal-500" : "cursor-grab"
        }`}
        aria-label="CareCompass Sathi Quick Voice and Emergency Bar"
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Small Drag Grip Handle Indicator */}
          <div
            className="flex h-10 w-4 items-center justify-center text-slate-400 hover:text-slate-600"
            title="Drag bar to reposition"
            aria-hidden="true"
          >
            <span className="icon-symbol text-base">drag_indicator</span>
          </div>

          {/* Suno Button (TTS Read Aloud) */}
          <button
            onClick={handleSuno}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-bold transition active:scale-95 touch-target ${
              isSpeaking
                ? "bg-amber-500 text-white shadow-md animate-pulse"
                : "bg-slate-100 text-slate-800 hover:bg-slate-200"
            }`}
            aria-label={isSpeaking ? "Stop reading aloud" : `Read page aloud (${sunoLabel})`}
            title="Suno: Read instructions and results aloud"
          >
            <span className="icon-symbol text-lg">
              {isSpeaking ? "volume_off" : "volume_up"}
            </span>
            <span>{isSpeaking ? "Stop" : sunoLabel}</span>
          </button>

          {/* Boliye Button (Voice Input) */}
          <button
            onClick={startListening}
            className="flex items-center gap-2 rounded-full bg-teal-700 px-5 py-2.5 text-xs font-extrabold text-white shadow-md transition hover:bg-teal-800 active:scale-95 touch-target"
            aria-label={`Start voice symptom input (${boliyeLabel})`}
            title="Boliye: Speak your concern in Hindi, Hinglish or English"
          >
            <span className="icon-symbol text-xl animate-pulse">mic</span>
            <span className="tracking-wide">{boliyeLabel}</span>
          </button>

          {/* SOS 112 Red Alert Button */}
          <button
            onClick={() => router.push("/emergency")}
            className="flex items-center gap-1.5 rounded-full bg-rose-600 px-4 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-rose-700 active:scale-95 touch-target"
            aria-label="SOS Emergency Help 112"
            title="Instant 112 ambulance & first aid"
          >
            <span className="icon-symbol text-lg">crisis_alert</span>
            <span>SOS</span>
          </button>
        </div>
      </div>
    </>
  );
}
