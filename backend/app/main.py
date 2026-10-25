import re
import os
from contextlib import asynccontextmanager
from typing import Literal, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from .redflags import detect_red_flags, is_minor_bleeding
from .firstaid import steps
from .classifier import predict
from . import classifier as classifier_service
from .matcher import match
from .guard import is_irrelevant, has_health_term, IRRELEVANT_REPLY
from . import dispatch as dispatch_service, hospitals, prescription, reminders, homecare

@asynccontextmanager
async def lifespan(app):
    hospitals.load_live_cache()
    if os.getenv("TINYFISH_API_KEY"):
        hospitals.start_refresh(28.54, 77.27, timeout=90)
    classifier_service.warmup()
    yield

app=FastAPI(title="CareCompass Sathi API",version="0.1.0",lifespan=lifespan)
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_credentials=True,allow_methods=["*"],allow_headers=["*"])
class Location(BaseModel): lat:float=28.6139; lng:float=77.209
class Turn(BaseModel): role:Literal["user","assistant"]; text:str
class TriageRequest(BaseModel): user_input:str; language:Literal["auto","hi","en","hinglish"]="auto"; location:Location=Field(default_factory=Location); conversation_history:list[Turn]=Field(default_factory=list)
class HealthResponse(BaseModel):
    status: str
    model_config = ConfigDict(json_schema_extra={"example": {"status": "ok"}})
class CaregiverResponse(BaseModel):
    caregiver_id: str
    score: float
    reason: str
class TriageResponse(BaseModel):
    follow_up_question: Optional[str] = None
    care_type: Optional[Literal["paramedic_home_visit","home_nursing","lab_test_home","teleconsultation","emergency_112"]] = None
    urgency: Optional[Literal["emergency","same_day","scheduled"]] = None
    red_flags: list[str] = Field(default_factory=list)
    reasoning: str
    matched_caregivers: list[CaregiverResponse] = Field(default_factory=list)
    detected_language: Optional[str] = None
    first_aid_steps: Optional[list[str]] = None
    emergency_numbers: Optional[dict[str,str]] = None
    irrelevant: bool = False
    model_config = ConfigDict(json_schema_extra={"example": {"follow_up_question": None, "care_type": "teleconsultation", "urgency": "same_day", "red_flags": [], "reasoning": "Routing support only; this is not a diagnosis.", "matched_caregivers": [], "detected_language": "English", "irrelevant": False}})
class DispatchHospital(BaseModel): name: str; distance_km: float; phone: str
class DispatchResponse(BaseModel):
    dispatch_id: str
    status: Literal["notified","ambulance_assigned","en_route"]
    eta_minutes: int
    hospital: DispatchHospital
    packet: dict
    model_config = ConfigDict(json_schema_extra={"example": {"dispatch_id": "d2f1a4a0-2dd8-4a7e-8a84-984fa9c816d0", "status": "notified", "eta_minutes": 18, "hospital": {"name": "AIIMS New Delhi", "distance_km": 2.0, "phone": "011-26588500"}, "packet": {"patient": {}, "red_flag": "breathlessness", "summary": "difficulty breathing"}}})
class NearbyResponse(BaseModel):
    hospitals: list[dict]
    live_hospitals: Optional[list[dict]] = None
    live_source: Optional[Literal["tinyfish"]] = None
    model_config = ConfigDict(json_schema_extra={"example": {"hospitals": [{"name": "AIIMS New Delhi", "lat": 28.5672, "lng": 77.21, "phone": "011-26588500", "emergency": True, "distance_km": 3.1}]}})
class LiveHospitalsResponse(BaseModel):
    live_hospitals: Optional[list[dict]] = None
    live_source: Optional[Literal["tinyfish"]] = None
    fetched_at: Optional[str] = None
class RefreshResponse(BaseModel):
    started: bool
    model_config = ConfigDict(json_schema_extra={"example": {"started": True}})
class ParsedMedicine(BaseModel):
    name: str
    dosage_as_written: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    with_food: Optional[bool] = None
    food_note: Optional[str] = None
    explanation: str
class PrescriptionResponse(BaseModel):
    medicines: list[ParsedMedicine]
    note: Optional[str] = None
    error: Optional[str] = None
    model_config = ConfigDict(json_schema_extra={"example": {"medicines": [], "error": "Could not read any medicine. Please type the text."}})
class ReminderEntry(BaseModel): medicine: str; times: list[str]; with_food: Optional[bool] = None; days: Optional[str] = None
class ReminderResponse(BaseModel):
    timetable: list[ReminderEntry]
    note: str
    model_config = ConfigDict(json_schema_extra={"example": {"timetable": [{"medicine": "Paracetamol", "times": ["08:00", "20:00"], "with_food": True, "days": "3 days"}], "note": "Confirm timing with a clinician or pharmacist."}})
