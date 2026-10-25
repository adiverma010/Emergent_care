"""Local, deterministic guided assessment engine."""
import json
import re
import time
from difflib import SequenceMatcher
from pathlib import Path

from .firstaid import steps
from .guard import has_health_term, is_irrelevant, IRRELEVANT_REPLY
from .redflags import detect_red_flags

_DATA = json.loads((Path(__file__).resolve().parents[1] / "data" / "protocols.json").read_text(encoding="utf-8"))
PROTOCOLS = {p["id"]: p for p in _DATA["protocols"]}
DISCLAIMER = "This is general guidance, not a diagnosis or prescription. This prototype has not been reviewed by a doctor."
LANG_NAMES = {"en": "English", "hi": "Hindi", "hinglish": "Hinglish"}
EMERGENCY_PATTERNS = [
    ("breathlessness", r"breathless|difficulty breathing|trouble breathing|shortness of breath|can't breathe|cannot breathe|सांस.*(दिक्कत|नहीं)|saans.*(problem|nahi)|oxygen (low|cylinder|chahiye)|spo2 low|saturation kam"),
    ("chest_pain", r"chest pain|सीने में दर्द|seene me dard"),
    ("fainting", r"faint|passed out|बेहोश|behosh"),
    ("fever_stiff_neck_confusion", r"(fever|bukhar|बुखार).{0,70}(stiff neck|neck stiff|confus|गर्दन अकड़|अकड़न|भ्रम)"),
    ("blood_in_vomit_or_stool", r"(blood|खून|रक्त).{0,20}(vomit|stool|उल्टी|मल)|(vomit|stool|उल्टी|मल).{0,20}(blood|खून|रक्त)"),
    ("severe_dehydration", r"no urine.{0,10}8|8 hours.{0,20}urine|पेशाब नहीं.{0,20}8|severe dehydration"),
    ("snake_bite", r"snake.{0,20}bit|सांप ने काट|saanp ne kaat"),
]
_NEG = re.compile(r"\b(no|not|without|nahi|nahin|नहीं)\b", re.I)
USER_EMERGENCY = re.compile(
    r"\b(emergency|urgent|critical|ambulance\s+chahiye|it's\s+an\s+emergency|its\s+an\s+emergency|emergency\s+hai|bahut\s+serious)\b"
    r"|jaan\s+ko\s+khatra|जान को खतरा|आपात\s*(?:कालीन|स्थिति)|आपातकाल|इमरजेंसी|बहुत गंभीर|एम्बुलेंस चाहिए",
    re.I,
)

def _lang(value):
    return value if value in LANG_NAMES else "hinglish"

def _flag_check(text):
    flags = list(detect_red_flags(text))
    low = text.lower()
    for flag, pattern in EMERGENCY_PATTERNS:
        match = re.search(pattern, low, re.I)
        if match:
            prefix = low[max(0, match.start()-18):match.start()]
            if not re.search(r"\b(no|not|without|nahi|nahin)\b|नहीं\s*$", prefix, re.I):
                flags.append(flag)
    # Universal fever escalation rules.
    fever = re.search(r"fever|bukhar|बुखार", low, re.I)
    temp = _temperature(low)
    days = _duration_days(low)
    if fever and re.search(r"\b(?:2|two)\s*months?|2\s*mahine|दो महीने", low, re.I):
        flags.append("infant_fever")
    return list(dict.fromkeys(flags))

def _temperature(text):
    m = re.search(r"\b(\d{2,3}(?:\.\d)?)\s*°?\s*([cf])?\b", text, re.I)
    if not m: return None
    n = float(m.group(1)); unit = (m.group(2) or "").lower()
    if unit == "f" or (not unit and 90 <= n <= 110): n = (n - 32) * 5 / 9
    return n if 30 <= n <= 45 else None

def _duration_days(text):
    m = re.search(r"\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|ek|do|teen|char|paanch)\s*(days?|din(?:o|on)?|दिन|weeks?|hafta|hafton|हफ्ता|हफ्ते)(?:\b|$)", text, re.I)
    if not m: return None
    n = m.group(1).lower()
    n = int(n) if n.isdigit() else {"one":1,"ek":1,"two":2,"do":2,"three":3,"teen":3,"four":4,"char":4,"five":5,"paanch":5,"six":6,"seven":7,"eight":8,"nine":9,"ten":10}[n]
    return n * 7 if m.group(2).lower() in {"week", "weeks", "hafta", "hafton", "हफ्ता", "हफ्ते"} else n

