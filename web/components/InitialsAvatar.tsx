"use client";

import React from "react";

interface InitialsAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  role?: string;
}

const COLOR_PAIRS = [
  { bg: "bg-teal-600", text: "text-white" },
  { bg: "bg-emerald-600", text: "text-white" },
  { bg: "bg-sky-600", text: "text-white" },
  { bg: "bg-indigo-600", text: "text-white" },
  { bg: "bg-rose-600", text: "text-white" },
  { bg: "bg-amber-600", text: "text-white" },
];

export function getInitials(name: string): string {
  if (!name) return "CP";
  const cleaned = name.replace(/^(Dr\.|Sister|Nurse|Mr\.|Mrs\.|Ms\.)\s+/i, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CP";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function InitialsAvatar({ name, size = "md", className = "", role }: InitialsAvatarProps) {
  const initials = getInitials(name);

  // Deterministic color based on name hash
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % COLOR_PAIRS.length;
  const color = COLOR_PAIRS[colorIndex];

  const sizeClasses = {
    sm: "w-8 h-8 text-xs font-semibold",
    md: "w-11 h-11 text-sm font-bold",
    lg: "w-14 h-14 text-base font-bold",
    xl: "w-18 h-18 text-xl font-extrabold",
  }[size];

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full select-none shrink-0 shadow-sm ${color.bg} ${color.text} ${sizeClasses} ${className}`}
      aria-label={`Avatar for ${name}${role ? ` (${role})` : ""}`}
      title={name}
    >
      <span>{initials}</span>
    </div>
  );
}
