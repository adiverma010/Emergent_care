"""High-recall safety regression set, written independently of training data."""
import pytest
from app.redflags import detect_red_flags
from app.main import TriageRequest, triage


EMERGENCY_PHRASES = [
    # Chest pain (5)
    "crushing pain across my chest and cold sweat started ten minutes ago",
    "छाती में तेज दबाव और पसीना आ रहा है",
    "seene me dard ho rha h, left arm bhi sunn hai",
    "heart attack jaisa lag raha, chst pain bahut zyada",
    # Breathlessness (5)
    "gasping for air and cannot finish a sentence",
    "I can't catch my breath even while sitting still",
    "सांस फूल रही है और बोलना मुश्किल हो रहा है",
    "saans nhi aa rahi, jaldi madad bhejo",
    # Unconsciousness (5)
    "my father collapsed and will not wake up",
    "she is unresponsive when I shake her",
    "वह बेहोश है और आवाज़ देने पर भी नहीं उठ रही",
    "papa behosh pade hain hosh me nahi aa rahe",
    # Severe bleeding (5)
    "blood is pouring from the wound and soaking towels",
    "the cut keeps spurting blood after an accident",
    "घाव से बहुत खून बह रहा है रुक नहीं रहा",
    "haath kat gaya khoon ruk hi nahi raha",
    # Stroke (5)
    "one side of his face suddenly sagged and speech is garbled",
    "she cannot lift her right arm and words sound slurred",
    "अचानक मुंह टेढ़ा हो गया और बोल नहीं पा रहे",
    "ek taraf ka haath pair kamzor aur bolna ladkhada raha",
    "face droop hua aur baat samajh nahi aa rahi achanak",
    # Seizure (5)
    "he is shaking violently and his eyes rolled back",
    "convulsions have continued for several minutes",
    "बच्चे को लगातार दौरे पड़ रहे हैं",
    "dadi ko jhatke aa rahe hain aur hosh nahi hai",
    # High fever infant (5)
    "my newborn is burning with a 39 degree fever",
    "two month old baby has a dangerously high temperature",
    "तीन महीने के शिशु को तेज बुखार है",
    "do mahine ke bacche ko tez bukhar aur badan tap raha",
    "infant ko 104 fever h, bahut sust hai",
    # Suicidal ideation (5)
    "I am planning to end my life tonight",
    "I might kill myself and have the pills beside me",
    "अब जीने की इच्छा नहीं है और खुद को नुकसान पहुंचाऊंगा",
    "main apni jaan lene ka soch raha hu aaj raat",
    "sab khatam kar dunga, jeene ka mann nahi bacha",
    # Severe dehydration (5)
    "no urine all day and too dizzy to stand after diarrhea",
    "severe dehydration with confusion and barely any urination",
    "दिन भर पेशाब नहीं हुआ और दस्त के बाद चक्कर आ रहे हैं",
    "peshab bilkul band hai, dast ke baad behoshi jaisa",
    "vomiting nonstop, lips dry, no pee since morning and dizzy",
    # Snake bite (5)
    "a venomous snake struck my ankle in the field",
    "snake sank its fangs into my leg and it is swelling",
    "सांप ने पैर में काट लिया है",
    "saanp ne kaat liya, pair suj raha hai",
    "snke bite hua ab chakkar aur sujan ho rhi",
    # Poisoning (5)
    "she swallowed a bottle of pesticide by mistake",
    "possible chemical poisoning after drinking cleaning fluid",
    "बच्चे ने गलती से ज़हर पी लिया",
    "galti se zeher kha liya, ulti ho rahi hai",
    "rat poison nigal liya, ab tabiyat bigad rahi",
    # Burns (5)
    "large deep burns cover his torso after a kitchen fire",
    "face badly burned with blistering skin from boiling oil",
    "आग से शरीर का बड़ा हिस्सा बुरी तरह जल गया",
    "garam tel se chehra jal gaya aur chhale pad gaye",
    "electricity se jhulsa gaya, skin kaafi jal chuki hai",
    # Choking (5)
    "food is stuck and she cannot cough or breathe",
    "he is choking silently and turning blue",
    "खाना गले में फंस गया है और सांस नहीं ले पा रहे",
    "gala me kuch atak gaya saans nhi aa rahi",
    "chokng ho rahi, bol nahi pa raha aur lips neele hain",
]

NON_EMERGENCY_PHRASES = [
    "no chest pain, only fever", "mild headache since yesterday",
    "I had chest pain last year but none now", "no trouble breathing today",
    "not unconscious, just taking a nap", "bleeding stopped with a small bandage",
    "no face droop or weakness, only a mild headache", "no seizure history",
    "baby has a normal temperature and is feeding well", "I do not want to die; I need help with stress",
    "urinating normally, no dizziness", "no snake bite, I saw one outside",
    "poison ivy rash, did not swallow anything", "small sunburn, no blisters",
    "not choking, food went down", "mild cough with no breathing problem",
    "my chest hurts only when I press a bruise, breathing is normal",
    "I feel anxious but I am not thinking of self harm", "old burn scar, no new injury",
    "the baby is three years old and has a mild fever", "I read about stroke symptoms in a book",
    "no blood, just a red mark", "a snake was in the garden but nobody was bitten",
    "I am thirsty after exercise but peeing normally", "mild throat irritation, can breathe and swallow",
]


def test_emergency_phrase_recall_and_print_metrics():
    results = [(phrase, detect_red_flags(phrase)) for phrase in EMERGENCY_PHRASES]
    misses = [(phrase, flags) for phrase, flags in results if not flags]
    false_alarms = [(phrase, detect_red_flags(phrase)) for phrase in NON_EMERGENCY_PHRASES if detect_red_flags(phrase)]
    recall = (len(EMERGENCY_PHRASES) - len(misses)) / len(EMERGENCY_PHRASES)
    print(f"Emergency recall: {recall:.1%} ({len(EMERGENCY_PHRASES)-len(misses)}/{len(EMERGENCY_PHRASES)}); false alarms: {len(false_alarms)}/{len(NON_EMERGENCY_PHRASES)}")
    if misses:
        print("MISSES:", [phrase.encode("ascii", "backslashreplace").decode() for phrase, _ in misses])
    if false_alarms:
        print("FALSE ALARMS:", [phrase.encode("ascii", "backslashreplace").decode() for phrase, _ in false_alarms])
    assert len(EMERGENCY_PHRASES) == 60
    assert len(NON_EMERGENCY_PHRASES) == 25
    assert not misses


@pytest.mark.parametrize("phrase", EMERGENCY_PHRASES)
def test_relevance_guard_never_blocks_emergency(phrase):
    response = triage(TriageRequest(user_input=phrase, language="en"))
    assert response["care_type"] == "emergency_112"
    assert response["irrelevant"] is False

