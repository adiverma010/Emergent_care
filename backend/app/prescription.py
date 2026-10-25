"""Conservative typed-text extraction; never supplies a missing dose."""
import re

DOSAGE = re.compile(r"\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?|tabs?|tablets?|caps?|capsules?)\b", re.I)
FREQUENCY = re.compile(r"\b(?:OD|BD|TDS|QID|once\s+(?:a|per)\s+day|twice\s+(?:a|per)\s+day|three\s+times\s+(?:a|per)\s+day|four\s+times\s+(?:a|per)\s+day|once\s+daily|twice\s+daily|three\s+times\s+daily|four\s+times\s+daily)\b", re.I)
ERROR = "Could not read any medicine. Please type the text."


def parse_text(text, language="en"):
    medicines = []
    for line in (text or "").splitlines():
        dosage = DOSAGE.search(line)
        frequency = FREQUENCY.search(line)
        markers = [m.start() for m in (dosage, frequency) if m]
        if not markers:
            continue
        prefix = line[:min(markers)].strip(" \t:,-;.")
        prefix = re.sub(r"^(?:(?:take|use|give|start|medicine|medication|tab(?:let)?|cap(?:sule)?)\s+)+", "", prefix, flags=re.I).strip(" \t:,-;.")
        if not prefix or not re.search(r"[A-Za-z\u0900-\u097F]", prefix):
            continue
        food = re.search(r"\b(after food|with food|before food|after meals?|with meals?|खाने के बाद|खाने से पहले)\b", line, re.I)
        duration = re.search(r"\bfor\s+\d+\s*(?:days?|weeks?)\b|\b\d+\s*(?:दिन|हफ्ते|सप्ताह)\b", line, re.I)
        explanation = {
            "hi": "पर्चे में लिखी जानकारी ही निकाली गई है; कोई खुराक अनुमान से न लें।",
            "hinglish": "Sirf likhi hui jankari nikali gayi hai; dose guess na karein.",
            "en": "Only information written in the text was extracted; do not guess a dose.",
        }.get(language, "Only information written in the text was extracted; do not guess a dose.")
        medicines.append({
            "name": prefix,
            "dosage_as_written": dosage.group(0) if dosage else None,
            "frequency": frequency.group(0) if frequency else None,
            "duration": duration.group(0) if duration else None,
            "with_food": (food.group(0).lower().startswith(("after", "with", "खाने के बाद")) if food else None),
            "food_note": food.group(0) if food else None,
            "explanation": explanation,
        })
    if not medicines:
        return {"medicines": [], "error": ERROR}
    return {"medicines": medicines, "note": "Only text explicitly present was extracted. Verify all instructions with a pharmacist or doctor."}