def _pending_question(protocol, session):
    slots = session.get("slots", {})
    questions = {q["id"]: q for q in protocol["questions"]}
    for qid in reversed(session.get("asked", [])):
        q = questions.get(qid)
        if q and q["slot"] not in slots:
            return q
    return None

def _parse_pending_answer(question, raw):
    text = (raw or "").strip()
    if not text:
        return False, None
    kind = question["type"]
    slot = question["slot"]
    normalized = re.sub(r"\s+", " ", text.casefold()).strip()
    unknown_answers = {"not sure", "unsure", "pata nahi", "pata nahin", "dont know", "don't know", "do not know", "पता नहीं", "मालूम नहीं"}
    if normalized in unknown_answers:
        return True, "unknown"
    if kind == "choice":
        yes = {"yes", "yeah", "yep", "haan", "han", "ha", "हाँ", "हां", "जी", "जी हाँ"}
        no = {"no", "nope", "nah", "nahi", "nahin", "nhi", "नहीं", "ना"}
        if normalized in yes: return True, "yes"
        if normalized in no: return True, "no"
        if any(re.search(r"(?<!\w)" + re.escape(word) + r"(?!\w)", normalized, re.I) for word in no): return True, "no"
        if any(re.search(r"(?<!\w)" + re.escape(word) + r"(?!\w)", normalized, re.I) for word in yes): return True, "yes"
        opts = [str(v).casefold().strip() for v in question["options"].values()]
        if normalized in opts:
            if normalized in {v.casefold() for v in yes}: return True, "yes"
            if normalized in {v.casefold() for v in no}: return True, "no"
            return True, "unknown"
        return False, None
    if kind == "number":
        if not (re.search(r"\d+(?:\.\d+)?\s*(?:°?\s*[cf])?\b", text, re.I)
                or re.search(r"\b(?:tez|tezz|bahut\s+tez|very\s+high|high)\b|तेज|बहुत तेज", text, re.I)):
            return False, None
        if slot == "temperature_c":
            parsed = _temperature(text)
            if parsed is not None: return True, parsed
            number = re.search(r"\d+(?:\.\d+)?", text)
            if number: return True, float(number.group(0))
            return True, "severe"
        number = re.search(r"\d+(?:\.\d+)?", text)
        return True, float(number.group(0)) if number else "severe"
    if kind == "text":
        duration_words = r"\b(?:din|dino|dinon|days?|haft(?:a|e|on)|weeks?|kal|parso|aaj|subah|raat|today|tomorrow|yesterday|since|se|do|teen|ek)\b|दिन|हफ्ते?|कल|परसों|आज|सुबह|रात"
        if not re.search(r"\d|" + duration_words, text, re.I):
            return False, None
        parsed = _duration_days(text)
        if parsed is not None: return True, parsed
        if re.search(r"\b(parso|परसों)\b", text, re.I): return True, 2
        if re.search(r"\b(kal|yesterday|tomorrow|कल)\b", text, re.I): return True, 1
        if re.search(r"\b(aaj|today|आज)\b", text, re.I): return True, 0
        return True, text
    return True, text

def _question_retry_response(req, session, question, hint, start):
    lang = _lang(req.language)
    gentle = {
        "en": "Please try once more. For example: 3 days, Yes/No, or a number such as 102.",
        "hi": "कृपया एक बार फिर बताएं। उदाहरण: 3 दिन, हाँ/नहीं, या 102 जैसा नंबर।",
        "hinglish": "Ek baar aur batayein. Jaise: 3 din, haan/nahi, ya 102 jaisa number.",
    }[lang]
    question_out = {"id": question["id"], "text": question["text"][lang] + " " + gentle,
                    "type": question["type"], "options": question["options"][lang],
                    "progress": f"{len(session.get('asked', []))} of 3"}
    session["history"] = (session.get("history", []) + [{"role": "user", "text": hint}, {"role": "assistant", "text": question_out["text"]}])[-20:]
    return _finish({"follow_up_question": question_out["text"], "care_type": None, "urgency": None,
                    "red_flags": [], "reasoning": "A short guided assessment is collecting safety-relevant details.",
                    "matched_caregivers": [], "detected_language": LANG_NAMES[lang], "irrelevant": False,
                    "status": "question", "question": question_out, "session": session, "advice": None,
                    "dispatch_recommended": False}, start)