class HomecareResponse(BaseModel):
    self_care: list[str]
    otc_categories: list[str]
    warning: str
    book_teleconsult: str
    urgent_care_if: str
    model_config = ConfigDict(json_schema_extra={"example": {"self_care": ["Rest and drink fluids if safe."], "otc_categories": [], "warning": "Consult a doctor before using medicine.", "book_teleconsult": "Consider booking a teleconsult.", "urgent_care_if": "breathing difficulty, chest pain, confusion, severe pain, dehydration, or rapid worsening"}})
class GreetingResponse(BaseModel):
    greeting: str
    model_config = ConfigDict(json_schema_extra={"example": {"greeting": "Namaste. How can I help you today?"}})
def lang_for(text,requested):
    if requested=="hi":return "Hindi"
    if requested=="hinglish":return "Hinglish"
    if requested=="en":return "English"
    if re.search(r"[ऀ-ॿ]",text):return "Hindi"
    words=text.lower().split(); roman={"hai","hain","nahi","nahin","mujhe","chahiye","bukhar","dard","saans","mera","ko","ho","raha","rahi"}
    return "Hinglish" if len(set(words)&roman)>=2 else "English"
def lang_code(d):return {"English":"en","Hindi":"hi","Hinglish":"hinglish"}[d]
def followup(lang):return {"Hindi":"कृपया बताएं मुख्य समस्या क्या है और यह कब से है?","Hinglish":"Main problem kya hai aur kab se ho rahi hai?","English":"What is the main concern, and when did it start?"}[lang]
_STATED_DAY=re.compile(r"\b(today|tomorrow|kal|parso|monday|tuesday|wednesday|thursday|friday|saturday|sunday|in\s+\d+\s+days?)\b|आज|कल|सोमवार|मंगलवार|बुधवार|गुरुवार|शुक्रवार|शनिवार|रविवार",re.I)
_DENGUE=re.compile(r"\bdengue\b|डेंगू",re.I)
def explicit_service_route(text):
    t=text.lower()
    urgency="scheduled" if _STATED_DAY.search(t) else "same_day"
    if re.search(r"(blood pressure|\bbp\b).{0,25}(check|test|measure)|(?:check|test|measure).{0,25}(blood pressure|\bbp\b)|(?:बीपी|ब्लड प्रेशर).{0,20}(चेक|जांच|जाँच)",t):
        return "paramedic_home_visit",urgency,"The dataset routes home BP checks to a paramedic home visit."
    if re.search(r"(sugar|शुगर).{0,30}(check|test|जांच|जाँच|टेस्ट).{0,30}(home|ghar|घर)|(?:ghar|घर).{0,30}(sugar|शुगर).{0,20}(check|test|जांच|जाँच|टेस्ट)",t):
        return "lab_test_home","scheduled","Blood sugar testing at home is routed to home lab testing."
    if re.search(r"sample collection|blood test|urine test|lab test|sample lene|khoon ki jaanch|रक्त जांच|रक्त जाँच|यूरिन टेस्ट|सैंपल कलेक्शन|सैंपल लेने|घर पर जांच|घर पर जाँच",t):
        return "lab_test_home","scheduled","A home sample or lab test was requested."
    if re.search(r"video consultation|video consult|online doctor|teleconsult(?:ation)?|doctor on call|consult doctor|need a doctor|doctor needed|doctor chahiye|doctor se video|online par doctor|डॉक्टर.*वीडियो|वीडियो.*डॉक्टर|टेली.?कंसल्ट|ऑनलाइन डॉक्टर|डॉक्टर चाहिए",t):
        return "teleconsultation","same_day","A doctor consultation was requested."
    if re.search(r"doctor visit|doctor at home|doctor.*(visit|ghar|home)|medic visit|visit.*(fever|bukhar)|डॉक्टर.*(घर|विजिट)|बुखार.*डॉक्टर",t):
        return "paramedic_home_visit",urgency,"A clinician home visit was requested."
    if re.search(r"(blood pressure|\bbp\b).{0,25}(check|test|measure)|(?:check|test|measure).{0,25}(blood pressure|\bbp\b)|vitals|(?:oxygen|spo2|saturation).{0,25}(level|check|measure)|(?:ecg|ekg).{0,25}(home|ghar|घर)|घर.*(?:बीपी|ब्लड प्रेशर|वाइटल|ईसीजी)|(?:बीपी|ब्लड प्रेशर).{0,20}(चेक|जांच|जाँच)",t):
        if re.search(r"(blood pressure|\bbp\b)|(?:बीपी|ब्लड प्रेशर)",t):
            return "paramedic_home_visit",urgency,"The dataset routes home BP checks to a paramedic home visit."
        return "home_nursing",urgency,"A home monitoring service was requested."
    if re.search(r"catheter|stitches|suture|dressing|injection|\biv\b|\bdrip\b|wound care|nurse visit|nurse for|nurse.*(come|visit|home)|टांके|टाँके|सिलाई|ड्रेसिंग|पट्टी|इंजेक्शन|कैथेटर|ड्रिप|नर्स",t):
        return "home_nursing",urgency,"A nursing or wound-care service was requested."
    return None
