"""High-recall, offline multilingual emergency phrase detection."""
import re
from typing import List

PATTERNS = {
    "chest_pain": [r"chest.{0,12}(pain|tight|pressure)", r"chest\s*(mein|me)\s*dard", r"(crushing|severe|sudden).{0,20}chest", r"heart\s*(pain|attack)", r"seene?\s*(mein|me|par)?\s*(tez\s*)?dard", r"dil mein dard", r"सीने में दर्द", r"छाती में दर्द", r"दिल में दर्द", r"छाती में तेज दबाव"],
    "breathlessness": [r"breathless", r"can't catch (my )?breath", r"can't breathe", r"cannot breathe", r"gasping for air", r"difficulty breathing", r"shortness of breath", r"saans\s*(nhi|nahi|nahin)\s*(aa|le)", r"saans phool", r"saans lene mein takleef", r"दम घुट", r"सांस नहीं आ", r"सांस लेने में तकलीफ", r"साँस फूल", r"सांस फूल"],
    "unconsciousness": [r"unconscious", r"unresponsive", r"(will|won't|cannot|can't) wake", r"will not wake", r"not wake up", r"not waking", r"behosh", r"hosh nahi", r"response nahi", r"बेहोश", r"होश नहीं", r"होश नह"],
    "severe_bleeding": [r"severe bleeding", r"blood (is )?(pouring|spurting|gushing)", r"bleeding won't stop", r"bleeding not stopping", r"(cut|wound).{0,30}(spurting|pouring|bleeding)", r"bahut khoon", r"khoon (beh|ruk)", r"bleeding ruk nahi", r"बहुत खून", r"खून बह", r"खून नहीं रुक"],
    "stroke_symptoms": [r"face droop", r"slurred speech", r"speech is garbled", r"one side.{0,25}(weak|numb|sag|kamzor)", r"ek taraf.{0,35}(kamzor|ladkhad|sunn)", r"cannot lift.{0,20}(arm|hand)", r"speech.{0,20}(slur|garbl|ladkhad)", r"lakwa", r"muh tedha", r"bolne mein dikkat", r"बोल नहीं पा", r"मुंह टेढ़ा", r"मुँह टेढ़ा", r"बोलने में दिक्कत", r"बोल नहीं पा रहे"],
    "seizure": [r"seizure", r"convulsion", r"shaking violently", r"daura", r"jhatke", r"fit pad", r"body.{0,15}kaanp", r"mirgi", r"दौरा", r"दौरे", r"झटके", r"मिर्गी"],
    "high_fever_infant": [r"(baby|infant|newborn).{0,30}(high|very high|39|40|104).{0,12}(fever|temperature)", r"(high|very high|39|40|104).{0,30}(baby|infant|newborn)", r"baby ko tez bukhar", r"(do|2|two|three|3) mahine.{0,35}(bukhar|fever)", r"शिशु.*बुखार", r"बच्चे को तेज बुखार"],
    "suicidal_ideation": [r"suicid", r"kill myself", r"end my life", r"want to die", r"planning to.{0,20}life", r"(apni|meri) jaan lene", r"maar lena chahta", r"jeene ka mann nahi", r"जीने की इच्छा नहीं", r"जीने का मन नहीं", r"मर जाना चाहता", r"खुद को नुकसान", r"खुदकुशी"],
    "severe_dehydration": [r"severe dehydration", r"no urine.{0,40}(dizz|confus|stand)", r"not urinat.{0,40}(dizz|confus)", r"no pee.{0,40}(dizz|confus)", r"peshab nahi.{0,40}(chakkar|behosh)", r"paani ki kami.{0,30}chakkar", r"पेशाब नहीं.{0,20}चक्कर", r"पानी की कमी.{0,20}चक्कर"],
    "snake_bite": [r"snak?e.{0,20}(bite|bit|struck|fang)", r"snke.{0,20}bite", r"(bite|bitten).{0,20}snake", r"saanp ne kaat", r"saanp kaat", r"सांप ने.{0,15}काट", r"साँप ने.{0,15}काट"],
    "poisoning": [r"poison(?! ivy)", r"overdose", r"swallowed.{0,30}(pesticide|chemical|cleaning fluid|poison)", r"drinking.{0,20}(chemical|cleaning fluid)", r"zeher", r"zehar", r"poison kha", r"poisoning", r"ज़हर", r"जहर"],
    "severe_burn": [r"severe burn", r"badly burn(t|ed)", r"large.{0,20}burn", r"burns? cover.{0,30}", r"jal gaya", r"jal gayi", r"jhulsa", r"जल गया", r"जल गई", r"गंभीर जल"],
    "choking": [r"choking", r"choked", r"chokng", r"food is stuck", r"can't cough or breathe", r"dam ghut", r"atak gaya.{0,30}(gala|throat|saans)", r"गला.{0,20}अटक", r"खाना गले में फंस", r"दम घुट"],
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
                suffix = text[m.end():m.end()+45]
                if re.search(r"\b(no|not|without|never|denies|nahi|nahin|nhi)\b\W*$", prefix, re.I) or re.search(r"\b(none now|no longer|did not|nobody|no one|not currently|no snake bite)\b", suffix, re.I):
                    continue
                flags.append(flag); break
            if flag in flags: break
    return flags
