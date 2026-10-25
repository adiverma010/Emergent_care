import json

from app.main import AssessRequest, guided_assess


def turn(text, session=None, *, answer=None, language="hinglish"):
    return guided_assess(AssessRequest(
        user_input=text,
        language=language,
        session=session or {},
        answer=answer,
    ))


def drive(text, replies, language="hinglish"):
    transcript=[]
    result=turn(text, language=language)
    transcript.append({"user_input":text,"response":result})
    for value in replies:
        if result["status"] != "question": break
        result=turn(value, result["session"], language=language)
        transcript.append({"user_input":value,"response":result})
    return result, transcript


def test_typed_hinglish_duration_and_temperature_finish_and_print_json():
    result, transcript=drive("mujhe bukhar hai", ["Haan", "3 dino se", "102 C"])
    assert result["status"] == "result"
    assert result["advice"] and result["advice"]["severity"] == "doctor_today"
    assert all(entry["response"]["status"] != "irrelevant" for entry in transcript)
    print("FLOW_A_JSON=" + json.dumps(transcript, ensure_ascii=False, separators=(",", ":")))


def test_spelled_duration_and_decimal_temperature_finish():
    result, transcript=drive("mujhe bukhar hai", ["Haan", "teen din", "39.5"])
    assert result["status"] == "result" and result["advice"]
    assert all(entry["response"]["status"] != "irrelevant" for entry in transcript)


def test_pata_nahi_for_each_question_still_finishes():
    result, transcript=drive("mujhe bukhar hai", ["pata nahi", "pata nahi", "pata nahi"])
    assert result["status"] == "result" and result["advice"]
    assert all(entry["response"]["status"] != "irrelevant" for entry in transcript)


def test_user_declared_emergency_during_protocol():
    first=turn("mujhe bukhar hai")
    result=turn("its an emergency", first["session"])
    assert result["status"] == "emergency"
    assert result["dispatch_recommended"] is True
    assert result["matched_caregivers"] == []
    assert result["first_aid_steps"]


def test_non_protocol_guard_and_help_followup_remain():
    assert turn("two guna two is qual to what beta")["status"] == "irrelevant"
    help_result=turn("help")
    assert help_result["follow_up_question"]


def test_red_flag_typed_as_pending_answer_stays_emergency():
    first=turn("mujhe bukhar hai")
    result=turn("saanp ne kaat liya", first["session"])
    assert result["status"] == "emergency" and result["dispatch_recommended"]
    assert result["matched_caregivers"] == []


def test_invalid_answer_retries_same_question_once_then_moves_on():
    first=turn("mujhe bukhar hai")
    retry=turn("banana", first["session"])
    assert retry["status"] == "question"
    assert retry["question"]["id"] == first["question"]["id"]
    next_question=turn("still banana", retry["session"])
    assert next_question["status"] == "question"
    assert next_question["question"]["id"] != first["question"]["id"]