@app.get("/health",response_model=HealthResponse)
def health():return {"status":"ok"}
@app.post("/triage",response_model=TriageResponse,response_model_exclude_unset=True)
def triage(req:TriageRequest):
    text=req.user_input.strip()
    # Check both the latest turn and the user's full conversation before filtering.
    prior_user_text=[turn.text for turn in req.conversation_history if turn.role=="user"]
    context_text=" ".join(prior_user_text+[text]).strip()
    latest_flags=detect_red_flags(text)
    context_flags=detect_red_flags(context_text)
    flags=list(dict.fromkeys(latest_flags+context_flags))
    if "major_trauma" in flags:
        flags=["major_trauma"]+[flag for flag in flags if flag!="major_trauma"]
    if flags:
        detected=lang_for(text,req.language); code=lang_code(detected)
        return {"follow_up_question":None,"care_type":"emergency_112","urgency":"emergency","red_flags":flags,"reasoning":"A possible emergency warning sign was reported. Call 112 now for urgent assessment.","matched_caregivers":[],"detected_language":detected,"first_aid_steps":steps(flags[0],code),"emergency_numbers":{"ambulance":"112"},"irrelevant":False}
    history=req.conversation_history
    pending_followup=bool(history and history[-1].role=="assistant")
    detected=lang_for(text,req.language)
    # Filter earlier turns before building classifier/gate context. Assistant
    # turns only mark whether the next user message is a follow-up answer.
    earlier_user_text=[]
    previous_was_assistant=False
    for turn in history:
        if turn.role=="assistant":
            previous_was_assistant=True
        else:
            if not is_irrelevant(turn.text,previous_was_assistant):
                earlier_user_text.append(turn.text)
            previous_was_assistant=False
    combined=" ".join(earlier_user_text+[text]).strip()
    reply_language={"hi":"hindi","en":"english"}.get(req.language,"hinglish")
    if is_irrelevant(text,pending_followup) or not has_health_term(combined):
        return {"follow_up_question":IRRELEVANT_REPLY[reply_language],"care_type":None,"urgency":None,"red_flags":[],"reasoning":"Input is not a health request","matched_caregivers":[],"detected_language":detected,"irrelevant":True}
    # Dengue is a health request even if the relevance vocabulary does not know it.
    if _DENGUE.search(text):
        return {"follow_up_question":None,"care_type":"teleconsultation","urgency":"same_day","red_flags":[],"reasoning":"Dengue can worsen quickly; a doctor should assess it today.","matched_caregivers":match("teleconsultation",req.location.model_dump(),detected),"detected_language":detected,"irrelevant":False}

    route=explicit_service_route(text)
    if route:
        care,urgency,reasoning=route
        return {"follow_up_question":None,"care_type":care,"urgency":urgency,"red_flags":[],"reasoning":reasoning,"matched_caregivers":match(care,req.location.model_dump(),detected),"detected_language":detected,"irrelevant":False}
    if re.search(r"\b(physio(?:therapy|therapist)?|medicine delivery|pharmacy delivery)\b|फिजियोथेरेपी|दवा डिलीवरी",text,re.I):
        return {"follow_up_question":None,"care_type":None,"urgency":None,"red_flags":[],"reasoning":"This service is not directly arranged by triage; contact a physiotherapist or pharmacy to book it.","matched_caregivers":[],"detected_language":detected,"irrelevant":False}
    if is_minor_bleeding(text):
        care="home_nursing"
        return {"follow_up_question":None,"care_type":care,"urgency":"same_day","red_flags":[],"reasoning":"Bleeding appears limited; apply pressure and seek same-day care if needed.","matched_caregivers":match(care,req.location.model_dump(),detected),"detected_language":detected,"first_aid_steps":steps("minor_bleeding",lang_code(detected)),"irrelevant":False}

    # Keep only relevant user messages. Assistant messages only mark context for
    # short follow-up answers and are never passed to the classifier.
    followup_count=sum(turn.role=="assistant" for turn in history)
    try: care,urg,cc,uc=predict(combined)
    except Exception: care,urg,cc,uc=None,None,0,0
    vague=bool(re.fullmatch(r"(help|help me|help please|please help|need help|need something|something|kuch chahiye|मदद|मदद चाहिए)\W*",text,re.I))
    if vague and followup_count<2:
        return {"follow_up_question":followup(detected),"care_type":None,"urgency":None,"red_flags":[],"reasoning":"Please tell us the health concern so we can route you safely.","matched_caregivers":[],"detected_language":detected,"irrelevant":False}
    low_confidence=care not in {"paramedic_home_visit","home_nursing","lab_test_home","teleconsultation","emergency_112"} or cc<.36
    if low_confidence:
        return {"follow_up_question":None,"care_type":"teleconsultation","urgency":"same_day","red_flags":[],"reasoning":"Not enough detail to pick a specific service, so a doctor consultation is the safest next step","matched_caregivers":match("teleconsultation",req.location.model_dump(),detected),"detected_language":detected,"irrelevant":False}
    if care=="emergency_112":care="teleconsultation"; urg="same_day"
    return {"follow_up_question":None,"care_type":care,"urgency":urg,"red_flags":[],"reasoning":f"Offline classifier confidence: care type {cc:.2f}, urgency {uc:.2f}. Routing support only; this is not a diagnosis.","matched_caregivers":match(care,req.location.model_dump(),detected),"detected_language":detected,"irrelevant":False}
