import type { Lang } from "./api";

export function greeting(name: string, age: number, lang: Lang): string {
  const h = new Date().getHours();
  const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  const n = name.trim() || "";
  if (lang === "hindi") {
    const hi = h < 12 ? "सुप्रभात" : h < 17 ? "नमस्कार" : "शुभ संध्या";
    if (age >= 60) return `प्रणाम ${n} जी, ${hi}!`;
    if (age >= 40) return `नमस्ते ${n} जी, ${hi}!`;
    if (age < 18) return `नमस्ते ${n}! कैसे हो?`;
    return `नमस्ते ${n}, ${hi}!`;
  }
  if (lang === "hinglish") {
    if (age >= 60) return `Pranam ${n} ji, good ${part}! Aaj tabiyat kaisi hai?`;
    if (age >= 40) return `Namaste ${n} ji, good ${part}! Aaj kaisa lag raha hai?`;
    if (age < 18) return `Hello ${n}! Kaise ho?`;
    return `Hi ${n}, good ${part}! Kya problem hai aaj?`;
  }
  if (age >= 60) return `Good ${part}, ${n} ji. How are you feeling today?`;
  if (age < 18) return `Hello ${n}! How are you?`;
  return `Good ${part}, ${n}. How can I help today?`;
}

export const CARE_LABEL: Record<string, { en: string; hi: string }> = {
  paramedic_home_visit: { en: "Medic home visit", hi: "घर पर मेडिक की विज़िट" },
  home_nursing: { en: "Home nursing", hi: "घर पर नर्सिंग" },
  lab_test_home: { en: "Lab test at home", hi: "घर पर लैब टेस्ट" },
  teleconsultation: { en: "Doctor video consult", hi: "डॉक्टर से वीडियो सलाह" },
  emergency_112: { en: "Emergency: call 112", hi: "आपातकाल: 112 पर कॉल करें" },
};

export const URGENCY_LABEL: Record<string, { en: string; hi: string }> = {
  emergency: { en: "Emergency", hi: "आपातकाल" },
  same_day: { en: "Today", hi: "आज ही" },
  scheduled: { en: "Can be scheduled", hi: "समय तय करें" },
};

export const pick = (lang: Lang, o: { en: string; hi: string }) => (lang === "hindi" ? o.hi : o.en);