def _protocol(text, session):
    chosen = session.get("protocol_id")
    if chosen in PROTOCOLS: return PROTOCOLS[chosen]
    normalized = re.sub(r"[^\w\s]", " ", text.lower())
    best = (0, None)
    for p in PROTOCOLS.values():
        score = 0
        kws = set(sum((p["keywords"].get(k, []) for k in ("en", "hi", "hinglish")), []))
        for kw in kws:
            k = kw.lower()
            if k and re.search(r"(?<!\w)" + re.escape(k) + r"(?!\w)", normalized): score += 3 if " " in k else 2
            elif len(k) > 4 and any(SequenceMatcher(None, k, token).ratio() >= .84 for token in normalized.split()): score += 1
        if score > best[0]: best = score, p
    return best[1] if best[0] else None

def _slot_parse(text, slots, profile):
    out = dict(slots)
    out.update({"age_years": profile.get("age"), "allergies": profile.get("allergies", []), "history": profile.get("history", [])})
    d = _duration_days(text)
    if d is not None: out["duration_days"] = d
    t = _temperature(text)
    if t is not None: out["temperature_c"] = t
    who = re.search(r"\b(papa|father|mummy|mother|dadi|grandmother|wife|husband|myself|me|bachcha|baby)\b|पापा|मम्मी|दादी|बच्चे", text, re.I)
    if who: out["patient_relation"] = who.group(0)
    if re.search(r"\b(no|none|nahi|nahin|नहीं)\b", text, re.I): out.setdefault("warning_signs", "none")
    if re.search(r"\b(yes|haan|ha|हाँ)\b", text, re.I): out.setdefault("warning_signs", "reported")
    if re.search(r"severe|बहुत तेज|बहुत ज्यादा|bahut zyada", text, re.I): out["severity"] = "severe"
    return out

def _rule_severity(protocol, slots, text):
    """Evaluate the protocol's ordered, first-match severity rules."""
    for rule in protocol.get("severity_rules", []):
        condition=rule.get("condition", {})
        matched=False
        if condition.get("always"):
            matched=True
        if "duration_days_gt" in condition:
            try: matched=matched or float(slots.get("duration_days", 0)) > condition["duration_days_gt"]
            except (TypeError,ValueError): pass
        if "temperature_c_gt" in condition:
            try: matched=matched or float(slots.get("temperature_c", 0)) > condition["temperature_c_gt"]
            except (TypeError,ValueError): pass
        if "severity_in" in condition:
            matched=matched or slots.get("severity") in condition["severity_in"]
        if "contains_any" in condition:
            value=str(slots.get(condition.get("key", ""), "")).lower()
            matched=matched or any(term.lower() in value or term.lower() in text.lower() and term.lower() == "severe" for term in condition["contains_any"])
        if matched:
            return rule["severity"]
    return "home_care"

def _advice(protocol, severity, lang, profile):
    src = protocol["advice"][severity][lang]
    allergy = " ".join(profile.get("allergies", [])).lower()
    history = " ".join(profile.get("history", [])).lower()
    age = profile.get("age")
    meds=[]; hidden=False
    for med in protocol.get("medicine_info", []):
        exclusion=False
        examples=" ".join(med.get("examples",[])).lower()
        if any(item.strip() and (item.strip() in examples or examples in item.strip()) for item in profile.get("allergies",[])):
            exclusion=True
        for rule in med.get("avoid_if", []):
            rule=rule.lower()
            if rule.startswith("allergy:") and rule.split(":",1)[1] in allergy: exclusion=True
            elif rule.startswith("history:") and rule.split(":",1)[1] in history: exclusion=True
            elif rule == "age:under16" and age is not None and age < 16: exclusion=True
            elif rule == "pregnancy" and re.search(r"pregnan|गर्भवती", " ".join(profile.get("history",[])), re.I): exclusion=True
        if exclusion: hidden=True
        else: meds.append({"category":med["category"],"examples":med.get("examples",[]),"note":med["note"][lang] if isinstance(med.get("note"),dict) else med.get("note", "Confirm any medicine and dose with a pharmacist or doctor.")})
    return {"severity":severity,"summary":src["summary"],"do_now":src["do_now"],"home_remedies":src["home_remedies"],"medicine_info":meds,"medicine_hidden_reason":"Some options are hidden because of your listed allergy or history" if hidden else None,"avoid":src["avoid"],"see_doctor_if":src["see_doctor_if"],"sources":[{"name":s["name"],"url":s["url"]} for s in protocol.get("sources",[])],"disclaimer":DISCLAIMER}

