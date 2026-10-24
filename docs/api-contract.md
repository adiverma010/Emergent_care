# CareCompass Sathi API Contract

Base URL: `http://localhost:8000` (configurable via `NEXT_PUBLIC_API_URL`)

All endpoints accept and return JSON unless otherwise noted.

---

## 1. POST /triage

Accepts user symptom input and conversation context, returns triage determination, safety red flags, clinical explanation, and caregiver recommendations.

### Request Body
```json
{
  "user_input": "string (required)",
  "language": "en | hi | hinglish | auto",
  "location": {
    "lat": 28.54,
    "lng": 77.27
  },
  "conversation_history": [
    {
      "role": "user | assistant",
      "content": "string"
    }
  ]
}
```

### Response Body
```json
{
  "follow_up_question": "string | null",
  "care_type": "paramedic_home_visit | home_nursing | lab_test_home | teleconsultation | emergency_112 | null",
  "urgency": "emergency | same_day | scheduled | null",
  "red_flags": [
    "chest_pain | breathlessness | unconsciousness | severe_bleeding | stroke_symptoms | seizure | high_fever_infant | suicidal_ideation | severe_dehydration"
  ],
  "reasoning": "Plain language explanation for user and caregiver routing",
  "matched_caregivers": [
    {
      "caregiver_id": "CG_014",
      "score": 0.94,
      "reason": "Experienced in acute fever management, speaks Hindi and English, 3.2km away",
      "name": "Sister Anita Sharma",
      "role": "Registered Home Nurse",
      "phone": "+91-9876543210",
      "rating": 4.9,
      "distance_km": 3.2
    }
  ]
}
```

---

## 2. POST /dispatch

Initiates emergency service / ambulance dispatch for severe or critical cases.

### Request Body
```json
{
  "emergency_type": "string (e.g. chest_pain, severe_breathlessness, accident)",
  "location": {
    "lat": 28.54,
    "lng": 77.27,
    "address": "string optional"
  },
  "user_name": "string optional",
  "contact": "string optional"
}
```

### Response Body
```json
{
  "dispatch_id": "DISP-8921",
  "status": "notified | ambulance_assigned | en_route | arrived",
  "eta_minutes": 8,
  "ambulance_id": "DL-01-AMB-402",
  "hospital_name": "AIIMS Trauma Centre",
  "hospital_phone": "+91-11-26593677",
  "first_aid_steps": [
    "Keep patient calm and seated in an upright, comfortable position.",
    "Loosen tight clothing around neck and chest.",
    "Do not give solid food or liquids if consciousness is fluctuating.",
    "Keep airway clear and monitor breathing until paramedics arrive."
  ],
  "timeline": [
    { "step": "Emergency call received", "time": "Just now", "done": true },
    { "step": "Ambulance DL-01-AMB-402 assigned", "time": "1 min ago", "done": true },
    { "step": "Ambulance en route with paramedic team", "time": "ETA 8 mins", "done": false },
    { "step": "Arrival at location", "time": "Pending", "done": false }
  ]
}
```

---

## 3. GET /dispatch/{id}

Polls status for an existing emergency dispatch.

### Response Body
```json
{
  "dispatch_id": "DISP-8921",
  "status": "notified | ambulance_assigned | en_route | arrived",
  "eta_minutes": 5,
  "ambulance_id": "DL-01-AMB-402",
  "hospital_name": "AIIMS Trauma Centre",
  "timeline": [
    { "step": "Emergency call received", "time": "2 mins ago", "done": true },
    { "step": "Ambulance DL-01-AMB-402 assigned", "time": "2 mins ago", "done": true },
    { "step": "Ambulance en route with paramedic team", "time": "ETA 5 mins", "done": true },
    { "step": "Arrival at location", "time": "Pending", "done": false }
  ]
}
```

---

## 4. GET /hospitals/nearby?lat={lat}&lng={lng}

Returns verified nearby emergency hospitals with direct call numbers and live bed estimates.

### Response Body
```json
[
  {
    "id": "HOSP-01",
    "name": "AIIMS Apex Trauma Centre",
    "distance_km": 2.4,
    "phone": "+91-11-26593677",
    "address": "Ring Road, Safdarjung Enclave, New Delhi",
    "emergency_beds_available": 14,
    "has_icu": true
  },
  {
    "id": "HOSP-02",
    "name": "Safdarjung Hospital Emergency",
    "distance_km": 3.1,
    "phone": "+91-11-26165060",
    "address": "Ansari Nagar West, New Delhi",
    "emergency_beds_available": 22,
    "has_icu": true
  },
  {
    "id": "HOSP-03",
    "name": "Max Super Speciality Hospital",
    "distance_km": 4.5,
    "phone": "+91-11-26515050",
    "address": "1, 2, Press Enclave Marg, Saket, New Delhi",
    "emergency_beds_available": 6,
    "has_icu": true
  }
]
```

---

## 5. POST /prescription/parse

