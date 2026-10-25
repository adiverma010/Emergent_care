/*
CONTRACT: POST /assess (superset of the existing /triage response, so old
fields keep working)

Request:
{ "user_input": str, "language": "en"|"hi"|"hinglish",
  "location": {"lat": float, "lng": float},
  "profile": {"name": str, "age": int, "allergies": [str], "history": [str]},
  "session": { "protocol_id": str|null, "slots": {str: any}, "asked": [str],
               "history": [{"role": "user"|"assistant", "text": str}] },
  "answer": {"question_id": str, "value": str} | null }

Response (all existing /triage fields stay: follow_up_question, care_type,
urgency, red_flags, reasoning, matched_caregivers, detected_language,
first_aid_steps, emergency_numbers, irrelevant) PLUS:
{ "status": "question" | "result" | "emergency" | "irrelevant",
  "question": { "id": str, "text": str, "type": "choice"|"number"|"text",
                "options": [str], "progress": "2 of 3" } | null,
  "session": { ...updated session to send back next time... },
  "advice": {
    "severity": "emergency"|"doctor_today"|"doctor_soon"|"home_care",
    "summary": str,
    "do_now": [str], "home_remedies": [str],
    "medicine_info": [{"category": str, "examples": [str], "note": str}],
    "medicine_hidden_reason": str|null,
    "avoid": [str], "see_doctor_if": [str],
    "sources": [{"name": str, "url": str}],
    "disclaimer": str } | null,
  "dispatch_recommended": bool,
  "process_ms": int }
*/

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
  irrelevant?: boolean;
};

export type AssessSession = {
  protocol_id: string | null;
  slots: Record<string, unknown>;
  asked: string[];
  history: Turn[];
};

export type AssessQuestion = {
  id: string;
  text: string;
  type: "choice" | "number" | "text";
  options: string[];
  progress: string;
};

export type MedicineInfo = {
  category: string;
  examples: string[];
  note: string;
};

export type AdviceSource = {
  name: string;
  url: string;
};

export type AssessAdvice = {
  severity: "emergency" | "doctor_today" | "doctor_soon" | "home_care";
  summary: string;
  do_now: string[];
  home_remedies: string[];
  medicine_info: MedicineInfo[];
  medicine_hidden_reason: string | null;
  avoid: string[];
  see_doctor_if: string[];
  sources: AdviceSource[];
  disclaimer: string;
};

export type AssessResponse = TriageResponse & {
  status: "question" | "result" | "emergency" | "irrelevant";
  question: AssessQuestion | null;
  session: AssessSession;
  advice: AssessAdvice | null;
  dispatch_recommended: boolean;
  process_ms: number;
};

export type DispatchPatient = {
  name: string;
  age: number;
  allergies: string[];
  history: string[];
};

export type DispatchResponse = {
  dispatch_id: string;
  status: "notified" | "ambulance_assigned" | "en_route" | "arrived";
  eta_minutes: number;
  is_simulated?: boolean;
  hospital: {
    name: string;
    distance_km: number;
    phone: string;
  };
  packet: {
    patient: DispatchPatient;
    red_flag?: string;
    summary?: string;
  };
};

export type NearbyHospital = {
  name: string;
  lat: number;
  lng: number;
  phone: string;
  emergency: boolean;
  distance_km: number;
};

export type LiveHospital = {
  name: string;
  lat?: number;
  lng?: number;
  phone?: string;
  emergency?: boolean;
  distance_km?: number;
  address?: string;
};

export type LiveHospitalsResponse = {
  live_hospitals?: LiveHospital[];
  live_source?: string;
};

export type ParsedMedicine = {
  name: string;
  dosage_as_written: string;
  frequency: string | null;
  duration: string | null;
  with_food: boolean;
  food_note: string | null;
  explanation: string;
};

export type PrescriptionParseResponse = {
  medicines: ParsedMedicine[];
  note: string;
};

export type ScheduledMedicine = {
  medicine: string;
  times: string[];
  with_food?: boolean;
  days?: string | null;
};

export type ScheduleResponse = {
  timetable: ScheduledMedicine[];
  note: string;
};

