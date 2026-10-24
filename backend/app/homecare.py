def guidance(body, language="en"):
    allergies=[str(a).lower() for a in body.get("allergies",[]) or []]
    if language=="hi": care=["आराम करें और पर्याप्त तरल लें, यदि पीना सुरक्षित हो।","हल्के लक्षणों पर नज़र रखें और बिगड़ने पर डॉक्टर से संपर्क करें।"]; warning="कोई भी दवा लेने से पहले डॉक्टर से सलाह लें। यह निदान या पर्चा नहीं है।"; consult="टेली-कंसल्ट बुक करें।"
    elif language=="hinglish": care=["Aaram karein aur fluids lein, agar peena safe ho.","Symptoms par nazar rakhein; badhne par doctor se baat karein."]; warning="Koi bhi dawa lene se pehle doctor se salah lein. Yeh diagnosis ya prescription nahi hai."; consult="Teleconsult book karein."
    else: care=["Rest and drink fluids if it is safe for you to do so.","Monitor symptoms and contact a clinician if they worsen or persist."]; warning="Consult a doctor before using any medicine. This is not a diagnosis or prescription."; consult="Consider booking a teleconsult."
    cats=["pain-relief category","antacid category","oral rehydration category"]
    if any("nsaid" in a or "ibuprofen" in a or "aspirin" in a for a in allergies): cats=[x for x in cats if x!="pain-relief category"]
    return {"self_care":care,"otc_categories":cats,"warning":warning,"book_teleconsult":consult,"urgent_care_if":"breathing difficulty, chest pain, confusion, severe pain, dehydration, or rapid worsening"}
