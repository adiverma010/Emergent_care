import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app.redflags import detect_red_flags

CASES=[
    ("Chest pain since morning","chest_pain"),("no chest pain now",None),("seene mein dard ho raha hai","chest_pain"),("chest mein dard hai","chest_pain"),("दिल में दर्द","chest_pain"),
    ("I can't breathe","breathlessness"),("saans nahi aa rahi","breathlessness"),("saans phool rahi hai","breathlessness"),("सांस लेने में तकलीफ","breathlessness"),
    ("He is unconscious","unconsciousness"),("behosh ho gaya","unconsciousness"),("वह बेहोश है","unconsciousness"),
    ("bleeding won't stop","severe_bleeding"),("bahut khoon beh raha hai","severe_bleeding"),("खून बह रहा है","severe_bleeding"),
    ("possible stroke, face drooping","stroke_symptoms"),("lakwa ho gaya","stroke_symptoms"),("मुंह टेढ़ा हो गया","stroke_symptoms"),("bolne mein dikkat","stroke_symptoms"),
    ("having a seizure","seizure"),("daura pada hai","seizure"),("jhatke aa rahe hain","seizure"),("मिर्गी का दौरा","seizure"),
    ("newborn has a high fever","high_fever_infant"),("baby ko tez bukhar","high_fever_infant"),("शिशु को तेज बुखार","high_fever_infant"),
    ("I want to kill myself","suicidal_ideation"),("jeene ka mann nahi","suicidal_ideation"),("खुदकुशी करना चाहता हूं","suicidal_ideation"),
    ("severe dehydration no urine and dizzy","severe_dehydration"),("paani ki kami chakkar peshab nahi","severe_dehydration"),("पेशाब नहीं और चक्कर","severe_dehydration"),
    ("snake bite","snake_bite"),("saanp ne kaata","snake_bite"),("सांप ने काटा","snake_bite"),("poison kha liya","poisoning"),("zeher pee liya","poisoning"),("ज़हर खा लिया","poisoning"),
    ("bad severe burn","severe_burn"),("jal gaya hai","severe_burn"),("गर्म पानी से जल गया","severe_burn"),("choking on food","choking"),("dam ghut raha","choking"),("गला अटक गया","choking"),
    ("throat swelling from anaphylaxis","anaphylaxis"),("allergy se saans nahi aa rahi","anaphylaxis"),("एलर्जी से गला सूज रहा","anaphylaxis"),
]
def test_all_emergency_phrases_flagged():
    for phrase, expected in CASES:
        flags=detect_red_flags(phrase)
        if expected is None:
            assert not flags, f"negated phrase incorrectly flagged: {phrase}"
            continue
        assert flags, f"not flagged: {phrase}"
        assert expected in flags, f"{phrase}: expected {expected}, got {flags}"
def test_clearly_negated_chest_pain_not_flagged():
    assert "chest_pain" not in detect_red_flags("no chest pain")
