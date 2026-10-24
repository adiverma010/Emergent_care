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

export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK !== "false";

export const MOCK_HOSPITALS: NearbyHospital[] = [
  {
    id: "HOSP-01",
    name: "AIIMS Apex Trauma Centre",
    distance_km: 2.1,
    phone: "011-26593677",
    address: "Ring Road, Safdarjung Enclave, New Delhi",
    emergency_beds_available: 12,
    has_icu: true,
  },
  {
    id: "HOSP-02",
    name: "Safdarjung Hospital Emergency",
    distance_km: 2.8,
    phone: "011-26165060",
    address: "Ansari Nagar West, New Delhi",
    emergency_beds_available: 19,
    has_icu: true,
  },
  {
    id: "HOSP-03",
    name: "Max Super Speciality Hospital",
    distance_km: 4.3,
    phone: "011-26515050",
    address: "Press Enclave Marg, Saket, New Delhi",
    emergency_beds_available: 5,
    has_icu: true,
  },
  {
    id: "HOSP-04",
    name: "Fortis Escorts Heart Institute",
    distance_km: 5.6,
    phone: "011-47135000",
    address: "Okhla Road, Sukhdev Vihar, New Delhi",
    emergency_beds_available: 8,
    has_icu: true,
  },
];

export const MOCK_FIRST_AID_STEPS: Record<string, string[]> = {
  chest_pain: [
    "Have the patient sit quietly in a comfortable position, leaning slightly forward with knees bent.",
    "Loosen tight clothing around neck, chest, and waist to ease breathing.",
    "Do NOT give heavy food or water; keep patient calm and reassure them.",
    "If prescribed nitroglycerin/aspirin is already advised by their cardiologist, assist them in taking it.",
    "Monitor pulse and responsiveness continuously until emergency team arrives.",
  ],
  breathlessness: [
    "Sit the person upright; do NOT let them lie flat on their back.",
    "Open windows or turn on a fan to ensure ample fresh air circulation.",
    "Encourage slow, pursed-lip breathing (breathe in through nose for 2 seconds, blow out slowly through pursed lips for 4 seconds).",
    "Keep airway completely unobstructed and loosen collar or tight clothes.",
  ],
  seizure: [
    "Clear hard or sharp objects away from around the person.",
    "Turn the person gently onto their side to keep the airway clear.",
    "Do NOT put anything inside their mouth or try to hold down their tongue.",
    "Do NOT restrain their movements or shake them.",
    "Time the seizure and stay by their side until breathing returns to normal.",
  ],
  severe_bleeding: [
    "Apply firm, continuous pressure directly over the wound using a clean cloth or bandage.",
    "Elevate the injured limb above heart level if no broken bone is suspected.",
    "Do not remove the cloth if it soaks through; place another clean cloth directly on top and maintain pressure.",
    "Keep patient warm and still to prevent shock.",
  ],
  unconsciousness: [
    "Check for breathing and pulse immediately.",
    "Place the person in the recovery position (on their side with head tilted back slightly).",
    "Do NOT give anything by mouth (no water, food, or medicine).",
    "Keep the neck straight to ensure the tongue does not block the airway.",
  ],
  default: [
    "Keep the patient calm, comfortable, and well-supported.",
    "Ensure the surrounding area is well-ventilated and free of obstacles for paramedics.",
    "Keep their identification, current medication list, and phone ready.",
    "Remain beside the patient and monitor their consciousness and breathing.",
  ],
};

