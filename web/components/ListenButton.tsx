"use client";

import React from "react";
import { useApp } from "../context/AppContext";

interface ListenButtonProps {
  text: string;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export function ListenButton({ text, label = "Listen", size = "sm", className = "" }: ListenButtonProps) {
  const { speakText, stopSpeaking, isSpeaking, activeSpeechText, profile } = useApp();

  const isCurrentPlaying = isSpeaking && activeSpeechText === text;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCurrentPlaying) {
      stopSpeaking();
    } else {
      speakText(text);
    }
  };

  const isHindi = profile.language === "hi";
  const displayLabel = label === "Listen" ? (isHindi ? "सुनिए" : "Listen") : label;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-1 rounded-full border transition font-bold ${
        isCurrentPlaying
          ? "border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-400 animate-pulse"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      } ${
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm"
      } ${className}`}
      aria-label={isCurrentPlaying ? `Stop reading: ${text}` : `Read aloud: ${text}`}
      title={isCurrentPlaying ? "Click to stop reading" : "Read aloud with voice"}
    >
      <span className="icon-symbol text-base text-amber-600">
        {isCurrentPlaying ? "stop" : "volume_up"}
      </span>
      <span>{isCurrentPlaying ? "Stop" : displayLabel}</span>
    </button>
  );
}
