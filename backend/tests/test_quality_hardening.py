import json
import re
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import classifier, hospitals, prescription
from app.firstaid import steps
from app.main import TriageRequest, triage, explicit_service_route
from app.redflags import detect_red_flags, is_minor_bleeding


NEW_EMERGENCIES = [
    "mera dost building se gir gaya",
    "fell from the roof and hit the ground hard",
    "my uncle fell from a height and is badly hurt",
    "chhat se gir gaya, uth nahi pa raha",
    "road accident mein aadmi zameen par pada hai",
    "a car hit bystander and he cannot stand",
    "bike accident ho gaya, sar pe chot lagi",
    "head injury and now vomiting and drowsy",
    "building se gira aur behosh hai",
    "terrace se gir padi, hosh nahi aa raha",
    "accident ho gaya, pair hil nahi raha",
    "ऊंचाई से गिरकर सिर पर चोट लगी है",
    "छत से गिरा और उठ नहीं पा रहा",
    "सड़क हादसे में सिर पर चोट और उल्टी",
    "बाइक दुर्घटना हुई और व्यक्ति बेहोश है",
    "usko bhot khoon nikal rha hai",
    "bahot khun beh rha h ruk nahi raha",
    "bahut khoon nikal raha hai, kapda pura bheeg gaya",
    "bohot khoon beh raha hai aur chakkar aa rahe hain",
    "bhot khun nikal rha hai chot se",
    "blood coming out everywhere and it will not stop",
    "bleeding a lot from the leg after a crash",
    "blood is spurting from a deep wound",
    "bleeding heavily and getting weaker by the minute",
    "the cut is gushing blood through the towel",
    "khoon nikal raha hai aur band nahi ho raha",
    "khoon beh rha hai, bahot zyada beh raha hai",
    "bhot saara khun nikal raha h jaldi aao",
    "खून बहुत निकल रहा है और रुक नहीं रहा",
    "बहुत खून बह रहा है कपड़ा लाल हो गया",
    "खून की धार निकल रही है",
    "खून निकल रहा है और पट्टी भीग गई",
    "खून बहना बंद नहीं हो रहा",
    "ऑक्सीजन सिलेंडर चाहिए, सांस बहुत फूल रही है",
    "oxygen cylinder needed urgently for my father",
    "oxygen chahiye, saans nahi aa rahi",
    "oxygen low ho gaya, patient is struggling to breathe",
    "SpO2 low and he cannot catch his breath",
    "saturation kam hai aur saans phool rahi hai",
    "patient ka oxygen level low hai, jaldi help",
]

NEGATIVE_OR_MILD = [
    "thoda sa cut hai", "no bleeding", "no blood coming out",
    "small scratch, bleeding stopped quickly", "mild headache since yesterday",
    "no fall from the roof", "there was no road accident",
    "oxygen level check at home, no breathing problem", "oxygen cylinder is not needed",
    "I am not breathless", "no chest pain, only mild fever",
    "sirf halka sa cut hai, thoda khoon tha ab ruk gaya",
    "minor knee scrape with no active bleeding", "he did not fall from the building",
    "no one was hit by a vehicle", "my old head injury has no vomiting or drowsiness",
]


def test_new_emergency_recall_and_false_alarms(capsys):
    missed = [phrase for phrase in NEW_EMERGENCIES if not detect_red_flags(phrase)]
    false_alarms = [phrase for phrase in NEGATIVE_OR_MILD if detect_red_flags(phrase)]
    recall = (len(NEW_EMERGENCIES) - len(missed)) / len(NEW_EMERGENCIES)
    print(f"Extra emergency recall: {recall:.1%} ({len(NEW_EMERGENCIES)-len(missed)}/{len(NEW_EMERGENCIES)}); false alarms: {len(false_alarms)}/{len(NEGATIVE_OR_MILD)}")
    if missed:
        print("MISSED:", [x.encode("ascii", "backslashreplace").decode() for x in missed])
    if false_alarms:
        print("FALSE ALARMS:", [x.encode("ascii", "backslashreplace").decode() for x in false_alarms])
    assert len(NEW_EMERGENCIES) >= 40 and len(NEGATIVE_OR_MILD) >= 15
    assert not missed
    assert not false_alarms