Extracts medications, schedules, food relationships, and plain-language patient explanations from an uploaded image or transcribed prescription text.

### Request Body
```json
{
  "text": "string (optional if image uploaded)",
  "image_base64": "string (optional)"
}
```
*(Or multipart form-data with `file`)*

### Response Body
```json
{
  "medicines": [
    {
      "name": "Paracetamol 650mg",
      "dosage": "650mg",
      "frequency": "Twice daily",
      "timing": "morning_night",
      "relation_to_food": "after_food",
      "instructions": "Take after meals with warm water. Maximum 3 tablets in 24 hours.",
      "explanation": "Relieves mild to moderate fever and body aches."
    },
    {
      "name": "Amoxicillin 500mg",
      "dosage": "500mg",
      "frequency": "Three times daily",
      "timing": "three_times_a_day",
      "relation_to_food": "after_food",
      "instructions": "Complete full 5-day course without skipping.",
      "explanation": "Antibiotic to fight bacterial throat infection."
    },
    {
      "name": "Pantoprazole 40mg",
      "dosage": "40mg",
      "frequency": "Once daily",
      "timing": "morning",
      "relation_to_food": "before_food",
      "instructions": "Take 30 minutes before breakfast.",
      "explanation": "Prevents acidity and stomach irritation."
    }
  ],
  "doctor_notes": "Hydrate well and rest. Review after 5 days if cough persists.",
  "safety_disclaimer": "AI-assisted extraction. Always verify dosages and instructions with your treating physician or pharmacist."
}
```

---

## 6. POST /reminders/schedule

Generates concrete daily reminder timetable for prescribed medications.

### Request Body
```json
{
  "medicines": [
    {
      "name": "string",
      "dosage": "string",
      "timing": "morning | afternoon | night | morning_night | three_times_a_day",
      "relation_to_food": "before_food | after_food | with_food | as_needed"
    }
  ],
  "user_id": "string optional"
}
```

### Response Body
```json
{
  "reminders": [
    {
      "id": "REM-01",
      "medicine_name": "Pantoprazole 40mg",
      "time_slot": "morning",
      "time": "08:00 AM",
      "relation_to_food": "before_food",
      "dosage": "1 tablet",
      "status": "pending"
    },
    {
      "id": "REM-02",
      "medicine_name": "Paracetamol 650mg",
      "time_slot": "morning",
      "time": "09:00 AM",
      "relation_to_food": "after_food",
      "dosage": "1 tablet",
      "status": "pending"
    },
    {
      "id": "REM-03",
      "medicine_name": "Amoxicillin 500mg",
      "time_slot": "afternoon",
      "time": "02:00 PM",
      "relation_to_food": "after_food",
      "dosage": "1 capsule",
      "status": "pending"
    },
    {
      "id": "REM-04",
      "medicine_name": "Paracetamol 650mg",
      "time_slot": "night",
      "time": "09:00 PM",
      "relation_to_food": "after_food",
      "dosage": "1 tablet",
      "status": "pending"
    }
  ]
}
```

---

## 7. POST /homecare

Books a confirmed or demo homecare visit (nurse, paramedic, or lab technician).

### Request Body
```json
{
  "caregiver_id": "string",
  "user_name": "string",
  "care_type": "paramedic_home_visit | home_nursing | lab_test_home | teleconsultation",
  "date": "string (YYYY-MM-DD)",
  "time_slot": "morning | afternoon | evening",
  "contact": "string"
}
```

### Response Body
```json
{
  "booking_id": "BK-51928",
  "status": "confirmed",
  "caregiver_id": "CG_014",
  "caregiver_name": "Sister Anita Sharma",
  "scheduled_time": "Tomorrow, 10:00 AM - 12:00 PM",
  "care_type": "home_nursing",
  "message": "Caregiver has received the request and will arrive with standard diagnostic kit."
}
```

---

## 8. GET /greeting?age={age}&language={language}

Generates warm, age-appropriate, culturally grounded multilingual greeting and recommended quick actions.

### Query Parameters
- `age`: integer (optional)
- `language`: `en | hi | hinglish`

### Response Body
```json
{
  "greeting": "Namaste Sharma ji, kaisa lag raha hai aaj?",
  "subtext": "Aapki dekhbhal ke liye Sathi hamesha hazir hai. Boliye ya likhiye.",
  "quick_actions": [
    {
      "title": "Bukhar ya Thakan",
      "subtitle": "Paracetamol timing aur checkup",
      "icon": "thermometer",
      "query": "Mujhe pichle do din se thakan aur halka bukhar hai"
    },
    {
      "title": "Dawa Ka Time",
      "subtitle": "Daily reminders dekhein",
      "icon": "pill",
      "query": "/prescriptions"
    },
    {
      "title": "Ghar par Nurse",
      "subtitle": "Dressing ya injection seva",
      "icon": "medical_services",
      "query": "Ghar par injection lagwane ke liye nurse chahiye"
    }
  ]
}
```
