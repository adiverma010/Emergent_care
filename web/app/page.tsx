"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSettings } from "@/lib/settings";
import {
  assess,
  type AssessResponse,
  type AssessSession,
  type AssessQuestion,
  type AssessAdvice,
} from "@/lib/api";
import { speak, stopSpeaking, startListening, speechInputSupported } from "@/lib/speech";
import {
  greeting,
  CARE_LABEL,
  URGENCY_LABEL,
  HOME_TEXT,
  ADVICE_TEXT,
  pick,
} from "@/lib/text";
import { ListenButton } from "@/components/ListenButton";

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

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  response?: AssessResponse;
  question?: AssessQuestion | null;
  advice?: AssessAdvice | null;
  irrelevant?: boolean;
};

export default function Home() {
  const router = useRouter();
  const { profile, ready, update } = useSettings();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [session, setSession] = useState<AssessSession | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<AssessQuestion | null>(null);
  const [error, setError] = useState("");
  const [lastQuery, setLastQuery] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<{ stop?: () => void } | null>(null);
  const lang = profile.language;

  useEffect(() => {
    if (ready && !profile.onboarded) router.replace("/onboarding");
  }, [ready, profile.onboarded, router]);

  useEffect(() => {
    if (messages.length > 0 || loading) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  const sendAssess = async (
    userInput: string,
    answerPayload?: { question_id: string; value: string } | null
  ) => {
    const trimmed = userInput.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setError("");
    setLastQuery(trimmed);
    stopSpeaking();

    // Show user message in conversation thread
    const userMsg: ChatMessage = {
      id: "usr-" + Date.now(),
      role: "user",
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setText("");

    try {
      // Pass full profile on every call: name, age, allergies, history
      const r = await assess(
        trimmed,
        lang,
        {
          name: profile.name,
          age: profile.age,
          allergies: profile.allergies,
          history: profile.history,
        },
        session,
        answerPayload || null
      );

      // Keep session object returned by server
      if (r.session) {
        setSession(r.session);
      }

      // 4. Status "emergency" (or dispatch_recommended): auto-route immediately
      const isEmergency =
        r.status === "emergency" ||
        r.dispatch_recommended ||
        r.care_type === "emergency_112" ||
        (r.red_flags && r.red_flags.length > 0);

      if (isEmergency) {
        try {
          sessionStorage.setItem(
            "sathi_emergency_triage",
            JSON.stringify({ ...r, user_input: trimmed, dispatch_recommended: true })
          );
        } catch {}
        router.push("/emergency");
        return;
      }

      // 5. Status "irrelevant": polite message bubble only, no cards
      if (r.status === "irrelevant" || r.irrelevant) {
        setActiveQuestion(null);
        const replyText =
          r.follow_up_question || pick(lang, HOME_TEXT.irrelevant_note);
        const assistantMsg: ChatMessage = {
          id: "ast-" + Date.now(),
          role: "assistant",
          text: replyText,
          response: r,
          irrelevant: true,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        speak(replyText, lang);
        return;
      }

      // 2. Status "question": show question bubble with progress and options
      if (r.status === "question" || r.question || r.follow_up_question) {
        const qObj = r.question || {
          id: `q_${Date.now()}`,
          text: r.follow_up_question || "Please provide more details:",
          type: "text" as const,
          options: [],
          progress: "1 of 2",
        };
        setActiveQuestion(qObj);

        const assistantMsg: ChatMessage = {
          id: "ast-" + Date.now(),
          role: "assistant",
          text: qObj.text,
          question: qObj,
          response: r,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        speak(qObj.text, lang);
        return;
      }

      // 3. Status "result": Advice card with severity color & caregiver cards
      setActiveQuestion(null);
      const summaryText = r.advice?.summary || r.reasoning;
      const assistantMsg: ChatMessage = {
        id: "ast-" + Date.now(),
        role: "assistant",
        text: summaryText,
        advice: r.advice,
        response: r,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Read summary and do_now steps aloud
      const speakText = [summaryText, ...(r.advice?.do_now || [])].join(". ");
      speak(speakText, lang);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || pick(lang, HOME_TEXT.server_error));
    } finally {
      setLoading(false);
    }
  };

  const handleChipClick = (qId: string, optValue: string) => {
    sendAssess(optValue, { question_id: qId, value: optValue });
  };

  const handleSendText = () => {
    if (!text.trim()) return;
    if (activeQuestion) {
      sendAssess(text.trim(), { question_id: activeQuestion.id, value: text.trim() });
    } else {
      sendAssess(text.trim(), null);
    }
  };

  const toggleMic = () => {
    if (listening) {
      recRef.current?.stop?.();
      return;
    }
    stopSpeaking();
    setListening(true);
    recRef.current = startListening(
      lang,
      (t, final) => {
        setText(t);
        if (final) {
          if (activeQuestion) {
            sendAssess(t, { question_id: activeQuestion.id, value: t });
          } else {
            sendAssess(t, null);
          }
        }
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
      inputRef.current?.focus();
    }
  };

  const handleStartOver = () => {
    stopSpeaking();
    setSession(null);
    setActiveQuestion(null);
    setMessages([]);
    setText("");
    setError("");
  };

  // Helper to get card color by severity
  const getSeverityStyle = (severity?: string) => {
    switch (severity) {
      case "home_care":
        return "border-ok bg-ok-soft/30";
      case "doctor_soon":
        return "border-beige bg-beige/40";
      case "doctor_today":
        return "border-amber-300 bg-amber-50/70";
      case "emergency":
        return "border-danger bg-danger-soft/60";
      default:
        return "border-primary/30 bg-primary-soft/30";
    }
  };

  if (!ready || !profile.onboarded) return <main className="p-6">Loading...</main>;

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 pb-36 text-ink">
      {/* Header */}
      <header className="rounded-3xl bg-primary-soft p-4 flex items-start justify-between gap-2 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-primary">{greeting(profile.name, profile.age, lang)}</h1>
          <p className="text-muted text-xs sm:text-sm">CareCompass Sathi: आपकी सेहत का साथी</p>
        </div>
        <div className="flex flex-col items-end gap-2">
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

          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleStartOver}
              className="rounded-full bg-white/90 border border-beige px-3 py-1 text-xs font-bold text-muted hover:text-ink shadow-2xs transition focus-visible:outline-2 focus-visible:outline-primary"
            >
              🔄 {pick(lang, HOME_TEXT.start_over)}
            </button>
          )}
        </div>
      </header>

      {/* Network Error / Timeout Banner with Retry */}
      {error && (
        <aside
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-danger/30 bg-danger-soft p-3.5 text-sm font-bold text-danger shadow-xs"
        >
          <div className="flex items-center gap-2">
            <span aria-hidden="true">⚠️</span>
            <span>{error}</span>
          </div>
          {lastQuery && (
            <button
              type="button"
              onClick={() => sendAssess(lastQuery, null)}
              className="min-h-[48px] rounded-xl bg-danger px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-danger/90 active:scale-95 transition focus-visible:outline-3 focus-visible:outline-primary"
            >
              {pick(lang, HOME_TEXT.retry_btn)}
            </button>
          )}
        </aside>
      )}

      {/* Hero: Voice & Text Input + Quick Action Boxes */}
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
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendText()}
            placeholder={
              activeQuestion
                ? "Type your answer or tap an option above..."
                : "e.g. papa ko do din se bukhar hai"
            }
            className="flex-1 min-h-[48px] rounded-full bg-beige/40 px-5 py-3 text-base focus-visible:outline-3 focus-visible:outline-primary"
          />
          <button
            onClick={handleSendText}
            disabled={loading || !text.trim()}
            className="min-h-[48px] min-w-[64px] rounded-full bg-primary px-6 font-bold text-white disabled:opacity-50 hover:bg-primary/90 transition focus-visible:outline-3 focus-visible:outline-primary"
          >
            {loading ? "..." : "Go"}
          </button>
        </div>

        {/* Four Large Quick Action Boxes Under Mic */}
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => handleQuickAction(action)}
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

      {/* Conversation Thread (Chat Bubbles) */}
      {messages.length > 0 && (
        <section aria-label="Conversation Thread" className="space-y-4 pt-2">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-bold text-muted uppercase tracking-wider">
              {lang === "hindi" ? "बातचीत" : "Conversation"}
            </h3>
            <button
              type="button"
              onClick={handleStartOver}
              className="text-xs font-bold text-primary hover:underline"
            >
              {pick(lang, HOME_TEXT.start_over)}
            </button>
          </div>

          <div className="space-y-4">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div key={msg.id} className="space-y-2">
                  {/* Message Bubble */}
                  <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] sm:max-w-[80%] rounded-3xl p-4 shadow-xs text-base ${
                        isUser
                          ? "bg-primary text-white rounded-br-sm"
                          : "bg-white text-ink border border-beige rounded-bl-sm space-y-2"
                      }`}
                    >
                      {/* Question Progress Label if present */}
                      {!isUser && msg.question?.progress && (
                        <div className="flex items-center justify-between gap-2 border-b border-beige/60 pb-1 text-xs text-muted font-bold">
                          <span>
                            {pick(lang, ADVICE_TEXT.question_prefix)}: {msg.question.progress}
                          </span>
                        </div>
                      )}

                      <p className="font-semibold leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                      {/* Tappable Option Chips for Questions */}
                      {!isUser && msg.question && msg.question.options && msg.question.options.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {msg.question.options.map((opt, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => handleChipClick(msg.question!.id, opt)}
                              disabled={loading}
                              className="flex min-h-[48px] items-center justify-center rounded-2xl bg-primary-soft border border-primary/20 px-4 py-2.5 text-xs sm:text-sm font-bold text-primary hover:bg-primary hover:text-white transition active:scale-95 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50"
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}

                      {!isUser && (
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-beige/40">
                          <button
                            type="button"
                            onClick={() => speak(msg.text, lang)}
                            className="rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary hover:bg-primary/20 transition focus-visible:outline-2 focus-visible:outline-primary"
                          >
                            🔊 Listen
                          </button>
                          {msg.response?.process_ms !== undefined && (
                            <span className="text-[10px] text-muted font-medium">
                              ⚡ {pick(lang, ADVICE_TEXT.answered_in)} {msg.response.process_ms}ms
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Status "result" with Advice Card */}
                  {!isUser && msg.advice && msg.response && (
                    <div
                      className={`mr-auto max-w-[95%] sm:max-w-[90%] rounded-3xl p-5 shadow-sm border-2 space-y-4 ${getSeverityStyle(
                        msg.advice.severity
                      )}`}
                    >
                      {/* Summary */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="rounded-full bg-white/80 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-ink border border-beige">
                            {msg.advice.severity.replace("_", " ")}
                          </span>
                          <h4 className="text-lg font-extrabold text-ink mt-1">
                            {msg.advice.summary}
                          </h4>
                        </div>
                        <ListenButton
                          text={[msg.advice.summary, ...msg.advice.do_now].join(". ")}
                        />
                      </div>

                      {/* 1. Abhi kya karein / Do this now numbered steps */}
                      {msg.advice.do_now && msg.advice.do_now.length > 0 && (
                        <div className="rounded-2xl bg-white/90 p-4 border border-beige space-y-2">
                          <h5 className="font-extrabold text-sm text-ink">
                            📌 {pick(lang, ADVICE_TEXT.do_now)}
                          </h5>
                          <ol className="list-decimal space-y-1.5 pl-5 text-sm font-semibold text-ink">
                            {msg.advice.do_now.map((step, idx) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {/* 2. Gharelu upay / Home remedies (collapsible) */}
                      {msg.advice.home_remedies && msg.advice.home_remedies.length > 0 && (
                        <details className="group rounded-2xl bg-white/80 p-3.5 border border-beige">
                          <summary className="font-bold text-sm cursor-pointer list-none flex items-center justify-between text-ink select-none">
                            <span>🌿 {pick(lang, ADVICE_TEXT.home_remedies)} ({msg.advice.home_remedies.length})</span>
                            <span className="text-xs transition group-open:rotate-180">▼</span>
                          </summary>
                          <ul className="mt-2.5 list-disc space-y-1 pl-5 text-sm text-ink">
                            {msg.advice.home_remedies.map((rem, idx) => (
                              <li key={idx}>{rem}</li>
                            ))}
                          </ul>
                        </details>
                      )}

                      {/* 3. Dawai ki jaankari / Medicine info (collapsible) */}
                      <details className="group rounded-2xl bg-white/80 p-3.5 border border-beige">
                        <summary className="font-bold text-sm cursor-pointer list-none flex items-center justify-between text-ink select-none">
                          <span>💊 {pick(lang, ADVICE_TEXT.medicine_info)}</span>
                          <span className="text-xs transition group-open:rotate-180">▼</span>
                        </summary>
                        <div className="mt-2.5 space-y-2">
                          {msg.advice.medicine_hidden_reason ? (
                            <p className="text-xs font-semibold text-amber-900 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                              ℹ️ {msg.advice.medicine_hidden_reason}
                            </p>
                          ) : msg.advice.medicine_info && msg.advice.medicine_info.length > 0 ? (
                            msg.advice.medicine_info.map((med, idx) => (
                              <div key={idx} className="rounded-xl bg-beige/30 p-2.5 text-xs text-ink space-y-1">
                                <p className="font-bold">{med.category}</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {med.examples.map((ex, i) => (
                                    <span key={i} className="rounded-md bg-white px-2 py-0.5 font-semibold text-primary border border-beige">
                                      {ex}
                                    </span>
                                  ))}
                                </div>
                                <p className="text-muted text-[11px]">{med.note}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted">No medicines recommended without doctor consult.</p>
                          )}
                        </div>
                      </details>

                      {/* 4. Kya na karein / Avoid (collapsible) */}
                      {msg.advice.avoid && msg.advice.avoid.length > 0 && (
                        <details className="group rounded-2xl bg-white/80 p-3.5 border border-beige">
                          <summary className="font-bold text-sm cursor-pointer list-none flex items-center justify-between text-ink select-none">
                            <span>🚫 {pick(lang, ADVICE_TEXT.avoid)} ({msg.advice.avoid.length})</span>
                            <span className="text-xs transition group-open:rotate-180">▼</span>
                          </summary>
                          <ul className="mt-2.5 list-disc space-y-1 pl-5 text-sm text-danger font-medium">
                            {msg.advice.avoid.map((av, idx) => (
                              <li key={idx}>{av}</li>
                            ))}
                          </ul>
                        </details>
                      )}

                      {/* 5. Doctor ko kab dikhayein / See a doctor if (collapsible) */}
                      {msg.advice.see_doctor_if && msg.advice.see_doctor_if.length > 0 && (
                        <details className="group rounded-2xl bg-white/80 p-3.5 border border-beige">
                          <summary className="font-bold text-sm cursor-pointer list-none flex items-center justify-between text-ink select-none">
                            <span>🩺 {pick(lang, ADVICE_TEXT.see_doctor_if)} ({msg.advice.see_doctor_if.length})</span>
                            <span className="text-xs transition group-open:rotate-180">▼</span>
                          </summary>
                          <ul className="mt-2.5 list-disc space-y-1 pl-5 text-sm text-ink font-medium">
                            {msg.advice.see_doctor_if.map((doc, idx) => (
                              <li key={idx}>{doc}</li>
                            ))}
                          </ul>
                        </details>
                      )}

                      {/* 6. Care Card & Caregiver Cards */}
                      {msg.response.care_type && (
                        <div className="rounded-2xl bg-white/90 p-4 border border-beige space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-primary-soft px-3.5 py-1 text-xs font-bold text-primary">
                              {pick(
                                lang,
                                CARE_LABEL[msg.response.care_type] || {
                                  en: msg.response.care_type,
                                  hi: msg.response.care_type,
                                }
                              )}
                            </span>
                            {msg.response.urgency && (
                              <span className="rounded-full bg-beige px-3.5 py-1 text-xs font-bold text-muted">
                                {pick(
                                  lang,
                                  URGENCY_LABEL[msg.response.urgency] || {
                                    en: msg.response.urgency,
                                    hi: msg.response.urgency,
                                  }
                                )}
                              </span>
                            )}
                          </div>

                          {msg.response.matched_caregivers && msg.response.matched_caregivers.length > 0 && (
                            <div className="space-y-2 pt-2 border-t border-beige">
                              <h5 className="font-bold text-xs text-muted uppercase">
                                {lang === "hindi" ? "उपलब्ध सहयोगी" : "Matched Caregivers"}
                              </h5>
                              {msg.response.matched_caregivers.map((c) => (
                                <div
                                  key={c.caregiver_id}
                                  className="flex items-center justify-between gap-2 rounded-xl bg-cream p-2.5 border border-beige"
                                >
                                  <div>
                                    <p className="text-xs font-bold text-ink">{c.caregiver_id}</p>
                                    <p className="text-[11px] text-muted">{c.reason}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => alert("Caregiver booked (demo)")}
                                    className="min-h-[40px] rounded-lg bg-primary px-3 py-1 text-xs font-bold text-white shadow-2xs hover:bg-primary/90"
                                  >
                                    Book
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 7. Book Teleconsult Button */}
                      <button
                        type="button"
                        onClick={() => alert("Teleconsultation booked (demo)")}
                        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-base font-bold text-white shadow-md hover:bg-primary/90 active:scale-98 transition focus-visible:outline-3 focus-visible:outline-primary"
                      >
                        <span>📹</span>
                        <span>{pick(lang, ADVICE_TEXT.book_teleconsult)}</span>
                      </button>

                      {/* 8. Sources & Disclaimer */}
                      <div className="space-y-1.5 pt-1 border-t border-beige/60">
                        {msg.advice.sources && msg.advice.sources.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                            <span className="font-semibold">Sources:</span>
                            {msg.advice.sources.map((src, i) => (
                              <a
                                key={i}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline hover:text-primary/80"
                              >
                                {src.name}
                              </a>
                            ))}
                          </div>
                        )}
                        <p className="text-[11px] text-muted italic leading-tight">
                          {msg.advice.disclaimer}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* 6. Soch rahe hain... skeleton */}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-3xl bg-white border border-beige p-4 text-sm font-bold text-muted shadow-xs flex items-center gap-3 animate-pulse">
                  <span className="text-xl animate-spin">⏳</span>
                  <span>{pick(lang, ADVICE_TEXT.thinking)}</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>
        </section>
      )}
    </main>
  );
}
