"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSettings } from "@/lib/settings";
import { triage, type TriageResponse, type Turn } from "@/lib/api";
import { speak, stopSpeaking, startListening, speechInputSupported } from "@/lib/speech";
import { greeting, CARE_LABEL, URGENCY_LABEL, HOME_TEXT, pick } from "@/lib/text";

const EMERGENCY_HINT = {
  english: "Call 112 now. Follow these steps until help arrives.",
  hindi: "अभी 112 पर कॉल करें। मदद आने तक ये कदम उठाएं।",
  hinglish: "Abhi 112 par call karein. Madad aane tak ye steps follow karein.",
};

const QUICK_ACTIONS = [
  {
    id: "fever",
    icon: "🤒",
    label: HOME_TEXT.quick_fever,
    sentences: {
      hindi: "मुझे तेज़ बुखार और शरीर में दर्द है, मदद चाहिए",
      hinglish: "Mujhe tez bukhar aur body pain hai, help chahiye",
      english: "I have high fever and severe body ache, please help",
    },
  },
  {
    id: "lab",
    icon: "🧪",
    label: HOME_TEXT.quick_lab,
    sentences: {
      hindi: "मुझे घर पर ब्लड टेस्ट और खून की जांच करवानी है",
      hinglish: "Mujhe ghar par blood sample aur lab test chahiye",
      english: "I need a blood test and lab sample collection at home",
    },
  },
  {
    id: "doctor",
    icon: "🩺",
    label: HOME_TEXT.quick_doctor,
    sentences: {
      hindi: "मुझे डॉक्टर से ऑनलाइन वीडियो पर बात करनी है",
      hinglish: "Mujhe doctor se online video consultation chahiye",
      english: "I need an online video consultation with a doctor",
    },
  },
  {
    id: "meds",
    icon: "💊",
    label: HOME_TEXT.quick_meds,
    route: "/prescriptions",
  },
];