export const apiLang = (l: Lang) => (l === "english" ? "en" : l === "hindi" ? "hi" : "hinglish");

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

export async function assess(
  user_input: string,
  language: Lang,
  profile: { name: string; age: number; allergies: string[]; history: string[] },
  session?: AssessSession | null,
  answer?: { question_id: string; value: string } | null
): Promise<AssessResponse> {
  const startTime = Date.now();
  const location = await getLocation();
  const langCode = apiLang(language);
  const currentSession: AssessSession = session || {
    protocol_id: null,
    slots: {},
    asked: [],
    history: [],
  };

  const payload = {
    user_input,
    language: langCode,
    location,
    profile: {
      name: profile.name || "",
      age: profile.age || 30,
      allergies: profile.allergies || [],
      history: profile.history || [],
    },
    session: currentSession,
    answer: answer || null,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`${API}/assess`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return {
        ...data,
        process_ms: data.process_ms ?? (Date.now() - startTime),
      };
    }

    if (res.status === 404) {
      return await fallbackAssessViaTriage(user_input, language, currentSession, profile, startTime);
    }

    throw new Error(`Server error ${res.status}`);
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Request timed out after 5 seconds");
    }
    throw err;
  }
}

async function fallbackAssessViaTriage(
  user_input: string,
  language: Lang,
  currentSession: AssessSession,
  profile: { name: string; age: number; allergies: string[]; history: string[] },
  startTime: number
): Promise<AssessResponse> {
  const triageRes = await triage(user_input, language, currentSession.history);
  const elapsed = Date.now() - startTime;

  if (triageRes.irrelevant) {
    return {
      ...triageRes,
      status: "irrelevant",
      question: null,
      session: currentSession,
      advice: null,
      dispatch_recommended: false,
      process_ms: elapsed,
    };
  }

  const isEmerg =
    triageRes.care_type === "emergency_112" ||
    (triageRes.red_flags && triageRes.red_flags.length > 0);

  if (isEmerg) {
    return {
      ...triageRes,
      status: "emergency",
      question: null,
      session: currentSession,
      advice: {
        severity: "emergency",
        summary: triageRes.reasoning || "Critical emergency warning sign detected. Call 112 now.",
        do_now: triageRes.first_aid_steps || [
          "Call 112 immediately",
          "Keep patient resting in safe ventilated position",
          "Do not administer solid foods or fluids",
        ],
        home_remedies: [],
        medicine_info: [],
        medicine_hidden_reason: "Immediate emergency care required; do not self-medicate.",
        avoid: ["Delaying calling emergency services", "Heavy exertion"],
        see_doctor_if: ["Any red flag symptoms worsen"],
        sources: [{ name: "National Health Portal / 112 India", url: "https://www.nhp.gov.in" }],
        disclaimer: "Emergency assessment only; please proceed to emergency medical care.",
      },
      dispatch_recommended: true,
      process_ms: elapsed,
    };
  }

  if (triageRes.follow_up_question) {
    const qCount = (currentSession.asked || []).length + 1;
    const qId = `q_${qCount}`;
    return {
      ...triageRes,
      status: "question",
      question: {
        id: qId,
        text: triageRes.follow_up_question,
        type: "choice",
        options:
          language === "hindi"
            ? ["1 से 2 दिन", "3 से 5 दिन", "एक हफ्ते से ज्यादा"]
            : language === "hinglish"
            ? ["1-2 din", "3-5 din", "1 week se zyada"]
            : ["1-2 days", "3-5 days", "More than a week"],
        progress: `${qCount} of 3`,
      },
      session: {
        ...currentSession,
        asked: [...(currentSession.asked || []), qId],
        history: [
          ...currentSession.history,
          { role: "user", text: user_input },
          { role: "assistant", text: triageRes.follow_up_question },
        ],
      },
      advice: null,
      dispatch_recommended: false,
      process_ms: elapsed,
    };
  }

  const severity: "doctor_today" | "doctor_soon" | "home_care" =
    triageRes.urgency === "emergency"
      ? "doctor_today"
      : triageRes.urgency === "same_day"
      ? "doctor_today"
      : "doctor_soon";

  const hasAllergy = (profile.allergies || []).length > 0;

  return {
    ...triageRes,
    status: "result",
    question: null,
    session: {
      ...currentSession,
      history: [
        ...currentSession.history,
        { role: "user", text: user_input },
        { role: "assistant", text: triageRes.reasoning },
      ],
    },
    advice: {
      severity,
      summary: triageRes.reasoning,
      do_now: [
        language === "hindi" ? "आराम करें और पर्याप्त पानी पिएं" : "Rest and stay well hydrated",
        language === "hindi"
          ? "लक्षणों पर नज़र रखें और बदलाव नोट करें"
          : "Monitor symptoms and note any changes",
      ],
      home_remedies: [
        language === "hindi" ? "गुनगुना पानी और हल्का भोजन लें" : "Warm water and light meals",
        language === "hindi" ? "पर्याप्त नींद और विश्राम लें" : "Adequate rest and sleep",
      ],
      medicine_info: hasAllergy
        ? []
        : [
            {
              category: "General symptomatic relief",
              examples: ["Paracetamol 500mg"],
              note: "Only use after clinician or pharmacist advice; verify contraindications.",
            },
          ],
      medicine_hidden_reason: hasAllergy
        ? "Medicine guidance hidden due to known allergy profile; confirm directly with doctor."
        : null,
      avoid: [
        language === "hindi" ? "बिना डॉक्टर की सलाह भारी दवाएं लेना" : "Self-prescribing heavy antibiotics",
        language === "hindi" ? "अधिक शारीरिक श्रम" : "Excessive physical strain",
      ],
      see_doctor_if: [
        language === "hindi" ? "बुखार या दर्द 2 दिन से अधिक रहे" : "Fever or pain persists beyond 2 days",
        language === "hindi" ? "सांस लेने में कोई कठिनाई हो" : "Any breathing difficulty develops",
      ],
      sources: [
        { name: "CareCompass Guidelines", url: "https://www.mohfw.gov.in" },
      ],
      disclaimer: "This guidance is for informational routing support only, not a diagnostic medical verdict.",
    },
    dispatch_recommended: false,
    process_ms: elapsed,
  };
}

