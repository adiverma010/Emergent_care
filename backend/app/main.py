import re
from typing import Literal, Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from .redflags import detect_red_flags
from .firstaid import steps
from .classifier import predict
from .matcher import match
from .guard import is_irrelevant, IRRELEVANT_REPLY
from . import dispatch as dispatch_service, hospitals, prescription, reminders, homecare

app=FastAPI(title="CareCompass Sathi API",version="0.1.0")
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_credentials=True,allow_methods=["*"],allow_headers=["*"])
class Location(BaseModel): lat:float=28.6139; lng:float=77.209
class Turn(BaseModel): role:Literal["user","assistant"]; text:str
class TriageRequest(BaseModel): user_input:str; language:Literal["auto","hi","en","hinglish"]="auto"; location:Location=Field(default_factory=Location); conversation_history:list[Turn]=Field(default_factory=list)
def lang_for(text,requested):
    if requested=="hi":return "Hindi"
    if requested=="hinglish":return "Hinglish"
    if requested=="en":return "English"
    if re.search(r"[ऀ-ॿ]",text):return "Hindi"
    words=text.lower().split(); roman={"hai","hain","nahi","nahin","mujhe","chahiye","bukhar","dard","saans","mera","ko","ho","raha","rahi"}
    return "Hinglish" if len(set(words)&roman)>=2 else "English"
def lang_code(d):return {"English":"en","Hindi":"hi","Hinglish":"hinglish"}[d]
def followup(lang):return {"Hindi":"कृपया बताएं मुख्य समस्या क्या है और यह कब से है?","Hinglish":"Main problem kya hai aur kab se ho rahi hai?","English":"What is the main concern, and when did it start?"}[lang]
@app.get("/health")
def health():return {"status":"ok"}
@app.post("/triage")
def triage(req:TriageRequest):
    text=req.user_input.strip()
    # Red flags are checked on the latest message before the relevance guard.
    flags=detect_red_flags(text)
    if flags:
        detected=lang_for(text,req.language); code=lang_code(detected)
        return {"follow_up_question":None,"care_type":"emergency_112","urgency":"emergency","red_flags":flags,"reasoning":"A possible emergency warning sign was reported. Call 112 now for urgent assessment.","matched_caregivers":[],"detected_language":detected,"first_aid_steps":steps(flags[0],code),"emergency_numbers":{"ambulance":"112"},"irrelevant":False}
    history=req.conversation_history
    pending_followup=bool(history and history[-1].role=="assistant")
    detected=lang_for(text,req.language)
    if is_irrelevant(text,pending_followup):
        reply_language={"hi":"hindi","en":"english"}.get(req.language,"hinglish")
        return {"follow_up_question":IRRELEVANT_REPLY[reply_language],"care_type":None,"urgency":None,"red_flags":[],"reasoning":"Input is not a health request","matched_caregivers":[],"detected_language":detected,"irrelevant":True}

    # Keep only relevant user messages. Assistant messages only mark context for
    # short follow-up answers and are never passed to the classifier.
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
    followup_count=sum(turn.role=="assistant" for turn in history)
    try: care,urg,cc,uc=predict(combined)
    except Exception: care,urg,cc,uc=None,None,0,0
    vague=len(text.split())<2 or bool(re.fullmatch(r"(help|doctor|help me|please help|डॉक्टर|मदद|doctor chahiye)\W*",text,re.I))
    low_confidence=care not in {"paramedic_home_visit","home_nursing","lab_test_home","teleconsultation","emergency_112"} or cc<.36
    if (low_confidence or vague) and followup_count<2:
        return {"follow_up_question":followup(detected),"care_type":None,"urgency":None,"red_flags":[],"reasoning":f"More detail is needed before safe routing (model confidence {cc:.2f}).","matched_caregivers":[],"detected_language":detected,"irrelevant":False}
    if low_confidence and followup_count>=2:
        return {"follow_up_question":None,"care_type":"teleconsultation","urgency":"same_day","red_flags":[],"reasoning":"Not enough detail to pick a specific service, so a doctor consultation is the safest next step","matched_caregivers":match("teleconsultation",req.location.model_dump(),detected),"detected_language":detected,"irrelevant":False}
    if care=="emergency_112":care="teleconsultation"; urg="same_day"
    return {"follow_up_question":None,"care_type":care,"urgency":urg,"red_flags":[],"reasoning":f"Offline classifier confidence: care type {cc:.2f}, urgency {uc:.2f}. Routing support only; this is not a diagnosis.","matched_caregivers":match(care,req.location.model_dump(),detected),"detected_language":detected,"irrelevant":False}
@app.post("/dispatch")
def create_dispatch(body:dict):return dispatch_service.create(body)
@app.get("/dispatch/{ident}")
def get_dispatch(ident:str):
    out=dispatch_service.get(ident)
    if not out:raise HTTPException(404,"dispatch not found")
    return out
@app.get("/hospitals/nearby")
def nearby(lat:float,lng:float):return {"hospitals":hospitals.nearby(lat,lng)}
@app.post("/prescription/parse")
async def parse_prescription(request:Request):
    content_type=request.headers.get("content-type","")
    if "multipart/form-data" in content_type:
        form=await request.form(); text=form.get("text"); image=form.get("image"); language=form.get("language","en")
        if image and not text:return {"medicines":[],"note":"Image OCR is unavailable offline. Please type the visible prescription text or consult a pharmacist."}
        if text is None:raise HTTPException(400,"provide text or image")
    else:
        body=await request.json(); text=body.get("text"); language=body.get("language","en")
        if text is None:raise HTTPException(400,"provide text or image")
    return prescription.parse_text(text,language)
class PrescriptionJSON(BaseModel):text:str; language:str="en"
@app.post("/prescription/parse-text")
def parse_prescription_text(body:PrescriptionJSON):return prescription.parse_text(body.text,body.language)
@app.post("/reminders/schedule")
def schedule(body:dict):return reminders.schedule(body.get("medicines",[]))
@app.post("/homecare")
def homecare_route(body:dict,language:str="en"):return homecare.guidance(body,language)
@app.get("/greeting")
def greeting(age:int=30,language:str="en"):
    band="elder" if age>=60 else "young" if age<25 else "adult"
    greetings={"en":{"elder":"Namaste, Dadaji/Dadiji. How can I help you today?","young":"Hi! What can I help you with?","adult":"Namaste. How can I help you today?"},"hi":{"elder":"नमस्ते दादाजी/दादीजी, मैं आपकी कैसे मदद करूं?","young":"नमस्ते! मैं आपकी क्या मदद करूं?","adult":"नमस्ते, मैं आपकी कैसे मदद करूं?"},"hinglish":{"elder":"Namaste Dadaji/Dadiji, main aapki kya madad kar sakta hoon?","young":"Hi! Batao, kya help chahiye?","adult":"Namaste, main aapki kya madad kar sakta hoon?"}}
    return {"greeting":greetings.get(language,greetings["en"])[band]}
