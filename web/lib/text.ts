import type { Lang } from "./api";

export type Multilingual = { en: string; hi: string; hinglish?: string };

export function pick(lang: Lang, o: Multilingual): string {
  if (lang === "hinglish") return o.hinglish || o.en;
  if (lang === "hindi") return o.hi;
  return o.en;
}

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

export const CARE_LABEL: Record<string, Multilingual> = {
  paramedic_home_visit: { en: "Medic home visit", hi: "घर पर मेडिक की विज़िट", hinglish: "Medic home visit" },
  home_nursing: { en: "Home nursing", hi: "घर पर नर्सिंग", hinglish: "Home nursing" },
  lab_test_home: { en: "Lab test at home", hi: "घर पर लैब टेस्ट", hinglish: "Lab test at home" },
  teleconsultation: { en: "Doctor video consult", hi: "डॉक्टर से वीडियो सलाह", hinglish: "Doctor video consult" },
  emergency_112: { en: "Emergency: call 112", hi: "आपातकाल: 112 पर कॉल करें", hinglish: "Emergency: call 112" },
};

export const URGENCY_LABEL: Record<string, Multilingual> = {
  emergency: { en: "Emergency", hi: "आपातकाल", hinglish: "Emergency" },
  same_day: { en: "Today", hi: "आज ही", hinglish: "Today" },
  scheduled: { en: "Can be scheduled", hi: "समय तय करें", hinglish: "Scheduled" },
};

export const NAV_TEXT = {
  home: { en: "Home", hi: "होम", hinglish: "Home" },
  medicines: { en: "Medicines", hi: "दवाइयां", hinglish: "Medicines" },
  emergency: { en: "Emergency", hi: "आपातकाल", hinglish: "Emergency" },
  profile: { en: "Profile", hi: "प्रोफाइल", hinglish: "Profile" },
  suno: { en: "Listen", hi: "सुनो", hinglish: "Suno" },
  sos: { en: "SOS 112", hi: "आपातकाल 112", hinglish: "SOS 112" },
};

export const EMERGENCY_TEXT = {
  call_112: { en: "CALL 112 NOW", hi: "अभी 112 पर कॉल करें", hinglish: "Abhi 112 par call karein" },
  first_aid_title: { en: "First-Aid Steps", hi: "प्राथमिक उपचार के कदम", hinglish: "First-aid steps" },
  default_steps: {
    en: [
      "Keep the patient sitting or lying down comfortably in a well-ventilated area.",
      "Call 112 immediately or arrange transport to the nearest hospital.",
      "Do not give any food, water, or oral medicines if patient is drowsy or choking.",
      "Note down exact symptoms and times to inform emergency doctors.",
    ],
    hi: [
      "मरीज को आरामदायक स्थिति में बैठाएं या लिटाएं, हवा आने दें।",
      "तुरंत 112 पर कॉल करें या नज़दीकी अस्पताल ले जाने का प्रबंध करें।",
      "यदि मरीज बेहोश या उल्टी कर रहा हो तो खाने या पीने को कुछ न दें।",
      "लक्षण कब शुरू हुए, यह समय नोट कर लें ताकि डॉक्टर को बता सकें।",
    ],
    hinglish: [
      "Patient ko aaram se bithayein ya litayein, hawa aane dein.",
      "Turant 112 par call karein ya paas ke hospital le jaane ki vyavastha karein.",
      "Behoshi ya ulti ki sthiti mein kuch bhi khane ya peene ko na dein.",
      "Symptoms kab shuru hue, wo time note karein taaki doctor ko bata sakein.",
    ],
  },
  describe_label: {
    en: "Describe what happened",
    hi: "क्या हुआ विस्तार से बताएं",
    hinglish: "Kya hua detail mein batayein",
  },
  describe_placeholder: {
    en: "e.g. Sudden severe chest pain and breathlessness",
    hi: "उदा. अचानक सीने में तेज़ दर्द और सांस फूलना",
    hinglish: "e.g. Achanak seene mein tez dard aur saans lene mein takleef",
  },
  describe_btn: { en: "Check Emergency Steps", hi: "कदम देखें", hinglish: "Steps dekhein" },
  dispatch_title: {
    en: "Notify Ambulance & Hospital",
    hi: "एम्बुलेंस और अस्पताल को सूचित करें",
    hinglish: "Ambulance aur hospital ko notify karein",
  },
  dispatch_desc: {
    en: "Sends patient medical profile and GPS location directly to nearest responder.",
    hi: "मरीज की मेडिकल प्रोफाइल और जीपीएस लोकेशन नज़दीकी अस्पताल को भेजता है।",
    hinglish: "Patient ki medical details aur GPS location paas ke hospital ko bhejta hai.",
  },
  dispatch_btn: {
    en: "Notify Ambulance & Hospital",
    hi: "एम्बुलेंस व अस्पताल को सूचित करें",
    hinglish: "Ambulance aur hospital ko inform karein",
  },
  dispatch_sending: { en: "Notifying hospital...", hi: "अस्पताल को सूचना दी जा रही है...", hinglish: "Hospital ko notify kar rahe hain..." },
  status_notified: { en: "Hospital Notified", hi: "अस्पताल को सूचना प्राप्त", hinglish: "Hospital Notified" },
  status_assigned: { en: "Ambulance Assigned", hi: "एम्बुलेंस आवंटित", hinglish: "Ambulance Assigned" },
  status_enroute: { en: "Ambulance En Route", hi: "एम्बुलेंस रास्ते में है", hinglish: "Ambulance En Route" },
  demo_banner: {
    en: "Demo simulation: no real ambulance is called",
    hi: "डेमो सिमुलेशन: कोई वास्तविक एम्बुलेंस नहीं बुलाई गई है",
    hinglish: "Demo simulation: no real ambulance is called",
  },
  nearby_hospitals_title: { en: "Nearby Hospitals", hi: "नज़दीकी अस्पताल", hinglish: "Nearby Hospitals" },
  call_btn: { en: "Call", hi: "कॉल करें", hinglish: "Call" },
  patient_summary_title: { en: "Patient Summary Sent", hi: "भेजी गई जानकारी", hinglish: "Patient summary sent" },
};

