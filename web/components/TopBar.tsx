"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "../context/AppContext";
import { AppLanguage } from "../lib/types";
import { InitialsAvatar } from "./InitialsAvatar";

export function TopBar() {
  const pathname = usePathname();
  const { profile, setLanguage, setElderMode } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/", labelEn: "Home", labelHi: "होम", labelHing: "Home", icon: "home" },
    { href: "/triage", labelEn: "Triage", labelHi: "लक्षण जांच", labelHing: "Triage", icon: "stethoscope" },
    { href: "/emergency", labelEn: "Emergency", labelHi: "आपातकालीन", labelHing: "Emergency", icon: "e911_emergency", urgent: true },
    { href: "/prescriptions", labelEn: "Prescriptions", labelHi: "दवाइयां", labelHing: "Dawa Schedule", icon: "medication" },
    { href: "/profile", labelEn: "Profile", labelHi: "प्रोफाइल", labelHing: "Profile", icon: "account_circle" },
  ];

  const getNavLabel = (item: (typeof navLinks)[0]) => {
    if (profile.language === "hi") return item.labelHi;
    if (profile.language === "hinglish") return item.labelHing;
    return item.labelEn;
  };

  const languages: { code: AppLanguage; label: string }[] = [
    { code: "en", label: "EN" },
    { code: "hi", label: "हिंदी" },
    { code: "hinglish", label: "Hinglish" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">
        {/* Brand Logo & Sathi title */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-lg p-1.5 focus-visible:ring-2 focus-visible:ring-teal-600"
            aria-label="CareCompass Sathi Home"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm ring-2 ring-teal-700/20">
              <span className="icon-symbol text-2xl font-bold">medical_services</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
                  CareCompass
                </span>
                <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-teal-800">
                  साथी
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-500">
                {profile.language === "hi"
                  ? "सुरक्षित स्वास्थ्य साथी"
                  : profile.language === "hinglish"
                  ? "Aapka Health Navigator"
                  : "Safety-first care navigation"}
              </span>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation Pills */}
        <nav className="hidden md:flex items-center gap-1.5" aria-label="Main Navigation">
          {navLinks.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  item.urgent
                    ? isActive
                      ? "bg-rose-600 text-white shadow-sm"
                      : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200"
                    : isActive
                    ? "bg-teal-700 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
                aria-current={isActive ? "page" : undefined}
                aria-label={getNavLabel(item)}
              >
                <span className="icon-symbol text-base">{item.icon}</span>
                <span>{getNavLabel(item)}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right Tools: Elder Mode, Language Switcher, SOS 112, Avatar */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Elder Mode Toggle */}
          <button
            onClick={() => setElderMode(!profile.elderMode)}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition-all ${
              profile.elderMode
                ? "border-amber-500 bg-amber-50 text-amber-900 shadow-sm ring-2 ring-amber-400"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
            aria-pressed={profile.elderMode}
            aria-label={profile.elderMode ? "Elder Mode enabled" : "Turn on Elder Mode for larger text and contrast"}
            title="Elder Mode (बड़ा टेक्स्ट और कंट्रास्ट)"
          >
            <span className="icon-symbol text-sm text-amber-600">elderly</span>
            <span className="hidden sm:inline">
              {profile.elderMode ? "Elder Mode ON" : "Elder Mode"}
            </span>
          </button>

          {/* Language Switcher EN / हिंदी / Hinglish */}
          <div
            className="flex items-center rounded-full border border-slate-200 bg-slate-100 p-0.5"
            role="group"
            aria-label="Language selection"
          >
            {languages.map((lang) => {
              const isSelected = profile.language === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={`rounded-full px-2 py-0.5 text-xs font-bold transition-colors ${
                    isSelected
                      ? "bg-white text-teal-800 shadow-xs ring-1 ring-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                  aria-pressed={isSelected}
                  aria-label={`Switch language to ${lang.label}`}
                >
                  {lang.label}
                </button>
              );
            })}
          </div>

          {/* SOS 112 Quick Direct Dial Button */}
          <a
            href="tel:112"
            className="flex items-center gap-1 rounded-full bg-rose-600 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-rose-700 active:scale-95"
            aria-label="Emergency Call 112"
            title="Immediate 112 Call"
          >
            <span className="icon-symbol text-base animate-pulse">emergency</span>
            <span>112 SOS</span>
          </a>

          {/* Profile Initials Avatar */}
          <Link
            href="/profile"
            className="rounded-full ring-2 ring-transparent transition hover:ring-teal-500 focus-visible:ring-2 focus-visible:ring-teal-600"
            aria-label="User Profile"
          >
            <InitialsAvatar name={profile.name || "Sathi User"} size="sm" />
          </Link>

          {/* Mobile hamburger toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex md:hidden items-center justify-center rounded-lg p-1 text-slate-700 hover:bg-slate-100"
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            <span className="icon-symbol text-2xl">{mobileMenuOpen ? "close" : "menu"}</span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="border-t border-slate-200 bg-white p-4 shadow-lg md:hidden">
          <div className="grid grid-cols-2 gap-2">
            {navLinks.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2 rounded-xl p-3 text-sm font-semibold transition ${
                    item.urgent
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : isActive
                      ? "bg-teal-700 text-white"
                      : "bg-slate-50 text-slate-800 hover:bg-slate-100"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="icon-symbol text-xl">{item.icon}</span>
                  <span>{getNavLabel(item)}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
