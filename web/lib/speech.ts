import type { Lang } from "./api";

let currentAnswerText = "";
let currentAnswerLang: Lang = "hinglish";
const speechListeners = new Set<(speaking: boolean) => void>();

function notifySpeaking(speaking: boolean) {
  speechListeners.forEach((fn) => fn(speaking));
}

export function subscribeSpeechState(fn: (speaking: boolean) => void): () => void {
  speechListeners.add(fn);
  return () => speechListeners.delete(fn);
}

export function setCurrentAnswer(text: string, lang?: Lang) {
  currentAnswerText = text;
  if (lang) currentAnswerLang = lang;
}

export function getCurrentAnswer(): { text: string; lang: Lang } {
  return { text: currentAnswerText, lang: currentAnswerLang };
}

export function isSpeaking(): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  return window.speechSynthesis.speaking;
}

export function speak(text: string, lang: Lang) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  setCurrentAnswer(text, lang);

  const u = new SpeechSynthesisUtterance(text);
  // Romanised Hinglish reads better with the Indian-English voice.
  u.lang = lang === "hindi" ? "hi-IN" : "en-IN";
  u.rate = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const v = voices.find((x) => x.lang === u.lang) || voices.find((x) => x.lang.startsWith(u.lang.slice(0, 2)));
  if (v) u.voice = v;

  u.onstart = () => notifySpeaking(true);
  u.onend = () => notifySpeaking(false);
  u.onerror = () => notifySpeaking(false);

  window.speechSynthesis.speak(u);
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    notifySpeaking(false);
  }
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop?: () => void;
  abort?: () => void;
}

interface SpeechRecognitionEvent {
  results: {
    length: number;
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
      isFinal: boolean;
    };
  };
}

interface WindowWithSpeech extends Window {
  SpeechRecognition?: { new (): SpeechRecognitionInstance };
  webkitSpeechRecognition?: { new (): SpeechRecognitionInstance };
}

export function speechInputSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as WindowWithSpeech;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function startListening(
  lang: Lang,
  onText: (text: string, final: boolean) => void,
  onEnd: () => void
): SpeechRecognitionInstance | null {
  const w = window as unknown as WindowWithSpeech;
  const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = lang === "english" ? "en-IN" : "hi-IN";
  r.interimResults = true;
  r.continuous = false;
  r.onresult = (e: SpeechRecognitionEvent) => {
    let t = "";
    for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
    onText(t, e.results[e.results.length - 1].isFinal);
  };
  r.onend = onEnd;
  r.onerror = onEnd;
  r.start();
  return r;
}
