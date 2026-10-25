import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.guard import is_irrelevant, IRRELEVANT_REPLY
from app.main import TriageRequest, triage


def test_irrelevant_inputs():
    for text in ("2+2", "abba dabba", "hello how are you", "asdfgh", "12345"):
        assert is_irrelevant(text) is True, text


def test_health_inputs_are_not_irrelevant():
    for text in (
        "mujhe 7 din se fever h doctor ke pas nahi jaunga",
        "bukar hai",
        "sar dard",
        "sugar test ghar pe",
        "dadi gir gayi",
        "doctor chahiye",
        "help",
    ):
        assert is_irrelevant(text) is False, text


def test_short_followup_answer_is_relevant_when_pending():
    assert is_irrelevant("2 din se", pending_followup=True) is False


def test_irrelevant_triage_reply_shape():
    for language, expected in (("hi", "hindi"), ("en", "english"), ("hinglish", "hinglish"), ("auto", "hinglish")):
        result = triage(TriageRequest(user_input="2+2", language=language))
        assert result["follow_up_question"] == IRRELEVANT_REPLY[expected]
        assert result["care_type"] is None
        assert result["urgency"] is None
        assert result["red_flags"] == []
        assert result["matched_caregivers"] == []
        assert result["reasoning"] == "Input is not a health request"
        assert result["irrelevant"] is True


def test_emergency_precedes_irrelevance_guard(monkeypatch):
    monkeypatch.setattr("app.main.is_irrelevant", lambda *args, **kwargs: True)
    result = triage(TriageRequest(user_input="saanp ne kaat liya", language="hinglish"))
    assert result["care_type"] == "emergency_112"
    assert result["urgency"] == "emergency"
    assert result["red_flags"] == ["snake_bite"]
    assert result["irrelevant"] is False


def test_junk_history_is_not_sent_to_classifier(monkeypatch):
    captured = {}

    def fake_predict(text):
        captured["text"] = text
        return "teleconsultation", "same_day", 0.9, 0.9

    monkeypatch.setattr("app.main.predict", fake_predict)
    result = triage(TriageRequest(
        user_input="mujhe bukhar hai",
        language="hinglish",
        conversation_history=[
            {"role": "user", "text": "abba dabba"},
            {"role": "assistant", "text": "What is the health concern?"},
            {"role": "user", "text": "2 din se"},
        ],
    ))
    assert captured["text"] == "2 din se mujhe bukhar hai"
    assert result["irrelevant"] is False


def test_two_followups_do_not_ask_a_third_question(monkeypatch):
    monkeypatch.setattr("app.main.predict", lambda text: ("teleconsultation", "same_day", 0.2, 0.8))
    result = triage(TriageRequest(
        user_input="pain",
        language="en",
        conversation_history=[
            {"role": "assistant", "text": "Where is the pain?"},
            {"role": "user", "text": "stomach"},
            {"role": "assistant", "text": "When did it start?"},
        ],
    ))
    assert result["follow_up_question"] is None
    assert result["care_type"] == "teleconsultation"
    assert result["urgency"] == "same_day"
    assert result["reasoning"] == "Not enough detail to pick a specific service, so a doctor consultation is the safest next step"
    assert result["irrelevant"] is False