export function mockTriage(req: TriageRequest): TriageResponse {
  const text = req.user_input.toLowerCase();

  // Emergency 112 check: chest pain, heart attack, unconsciousness, severe breathing trouble, stroke
  if (
    text.includes("chest pain") ||
    text.includes("seene mein dard") ||
    text.includes("dil ka daura") ||
    text.includes("heart attack") ||
    text.includes("saans nahi") ||
    text.includes("breathless") ||
    text.includes("saans phool") ||
    text.includes("unconscious") ||
    text.includes("behosh") ||
    text.includes("stroke") ||
    text.includes("khoon ki ulti") ||
    text.includes("vomiting blood") ||
    text.includes("falij") ||
    text.includes("paralysis")
  ) {
    const flags: ("chest_pain" | "breathlessness" | "unconsciousness" | "severe_bleeding" | "stroke_symptoms")[] = [];
    if (text.includes("chest") || text.includes("seene")) flags.push("chest_pain");
    if (text.includes("saans") || text.includes("breath")) flags.push("breathlessness");
    if (text.includes("behosh") || text.includes("unconscious")) flags.push("unconsciousness");
    if (text.includes("khoon") || text.includes("blood")) flags.push("severe_bleeding");
    if (text.includes("stroke") || text.includes("falij")) flags.push("stroke_symptoms");

    return {
      follow_up_question: null,
      care_type: "emergency_112",
      urgency: "emergency",
      red_flags: flags.length ? flags : ["chest_pain"],
      reasoning:
        "High-risk acute symptoms detected requiring immediate emergency medical intervention. Routine home visits and clinic appointments are suspended. Please call 112 immediately.",
      matched_caregivers: [],
    };
  }

  // Follow-up required check: ambiguous or short input
  if (
    (text.length < 15 && !text.includes("fever") && !text.includes("bukhar") && !text.includes("injection")) ||
    (text.includes("pet me dard") && !text.includes("vomit") && !text.includes("dast") && req.conversation_history.length === 0)
  ) {
    const isHindi = req.language === "hi" || req.language === "hinglish";
    return {
      follow_up_question: isHindi
        ? "Kya pet me dard ke sath ulti, bukhar ya dast bhi hai? Yeh dard kitne samay se ho raha hai?"
        : "Is the stomach pain accompanied by vomiting, fever, or loose motions? How many hours or days has it persisted?",
      care_type: null,
      urgency: null,
      red_flags: [],
      reasoning: "Additional context needed to determine if this requires a home nursing visit, lab work, or teleconsultation.",
      matched_caregivers: [],
    };
  }

  // Home nursing: injection, wound dressing, catheter, bedridden care
  if (
    text.includes("injection") ||
    text.includes("dressing") ||
    text.includes("ghav") ||
    text.includes("wound") ||
    text.includes("catheter") ||
    text.includes("nurse") ||
    text.includes("bandage")
  ) {
    return {
      follow_up_question: null,
      care_type: "home_nursing",
      urgency: "same_day",
      red_flags: [],
      reasoning:
        "Specialized clinical procedures (such as injections, sterile wound dressing, or catheter care) are safely managed at home by licensed visiting nurses.",
      matched_caregivers: [
        {
          caregiver_id: "CG_014",
          score: 0.96,
          name: "Sister Anita Sharma",
          role: "Senior Home Care Nurse (RN)",
          phone: "+91-9810123456",
          rating: 4.9,
          distance_km: 2.4,
          gender: "Female",
          skills: ["Injections", "IV Infusion", "Sterile Wound Dressing", "Catheterization"],
          languages: ["Hindi", "English", "Punjabi"],
          tier: "Tier 1 Verified",
          reason: "Top-rated registered nurse 2.4km away, verified for sterile wound care and home injections.",
        },
        {
          caregiver_id: "CG_022",
          score: 0.91,
          name: "Nurse Rajesh Maurya",
          role: "Critical Care & Post-Op Nurse",
          phone: "+91-9871654321",
          rating: 4.8,
          distance_km: 3.8,
          gender: "Male",
          skills: ["Post-operative Care", "Injections", "Bedside Monitoring"],
          languages: ["Hindi", "English"],
          tier: "Tier 1 Verified",
          reason: "Specialized in elder post-surgical monitoring and intramuscular injections, arrives in 45 mins.",
        },
      ],
    };
  }

  // Lab test at home: blood test, sugar, thyroid, sample collection
  if (
    text.includes("blood test") ||
    text.includes("lab test") ||
    text.includes("sugar test") ||
    text.includes("khoon ki janch") ||
    text.includes("sample") ||
    text.includes("cbc") ||
    text.includes("lipid")
  ) {
    return {
      follow_up_question: null,
      care_type: "lab_test_home",
      urgency: "scheduled",
      red_flags: [],
      reasoning: "Diagnostic sample collection can be scheduled comfortably at home with an accredited phlebotomist.",
      matched_caregivers: [
        {
          caregiver_id: "CG_035",
          score: 0.95,
          name: "Mohit Chawla",
          role: "Certified Phlebotomist (NABL Lab)",
          phone: "+91-9811223344",
          rating: 4.9,
          distance_km: 1.8,
          gender: "Male",
          skills: ["Painless Vein Puncture", "Fasting Glucose", "Geriatric Sample Collection"],
          languages: ["Hindi", "English"],
          tier: "NABL Certified",
          reason: "Nearby certified phlebotomist, high rating for painless blood collection in senior citizens.",
        },
      ],
    };
  }

  // Paramedic home visit: moderate acute fever, severe weakness, elderly immobility
  if (text.includes("bukhar") || text.includes("fever") || text.includes("kamzori") || text.includes("bedridden")) {
    return {
      follow_up_question: null,
      care_type: "paramedic_home_visit",
      urgency: "same_day",
      red_flags: [],
      reasoning:
        "Fever with generalized body ache and fatigue benefits from an in-person physical assessment, vitals check, and primary management by a mobile paramedic.",
      matched_caregivers: [
        {
          caregiver_id: "CG_008",
          score: 0.93,
          name: "Vikas Deshmukh",
          role: "Emergency Paramedic (EMT-P)",
          phone: "+91-9955443322",
          rating: 4.85,
          distance_km: 3.1,
          gender: "Male",
          skills: ["Acute Vitals Triage", "Fever Protocols", "Nebulization", "ECG"],
          languages: ["Hindi", "English"],
          tier: "Paramedic Level 2",
          reason: "Equipped with mobile diagnostic kit, pulse oximeter, and rapid antigen screening; 3.1km away.",
        },
        {
          caregiver_id: "CG_014",
          score: 0.89,
          name: "Sister Anita Sharma",
          role: "Senior Home Care Nurse (RN)",
          phone: "+91-9810123456",
          rating: 4.9,
          distance_km: 2.4,
          gender: "Female",
          skills: ["Vitals Monitoring", "Oral Hydration", "Fever Sponge"],
          languages: ["Hindi", "English", "Punjabi"],
          tier: "Tier 1 Verified",
          reason: "Experienced in gentle geriatric fever sponge and hydration therapy.",
        },
      ],
    };
  }

  // Default: Teleconsultation
  return {
    follow_up_question: null,
    care_type: "teleconsultation",
    urgency: "scheduled",
    red_flags: [],
    reasoning:
      "Your reported concern can be thoroughly reviewed via an online video or phone consultation with a general physician for medical guidance and prescription renewal.",
    matched_caregivers: [
      {
        caregiver_id: "CG_042",
        score: 0.94,
        name: "Dr. Sunita Rao, MBBS MD",
        role: "Consultant Physician (General Medicine)",
        phone: "+91-9820011223",
        rating: 4.95,
        distance_km: 0,
        gender: "Female",
        skills: ["Internal Medicine", "Preventive Healthcare", "Elder Care"],
        languages: ["Hindi", "English", "Telugu"],
        tier: "Medical Council Registered",
        reason: "18 years clinical experience, available now for 15-minute video teleconsult.",
      },
      {
        caregiver_id: "CG_049",
        score: 0.91,
        name: "Dr. Alok Sen, MBBS",
        role: "Family Medicine Specialist",
        phone: "+91-9830022334",
        rating: 4.88,
        distance_km: 0,
        gender: "Male",
        skills: ["Family Health", "Chronic Disease Management"],
        languages: ["Hindi", "English", "Bengali"],
        tier: "Medical Council Registered",
        reason: "Available for same-day digital consult and digital prescription issuance.",
      },
    ],
  };
}