export default function Home() {
  const router = useRouter();
  const { profile, ready, update } = useSettings();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<TriageResponse | null>(null);
  const [history, setHistory] = useState<Turn[]>([]);
  const [error, setError] = useState("");
  const [lastQuery, setLastQuery] = useState("");
  const recRef = useRef<any>(null);
  const lang = profile.language;

  useEffect(() => {
    if (ready && !profile.onboarded) router.replace("/onboarding");
  }, [ready, profile.onboarded, router]);

  const isEmergency = !!result && (result.care_type === "emergency_112" || (result.red_flags && result.red_flags.length > 0));

  const readResult = (r: TriageResponse) => {
    const emerg = r.care_type === "emergency_112" || (r.red_flags && r.red_flags.length > 0);
    if (emerg) {
      speak([EMERGENCY_HINT[lang], ...(r.first_aid_steps || [])].join(". "), lang);
    } else if (r.irrelevant) {
      speak(r.follow_up_question || pick(lang, HOME_TEXT.irrelevant_note), lang);
    } else if (r.follow_up_question) {
      speak(r.follow_up_question, lang);
    } else {
      const care = r.care_type ? pick(lang, CARE_LABEL[r.care_type] || { en: r.care_type, hi: r.care_type }) : "";
      speak(`${care}. ${r.reasoning}`, lang);
    }
  };

  const send = async (msg: string) => {
    const m = msg.trim();
    if (!m || loading) return;
    setLoading(true);
    setError("");
    setLastQuery(m);
    stopSpeaking();
    try {
      const r = await triage(m, lang, history);
      setResult(r);
      setText("");

      // Emergency auto-redirect
      if (r.care_type === "emergency_112" || (r.red_flags && r.red_flags.length > 0)) {
        try {
          sessionStorage.setItem("sathi_emergency_triage", JSON.stringify(r));
        } catch {}
        router.push("/emergency");
        return;
      }

      // Handle irrelevant input
      if (r.irrelevant) {
        // Do NOT add to conversation history, do NOT show care card
        readResult(r);
        return;
      }

      if (r.follow_up_question) {
        setHistory([...history, { role: "user", text: m }, { role: "assistant", text: r.follow_up_question }]);
      } else {
        setHistory([]);
      }
      readResult(r);
    } catch (e: any) {
      setError(e?.message || "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  };

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    stopSpeaking();
    setListening(true);
    recRef.current = startListening(
      lang,
      (t, final) => {
        setText(t);
        if (final) send(t);
      },
      () => setListening(false)
    );
    if (!recRef.current) {
      setListening(false);
      setError("Voice input is not supported in this browser. Please use Chrome.");
    }
  };

  const handleQuickAction = (action: (typeof QUICK_ACTIONS)[0]) => {
    if (action.route) {
      router.push(action.route);
    } else if (action.sentences) {
      const sentence = action.sentences[lang] || action.sentences.english;
      setText(sentence);
      send(sentence);
    }
  };

  if (!ready || !profile.onboarded) return <main className="p-6">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 pb-28 text-ink">
      {/* Header */}
      <header className="rounded-3xl bg-primary-soft p-4 flex items-start justify-between gap-2 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-primary">{greeting(profile.name, profile.age, lang)}</h1>
          <p className="text-muted text-xs sm:text-sm">CareCompass Sathi: आपकी सेहत का साथी</p>
        </div>
        <div className="flex gap-1 rounded-full bg-white p-1 text-sm font-bold shadow-xs">
          {(["hindi", "english", "hinglish"] as const).map((l) => (
            <button
              key={l}
              onClick={() => update({ language: l })}
              className={`rounded-full px-3 py-1 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-primary ${
                lang === l ? "bg-primary text-white" : "text-muted hover:bg-beige/50"
              }`}
            >
              {l === "hindi" ? "हिं" : l === "english" ? "EN" : "Hi/En"}
            </button>
          ))}
        </div>
      </header>

      {/* Network Error Banner with Retry Button */}
      {error && (
        <aside
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-danger/30 bg-danger-soft p-3.5 text-sm font-bold text-danger shadow-xs"
        >
          <div className="flex items-center gap-2">
            <span aria-hidden="true">⚠️</span>
            <span>{pick(lang, HOME_TEXT.server_error)}</span>
          </div>
          {lastQuery && (
            <button
              type="button"
              onClick={() => send(lastQuery)}
              className="min-h-[48px] rounded-xl bg-danger px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-danger/90 active:scale-95 transition focus-visible:outline-3 focus-visible:outline-primary"
            >
              {pick(lang, HOME_TEXT.retry_btn)}
            </button>
          )}
        </aside>
      )}

      {/* Voice & Text Input Hero */}
      <section className="rounded-3xl bg-white p-5 shadow-sm text-center space-y-4 border border-beige">
        <h2 className="text-xl font-bold">
          {lang === "hindi" ? "बोलिए, हम सुन रहे हैं" : "Boliye, hum sun rahe hain"}
        </h2>
        <button
          onClick={toggleMic}
          aria-label={listening ? "Listening... click to stop" : "Speak your health problem"}
          className={`mx-auto flex h-28 w-28 items-center justify-center rounded-full text-5xl text-white shadow-lg transition active:scale-95 focus-visible:outline-4 focus-visible:outline-primary ${
            listening ? "bg-danger animate-pulse" : "bg-primary hover:bg-primary/95"
          }`}
        >
          🎤
        </button>
        <p className="text-muted text-sm">
          {listening
            ? "Sun rahe hain... / Listening..."
            : lang === "hindi"
            ? "माइक दबाकर बोलें, या नीचे लिखें"
            : "Tap and speak, or type below"}
        </p>
        {!speechInputSupported() && (
          <p className="text-xs text-danger font-semibold">Voice needs Chrome. You can type instead.</p>
        )}

        {/* Text Input Row */}
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(text)}
            placeholder="e.g. papa ko do din se bukhar hai"
            className="flex-1 min-h-[48px] rounded-full bg-beige/40 px-5 py-3 text-base focus-visible:outline-3 focus-visible:outline-primary"
          />
          <button
            onClick={() => send(text)}
            disabled={loading || !text.trim()}
            className="min-h-[48px] min-w-[64px] rounded-full bg-primary px-6 font-bold text-white disabled:opacity-50 hover:bg-primary/90 transition focus-visible:outline-3 focus-visible:outline-primary"
          >
            {loading ? "..." : "Go"}
          </button>
        </div>

        {/* Four Large Quick Action Buttons Under Mic */}
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => handleQuickAction(action)}
              disabled={loading}
              className="flex min-h-[56px] items-center gap-2.5 rounded-2xl bg-cream p-3 text-left border border-beige hover:bg-primary-soft/40 hover:border-primary/40 active:scale-98 transition focus-visible:outline-3 focus-visible:outline-primary"
            >
              <span className="text-2xl shrink-0" aria-hidden="true">
                {action.icon}
              </span>
              <span className="text-xs sm:text-sm font-bold text-ink leading-tight line-clamp-2">
                {pick(lang, action.label)}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Irrelevant Query Gentle Note */}
      {result && result.irrelevant && (
        <section
          role="note"
          className="rounded-3xl bg-beige/60 p-5 space-y-3 border border-beige shadow-xs"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl" aria-hidden="true">
              💡
            </span>
            <div className="flex-1">
              <p className="text-base font-bold text-ink">
                {result.follow_up_question || pick(lang, HOME_TEXT.irrelevant_note)}
              </p>
              <p className="text-xs text-muted mt-1">
                {pick(lang, HOME_TEXT.irrelevant_note)}
              </p>
            </div>
          </div>
          <button
            onClick={() => readResult(result)}
            className="rounded-full bg-white px-4 py-2 font-bold text-primary shadow-xs hover:bg-primary-soft focus-visible:outline-3 focus-visible:outline-primary"
          >
            🔊 Listen / सुनें
          </button>
        </section>
      )}

      {/* Emergency Alert Card (if not redirected) */}
      {result && !result.irrelevant && isEmergency && (
        <section className="rounded-3xl border-4 border-danger bg-danger-soft p-5 space-y-3" role="alert">
          <h2 className="text-2xl font-extrabold text-danger">🚨 {EMERGENCY_HINT[lang]}</h2>
          <a
            href="tel:112"
            className="block min-h-[56px] rounded-full bg-danger py-4 text-center text-3xl font-extrabold text-white shadow-md focus-visible:outline-3 focus-visible:outline-white"
          >
            CALL 112
          </a>
          <ol className="list-decimal space-y-2 pl-6 font-semibold">
            {(result.first_aid_steps || []).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <p className="text-sm text-muted">{result.reasoning}</p>
          <button
            onClick={() => readResult(result)}
            className="rounded-full bg-white px-5 py-2 font-bold text-danger focus-visible:outline-3 focus-visible:outline-danger"
          >
            🔊 Listen / सुनें
          </button>
        </section>
      )}

      {/* Follow-up question card */}
      {result && !result.irrelevant && !isEmergency && result.follow_up_question && (
        <section className="rounded-3xl bg-beige p-5 space-y-2 border border-beige/60">
          <p className="text-xl font-semibold">{result.follow_up_question}</p>
          <button
            onClick={() => readResult(result)}
            className="rounded-full bg-white px-4 py-2 font-bold text-primary shadow-xs focus-visible:outline-3 focus-visible:outline-primary"
          >
            🔊 Listen / सुनें
          </button>
        </section>
      )}

      {/* Care recommendation and caregiver matches */}
      {result && !result.irrelevant && !isEmergency && !result.follow_up_question && (
        <section className="rounded-3xl bg-white p-5 shadow-sm space-y-3 border border-beige">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary-soft px-4 py-1.5 font-bold text-primary text-sm">
              {result.care_type
                ? pick(lang, CARE_LABEL[result.care_type] || { en: result.care_type, hi: result.care_type })
                : ""}
            </span>
            {result.urgency && (
              <span className="rounded-full bg-beige px-4 py-1.5 font-bold text-muted text-sm">
                {pick(lang, URGENCY_LABEL[result.urgency] || { en: result.urgency, hi: result.urgency })}
              </span>
            )}
          </div>
          <p className="text-base text-ink">{result.reasoning}</p>
          <button
            onClick={() => readResult(result)}
            className="rounded-full bg-primary-soft px-4 py-2 font-bold text-primary focus-visible:outline-3 focus-visible:outline-primary"
          >
            🔊 Listen / सुनें
          </button>
          {result.matched_caregivers.length > 0 && (
            <div className="space-y-2 pt-2">
              <h3 className="font-bold text-base">Best matches / सबसे अच्छे विकल्प</h3>
              {result.matched_caregivers.map((c, i) => (
                <div key={c.caregiver_id} className={`rounded-2xl p-3.5 ${i === 0 ? "bg-ok-soft" : "bg-beige/50"}`}>
                  <div className="flex justify-between font-bold">
                    <span>{c.caregiver_id}</span>
                    <span>{Math.round(c.score * 100)}% match</span>
                  </div>
                  <p className="text-sm text-muted">{c.reason}</p>
                  <button
                    className="mt-2 min-h-[48px] rounded-full bg-primary px-5 py-2 font-bold text-white hover:bg-primary/90 focus-visible:outline-3 focus-visible:outline-primary"
                    onClick={() => alert("Booking confirmed (demo)")}
                  >
                    Book
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
