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
