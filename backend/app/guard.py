import re
import difflib

# Health vocabulary: English, Hinglish (romanised) and Hindi (Devanagari).
HEALTH_TERMS = set("""
fever bukhar bukhaar dengue acidity acid reflux tez cough khansi khasi cold sardi zukam jukam flu pain dard ache headache
sar sir pet stomach seene seena chest saans breath breathing ulti vomit vomiting nausea dast
diarrhea loose motion motions chakkar dizzy dizziness kamzori weakness weak thakan tired thakaan
chot injury ghav wound cut kat kata katna bleeding khoon blood sugar diabetes bp pressure thyroid
asthma heart dil infection rash khujli sujan swelling jalan burn jal jala fracture sprain
moch allergy pregnant pregnancy baby bachcha bachche child infant elder bujurg
doctor dr nurse medic medicine dawa dawai goli tablet capsule injection dressing patti
test lab sample report jaanch janch checkup consultation consult appointment
sick ill unwell bimar beemar bimari tabiyat tabiat health symptom symptoms
urine peshab pishab stool gala throat kaan ear aankh eye daant tooth kamar back ghutna knee
haath hand pair leg foot gir gira gire fall fell behosh hosh unconscious faint fainted
fit seizure daura mirgi lakwa stroke saanp snake bite sting poison zeher
ambulance emergency hospital clinic help madad bachao ilaj treatment
oxygen spo2 pulse nabz temperature tapman thermometer cancer kidney liver
lag lagi laga hua ghar visit
""".split())

HINDI_TERMS = [
    "बुखार", "खांसी", "खाँसी", "सर्दी", "जुकाम", "दर्द", "सिर", "पेट", "सीने", "सांस", "साँस",
    "उल्टी", "दस्त", "चक्कर", "कमजोरी", "कमज़ोरी", "थकान", "चोट", "घाव", "खून", "शुगर", "दवा",
    "दवाई", "गोली", "इंजेक्शन", "पट्टी", "जांच", "जाँच", "तबीयत", "बीमार", "डॉक्टर", "नर्स",
    "सूजन", "जलन", "एलर्जी", "बेहोश", "सांप", "साँप", "ज़हर", "जहर", "मदद", "अस्पताल", "एम्बुलेंस",
    "गिर", "लग", "टेस्ट", "रिपोर्ट", "दौरा", "लकवा", "बच्चे", "बच्चा",
]

# Short answers to a follow-up question ("kab se?", "kisko?") are not health words.
ANSWER_PATTERN = re.compile(
    r"(\d+\s*(din|days?|day|ghante|hours?|hrs?|week|hafte|mahine|months?|saal|years?|sal))"
    r"|\b(kal|aaj|parso|subah|raat|abhi|pichle|kafi|bahut|thoda|lagatar|roz|yesterday|today|since)\b"
    r"|\b(papa|mummy|mama|maa|dada|dadi|nana|nani|bhai|behen|beti|beta|wife|husband|patni|pati|main|mujhe|mera|meri|father|mother|son|daughter|grandfather|grandmother|brother|sister|myself|me)\b"
    r"|(दिन|घंटे|हफ्ते|महीने|साल|कल|आज|पापा|मम्मी|माँ|दादी|दादा|भाई|बहन|बेटा|बेटी|मुझे|मेरा|मेरी)",
    re.IGNORECASE,
)

LETTERS = re.compile(r"[A-Za-z\u0900-\u097F]")
MATH_ONLY = re.compile(r"^[\s\d+\-*/=().,%^x×÷]+$", re.IGNORECASE)
TOKEN = re.compile(r"[A-Za-z\u0900-\u097F]+")
NON_HEALTH = re.compile(r"\b(guna|gunaa|multiply|plus|minus|divide|equal|qual|kitna\s+hota|calculate|maths?|capital|joke|song|gana|movie|film|cricket|score|weather|mausam|recipe|price|stock|news|who\s+is|what\s+is|kaun\s+hai|kya\s+hai|why|kyun|how\s+to|write|essay|code|translate)\b", re.I)
NON_HEALTH_WORDS = set("guna gunaa multiply plus minus divide equal qual kitna calculate maths math capital joke song gana movie film cricket score weather mausam recipe price stock news who what kaun kya why kyun how write essay code translate".split())
GENERIC_TERMS = {"help", "madad", "bachao", "doctor", "dr"}
FOLLOWUP_ANSWER = re.compile(
    r"(?:\d+\s*(?:din|days?|day|ghante|hours?|hrs?|weeks?|hafte|months?|mahine|years?|saal|sal)\b|\b(?:kal|parso|subah|raat|since)\b|\b(?:papa|mummy|dadi|wife|myself)\b)", re.I
)


def _has_health_term(text: str) -> bool:
    low = text.lower()
    if any(t in text for t in HINDI_TERMS):
        return True
    tokens = TOKEN.findall(low)
    for tok in tokens:
        if tok in NON_HEALTH_WORDS:
            continue
        if tok in HEALTH_TERMS:
            return True
        # tolerate spelling variants: "bukar", "feaver", "dardd"
        if len(tok) >= 4 and difflib.get_close_matches(tok, HEALTH_TERMS, n=1, cutoff=0.8):
            return True
    return False


def has_health_term(text: str) -> bool:
    """Check the shared health vocabulary, applying the generic-word limit."""
    tokens = TOKEN.findall((text or "").lower())
    if len(tokens) <= 4 and any(token in GENERIC_TERMS for token in tokens):
        return True
    return _has_health_term(text or "") and not (
        any(token in GENERIC_TERMS for token in tokens) and
        not any(token not in GENERIC_TERMS and _has_health_term(token) for token in tokens)
    )


def is_irrelevant(text: str, pending_followup: bool = False) -> bool:
    """True when the message is clearly not about health or care.

    Call this AFTER the red-flag check, never before: an emergency phrase
    must always get through.
    """
    t = (text or "").strip()
    if len(t) < 2:
        return True
    if not LETTERS.search(t):
        return True          # only digits, symbols or emoji
    if MATH_ONLY.match(t):
        return True          # "2+2"
    # Explicit non-health topics are never accepted as short follow-up answers.
    if NON_HEALTH.search(t) and not has_health_term(t):
        return True
    if has_health_term(t):
        return False
    if pending_followup and len(TOKEN.findall(t)) <= 8 and FOLLOWUP_ANSWER.search(t):
        return False         # a valid short answer ("2 din se", "papa ko")
    return True


IRRELEVANT_REPLY = {
    "english": "I can only help with health problems. Please tell me the symptom, who it is for, and since when. For example: \"fever for 2 days\".",
    "hindi": "मैं सिर्फ़ सेहत से जुड़ी परेशानी में मदद कर सकता हूँ। कृपया बताएं क्या तकलीफ़ है, किसे है और कब से है। जैसे: \"2 दिन से बुखार है\"।",
    "hinglish": "Main sirf health problem mein madad kar sakta hoon. Please batayein kya taklif hai, kisko hai aur kab se. Jaise: \"2 din se bukhar hai\".",
}