def assess(req, triage_fn, matcher_fn, location):
    start=time.perf_counter()
    lang=_lang(req.language); session=req.session.model_dump() if hasattr(req.session,"model_dump") else dict(req.session)
    hist=session.get("history",[]); latest=req.user_input.strip()
    pending=bool(hist and hist[-1].get("role")=="assistant")
    answer=req.answer.model_dump() if req.answer and hasattr(req.answer,"model_dump") else (dict(req.answer) if req.answer else None)
    context=" ".join([h["text"] for h in hist if h.get("role")=="user"]+[latest]+([answer["value"]] if answer else []))
    flags=list(dict.fromkeys(_flag_check(latest)+_flag_check(context)))
    age=req.profile.age
    if age == 0 and re.search(r"fever|bukhar|बुखार",context,re.I): flags.append("infant_fever")
    if flags:
        emergency_text={"en":{"summary":"Seek emergency medical help now.","call":"Call 112 now."},"hi":{"summary":"अभी आपातकालीन चिकित्सा सहायता लें।","call":"अभी 112 पर कॉल करें।"},"hinglish":{"summary":"Abhi emergency medical help lein.","call":"Abhi 112 par call karein."}}[lang]
        advice={"severity":"emergency","summary":emergency_text["summary"],"do_now":[emergency_text["call"]],"home_remedies":[],"medicine_info":[],"medicine_hidden_reason":None,"avoid":[],"see_doctor_if":[emergency_text["call"]],"sources":[],"disclaimer":DISCLAIMER}
        response={"follow_up_question":None,"care_type":"emergency_112","urgency":"emergency","red_flags":flags,"reasoning":"A possible emergency warning sign was reported. Call 112 now.","matched_caregivers":[],"detected_language":LANG_NAMES[lang],"first_aid_steps":steps(flags[0],lang),"emergency_numbers":{"ambulance":"112"},"irrelevant":False,"status":"emergency","question":None,"session":session,"advice":advice,"dispatch_recommended":True}
        return _finish(response,start)
    emergency_text = " ".join([latest, answer["value"] if answer else ""])
    if USER_EMERGENCY.search(emergency_text):
        call_text = {"en":"Call 112 now.","hi":"अभी 112 पर कॉल करें।","hinglish":"Abhi 112 par call karein."}[lang]
        summary = {"en":"You said this may be an emergency. Get urgent help now.","hi":"आपने आपात स्थिति बताई है। अभी तुरंत सहायता लें।","hinglish":"Aapne emergency batayi hai. Abhi turant madad lein."}[lang]
        response={"follow_up_question":None,"care_type":"emergency_112","urgency":"emergency","red_flags":["user_declared_emergency"],"reasoning":"The user described the situation as an emergency.","matched_caregivers":[],"detected_language":LANG_NAMES[lang],"first_aid_steps":steps("user_declared_emergency",lang),"emergency_numbers":{"ambulance":"112"},"irrelevant":False,"status":"emergency","question":None,"session":session,"advice":{"severity":"emergency","summary":summary,"do_now":[call_text],"home_remedies":[],"medicine_info":[],"medicine_hidden_reason":None,"avoid":[],"see_doctor_if":[call_text],"sources":[],"disclaimer":DISCLAIMER},"dispatch_recommended":True}
        return _finish(response,start)

    # An active protocol and its unanswered last question establish health context.
    protocol = PROTOCOLS.get(session.get("protocol_id"))
    pending_q = _pending_question(protocol, session) if protocol else None
    pending_mode = pending_q is not None
    if pending_mode:
        slots = session.setdefault("slots", {})
        raw_answer = (answer.get("value") if answer and answer.get("value", "").strip() else latest)
        valid, parsed = _parse_pending_answer(pending_q, raw_answer)
        retries = slots.setdefault("_invalid_retries", {})
        retry_count = retries.get(pending_q["id"], 0)
        if valid:
            slots[pending_q["slot"]] = parsed
            retries.pop(pending_q["id"], None)
        elif retry_count < 1:
            retries[pending_q["id"]] = retry_count + 1
            session["slots"] = slots
            return _question_retry_response(req, session, pending_q, latest, start)
        else:
            slots[pending_q["slot"]] = "unknown"
            retries.pop(pending_q["id"], None)
        session["slots"] = slots
        answer = None  # Already consumed as the pending question's answer.

    earlier=[]; prev_assistant=False
    for h in hist:
        if h.get("role")=="assistant": prev_assistant=True
        elif not is_irrelevant(h.get("text",""),prev_assistant): earlier.append(h["text"]); prev_assistant=False
    clean=" ".join(earlier+[latest]+([answer["value"]] if answer else [])).strip()
    if not pending_mode and (is_irrelevant(latest,pending) or not has_health_term(clean)):
        reply=IRRELEVANT_REPLY[{"en":"english","hi":"hindi"}.get(lang,"hinglish")]
        session["history"]=(hist+[{'role':'user','text':latest}])[-20:]
        response={"follow_up_question":reply,"care_type":None,"urgency":None,"red_flags":[],"reasoning":"Input is not a health request","matched_caregivers":[],"detected_language":LANG_NAMES[lang],"irrelevant":True,"status":"irrelevant","question":None,"session":session,"advice":None,"dispatch_recommended":False}
        return _finish(response,start)
    protocol=protocol if pending_mode else _protocol(clean,session)
    if not protocol:
        old=triage_fn(latest,lang,location,session.get("history",[]))
        session["history"]=(hist+[{'role':'user','text':latest}])[-20:]
        response={**old,"status":"result","question":None,"session":session,"advice":None,"dispatch_recommended":False}
        return _finish(response,start)
    slots=_slot_parse(clean,session.get("slots",{}),req.profile.model_dump())
    if answer:
        q=next((q for q in protocol["questions"] if q["id"]==answer["question_id"]),None)
        if q:
            val=answer["value"]
            if q["slot"]=="duration_days": val=_duration_days(val) or val
            elif q["slot"]=="temperature_c": val=_temperature(val) or val
            elif q["slot"]=="warning_signs" and re.search(r"\b(no|none|nahi|nahin)\b|नहीं",val,re.I): val="none"
            slots[q["slot"]]=val
    session["protocol_id"]=protocol["id"]; session["slots"]=slots
    asked=list(session.get("asked",[]))
    # Emergency answers get checked before any further questioning.
    if protocol["id"]=="diarrhea_vomiting" and re.search(r"blood|खून|रक्त",clean,re.I):
        flags=["blood_in_vomit_or_stool"]
        response={"follow_up_question":None,"care_type":"emergency_112","urgency":"emergency","red_flags":flags,"reasoning":"Blood with vomiting or diarrhea needs emergency assessment.","matched_caregivers":[],"detected_language":LANG_NAMES[lang],"first_aid_steps":steps(flags[0],lang),"emergency_numbers":{"ambulance":"112"},"irrelevant":False,"status":"emergency","question":None,"session":session,"advice":_advice(protocol,"emergency",lang,req.profile.model_dump()),"dispatch_recommended":True}
        return _finish(response,start)
    if re.search(r"\b(severe|very severe)\b|बहुत गंभीर|bahut gambhir", str(slots.get("warning_signs", "")), re.I):
        flag="reported_warning_sign"
        advice={"severity":"emergency","summary":{"en":"Seek emergency medical help now.","hi":"अभी आपातकालीन चिकित्सा सहायता लें।","hinglish":"Abhi emergency medical help lein."}[lang],"do_now":[{"en":"Call 112 now.","hi":"अभी 112 पर कॉल करें।","hinglish":"Abhi 112 par call karein."}[lang]],"home_remedies":[],"medicine_info":[],"medicine_hidden_reason":None,"avoid":[],"see_doctor_if":[{"en":"Call 112 now.","hi":"अभी 112 पर कॉल करें।","hinglish":"Abhi 112 par call karein."}[lang]],"sources":[],"disclaimer":DISCLAIMER}
        response={"follow_up_question":None,"care_type":"emergency_112","urgency":"emergency","red_flags":[flag],"reasoning":"A severe warning sign was reported.","matched_caregivers":[],"detected_language":LANG_NAMES[lang],"first_aid_steps":steps(flag,lang),"emergency_numbers":{"ambulance":"112"},"irrelevant":False,"status":"emergency","question":None,"session":session,"advice":advice,"dispatch_recommended":True}
        return _finish(response,start)
    for q in protocol["questions"]:
        if q["slot"] not in slots and q["id"] not in asked and len(asked)<3:
            asked.append(q["id"]); session["asked"]=asked
            question={"id":q["id"],"text":q["text"][lang],"type":q["type"],"options":q["options"][lang],"progress":f"{len(asked)} of 3"}
            session["history"]=(hist+[{'role':'user','text':latest},{'role':'assistant','text':question['text']}])[-20:]
            response={"follow_up_question":question["text"],"care_type":None,"urgency":None,"red_flags":[],"reasoning":"A short guided assessment is collecting safety-relevant details.","matched_caregivers":[],"detected_language":LANG_NAMES[lang],"irrelevant":False,"status":"question","question":question,"session":session,"advice":None,"dispatch_recommended":False}
            return _finish(response,start)
    # Ordered, conservative safety severity.
    severity=_rule_severity(protocol,slots,clean)
    fever=protocol["id"]=="fever"
    duration=slots.get("duration_days")
    try: duration=float(duration)
    except (TypeError,ValueError): duration=0
    temperature=slots.get("temperature_c")
    try: temperature=float(temperature)
    except (TypeError,ValueError): temperature=0
    pregnancy=bool(re.search(r"pregnan|गर्भवती",clean,re.I) or re.search(r"pregnan|गर्भवती", " ".join(req.profile.history), re.I))
    abdominal=protocol["id"]=="stomach_pain"
    if fever and (duration>3 or temperature>39.4) or pregnancy and (fever or abdominal): severity="doctor_today"
    elif protocol["id"]=="diarrhea_vomiting" and re.search(r"no urine|पेशाब नहीं|8 hours|8 घंटे",clean,re.I): severity="doctor_today"
    elif slots.get("severity")=="severe": severity="doctor_today"
    elif duration>=3 and severity=="home_care": severity="doctor_soon"
    age=slots.get("age_years")
    if age is not None and age>65 and slots.get("warning_signs") not in (None,"none","no","नहीं"):
        severity={"home_care":"doctor_soon","doctor_soon":"doctor_today","doctor_today":"emergency"}.get(severity,severity)
    advice=_advice(protocol,severity,lang,req.profile.model_dump())
    if severity=="emergency":
        flag="elderly_warning_sign"
        emergency_text={"en":"Seek emergency medical help now.","hi":"अभी आपातकालीन चिकित्सा सहायता लें।","hinglish":"Abhi emergency medical help lein."}[lang]
        call_text={"en":"Call 112 now.","hi":"अभी 112 पर कॉल करें।","hinglish":"Abhi 112 par call karein."}[lang]
        advice.update({"summary":emergency_text,"do_now":[call_text],"see_doctor_if":[call_text]})
        session["asked"]=asked; session["history"]=(hist+[{'role':'user','text':latest}])[-20:]
        response={"follow_up_question":None,"care_type":"emergency_112","urgency":"emergency","red_flags":[flag],"reasoning":"An older adult reported a warning sign and needs urgent assessment.","matched_caregivers":[],"detected_language":LANG_NAMES[lang],"first_aid_steps":steps(flag,lang),"emergency_numbers":{"ambulance":"112"},"irrelevant":False,"status":"emergency","question":None,"session":session,"advice":advice,"dispatch_recommended":True}
        return _finish(response,start)
    care=None if severity=="home_care" else protocol.get("care_type")
    urgency=protocol.get("urgency_map",{}).get(severity, "same_day")
    caregivers=matcher_fn(care,location,LANG_NAMES[lang]) if care else []
    session["asked"]=asked; session["history"]=(hist+[{'role':'user','text':latest}])[-20:]
    response={"follow_up_question":None,"care_type":care,"urgency":urgency,"red_flags":[],"reasoning":"Guided assessment result based on the information provided; this is not a diagnosis.","matched_caregivers":caregivers,"detected_language":LANG_NAMES[lang],"irrelevant":False,"status":"result","question":None,"session":session,"advice":advice,"dispatch_recommended":False}
    return _finish(response,start)

def _finish(response,start):
    response["process_ms"]=int((time.perf_counter()-start)*1000)
    return response