let mockDispatchCount = 100;

export function mockCreateDispatch(req: DispatchRequest): DispatchStatus {
  mockDispatchCount += 1;
  const dispatchId = `DISP-${mockDispatchCount}`;
  const steps = MOCK_FIRST_AID_STEPS[req.emergency_type] || MOCK_FIRST_AID_STEPS.default;

  return {
    dispatch_id: dispatchId,
    status: "notified",
    eta_minutes: 8,
    ambulance_id: "DL-01-AMB-402",
    hospital_name: "AIIMS Apex Trauma Centre",
    hospital_phone: "011-26593677",
    first_aid_steps: steps,
    timeline: [
      { step: "Emergency dispatch notified (112 integration)", time: "Just now", done: true },
      { step: "Paramedic ambulance assigned (DL-01-AMB-402)", time: "Pending", done: false },
      { step: "Ambulance en route with emergency kit", time: "ETA 8 mins", done: false },
      { step: "Ambulance arrived at patient location", time: "Pending", done: false },
    ],
  };
}

export function mockGetDispatch(id: string, elapsedTicks: number = 0): DispatchStatus {
  // Simulate progress across polls:
  // tick 0: notified
  // tick 1-2: ambulance_assigned
  // tick 3+: en_route
  let status: DispatchStatus["status"] = "notified";
  let eta = 8;
  const timeline = [
    { step: "Emergency dispatch notified (112 integration)", time: "Confirmed", done: true },
    { step: "Paramedic ambulance assigned (DL-01-AMB-402)", time: "Assigned", done: elapsedTicks >= 1 },
    { step: "Ambulance en route with emergency kit", time: "ETA 5 mins", done: elapsedTicks >= 2 },
    { step: "Ambulance arrived at patient location", time: "Expected 10:25 AM", done: elapsedTicks >= 4 },
  ];

  if (elapsedTicks >= 4) {
    status = "arrived";
    eta = 0;
  } else if (elapsedTicks >= 2) {
    status = "en_route";
    eta = Math.max(1, 7 - elapsedTicks * 2);
  } else if (elapsedTicks >= 1) {
    status = "ambulance_assigned";
    eta = 8;
  }

  return {
    dispatch_id: id,
    status,
    eta_minutes: eta,
    ambulance_id: "DL-01-AMB-402",
    hospital_name: "AIIMS Apex Trauma Centre",
    hospital_phone: "011-26593677",
    first_aid_steps: MOCK_FIRST_AID_STEPS.chest_pain,
    timeline,
  };
}

