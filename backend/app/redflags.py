"""High-recall, offline multilingual emergency phrase detection."""
import re
from typing import List

PATTERNS = {
    "chest_pain": [r"chest.{0,12}(pain|tight|pressure)", r"chest\s*(mein|me)\s*dard", r"(crushing|severe|sudden).{0,20}chest", r"heart\s*(pain|attack)", r"seene?\s*(mein|me|par)?\s*(tez\s*)?dard", r"dil mein dard", r"सीने में दर्द", r"छाती में दर्द", r"दिल में दर्द", r"छाती में तेज दबाव"],
    "breathlessness": [r"breathless", r"can't catch (my )?breath", r"can't breathe", r"cannot breathe", r"gasping for air", r"difficulty breathing", r"shortness of breath", r"oxygen.{0,18}(cylinder|chahiye|needed|level\s*(low|kam)|low|kam)", r"need oxygen", r"spo2\s*(is\s*)?(low|kam)", r"saturation\s*(is\s*)?(low|kam)", r"saans\s*(nhi|nahi|nahin)\s*(aa|le)", r"saans (?:bahut\s+)?phool", r"saans lene mein takleef", r"दम घुट", r"सांस नहीं आ", r"सांस लेने में तकलीफ", r"साँस फूल", r"सांस फूल", r"ऑक्सीजन (कम|चाहिए|लेवल कम|सिलेंडर)", r"सैचुरेशन कम"],
    "unconsciousness": [r"unconscious", r"unresponsive", r"(will|won't|cannot|can't) wake", r"will not wake", r"not wake up", r"not waking", r"behosh", r"hosh nahi", r"response nahi", r"बेहोश", r"होश नहीं", r"होश नह"],
    "severe_bleeding": [r"severe bleeding", r"blood (is )?(pouring|spurting|gushing|coming out)", r"bleeding (a lot|heavily|won't stop|not stopping)", r"(cut|wound).{0,30}(spurting|pouring|gushing|bleeding a lot)", r"(bhot|bahot|bahut|bohot)\s+(zyada|saara|sara)?\s*(khoon|khun).{0,35}(nikal|beh|ruk)", r"(khoon|khun).{0,30}(bhot|bahot|bahut|bohot|zyada|saara|sara).{0,25}(nikal|beh)", r"(khoon|khun)\s+(beh|behta)\s+(raha|rha|rhi|rhi hai|raha hai)", r"khoon nikal raha hai", r"khoon.{0,20}ruk.{0,12}nahi", r"khoon nahi ruk", r"bleeding ruk nahi", r"lots of blood", r"blood loss", r"bleeding badly", r"blood is flowing", r"बहुत खून", r"बहुत ज़्यादा खून", r"बहुत ज्यादा खून", r"खून बह", r"खून नहीं रुक", r"खून निकल.{0,20}(बहुत|ज़्यादा|ज्यादा|रुक नहीं)", r"खून.{0,35}(कपड़ा|पट्टी).{0,15}(भीग|लाल)", r"खून की धार", r"खून बहुत निकल", r"खून बहना बंद नहीं"],
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
    "major_trauma": [r"fall(?:en)?\s+from\s+(?:(?:a|the)\s+)?(?:height|building|roof|terrace)", r"fell\s+from\s+(?:(?:a|the)\s+)?(?:height|building|roof|terrace)", r"(?:building|roof|terrace|chhat).{0,25}(?:fell|fall|gir|gira)", r"(?:gir|gira|gayi|gaya).{0,30}(?:building|roof|terrace|chhat)", r"(?:building|roof|terrace|chhat).{0,25}(?:gir gaya|gir gayi|gir pada|gir padi)", r"road accident", r"bike accident", r"accident ho gaya", r"hit by (?:a )?(?:vehicle|car|truck|bus|bike)", r"(?:car|vehicle|truck|bus|bike) hit (?:a |the )?.{0,30}(?:person|man|woman|bystander|him|her)", r"head injury.{0,35}(?:vomit|drowsy|sleepy|unconscious)", r"head (?:hit|injury).{0,35}(?:vomit|drowsy|sleepy)", r"sar pe chot", r"height se gir", r"building se gir", r"chhat se gir", r"terrace se gir", r"ऊंचाई से गिर", r"ऊँचाई से गिर", r"इमारत से गिर", r"बिल्डिंग से गिर", r"छत से गिर", r"सड़क हादसा", r"बाइक दुर्घटना", r"सिर पर चोट", r"दुर्घटना हो गई"],
}
_COMPILED = {k: [re.compile(p, re.I) for p in v] for k, v in PATTERNS.items()}
NEGATION = re.compile(r"\b(no|not|without|never|denies|nahi|nahin|nhi|nahi hai|nahi ho raha)\b", re.I)
MINOR_BLEEDING = re.compile(r"\b(thoda(?:\s+sa)?|halka|minor|mild|small|little|only a little)\b.{0,35}\b(cut|wound|bleed|bleeding|khoon|khun)\b|\b(cut|chot|wound|knee)\b.{0,45}\b(khoon|khun|blood|bleed|bleeding)\b", re.I)
HEAVY_BLEEDING = re.compile(r"\b(gushing|spurting|pouring|heavily|bleeding a lot|bhot|bahot|bahut|bohot|zyada|saara|sara|lots of blood|severe)\b|बहुत|ज़्यादा|ज्यादा|धार|भीग|नहीं रुक", re.I)
FALL_OR_ACCIDENT = re.compile(r"\b(fall|fell|fallen|gir|gira|giri|gir gaya|gir gayi|accident|road accident|bike accident|hit by)\b|(?:गिर|दुर्घटना|हादसा)", re.I)
UNABLE_TO_MOVE = re.compile(r"\b(can't move|cannot move|unable to move|can't walk|cannot walk|not moving|move nahi kar|chal nahi pa|hil nahi pa)\b|(?:हिल नहीं पा|चल नहीं पा)", re.I)

