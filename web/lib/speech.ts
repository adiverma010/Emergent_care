import type { Lang } from "./api";

export function speak(text: string, lang: Lang) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  // Romanised Hinglish reads better with the Indian-English voice.
  u.lang = lang === "hindi" ? "hi-IN" : "en-IN";
  u.rate = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const v = voices.find((x) => x.lang === u.lang) || voices.find((x) => x.lang.startsWith(u.lang.slice(0, 2)));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function speechInputSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as any;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function startListening(
  lang: Lang,
  onText: (text: string, final: boolean) => void,
  onEnd: () => void
) {
  const w = window as any;
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = lang === "english" ? "en-IN" : "hi-IN";
  r.interimResults = true;
  r.continuous = false;
  r.onresult = (e: any) => {
    let t = "";
    for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
    onText(t, e.results[e.results.length - 1].isFinal);
  };
  r.onend = onEnd;
  r.onerror = onEnd;
  r.start();
  return r;
}