@pytest.mark.parametrize("phrase", NEW_EMERGENCIES)
def test_new_emergency_never_hits_relevance_guard(phrase):
    response = triage(TriageRequest(user_input=phrase, language="hinglish"))
    assert response["care_type"] == "emergency_112"
    assert response["urgency"] == "emergency"


def test_history_red_flag_is_checked_before_guard():
    response = triage(TriageRequest(user_input="usko bhot khoon nikal rha hai", language="hinglish", conversation_history=[{"role": "user", "text": "mera dost building se gir gaya"}]))
    assert response["care_type"] == "emergency_112"
    assert "major_trauma" in response["red_flags"]
    assert response["first_aid_steps"][0] == "Abhi 112 par call karein."
    assert "na hilaayein" in response["first_aid_steps"][1]


def test_minor_bleeding_gets_same_day_guidance_not_emergency():
    response = triage(TriageRequest(user_input="chot lagi hai knee me khoon nikal raha hai", language="hinglish"))
    assert response["care_type"] in {"home_nursing", "paramedic_home_visit"}
    assert response["urgency"] == "same_day"
    assert not response["red_flags"]
    assert response["first_aid_steps"] == [
        "Saaf kapde se zakhm par 10 minute mazboot dabav dein.",
        "Mumkin ho to chot wala haath ya pair upar rakhein.",
        "Bheega kapda na hataayein; uske upar doosra kapda rakhein.",
        "Khoon na ruke to hospital jaayein.",
    ]
    assert not is_minor_bleeding("no bleeding")


@pytest.mark.parametrize("text", ["oxygen cylinder", "oxygen chahiye", "oxygen low", "SpO2 low", "saturation kam"])
def test_oxygen_red_flags_route_to_emergency(text):
    response = triage(TriageRequest(user_input=text, language="en"))
    assert response["red_flags"] == ["breathlessness"]
    assert response["care_type"] == "emergency_112"
    assert response["first_aid_steps"][0] == "Call 112 now."


def test_dengue_is_health_request_but_not_red_flag_emergency():
    response = triage(TriageRequest(user_input="mujhe dengue hua hai", language="hinglish"))
    assert response["care_type"] == "teleconsultation"
    assert response["urgency"] == "same_day"
    assert response["red_flags"] == []
    assert "doctor" in response["reasoning"].lower()


def test_red_flag_steps_follow_requested_language():
    for lang, expected in (("en", "Call 112 now."), ("hi", "अभी 112 पर कॉल करें।"), ("hinglish", "Abhi 112 par call karein.")):
        response = triage(TriageRequest(user_input="oxygen low", language=lang))
        assert response["first_aid_steps"][0] == expected


ROUTING_40 = [
    "need nurse to give prescribed injection at home", "ghar par insulin injection lagwana hai", "injection at home for my mother prescribed by doctor", "dressing change for surgical wound", "stitches dressing karni hai ghar pe", "wound dressing nurse visit please", "blood sugar test at home tomorrow", "ghar pe fasting sugar test karwana hai", "need HbA1c blood test sample collection at home", "sugar test ghar pe chahiye", "fever and cough since two days", "papa ko bukhar aur khansi hai kal se", "mild fever with dry cough for 3 days", "doctor video consultation for recurring headache", "I need to speak with a doctor online about acidity", "doctor se video consult chahiye", "catheter care for elderly father at home", "urinary catheter replacement by nurse", "catheter bag leaking need home nurse", "need a nurse for wound stitches removal", "blood pressure check at home", "ECG test at home for my father", "need physiotherapy visit for knee pain", "my mother needs help bathing after surgery", "elderly care attendant for 8 hours", "need oxygen cylinder urgently for my grandfather", "rash on arm itchy since yesterday", "stomach pain after dinner", "my back hurts when bending", "child has loose motions since morning", "my dad has diabetes need diet advice", "I feel weak for several days", "medicine delivery needed", "please arrange doctor visit for fever", "need lab test collection at home", "nurse needed to remove catheter", "teleconsult for high blood pressure", "my leg is swollen after a fall", "need a doctor", "help please",
]