export const PRESCRIPTION_TEXT = {
  title: { en: "Prescriptions & Reminders", hi: "पर्चे और दवाइयां", hinglish: "Prescriptions & Reminders" },
  upload_title: { en: "Upload Prescription", hi: "पर्चे की फोटो अपलोड करें", hinglish: "Prescription photo upload karein" },
  upload_help: {
    en: "Take photo or choose an image file of your doctor's prescription",
    hi: "डॉक्टर के पर्चे की स्पष्ट फोटो लें या फाइल चुनें",
    hinglish: "Doctor ke prescription ki photo lein ya file chunein",
  },
  paste_title: { en: "Or Paste Prescription Text", hi: "या पर्चे का टेक्स्ट यहां लिखें", hinglish: "Ya prescription text yahan likhein" },
  paste_placeholder: {
    en: "e.g. Paracetamol 650mg TDS for 3 days after food\nAmoxicillin 500mg BD for 5 days",
    hi: "उदा. Paracetamol 650mg TDS for 3 days after food\nAmoxicillin 500mg BD for 5 days",
    hinglish: "e.g. Paracetamol 650mg TDS for 3 days after food\nAmoxicillin 500mg BD for 5 days",
  },
  parse_btn: { en: "Analyze Prescription", hi: "पर्चे की जांच करें", hinglish: "Prescription analyze karein" },
  parsing: { en: "Analyzing...", hi: "जांच जारी है...", hinglish: "Analyzing..." },
  doctor_confirm_note: {
    en: "Please confirm with your doctor. Dosages shown are exactly as written on prescription.",
    hi: "कृपया अपने डॉक्टर से पुष्टि करें। खुराक पर्चे में लिखे अनुसार ही दिखाई गई है।",
    hinglish: "Please confirm with your doctor. Doses prescription ke hisaab se hi hain.",
  },
  allergy_warning: {
    en: "ALLERGY WARNING: This medicine matches an allergy recorded in your profile!",
    hi: "एलर्जी चेतावनी: यह दवा आपकी प्रोफाइल में दर्ज एलर्जी से मेल खाती है!",
    hinglish: "ALLERGY WARNING: Ye medicine aapki profile mein darj allergy se match karti hai!",
  },
  daily_chart_title: { en: "Daily Dose Schedule", hi: "दैनिक दवा का समय", hinglish: "Daily Dose Schedule" },
  morning: { en: "Morning", hi: "सुबह", hinglish: "Morning" },
  afternoon: { en: "Afternoon", hi: "दोपहर", hinglish: "Afternoon" },
  night: { en: "Night", hi: "रात", hinglish: "Night" },
  before_food: { en: "Before food", hi: "खाने से पहले", hinglish: "Khane se pehle" },
  after_food: { en: "After food", hi: "खाने के बाद", hinglish: "Khane ke baad" },
  taken: { en: "Taken", hi: "ले ली", hinglish: "Le li" },
  notifications_enable: { en: "Enable dose notifications", hi: "रिमाइंडर नोटिफिकेशन चालू करें", hinglish: "Reminders on karein" },
  notifications_enabled: { en: "Notifications enabled", hi: "नोटिफिकेशन चालू हैं", hinglish: "Notifications enabled" },
  due_banner: { en: "Dose Reminder: Time to take your medicine!", hi: "दवा का समय: कृपया अपनी दवा लें!", hinglish: "Dawa ka time ho gaya hai! Please take your dose." },
  manual_title: { en: "Add Medicine Manually", hi: "दवा खुद जोड़ें", hinglish: "Medicine manually add karein" },
  manual_note: {
    en: "Manual fallback mode: server parsing could not be completed.",
    hi: "मैन्युअल मोड: सर्वर से पर्चा नहीं पढ़ा जा सका।",
    hinglish: "Manual mode: server se parse nahi ho saka.",
  },
  med_name: { en: "Medicine Name", hi: "दवा का नाम", hinglish: "Medicine Name" },
  frequency: { en: "Frequency", hi: "दिन में कितनी बार", hinglish: "Frequency" },
  add_med_btn: { en: "Add to Schedule", hi: "शेड्यूल में जोड़ें", hinglish: "Schedule mein add karein" },
};

