export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type Lang = "english" | "hindi" | "hinglish";
export type Turn = { role: "user" | "assistant"; text: string };

export type Caregiver = { caregiver_id: string; score: number; reason: string };

export type TriageResponse = {
  follow_up_question: string | null;
  care_type: string | null;
  urgency: string | null;
  red_flags: string[];
  reasoning: string;
  matched_caregivers: Caregiver[];
  detected_language?: string;
  first_aid_steps?: string[];
  emergency_numbers?: { ambulance: string };
};

const apiLang = (l: Lang) => (l === "english" ? "en" : l === "hindi" ? "hi" : "hinglish");

export async function getLocation(): Promise<{ lat: number; lng: number }> {
  const fallback = { lat: 28.54, lng: 77.27 };
  if (typeof navigator === "undefined" || !navigator.geolocation) return fallback;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(fallback),
      { timeout: 3000 }
    );
  });
}

export async function triage(
  user_input: string,
  language: Lang,
  conversation_history: Turn[]
): Promise<TriageResponse> {
  const location = await getLocation();
  const res = await fetch(`${API}/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_input, language: apiLang(language), location, conversation_history }),
  });
  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json();
}