export function mockParsePrescription(input: { text?: string; file?: File | null }): PrescriptionParseResponse {
  const text = (input.text || "").toLowerCase();

  // If text mentions specific known medicines, match them; otherwise return realistic sample medicines
  if (text.includes("metformin") || text.includes("sugar") || text.includes("diabetes")) {
    return {
      medicines: [
        {
          name: "Metformin 500mg",
          dosage: "500mg",
          frequency: "Twice daily",
          timing: "morning_night",
          relation_to_food: "with_food",
          instructions: "Take with or immediately after meals with plenty of water.",
          explanation: "Helps control blood sugar levels by improving body insulin response.",
        },
        {
          name: "Telmisartan 40mg",
          dosage: "40mg",
          frequency: "Once daily",
          timing: "morning",
          relation_to_food: "before_food",
          instructions: "Take every morning at the same time.",
          explanation: "Regulates high blood pressure and protects kidneys.",
        },
      ],
      doctor_notes: "Check fasting blood sugar weekly. Maintain low glycemic diet.",
      safety_disclaimer: "Extracted directly from prescription. Always confirm dosages with your doctor or pharmacist.",
    };
  }

  return {
    medicines: [
      {
        name: "Paracetamol 650mg",
        dosage: "650mg",
        frequency: "Twice daily",
        timing: "morning_night",
        relation_to_food: "after_food",
        instructions: "Take 1 tablet after food. Do not exceed 3 tablets in 24 hours.",
        explanation: "Helps reduce high body temperature and relieves bodily discomfort.",
      },
      {
        name: "Pantoprazole 40mg",
        dosage: "40mg",
        frequency: "Once daily",
        timing: "morning",
        relation_to_food: "before_food",
        instructions: "Take 1 tablet 30 minutes before morning tea or breakfast.",
        explanation: "Protects stomach lining from acidity and medication irritation.",
      },
      {
        name: "Cetirizine 10mg",
        dosage: "10mg",
        frequency: "Once daily at bedtime",
        timing: "night",
        relation_to_food: "after_food",
        instructions: "Take 1 tablet at night before sleeping. May cause mild drowsiness.",
        explanation: "Relieves running nose, allergic throat irritation, and sneezing.",
      },
    ],
    doctor_notes: "Rest and consume plenty of fluids. Follow up in 3 days if fever does not subside.",
    safety_disclaimer: "Extracted directly from prescription. Always confirm dosages with your doctor or pharmacist.",
  };
}

