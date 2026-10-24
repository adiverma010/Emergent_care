"use client";
import React, { useEffect, useState } from "react";
import { useSettings } from "@/lib/settings";
import { speak, stopSpeaking, isSpeaking, subscribeSpeechState } from "@/lib/speech";

interface ListenButtonProps {
  text: string;
  label?: string;
  className?: string;
}

export function ListenButton({ text, label, className = "" }: ListenButtonProps) {
  const { profile } = useSettings();
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSpeaking(isSpeaking());
    const unsub = subscribeSpeechState((s) => setSpeaking(s));
    return unsub;
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (speaking) {
      stopSpeaking();
    } else {
      speak(text, profile.language);
    }
  };

  const defaultLabel = profile.language === "hindi" ? "सुनें" : "Listen";
  const displayLabel = label || defaultLabel;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={speaking ? `Stop listening: ${text}` : `Listen aloud: ${text}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-bold transition focus-visible:outline-3 focus-visible:outline-primary ${
        speaking
          ? "bg-danger text-white ring-2 ring-danger-soft animate-pulse"
          : "bg-primary-soft text-primary hover:bg-primary/20"
      } ${className}`}
    >
      <span aria-hidden="true" className="text-lg">
        {speaking ? "⏹" : "🔊"}
      </span>
      <span>{speaking ? "Stop" : displayLabel}</span>
    </button>
  );
}