def detect_red_flags(text: str) -> List[str]:
    text = text or ""
    flags = []
    for flag, patterns in _COMPILED.items():
        for p in patterns:
            for m in p.finditer(text or ""):
                prefix = text[max(0, m.start()-35):m.start()]
                # Suppress only obvious local negation, not general words elsewhere.
                suffix = text[m.end():m.end()+45]
                if re.search(r"\b(no|not|without|never|denies|nahi|nahin|nhi)\b\W*$", prefix, re.I) or re.search(r"\b(none now|no longer|did not|didn't|nobody|no one|not currently|not needed|not required|no need|no snake bite)\b", suffix, re.I) or re.search(r"\b(no one|nobody|not|never|didn't|did not)\b.{0,25}$", prefix, re.I):
                    continue
                if flag == "severe_bleeding" and MINOR_BLEEDING.search(text) and not HEAVY_BLEEDING.search(text):
                    continue
                if flag == "breathlessness" and re.search(r"\boxygen\b.{0,25}\b(?:not needed|not required|no need)\b", text, re.I):
                    continue
                if flag == "major_trauma" and re.search(r"\b(no|not|without|didn't|did not)\b.{0,30}\b(vomit\w*|drows\w*|sleepy|fall|accident|hit)\b", text[max(0, m.start()-35):m.end()+45], re.I):
                    continue
                flags.append(flag); break
            if flag in flags: break
    if FALL_OR_ACCIDENT.search(text) and ({"severe_bleeding", "unconsciousness"} & set(flags) or UNABLE_TO_MOVE.search(text)):
        flags.append("major_trauma")
    return flags


def is_minor_bleeding(text: str) -> bool:
    """Recognize a non-severe bleed that still needs same-day care guidance."""
    t = text or ""
    if re.search(r"\b(no|not|without|never|denies|nahi|nahin|nhi)\b.{0,12}\b(bleeding|blood|khoon|khun)\b|(?:खून|रक्त).{0,12}(नहीं|नही|नहीं है)", t, re.I):
        return False
    has_bleeding = bool(re.search(r"\b(bleed(?:ing)?|blood|khoon|khun)\b|खून|रक्त", t, re.I))
    return has_bleeding and not ("severe_bleeding" in detect_red_flags(t) or "major_trauma" in detect_red_flags(t))