export function mockScheduleReminders(medicines: PrescriptionParseResponse["medicines"]): MedicationReminder[] {
  const reminders: MedicationReminder[] = [];
  let count = 1;

  medicines.forEach((med) => {
    if (med.timing === "morning" || med.timing === "morning_night" || med.timing === "three_times_a_day") {
      reminders.push({
        id: `REM-${count++}`,
        medicine_name: med.name,
        time_slot: "morning",
        time: med.relation_to_food === "before_food" ? "07:30 AM" : "08:30 AM",
        relation_to_food: med.relation_to_food,
        dosage: med.dosage || "1 dose",
        status: "pending",
      });
    }

    if (med.timing === "afternoon" || med.timing === "three_times_a_day") {
      reminders.push({
        id: `REM-${count++}`,
        medicine_name: med.name,
        time_slot: "afternoon",
        time: med.relation_to_food === "before_food" ? "01:00 PM" : "01:45 PM",
        relation_to_food: med.relation_to_food,
        dosage: med.dosage || "1 dose",
        status: "pending",
      });
    }

    if (med.timing === "night" || med.timing === "morning_night" || med.timing === "three_times_a_day") {
      reminders.push({
        id: `REM-${count++}`,
        medicine_name: med.name,
        time_slot: "night",
        time: med.relation_to_food === "before_food" ? "08:00 PM" : "09:00 PM",
        relation_to_food: med.relation_to_food,
        dosage: med.dosage || "1 dose",
        status: "pending",
      });
    }
  });

  return reminders;
}

export function mockHomecareBooking(req: HomecareBookingRequest): HomecareBookingResponse {
  return {
    booking_id: `BK-${Math.floor(10000 + Math.random() * 90000)}`,
    status: "confirmed",
    caregiver_id: req.caregiver_id,
    caregiver_name: req.caregiver_id === "CG_014" ? "Sister Anita Sharma" : "Nurse on Duty",
    scheduled_time: `${req.date || "Tomorrow"}, ${req.time_slot || "Morning Slot (9:00 AM - 11:00 AM)"}`,
    care_type: req.care_type,
    message: "Booking request confirmed (Mock). A licensed professional will visit your home with verified credentials and sanitization kit.",
  };
}