@app.post("/dispatch",response_model=DispatchResponse)
def create_dispatch(body:dict):return dispatch_service.create(body)
@app.get("/dispatch/{ident}",response_model=DispatchResponse)
def get_dispatch(ident:str):
    out=dispatch_service.get(ident)
    if not out:raise HTTPException(404,"dispatch not found")
    return out
@app.get("/hospitals/nearby",response_model=NearbyResponse)
async def nearby(lat:float,lng:float):
    live=hospitals.cached_live(lat,lng)
    return {"hospitals":hospitals.nearby(lat,lng),"live_hospitals":live,"live_source":"tinyfish" if live else None}
@app.get("/hospitals/live",response_model=LiveHospitalsResponse)
async def live_nearby():
    return hospitals.cached_live() or {"live_hospitals":None,"live_source":None,"fetched_at":None}
@app.post("/hospitals/live/refresh",response_model=RefreshResponse)
async def refresh_live_hospitals():
    return {"started":hospitals.start_refresh(28.54,77.27,timeout=90)}
@app.post("/prescription/parse",response_model=PrescriptionResponse)
async def parse_prescription(request:Request):
    content_type=request.headers.get("content-type","")
    if "multipart/form-data" in content_type:
        form=await request.form(); text=form.get("text"); image=form.get("image"); language=form.get("language","en")
        if image and not text:return {"medicines":[],"error":prescription.ERROR}
        if text is None:raise HTTPException(400,"provide text or image")
    else:
        body=await request.json(); text=body.get("text"); language=body.get("language","en")
        if text is None:raise HTTPException(400,"provide text or image")
    return prescription.parse_text(text,language)
class PrescriptionJSON(BaseModel):text:str; language:str="en"
@app.post("/prescription/parse-text",response_model=PrescriptionResponse)
def parse_prescription_text(body:PrescriptionJSON):return prescription.parse_text(body.text,body.language)
@app.post("/reminders/schedule",response_model=ReminderResponse)
def schedule(body:dict):return reminders.schedule(body.get("medicines",[]))
@app.post("/homecare",response_model=HomecareResponse)
def homecare_route(body:dict,language:str="en"):return homecare.guidance(body,language)
@app.get("/greeting",response_model=GreetingResponse)
def greeting(age:int=30,language:str="en"):
    band="elder" if age>=60 else "young" if age<25 else "adult"
    greetings={"en":{"elder":"Namaste, Dadaji/Dadiji. How can I help you today?","young":"Hi! What can I help you with?","adult":"Namaste. How can I help you today?"},"hi":{"elder":"नमस्ते दादाजी/दादीजी, मैं आपकी कैसे मदद करूं?","young":"नमस्ते! मैं आपकी क्या मदद करूं?","adult":"नमस्ते, मैं आपकी कैसे मदद करूं?"},"hinglish":{"elder":"Namaste Dadaji/Dadiji, main aapki kya madad kar sakta hoon?","young":"Hi! Batao, kya help chahiye?","adult":"Namaste, main aapki kya madad kar sakta hoon?"}}
    return {"greeting":greetings.get(language,greetings["en"])[band]}
