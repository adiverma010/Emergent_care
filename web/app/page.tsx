"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSettings } from "@/lib/settings";
import { triage, type TriageResponse, type Turn } from "@/lib/api";
import { speak, stopSpeaking, startListening, speechInputSupported } from "@/lib/speech";
import { greeting, CARE_LABEL, URGENCY_LABEL, pick } from "@/lib/text";

const EMERGENCY_HINT = {
  english: "Call 112 now. Follow these steps until help arrives.",
  hindi: "अभी 112 पर कॉल करें। मदद आने तक ये कदम उठाएं।",
  hinglish: "Abhi 112 par call karein. Madad aane tak ye steps follow karein.",
};

export default function Home() {
  const router = useRouter();
  const { profile, ready, update } = useSettings();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState<TriageResponse | null>(null);
  const [history, setHistory] = useState<Turn[]>([]);
  const [error, setError] = useState("");
  const recRef = useRef<any>(null);
  const lang = profile.language;

  useEffect(() => {
    if (ready && !profile.onboarded) router.replace("/onboarding");
  }, [ready, profile.onboarded, router]);

  const isEmergency = !!result && (result.care_type === "emergency_112" || result.red_flags.length > 0);

  const readResult = (r: TriageResponse) => {
    const emerg = r.care_type === "emergency_112" || r.red_flags.length > 0;
    if (emerg) {
      speak([EMERGENCY_HINT[lang], ...(r.first_aid_steps || [])].join(". "), lang);
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
    stopSpeaking();
    try {
      const r = await triage(m, lang, history);
      setResult(r);
      setText("");
      if (r.care_type === "emergency_112" || (r.red_flags && r.red_flags.length > 0)) {
        try {
          sessionStorage.setItem("sathi_emergency_triage", JSON.stringify(r));
        } catch {}
        router.push("/emergency");
        return;
      }
      if (r.follow_up_question) {
        setHistory([...history, { role: "user", text: m }, { role: "assistant", text: r.follow_up_question }]);
      } else {
        setHistory([]);
      }
      readResult(r);
    } catch (e: any) {
      setError("Could not reach the server. Is the backend running? " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  const toggleMic = () => {
    if (listening) { recRef.current?.stop(); return; }
    stopSpeaking();
    setListening(true);
    recRef.current = startListening(
      lang,
      (t, final) => { setText(t); if (final) send(t); },
      () => setListening(false)
    );
    if (!recRef.current) { setListening(false); setError("Voice input is not supported in this browser. Please use Chrome."); }
  };

  if (!ready || !profile.onboarded) return <main className="p-6">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 pb-28">
      <header className="rounded-3xl bg-primary-soft p-4 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-primary">{greeting(profile.name, profile.age, lang)}</h1>
          <p className="text-muted">CareCompass Sathi: आपकी सेहत का साथी</p>
        </div>
        <div className="flex gap-1 rounded-full bg-white p-1 text-sm font-bold">
          {(["hindi", "english", "hinglish"] as const).map((l) => (
            <button key={l} onClick={() => update({ language: l })}
              className={`rounded-full px-3 py-1 ${lang === l ? "bg-primary text-white" : "text-muted"}`}>
              {l === "hindi" ? "हिं" : l === "english" ? "EN" : "Hi/En"}
            </button>
          ))}
        </div>
      </header>

      <section className="rounded-3xl bg-white p-5 shadow-sm text-center space-y-3">
        <h2 className="text-xl font-bold">Boliye, hum sun rahe hain</h2>
        <button onClick={toggleMic} aria-label="Speak your problem"
          className={`mx-auto flex h-28 w-28 items-center justify-center rounded-full text-5xl text-white shadow-lg ${listening ? "bg-danger animate-pulse" : "bg-primary"}`}>
          🎤
        </button>
        <p className="text-muted">{listening ? "Sun rahe hain... / Listening..." : "Tap and speak, or type below"}</p>
        {!speechInputSupported() && <p className="text-sm text-danger">Voice needs Chrome. You can type instead.</p>}
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(text)}
            placeholder="e.g. papa ko do din se bukhar hai"
            className="flex-1 rounded-full bg-beige/50 px-5 py-3" />
          <button onClick={() => send(text)} disabled={loading}
            className="rounded-full bg-primary px-6 font-bold text-white disabled:opacity-50">
            {loading ? "..." : "Go"}
          </button>
        </div>
        {error && <p className="text-danger">{error}</p>}
      </section>

      {result && isEmergency && (
        <section className="rounded-3xl border-4 border-danger bg-danger-soft p-5 space-y-3" role="alert">
          <h2 className="text-2xl font-extrabold text-danger">🚨 {EMERGENCY_HINT[lang]}</h2>
          <a href="tel:112" className="block rounded-full bg-danger py-5 text-center text-3xl font-extrabold text-white">
            CALL 112
          </a>
          <ol className="list-decimal space-y-2 pl-6 font-semibold">
            {(result.first_aid_steps || []).map((s, i) => <li key={i}>{s}</li>)}
          </ol>
          <p className="text-sm text-muted">{result.reasoning}</p>
          <button onClick={() => readResult(result)} className="rounded-full bg-white px-5 py-2 font-bold text-danger">
            🔊 Listen / सुनें
          </button>
        </section>
      )}

      {result && !isEmergency && result.follow_up_question && (
        <section className="rounded-3xl bg-beige p-5 space-y-2">
          <p className="text-xl font-semibold">{result.follow_up_question}</p>
          <button onClick={() => readResult(result)} className="rounded-full bg-white px-4 py-2 font-bold text-primary">🔊 Listen</button>
        </section>
      )}

      {result && !isEmergency && !result.follow_up_question && (
        <section className="rounded-3xl bg-white p-5 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary-soft px-4 py-1 font-bold text-primary">
              {result.care_type ? pick(lang, CARE_LABEL[result.care_type] || { en: result.care_type, hi: result.care_type }) : ""}
            </span>
            {result.urgency && (
              <span className="rounded-full bg-beige px-4 py-1 font-bold text-muted">
                {pick(lang, URGENCY_LABEL[result.urgency] || { en: result.urgency, hi: result.urgency })}
              </span>
            )}
          </div>
          <p>{result.reasoning}</p>
          <button onClick={() => readResult(result)} className="rounded-full bg-primary-soft px-4 py-2 font-bold text-primary">🔊 Listen / सुनें</button>
          {result.matched_caregivers.length > 0 && (
            <div className="space-y-2 pt-2">
              <h3 className="font-bold">Best matches / सबसे अच्छे विकल्प</h3>
              {result.matched_caregivers.map((c, i) => (
                <div key={c.caregiver_id} className={`rounded-2xl p-3 ${i === 0 ? "bg-ok-soft" : "bg-beige/50"}`}>
                  <div className="flex justify-between font-bold">
                    <span>{c.caregiver_id}</span>
                    <span>{Math.round(c.score * 100)}% match</span>
                  </div>
                  <p className="text-sm text-muted">{c.reason}</p>
                  <button className="mt-2 rounded-full bg-primary px-4 py-1 font-bold text-white"
                    onClick={() => alert("Booking confirmed (demo)")}>Book</button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