export function getLocalGreeting(age: number | null, lang: AppLanguage, name?: string): DynamicGreeting {
  const currentHour = new Date().getHours();
  const displayName = name ? name.trim() : "";
  const isSenior = age !== null && age >= 60;

  if (lang === "hi") {
    const timeGreeting = currentHour < 12 ? "सुप्रभात" : currentHour < 17 ? "नमस्ते" : "शुभ संध्या";
    const title = isSenior
      ? `${timeGreeting} ${displayName ? displayName + " जी" : "आदरणीय"}, आप कैसा महसूस कर रहे हैं?`
      : `${timeGreeting} ${displayName || "साथी"}, आपकी सेहत कैसी है?`;

    return {
      greeting: title,
      subtext: "स्वास्थ्य संबंधी कोई भी परेशानी बेझिझक बोलें या लिखें। केयर कम्पास साथी हमेशा आपके साथ है।",
      quick_actions: [
        {
          title: "तबीयत खराब है",
          subtitle: "लक्षण बताएं और सही सलाह पाएं",
          icon: "stethoscope",
          query: "मुझे बुखार और शरीर में दर्द हो रहा है",
        },
        {
          title: "दवा का समय",
          subtitle: "आज की दवाइयों की समय सारणी",
          icon: "pill",
          query: "/prescriptions",
        },
        {
          title: "घर पर नर्स",
          subtitle: "ड्रेसिंग, इंजेक्शन या जांच के लिए",
          icon: "home_health",
          query: "घर पर इंजेक्शन लगाने के लिए नर्स की आवश्यकता है",
        },
        {
          title: "आपातकालीन 112",
          subtitle: "तुरंत एम्बुलेंस या अस्पताल सहायता",
          icon: "emergency",
          query: "/emergency",
        },
      ],
    };
  }

  if (lang === "hinglish") {
    const timeGreeting = currentHour < 12 ? "Good morning" : currentHour < 17 ? "Namaste" : "Good evening";
    const title = isSenior
      ? `${timeGreeting} ${displayName ? displayName + " ji" : ""}, aaj tabiyat kaisi lag rahi hai?`
      : `${timeGreeting} ${displayName || "dost"}, aaj kaisa feel ho raha hai?`;

    return {
      greeting: title,
      subtext: "Sathi aapki madad ke liye tayyar hai. Aasan bhasha me boliye ya likhiye.",
      quick_actions: [
        {
          title: "Symptom Check",
          subtitle: "Apni pareshani describe karein",
          icon: "stethoscope",
          query: "Papa ko do din se bukhar aur khansi hai",
        },
        {
          title: "Dawa Reminders",
          subtitle: "Prescription upload karein",
          icon: "pill",
          query: "/prescriptions",
        },
        {
          title: "Home Nursing",
          subtitle: "Injection ya dressing ke liye",
          icon: "home_health",
          query: "Ghar par sterile injection aur dressing lagwana hai",
        },
        {
          title: "Emergency 112",
          subtitle: "Fast ambulance aur SOS",
          icon: "emergency",
          query: "/emergency",
        },
      ],
    };
  }

  // English
  const timeGreeting = currentHour < 12 ? "Good morning" : currentHour < 17 ? "Good afternoon" : "Good evening";
  const title = isSenior
    ? `${timeGreeting} ${displayName ? "Mr./Ms. " + displayName : ""}, how are you feeling today?`
    : `${timeGreeting} ${displayName || ""}, what health concern can we help with today?`;

  return {
    greeting: title,
    subtext: "Your trusted healthcare navigator. Speak naturally or type in your comfort language.",
    quick_actions: [
      {
        title: "Check Symptoms",
        subtitle: "Safe guidance & caregiver matching",
        icon: "stethoscope",
        query: "I have high fever and shivering since yesterday",
      },
      {
        title: "Medication Reminders",
        subtitle: "Scan or view daily schedule",
        icon: "pill",
        query: "/prescriptions",
      },
      {
        title: "Home Nursing Visit",
        subtitle: "Injections, vitals, or wound care",
        icon: "home_health",
        query: "Need a verified home nurse for sterile dressing",
      },
      {
        title: "Emergency 112",
        subtitle: "Instant hospital & ambulance aid",
        icon: "emergency",
        query: "/emergency",
      },
    ],
  };
}
