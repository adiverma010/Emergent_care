"""Batch triage predictions: python predict.py INPUT.csv|INPUT.jsonl OUTPUT.csv"""
import csv
import json
import sys
from pathlib import Path

from app.classifier import predict
from app.redflags import detect_red_flags


OUTPUT_FIELDS = ["id", "care_type", "urgency", "red_flags", "follow_up_question"]


def _nested_request(row):
    value = row.get("request")
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            value = {}
    return value if isinstance(value, dict) else {}


def _normalized(row):
    request = _nested_request(row)
    return {
        "id": row.get("id", request.get("id", "")) or "",
        "user_input": row.get("user_input") or request.get("user_input") or "",
        "lat": row.get("lat", request.get("location", {}).get("lat")),
        "lng": row.get("lng", request.get("location", {}).get("lng")),
    }


def records(path):
    source = Path(path)
    if source.suffix.lower() == ".jsonl":
        with source.open(encoding="utf-8") as stream:
            for line in stream:
                if line.strip():
                    yield _normalized(json.loads(line))
    else:
        with source.open(encoding="utf-8-sig", newline="") as stream:
            for row in csv.DictReader(stream):
                yield _normalized(row)


def predict_record(row):
    flags = detect_red_flags(row["user_input"])
    if flags:
        care, urgency, follow_up = "emergency_112", "emergency", ""
    else:
        care, urgency, care_confidence, _ = predict(row["user_input"])
        if care_confidence < 0.36:
            care, urgency = "", ""
            follow_up = "Please share the main concern and when it started."
        else:
            follow_up = ""
    return {
        "id": row["id"],
        "care_type": care,
        "urgency": urgency,
        "red_flags": ";".join(flags),
        "follow_up_question": follow_up,
    }


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if len(argv) != 2:
        raise SystemExit("Usage: python predict.py INPUT.csv|INPUT.jsonl OUTPUT.csv")
    input_path, output_path = argv
    with Path(output_path).open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=OUTPUT_FIELDS)
        writer.writeheader()
        for row in records(input_path):
            writer.writerow(predict_record(row))
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()