def test_previous_40_routing_prompts_have_at_most_five_followups():
    responses = [triage(TriageRequest(user_input=text, language="auto")) for text in ROUTING_40]
    followups = [(i + 1, text) for i, (text, response) in enumerate(zip(ROUTING_40, responses)) if response["follow_up_question"]]
    print("routing followups", followups)
    assert len(ROUTING_40) == 40
    assert len(followups) <= 5
    assert all(re.fullmatch(r"(help|help please|please help|need help|need something|something|kuch chahiye|मदद|मदद चाहिए)\W*", text, re.I) for _, text in followups)


def test_explicit_service_routes():
    expected = {
        "injection for my father": ("home_nursing", "same_day"),
        "catheter replacement next Monday": ("home_nursing", "scheduled"),
        "blood pressure check at home": ("paramedic_home_visit", "same_day"),
        "sugar check at home": ("lab_test_home", "scheduled"),
        "ECG at home": ("home_nursing", "same_day"),
        "online doctor for fever": ("teleconsultation", "same_day"),
        "doctor visit for fever": ("paramedic_home_visit", "same_day"),
        "urine test at home": ("lab_test_home", "scheduled"),
    }
    for text, route in expected.items():
        result = explicit_service_route(text)
        assert result and result[:2] == route, (text, result)


def test_prescription_regex_cases_and_no_fallback():
    first = prescription.parse_text("Paracetamol 500mg twice a day after food for 3 days")
    assert first["medicines"][0]["name"] == "Paracetamol"
    assert first["medicines"][0]["dosage_as_written"] == "500mg"
    assert first["medicines"][0]["frequency"] == "twice a day"
    assert first["medicines"][0]["food_note"] == "after food"
    assert first["medicines"][0]["duration"] == "for 3 days"
    second = prescription.parse_text("noble plus 1 tab BD after food")
    assert second["medicines"][0]["name"] == "noble plus"
    assert second["medicines"][0]["dosage_as_written"] == "1 tab"
    assert second["medicines"][0]["frequency"] == "BD"
    junk = prescription.parse_text("asdfgh nothing readable xyz")
    assert junk == {"medicines": [], "error": prescription.ERROR}


def test_model_is_persisted_and_reloaded(monkeypatch):
    model_path = Path(__file__).resolve().parent / ".test-model.joblib"
    if model_path.exists():
        model_path.unlink()
    monkeypatch.setattr(classifier, "MODEL_PATH", model_path)
    monkeypatch.setattr(classifier, "_models", None)
    try:
        classifier.warmup()
        assert model_path.is_file()
        monkeypatch.setattr(classifier, "_models", None)
        monkeypatch.setattr(classifier, "train_models", lambda: pytest.fail("model should load from disk"))
        assert classifier.models()
    finally:
        model_path.unlink(missing_ok=True)
        model_path.with_suffix(".joblib.tmp").unlink(missing_ok=True)


def test_tinyfish_request_shape_and_structured_success(monkeypatch):
    good = [{"name": f"Hospital {i}", "phone": "123", "address": f"Address {i}"} for i in range(3)]
    class Response:
        status = 200
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def read(self): return json.dumps({"status": "COMPLETED", "result": {"hospitals": good}}).encode()
    captured = {}
    def fake_urlopen(request, timeout):
        captured["request"] = request
        captured["timeout"] = timeout
        return Response()
    monkeypatch.setattr(hospitals, "urlopen", fake_urlopen)
    result = hospitals._call_tinyfish(28.54, 77.27, "test-key")
    request = captured["request"]
    payload = json.loads(request.data)
    assert request.full_url == "https://agent.tinyfish.ai/v1/automation/run"
    assert request.get_header("X-api-key") == "test-key"
    assert captured["timeout"] == 8
    assert {"url", "goal", "output_schema"} <= payload.keys()
    assert result == good


def test_tinyfish_failure_falls_back_to_static(monkeypatch):
    class Response:
        status = 200
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def read(self): return b'{"status":"FAILED","result":null}'
    monkeypatch.setattr(hospitals, "urlopen", lambda *args, **kwargs: Response())
    assert hospitals._call_tinyfish(28.54, 77.27, "test-key") is None
    assert hospitals.nearby(28.54, 77.27)
