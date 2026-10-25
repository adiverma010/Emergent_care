import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import hospitals


SAN_JOSE_RESULTS = [
    {"name": "O'Connor Hospital Emergency Room", "phone": "(408) 947-2500", "address": "2105 Forest Ave"},
    {"name": "Santa Clara Valley Medical Center Emergency Room", "phone": "(408) 885-5000", "address": "751 S Bascom Ave"},
    {"name": "Good Samaritan Hospital Emergency Room", "phone": "(408) 559-2011", "address": "2425 Samaritan Dr"},
]


def test_rejects_all_three_prior_san_jose_results(caplog):
    caplog.set_level(logging.INFO)
    valid, rejected = hospitals.validate_hospitals(SAN_JOSE_RESULTS)
    assert valid == []
    assert rejected == {"us_phone_format": 3}
    assert "rejected 3 entries" in caplog.text
    assert "us_phone_format" in caplog.text


def test_accepts_named_delhi_hospital_with_delhi_phone():
    valid, rejected = hospitals.validate_hospitals([{
        "name": "Max Super Speciality Hospital, Saket, New Delhi",
        "phone": "011-26515050",
        "address": "Saket, New Delhi",
    }])
    assert rejected == {}
    assert valid == [{
        "name": "Max Super Speciality Hospital, Saket, New Delhi",
        "phone": "011-26515050",
        "address": "Saket, New Delhi",
    }]


def test_accepts_delhi_ncr_coordinates_only():
    assert hospitals.place_for_coordinates(28.54, 77.27) == "Delhi NCR, India"
    assert hospitals.place_for_coordinates(28.3, 76.8) == "Delhi NCR, India"
    assert hospitals.place_for_coordinates(28.29, 77.27) is None
    assert hospitals.place_for_coordinates(28.54, 77.61) is None


def test_tinyfish_does_not_call_outside_delhi_ncr(monkeypatch):
    def fail_if_called(*args, **kwargs):
        raise AssertionError("TinyFish must be skipped outside Delhi NCR")
    monkeypatch.setattr(hospitals, "urlopen", fail_if_called)
    assert hospitals._call_tinyfish(19.07, 72.87, "test-key") is None


def test_startup_deletes_cache_containing_any_wrong_region_entry(monkeypatch):
    cache_file = Path(__file__).resolve().parent / ".tinyfish-cache-test.json"
    cache_file.write_text(json.dumps({
        "live_hospitals": [
            {"name": "Max Super Speciality Hospital, Saket, New Delhi", "phone": "011-26515050", "address": "New Delhi"},
            *SAN_JOSE_RESULTS,
        ],
        "live_source": "tinyfish",
        "fetched_at": "2026-10-25T00:00:00+00:00",
    }), encoding="utf-8")
    monkeypatch.setattr(hospitals, "LIVE_CACHE_PATH", cache_file)
    monkeypatch.setattr(hospitals, "_LIVE_CACHE", None)
    try:
        hospitals.load_live_cache()
        assert not cache_file.exists()
        assert hospitals.cached_live() is None
    finally:
        cache_file.unlink(missing_ok=True)

