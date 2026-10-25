import statistics
import time

from app.main import AssessRequest, guided_assess
from app.assess import PROTOCOLS


def call(text, **kwargs):
    return guided_assess(AssessRequest(user_input=text, **kwargs))


def reply(previous, value, qid=None):
    qid = qid or previous["question"]["id"]
    return call(previous["session"]["history"][-2]["text"], language="en", profile=previous["session"].get("profile", {}), session=previous["session"], answer={"question_id": qid, "value": value})


def test_fever_guided_assessment_completes_with_advice():
    r = call("mujhe bukhar hai", language="hinglish")
    count = 0
    while r["status"] == "question" and count < 3:
        count += 1
        value = {"warning_signs": "No", "duration": "2 din", "measurement": "100 F"}.get(r["question"]["id"].split("_")[-1], "No")
        r = call("mujhe bukhar hai", language="hinglish", session=r["session"], answer={"question_id": r["question"]["id"], "value": value})
    assert count <= 3 and r["status"] == "result"
    assert all(k in r["advice"] for k in ("severity", "summary", "do_now", "home_remedies", "medicine_info", "medicine_hidden_reason", "avoid", "see_doctor_if", "sources", "disclaimer"))


def test_high_fever_duration_skips_questions():
    r = call("bukhar 3 din se 103 hai", language="hinglish")
    assert r["status"] in {"result", "question"}
    assert r["status"] == "result" or r["question"]["progress"] == "1 of 3"


def test_infant_fever_is_emergency():
    for text in ("baby 2 months fever", "2 mahine ke bachche ko bukhar"):
        r = call(text, language="en")
        assert r["status"] == "emergency" and r["dispatch_recommended"]


def test_allergy_hides_nsaid():
    r = call("headache", language="en", profile={"age": 30, "allergies": ["ibuprofen"], "history": []})
    while r["status"] == "question":
        r = call("headache", language="en", profile={"age": 30, "allergies": ["ibuprofen"], "history": []}, session=r["session"], answer={"question_id":r["question"]["id"],"value":"No"})
    assert r["status"] == "result"
    assert r["advice"]["medicine_hidden_reason"]
    assert all("ibuprofen" not in " ".join(m["examples"]).lower() for m in r["advice"]["medicine_info"])


def test_child_no_aspirin():
    r = call("fever", language="en", profile={"age": 8})
    while r["status"] == "question":
        r = call("fever", language="en", profile={"age": 8}, session=r["session"], answer={"question_id":r["question"]["id"],"value":"No"})
    assert "aspirin" not in str(r["advice"]).lower()


def test_stool_blood_answer_escalates():
    r = call("pet dard", language="hinglish")
    while r["status"] == "question":
        value = "blood in stool" if r["question"]["id"].endswith("warning_signs") else "1 day"
        r = call("pet dard", language="hinglish", session=r["session"], answer={"question_id":r["question"]["id"],"value":value})
    assert r["status"] == "emergency" and r["dispatch_recommended"]


def test_emergency_irrelevant_and_service_fallback():
    assert call("saanp ne kaat liya", language="hinglish")["status"] == "emergency"
    assert call("two guna two is qual to what beta", language="en")["status"] == "irrelevant"
    r=call("lab test at home", language="en")
    assert r["status"] == "result" and r["advice"] is None and r["care_type"] == "lab_test_home"


def test_each_protocol_produces_localized_advice():
    symptoms={"fever":"fever","cough_cold":"cough","sore_throat":"sore throat","headache":"headache","stomach_pain":"stomach pain","diarrhea_vomiting":"diarrhea","minor_wound":"wound","minor_burn":"burn","sprain_injury":"sprain","rash_allergy":"rash","acidity":"acidity","dizziness_weakness":"dizziness"}
    for p in PROTOCOLS.values():
        for lang in ("en", "hi", "hinglish"):
            r=call(symptoms[p["id"]],language=lang,session={"protocol_id":p["id"],"slots":{"warning_signs":"none","duration_days":1,"temperature_c":37},"asked":[q["id"] for q in p["questions"]]})
            assert r["status"] == "result" and r["advice"] and r["advice"]["summary"]


def test_assessment_calls_under_300ms():
    samples=[]
    for _ in range(50):
        t=time.perf_counter(); call("mujhe bukhar hai",language="hinglish"); samples.append((time.perf_counter()-t)*1000)
    print(f"assess latency 50 calls: median={statistics.median(samples):.2f}ms max={max(samples):.2f}ms")
    assert max(samples)<300
