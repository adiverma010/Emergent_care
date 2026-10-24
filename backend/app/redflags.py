"""High-recall, offline multilingual emergency phrase detection."""
import re
from typing import List

PATTERNS = {
    "chest_pain": [r"chest\s*(pain|tight|pressure)", r"heart\s*(pain|attack)", r"seene mein dard", r"chest mein dard", r"dil mein dard", r"सीने में दर्द", r"छाती में दर्द", r"दिल में दर्द"],
    "breathlessness": [r"breathless", r"can't breathe", r"cannot breathe", r"difficulty breathing", r"shortness of breath", r"saans (nahi|nahin) aa", r"saans phool", r"saans lene mein takleef", r"दम घुट", r"सांस नहीं आ", r"सांस लेने में तकलीफ", r"साँस फूल"],
    "unconsciousness": [r"unconscious", r"not waking", r"behosh", r"hosh nahi", r"बेहोश", r"होश नहीं", r"होश नह"],
    "severe_bleeding": [r"severe bleeding", r"bleeding won't stop", r"bleeding not stopping", r"bahut khoon", r"khoon beh", r"bleeding ruk nahi", r"बहुत खून", r"खून बह", r"खून नहीं रुक"],
    "stroke_symptoms": [r"stroke", r"face droop", r"slurred speech", r"one side.*weak", r"lakwa", r"muh tedha", r"bolne mein dikkat", r"लकवा", r"मुंह टेढ़ा", r"मुँह टेढ़ा", r"बोलने में दिक्कत"],
    "seizure": [r"seizure", r"convulsion", r"daura", r"jhatke", r"mirgi", r"दौरा", r"झटके", r"मिर्गी"],
    "high_fever_infant": [r"(baby|infant|newborn).*(high fever|fever|temperature)", r"(fever|bukhar).*(baby|infant|newborn|under 3 months)", r"baby ko tez bukhar", r"शिशु.*बुखार", r"बच्चे को तेज बुखार"],
    "suicidal_ideation": [r"suicid", r"kill myself", r"end my life", r"want to die", r"maar lena chahta", r"jeene ka mann nahi", r"जीने का मन नहीं", r"मर जाना चाहता", r"खुदकुशी"],
    "severe_dehydration": [r"severe dehydration", r"no urine.*dizz", r"not urinat.*dizz", r"peshab nahi.*chakkar", r"paani ki kami.*chakkar", r"पेशाब नहीं.*चक्कर", r"पानी की कमी.*चक्कर"],
    "snake_bite": [r"snake bite", r"snake.*bit", r"saanp ne kaata", r"saanp kaat", r"सांप ने काटा", r"साँप ने काटा"],
    "poisoning": [r"poison", r"overdose", r"zeher", r"zehar", r"poison kha", r"poisoning", r"ज़हर", r"जहर"],
    "severe_burn": [r"severe burn", r"badly burnt", r"jal gaya", r"jal gayi", r"जल गया", r"जल गई", r"गंभीर जल"],
    "choking": [r"choking", r"choked", r"dam ghut", r"atak gaya.*(gala|throat)", r"गला.*अटक", r"दम घुट"],
    "anaphylaxis": [r"anaphylaxis", r"throat swelling.*allerg", r"allergic reaction.*breath", r"allergy.*saans", r"एलर्जी.*सांस", r"गला सूज"],
}
_COMPILED = {k: [re.compile(p, re.I) for p in v] for k, v in PATTERNS.items()}
NEGATION = re.compile(r"\b(no|not|without|never|denies|nahi|nahin|nhi|nahi hai|nahi ho raha)\b", re.I)

def detect_red_flags(text: str) -> List[str]:
    flags = []
    for flag, patterns in _COMPILED.items():
        for p in patterns:
            for m in p.finditer(text or ""):
                prefix = text[max(0, m.start()-35):m.start()]
                # Suppress only obvious local negation, not general words elsewhere.
                if re.search(r"\b(no|not|without|never|denies|nahi|nahin|nhi)\b\W*$", prefix, re.I):
                    continue
                flags.append(flag); break
            if flag in flags: break
    return flags