export const PROFILE_TEXT = {
  title: { en: "My Profile", hi: "मेरी प्रोफाइल", hinglish: "My Profile" },
  privacy_note: {
    en: "Your details stay on this device.",
    hi: "आपकी जानकारी केवल इसी डिवाइस पर सुरक्षित रहती है।",
    hinglish: "Aapki details isi phone par rehti hain.",
  },
  name_label: { en: "Name", hi: "नाम", hinglish: "Name" },
  age_label: { en: "Age", hi: "उम्र", hinglish: "Age" },
  lang_label: { en: "Language", hi: "भाषा", hinglish: "Language" },
  history_label: { en: "Medical History", hi: "बीमारी का इतिहास", hinglish: "Medical History" },
  allergies_label: { en: "Allergies to medicine", hi: "दवा से एलर्जी", hinglish: "Medicine allergies" },
  allergies_placeholder: { en: "e.g. Penicillin, Sulfa", hi: "उदा. पेनिसिलिन, सल्फा", hinglish: "e.g. Penicillin, Sulfa" },
  elder_mode: { en: "Elder mode: bigger text", hi: "एल्डर मोड: बड़े अक्षर", hinglish: "Elder mode: bade akshar" },
  clear_btn: { en: "Clear my data", hi: "मेरा डेटा मिटाएं", hinglish: "Mera data clear karein" },
  clear_confirm: {
    en: "Are you sure? This will remove your saved profile and reminders from this device.",
    hi: "क्या आप वाकई अपना डेटा मिटाना चाहते हैं? इससे आपकी प्रोफाइल और रिमाइंडर हट जाएंगे।",
    hinglish: "Kya aap sure hain? Isse aapka profile aur reminders clear ho jayenge.",
  },
  saved_toast: { en: "Profile updated", hi: "प्रोफाइल अपडेट हो गई", hinglish: "Profile update ho gayi" },
};

export const HOME_TEXT = {
  quick_fever: { en: "Fever or injury help", hi: "बुखार या चोट में मदद", hinglish: "Bukhar ya chot mein madad" },
  quick_lab: { en: "Lab test at home", hi: "घर पर लैब टेस्ट", hinglish: "Ghar par lab test" },
  quick_doctor: { en: "Talk to a doctor", hi: "डॉक्टर से बात करें", hinglish: "Doctor se consult" },
  quick_meds: { en: "My medicines", hi: "मेरी दवाइयां", hinglish: "Meri dawaiyan" },
  server_error: { en: "Could not reach the server. Is the backend running?", hi: "सर्वर से संपर्क नहीं हो सका। क्या बैकएंड चालू है?", hinglish: "Server se connect nahi ho paya. Backend check karein." },
  retry_btn: { en: "Retry", hi: "पुनः प्रयास करें", hinglish: "Retry" },
  irrelevant_note: {
    en: "Please share health symptoms or concerns so we can guide you to the right care.",
    hi: "कृपया स्वास्थ्य संबंधी लक्षण या समस्या बताएं ताकि हम आपको सही सलाह दे सकें।",
    hinglish: "Kripya health se related symptoms batayein taaki hum sahi care suggest kar sakein.",
  },
};
