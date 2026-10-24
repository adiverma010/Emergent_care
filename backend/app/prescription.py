import re
def parse_text(text, language="en"):
    """Best-effort parsing of supplied text; never infer a missing dose."""
    meds=[]
    for line in (text or "").splitlines():
        m=re.search(r"([A-Za-z][A-Za-z0-9-]*(?:\s+[A-Za-z][A-Za-z0-9-]*){0,2})\s+((?:\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|mL|iu|units|таб|tablet|capsule))[^,;]*|(?:OD|BD|TDS|QID)\b.*)",line,re.I)
        if not m: continue
        freq=re.search(r"\b(OD|BD|TDS|QID|once daily|twice daily|three times daily|four times daily)\b",line,re.I)
        duration=re.search(r"\b(for\s+\d+\s*(?:days?|weeks?))\b",line,re.I)
        food=re.search(r"(after food|with food|before food)",line,re.I)
        meds.append({"name":m.group(1).strip(),"dosage_as_written":m.group(2).strip(),"frequency":freq.group(1) if freq else None,"duration":duration.group(1) if duration else None,"with_food":bool(food and food.group(1).lower()!="before food"),"food_note":food.group(1) if food else None,"explanation":{"hi":"पर्चे में लिखे अनुसार लें; कोई खुराक अनुमान से न लें।","hinglish":"Prescription mein likhe hisaab se lein; dose guess na karein.","en":"Follow the prescription as written; do not guess a dose."}.get(language,"Follow the prescription as written; do not guess a dose.")})
    if not meds and text: return {"medicines":[],"note":"Could not reliably read medicine instructions. Please confirm with a pharmacist or doctor; no dose was inferred."}
    return {"medicines":meds,"note":"Only text explicitly present was extracted. Verify the prescription with a pharmacist or doctor."}
