"use client";

import React, { useState, useEffect, useRef } from "react";
import { useApp } from "../context/AppContext";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}

interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export function VoiceInputButton({ onTranscript, className = "", size = "md" }: VoiceInputButtonProps) {
  const { profile, speakText, stopSpeaking, isSpeaking } = useApp();
  const [isListening, setIsListening] = useState(false);
  const [liveText, setLiveText] = useState("");
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const win = window as unknown as IWindow;
      const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSupported(false);
      }
    }
  }, []);

  const toggleListening = () => {
    if (isSpeaking) stopSpeaking();

    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      if (liveText.trim()) {
        onTranscript(liveText.trim());
        setLiveText("");
      }
      return;
    }

    if (typeof window === "undefined") return;
    const win = window as unknown as IWindow;
    const SpeechRecognition = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      speakText("Voice recognition is not supported in this browser. Please type your message.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = profile.language === "hi" ? "hi-IN" : "en-IN";

      recognition.onstart = () => {
        setIsListening(true);
        setLiveText("");
      };

      recognition.onresult = (event: any) => {
        let text = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          text += event.results[i][0].transcript;
        }
        setLiveText(text);
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech error:", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (liveText.trim()) {
          onTranscript(liveText.trim());
          setLiveText("");
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.warn("Speech recognition failed to start:", e);
      setIsListening(false);
    }
  };

  const sizeClasses = {
    sm: "p-1.5 text-sm",
    md: "p-2.5 text-base",
    lg: "p-3.5 text-xl",
  }[size];

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggleListening}
        className={`inline-flex items-center justify-center rounded-xl transition ${
          isListening
            ? "bg-rose-500 text-white animate-pulse shadow-md ring-2 ring-rose-400"
            : "bg-teal-50 text-teal-700 hover:bg-teal-100 hover:text-teal-900 border border-teal-200"
        } ${sizeClasses} ${className}`}
        aria-label={isListening ? "Stop listening" : "Click to speak with voice input"}
        title={isListening ? "Listening... click to stop" : "Speak your symptoms"}
      >
        <span className="icon-symbol">{isListening ? "mic" : "mic_none"}</span>
      </button>

      {/* Floating active live speech banner */}
      {isListening && liveText && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-30 whitespace-nowrap rounded-xl bg-slate-900/90 text-white px-3 py-1.5 text-xs shadow-lg backdrop-blur-xs animate-in fade-in">
          <span>{liveText}</span>
        </div>
      )}
    </div>
  );
}
