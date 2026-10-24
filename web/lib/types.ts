// Core Types for CareCompass Sathi

export type AppLanguage = "en" | "hi" | "hinglish";

export interface UserProfile {
  name: string;
  age: number | null;
  gender?: string;
  language: AppLanguage;
  allergies: string[];
  history: string[];
  elderMode: boolean;
  autoRead: boolean;
  isOnboarded: boolean;
}

export type CareType =
  | "paramedic_home_visit"
  | "home_nursing"
  | "lab_test_home"
  | "teleconsultation"
  | "emergency_112";

export type UrgencyLevel = "emergency" | "same_day" | "scheduled";

export type RedFlag =
  | "chest_pain"
  | "breathlessness"
  | "unconsciousness"
  | "severe_bleeding"
  | "stroke_symptoms"
  | "seizure"
  | "high_fever_infant"
  | "suicidal_ideation"
  | "severe_dehydration";

export interface CaregiverMatch {
  caregiver_id: string;
  score: number;
  reason: string;
  name: string;
  role: string;
  phone?: string;
  rating?: number;
  distance_km?: number;
  gender?: string;
  skills?: string[];
  languages?: string[];
  tier?: string;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface TriageRequest {
  user_input: string;
  language: string;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  conversation_history: ConversationTurn[];
}

export interface TriageResponse {
  follow_up_question: string | null;
  care_type: CareType | null;
  urgency: UrgencyLevel | null;
  red_flags: RedFlag[];
  reasoning: string;
  matched_caregivers: CaregiverMatch[];
}

export interface DispatchTimelineStep {
  step: string;
  time: string;
  done: boolean;
}

export interface DispatchStatus {
  dispatch_id: string;
  status: "notified" | "ambulance_assigned" | "en_route" | "arrived";
  eta_minutes: number;
  ambulance_id: string;
  hospital_name: string;
  hospital_phone?: string;
  first_aid_steps?: string[];
  timeline: DispatchTimelineStep[];
}

export interface DispatchRequest {
  emergency_type: string;
  location: {
    lat: number;
    lng: number;
    address?: string;
  };
  user_name?: string;
  contact?: string;
}

export interface NearbyHospital {
  id: string;
  name: string;
  distance_km: number;
  phone: string;
  address: string;
  emergency_beds_available: number;
  has_icu: boolean;
}

export type MedicationTiming = "morning" | "afternoon" | "night" | "morning_night" | "three_times_a_day";
export type FoodRelation = "before_food" | "after_food" | "with_food" | "as_needed";

export interface ParsedMedicine {
  name: string;
  dosage: string;
  frequency: string;
  timing: MedicationTiming;
  relation_to_food: FoodRelation;
  instructions: string;
  explanation: string;
}

export interface PrescriptionParseResponse {
  medicines: ParsedMedicine[];
  doctor_notes?: string;
  safety_disclaimer?: string;
}

export interface MedicationReminder {
  id: string;
  medicine_name: string;
  time_slot: "morning" | "afternoon" | "night";
  time: string;
  relation_to_food: string;
  dosage: string;
  status: "pending" | "taken" | "missed";
  takenAt?: string;
}

export interface HomecareBookingRequest {
  caregiver_id: string;
  user_name: string;
  care_type: CareType | string;
  date: string;
  time_slot: string;
  contact?: string;
}

export interface HomecareBookingResponse {
  booking_id: string;
  status: "confirmed" | "pending";
  caregiver_id: string;
  caregiver_name: string;
  scheduled_time: string;
  care_type: string;
  message: string;
}

export interface QuickActionItem {
  title: string;
  subtitle: string;
  icon: string;
  query: string;
}

export interface DynamicGreeting {
  greeting: string;
  subtext: string;
  quick_actions: QuickActionItem[];
}
