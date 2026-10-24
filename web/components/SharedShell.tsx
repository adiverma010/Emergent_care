"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSettings } from "@/lib/settings";
import {
  speak,
  stopSpeaking,
  isSpeaking,
  getCurrentAnswer,
  subscribeSpeechState,
} from "@/lib/speech";
import { NAV_TEXT, pick, greeting } from "@/lib/text";

const SUNO_STORAGE_KEY = "sathi_suno_pos_v1";

export function SharedShell() {
  const pathname = usePathname();
  const { profile } = useSettings();
  const lang = profile.language;

  // Draggable Suno position
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    hasMoved: boolean;
    isDragging: boolean;
  }>({
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
    hasMoved: false,
    isDragging: false,
  });

  // Track speech state
  useEffect(() => {
    setSpeaking(isSpeaking());
    return subscribeSpeechState((s) => setSpeaking(s));
  }, []);

  // Initialize position from localStorage or default
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(SUNO_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          // Clamp to current viewport
          const clampedX = Math.max(12, Math.min(window.innerWidth - 76, parsed.x));
          const clampedY = Math.max(12, Math.min(window.innerHeight - 150, parsed.y));
          setPos({ x: clampedX, y: clampedY });
          return;
        }
      }
    } catch {}
    // Default: right side, above bottom bar
    setPos({
      x: Math.max(12, window.innerWidth - 84),
      y: Math.max(12, window.innerHeight - 165),
    });
  }, []);

  // Update on window resize if outside bounds
  useEffect(() => {
    const handleResize = () => {
      setPos((prev) => {
        if (!prev) return null;
        return {
          x: Math.max(12, Math.min(window.innerWidth - 76, prev.x)),
          y: Math.max(12, Math.min(window.innerHeight - 150, prev.y)),
        };
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Do not render on onboarding page
  if (pathname === "/onboarding") {
    return null;
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pos) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      hasMoved: false,
      isDragging: true,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current.isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.hypot(dx, dy) > 5) {
      dragRef.current.hasMoved = true;
    }
    const newX = Math.max(12, Math.min(window.innerWidth - 76, dragRef.current.origX + dx));
    const newY = Math.max(12, Math.min(window.innerHeight - 150, dragRef.current.origY + dy));
    setPos({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current.isDragging) return;
    dragRef.current.isDragging = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (pos) {
      try {
        localStorage.setItem(SUNO_STORAGE_KEY, JSON.stringify(pos));
      } catch {}
    }

    // Tap action if didn't drag
    if (!dragRef.current.hasMoved) {
      handleSunoClick();
    }
  };

  const handleSunoClick = () => {
    if (speaking) {
      stopSpeaking();
      return;
    }
    const current = getCurrentAnswer();
    if (current && current.text.trim()) {
      speak(current.text, current.lang || lang);
    } else {
      const fallback = greeting(profile.name, profile.age, lang);
      speak(fallback, lang);
    }
  };

  const navTabs = [
    { href: "/", label: pick(lang, NAV_TEXT.home), icon: "🏠" },
    { href: "/prescriptions", label: pick(lang, NAV_TEXT.medicines), icon: "💊" },
    { href: "/emergency", label: pick(lang, NAV_TEXT.emergency), icon: "🚨", urgent: true },
    { href: "/profile", label: pick(lang, NAV_TEXT.profile), icon: "👤" },
  ];

  return (
    <>
      {/* Draggable Suno Floating Button */}
      {pos && (
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          aria-label={speaking ? "Stop speaking" : "Suno - Read answer aloud"}
          title="Suno / सुनो (Drag to move)"
          style={{
            position: "fixed",
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            touchAction: "none",
          }}
          className={`z-50 flex h-16 w-16 cursor-grab active:cursor-grabbing items-center justify-center rounded-full shadow-xl transition-transform active:scale-95 focus-visible:outline-3 focus-visible:outline-primary ${
            speaking
              ? "bg-danger text-white ring-4 ring-danger-soft animate-pulse"
              : "bg-primary text-white ring-4 ring-primary-soft hover:bg-primary/90"
          }`}
        >
          <div className="flex flex-col items-center leading-none select-none">
            <span className="text-xl" aria-hidden="true">
              {speaking ? "⏹" : "🔊"}
            </span>
            <span className="mt-0.5 text-xs font-black tracking-tight">
              {pick(lang, NAV_TEXT.suno)}
            </span>
          </div>
        </button>
      )}

      {/* Fixed SOS Button */}
      <Link
        href="/emergency"
        aria-label="Emergency SOS - 112"
        className="fixed bottom-20 right-4 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-danger text-lg font-extrabold text-white shadow-[0_0_0_4px_#ffdad6] hover:bg-danger/90 active:scale-95 transition focus-visible:outline-3 focus-visible:outline-primary"
      >
        SOS
      </Link>

      {/* Bottom Navigation Bar */}
      <nav
        aria-label="Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-beige bg-white/95 backdrop-blur-md"
      >
        <div className="mx-auto flex h-18 max-w-2xl items-center justify-around px-2">
          {navTabs.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-[48px] min-w-[56px] flex-col items-center justify-center rounded-2xl px-3 py-1 text-xs font-bold transition focus-visible:outline-3 focus-visible:outline-primary ${
                  isActive
                    ? tab.urgent
                      ? "bg-danger-soft text-danger"
                      : "bg-primary-soft text-primary"
                    : tab.urgent
                    ? "text-danger hover:bg-danger-soft/50"
                    : "text-muted hover:bg-beige/40"
                }`}
              >
                <span className="text-xl" aria-hidden="true">
                  {tab.icon}
                </span>
                <span className="mt-0.5 truncate">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
