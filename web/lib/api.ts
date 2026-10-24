import {
  TriageRequest,
  TriageResponse,
  DispatchRequest,
  DispatchStatus,
  NearbyHospital,
  PrescriptionParseResponse,
  MedicationReminder,
  HomecareBookingRequest,
  HomecareBookingResponse,
  DynamicGreeting,
  AppLanguage,
} from "./types";
import {
  USE_MOCK,
  mockTriage,
  mockCreateDispatch,
  mockGetDispatch,
  MOCK_HOSPITALS,
  mockParsePrescription,
  mockScheduleReminders,
  mockHomecareBooking,
  getLocalGreeting,
} from "./mock";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Perform triage on user symptoms with context history
 */
export async function triageSymptoms(request: TriageRequest): Promise<TriageResponse> {
  if (USE_MOCK) {
    return Promise.resolve(mockTriage(request));
  }

  try {
    const res = await fetch(`${API_BASE_URL}/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.warn("Triage API error, using safe fallback:", err);
    return mockTriage(request);
  }
}

/**
 * Dispatch emergency ambulance / alert 112 services
 */
export async function createDispatch(request: DispatchRequest): Promise<DispatchStatus> {
  if (USE_MOCK) {
    return Promise.resolve(mockCreateDispatch(request));
  }

  try {
    const res = await fetch(`${API_BASE_URL}/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      throw new Error(`Dispatch error: ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.warn("Dispatch API error, using safe fallback:", err);
    return mockCreateDispatch(request);
  }
}

/**
 * Poll dispatch status by id
 */
export async function getDispatchStatus(dispatchId: string, pollTick: number = 0): Promise<DispatchStatus> {
  if (USE_MOCK) {
    return Promise.resolve(mockGetDispatch(dispatchId, pollTick));
  }

  try {
    const res = await fetch(`${API_BASE_URL}/dispatch/${dispatchId}`);
    if (!res.ok) {
      throw new Error(`Dispatch lookup error: ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    return mockGetDispatch(dispatchId, pollTick);
  }
}

/**
 * Get nearby verified emergency hospitals
 */
export async function getNearbyHospitals(lat: number = 28.54, lng: number = 77.27): Promise<NearbyHospital[]> {
  if (USE_MOCK) {
    return Promise.resolve(MOCK_HOSPITALS);
  }

  try {
    const res = await fetch(`${API_BASE_URL}/hospitals/nearby?lat=${lat}&lng=${lng}`);
    if (!res.ok) throw new Error("Hospital fetch error");
    return await res.json();
  } catch (err) {
    return MOCK_HOSPITALS;
  }
}

/**
 * Parse medication prescription from image or text
 */
export async function parsePrescription(input: {
  text?: string;
  file?: File | null;
}): Promise<PrescriptionParseResponse> {
  if (USE_MOCK) {
    return Promise.resolve(mockParsePrescription(input));
  }

  try {
    let body: any;
    let headers: Record<string, string> = {};

    if (input.file) {
      const formData = new FormData();
      formData.append("file", input.file);
      if (input.text) formData.append("text", input.text);
      body = formData;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify({ text: input.text || "" });
    }

    const res = await fetch(`${API_BASE_URL}/prescription/parse`, {
      method: "POST",
      headers,
      body,
    });

    if (!res.ok) throw new Error("Prescription parse failed");
    return await res.json();
  } catch (err) {
    console.warn("Prescription API error, falling back:", err);
    return mockParsePrescription(input);
  }
}

/**
 * Schedule daily reminders for parsed medications
 */
export async function scheduleReminders(
  medicines: PrescriptionParseResponse["medicines"],
  userId?: string
): Promise<MedicationReminder[]> {
  if (USE_MOCK) {
    return Promise.resolve(mockScheduleReminders(medicines));
  }

  try {
    const res = await fetch(`${API_BASE_URL}/reminders/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ medicines, user_id: userId }),
    });

    if (!res.ok) throw new Error("Reminder schedule failed");
    const data = await res.json();
    return data.reminders || [];
  } catch (err) {
    return mockScheduleReminders(medicines);
  }
}

/**
 * Book a homecare visit (nurse/paramedic/lab)
 */
export async function bookHomecare(request: HomecareBookingRequest): Promise<HomecareBookingResponse> {
  if (USE_MOCK) {
    return Promise.resolve(mockHomecareBooking(request));
  }

  try {
    const res = await fetch(`${API_BASE_URL}/homecare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!res.ok) throw new Error("Homecare booking failed");
    return await res.json();
  } catch (err) {
    return mockHomecareBooking(request);
  }
}

/**
 * Get dynamic greeting by age and language
 */
export async function getGreeting(age: number | null, language: AppLanguage, name?: string): Promise<DynamicGreeting> {
  if (USE_MOCK) {
    return Promise.resolve(getLocalGreeting(age, language, name));
  }

  try {
    const query = new URLSearchParams();
    if (age !== null) query.set("age", age.toString());
    query.set("language", language);
    if (name) query.set("name", name);

    const res = await fetch(`${API_BASE_URL}/greeting?${query.toString()}`);
    if (!res.ok) throw new Error("Greeting error");
    return await res.json();
  } catch (err) {
    return getLocalGreeting(age, language, name);
  }
}