export async function createDispatch(data: {
  patient: DispatchPatient;
  location: { lat: number; lng: number };
  red_flag?: string;
  summary?: string;
}): Promise<DispatchResponse> {
  const res = await fetch(`${API}/dispatch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Dispatch error ${res.status}`);
  return res.json();
}

export async function getDispatch(id: string): Promise<DispatchResponse> {
  const res = await fetch(`${API}/dispatch/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Get dispatch error ${res.status}`);
  return res.json();
}

export async function getNearbyHospitals(lat: number, lng: number): Promise<{ hospitals: NearbyHospital[] }> {
  const res = await fetch(`${API}/hospitals/nearby?lat=${lat}&lng=${lng}`);
  if (!res.ok) throw new Error(`Nearby hospitals error ${res.status}`);
  return res.json();
}

export async function getLiveHospitals(): Promise<LiveHospitalsResponse | null> {
  try {
    const res = await fetch(`${API}/hospitals/live`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function parsePrescription(options: {
  text?: string;
  file?: File;
  language: Lang;
}): Promise<PrescriptionParseResponse> {
  const l = apiLang(options.language);
  if (options.file) {
    const formData = new FormData();
    formData.append("image", options.file);
    if (options.text) formData.append("text", options.text);
    formData.append("language", l);
    const res = await fetch(`${API}/prescription/parse`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error(`Prescription parse error ${res.status}`);
    return res.json();
  }

  const res = await fetch(`${API}/prescription/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: options.text || "", language: l }),
  });
  if (!res.ok) throw new Error(`Prescription parse error ${res.status}`);
  return res.json();
}

export async function scheduleReminders(medicines: ParsedMedicine[]): Promise<ScheduleResponse> {
  const res = await fetch(`${API}/reminders/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ medicines }),
  });
  if (!res.ok) throw new Error(`Schedule error ${res.status}`);
  return res.json();
}
