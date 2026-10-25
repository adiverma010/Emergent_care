import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.guard import is_irrelevant, has_health_term
from app.main import TriageRequest, triage


IRRELEVANT = [
    "two guna two is qual to what beta",
    "mere ko nahi baat krni",
    "2+2 kitna hota hai",
    "what is the capital of india",
    "tell me a joke",
    "cricket score batao",
    "help me write an essay",
    "beta kaisa hai tu",
]


@pytest.mark.parametrize("pending", [False, True])
@pytest.mark.parametrize("text", IRRELEVANT)
def test_non_health_messages_irrelevant_in_both_modes(text, pending):
    assert is_irrelevant(text, pending), text


@pytest.mark.parametrize("pending", [False, True])
@pytest.mark.parametrize("text", [
    "help", "help please", "doctor chahiye", "mujhe 7 din se fever h",
    "papa ko bukhar hai",
])
def test_health_requests_not_irrelevant(text, pending):
    assert not is_irrelevant(text, pending), text


@pytest.mark.parametrize("pending", [False, True])
def test_short_duration_is_valid_only_as_followup(pending):
    assert is_irrelevant("2 din se", False)
    assert not is_irrelevant("2 din se", True)


def test_relation_only_reply_requires_pending_followup():
    assert is_irrelevant("papa ko", False)
    assert not is_irrelevant("papa ko", True)


def test_generic_words_do_not_make_long_non_health_messages_health():
    assert not has_health_term("help me write an essay")
    assert not has_health_term("doctor what is the capital of india")
    assert has_health_term("help")
    assert has_health_term("doctor chahiye")
    assert not is_irrelevant("fever aur cricket", False)
    assert is_irrelevant("papa ko aaj office me bahut lamba meeting tha", True)


def test_help_then_math_sequence_is_irrelevant_without_care_card():
    first = triage(TriageRequest(user_input="help", language="en"))
    assert first["follow_up_question"]
    body = triage(TriageRequest(
        user_input="two guna two is qual to what beta", language="en",
        conversation_history=[
            {"role": "user", "text": "help"},
            {"role": "assistant", "text": first["follow_up_question"]},
        ],
    ))
    assert body["irrelevant"] is True
    assert body["care_type"] is None and body["urgency"] is None
    assert body["matched_caregivers"] == []


def test_help_family_symptom_sequence_reaches_decision():
    first = triage(TriageRequest(user_input="help", language="en"))
    second = triage(TriageRequest(
        user_input="papa ko", language="hinglish",
        conversation_history=[
            {"role": "user", "text": "help"},
            {"role": "assistant", "text": first["follow_up_question"]},
        ],
    ))
    body = triage(TriageRequest(
        user_input="2 din se bukhar", language="hinglish",
        conversation_history=[
            {"role": "user", "text": "help"},
            {"role": "assistant", "text": first["follow_up_question"]},
            {"role": "user", "text": "papa ko"},
            {"role": "assistant", "text": second.get("follow_up_question") or "Please add symptom duration."},
        ],
    ))
    assert body["irrelevant"] is False
    assert body["care_type"] is not None


def test_snake_bite_still_emergency():
    response = triage(TriageRequest(user_input="saanp ne kaat liya", language="hinglish"))
    assert response["care_type"] == "emergency_112"

