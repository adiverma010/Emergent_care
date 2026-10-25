import asyncio
import json
import logging
import math
import os
import re
from pathlib import Path
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
TINYFISH_URL = "https://agent.tinyfish.ai/v1/automation/run"
LIVE_CACHE_PATH = Path(__file__).resolve().parents[1] / "live_hospitals_cache.json"
logger = logging.getLogger(__name__)
_LIVE_CACHE = None
_REFRESH_TASK = None
DELHI_NCR_NAME = "Delhi NCR, India"
DELHI_NCR_CITY_RE = re.compile(r"\b(delhi|new delhi|gurugram|gurgaon|noida|ghaziabad|faridabad)\b", re.I)
INDIA_PHONE_PREFIXES = ("011", "+91 11", "0124", "0120", "0129", "+91")
US_PHONE_RE = re.compile(r"^\s*(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]+\d{3}[\s.-]+\d{4}\s*$")
HOSPITALS=[{"name":"AIIMS New Delhi","lat":28.5672,"lng":77.2100,"phone":"011-26588500","emergency":True},{"name":"Safdarjung Hospital","lat":28.5688,"lng":77.2066,"phone":"011-26165060","emergency":True},{"name":"Indraprastha Apollo Hospital","lat":28.5407,"lng":77.2830,"phone":"011-71791090","emergency":True},{"name":"Max Super Speciality Hospital Saket","lat":28.5275,"lng":77.2066,"phone":"011-26515050","emergency":True},{"name":"Fortis Memorial Research Institute Gurugram","lat":28.4595,"lng":77.0724,"phone":"0124-4962200","emergency":True},{"name":"Yashoda Super Speciality Hospital Ghaziabad","lat":28.6692,"lng":77.4477,"phone":"0120-4182000","emergency":True}]
def distance(a,b,c,d):
    r=6371;p=math.pi/180;x=math.sin((c-a)*p/2)**2+math.cos(a*p)*math.cos(c*p)*math.sin((d-b)*p/2)**2
    return 2*r*math.asin(math.sqrt(x))
def nearby(lat,lng):
    """Return only the curated static list; never block the main route on enrichment."""
    return sorted([{**h,"distance_km":round(distance(lat,lng,h["lat"],h["lng"]),2)} for h in HOSPITALS],key=lambda h:h["distance_km"])


def place_for_coordinates(lat, lng):
    if 28.3 <= lat <= 28.8 and 76.8 <= lng <= 77.6:
        return DELHI_NCR_NAME
    return None


def validate_hospitals(items):
    """Return validated named entries and aggregate rejection reasons only."""
    valid = []
    rejected = {}
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict) or not isinstance(item.get("name"), str) or not item["name"].strip():
            rejected["missing_name"] = rejected.get("missing_name", 0) + 1
            continue
        name = item["name"].strip()
        address = item.get("address", "") if isinstance(item.get("address", ""), str) else ""
        phone = item.get("phone", "") if isinstance(item.get("phone", ""), str) else ""
        if US_PHONE_RE.match(phone):
            rejected["us_phone_format"] = rejected.get("us_phone_format", 0) + 1
            continue
        has_delhi_region = bool(DELHI_NCR_CITY_RE.search(f"{name} {address}"))
        has_india_phone = phone.strip().startswith(INDIA_PHONE_PREFIXES)
        if not has_delhi_region and not has_india_phone:
            rejected["outside_delhi_ncr"] = rejected.get("outside_delhi_ncr", 0) + 1
            continue
        valid.append({"name": name, "phone": phone.strip(), "address": address.strip()})
    logger.info("TinyFish validation rejected %d entries; reasons=%s", sum(rejected.values()), rejected or "none")
    return valid[:3], rejected


def _call_tinyfish(lat, lng, api_key, timeout=8):
    place = place_for_coordinates(lat, lng)
    if place is None:
        logger.info("TinyFish skipped; reason=coordinates_outside_Delhi_NCR; rejected_entries=0")
        return None
    output_schema = {
        "type": "object",
        "properties": {
            "hospitals": {
                "type": "array",
                "items": {"type": "object", "properties": {
                    "name": {"type": "string"}, "phone": {"type": "string"}, "address": {"type": "string"}
                }, "required": ["name", "phone", "address"]},
            }
        },
        "required": ["hospitals"],
    }
    payload = {
        "url": "https://www.google.com/search?q=emergency+hospitals+in+South+Delhi+India",
        "goal": f"List up to 3 hospitals with an emergency department located in {place}. Ignore any result outside India. Return JSON: name, phone, address.",
        "output_schema": output_schema,
    }
    request = Request(TINYFISH_URL, data=json.dumps(payload).encode("utf-8"), method="POST", headers={"X-API-Key": api_key, "Content-Type": "application/json"})
    try:
        with urlopen(request, timeout=timeout) as response:
            response_body = response.read()
            if response.status < 200 or response.status >= 300:
                logger.warning("TinyFish HTTP %s: %s", response.status, response_body[:300].decode("utf-8", "replace"))
                return None
        body = json.loads(response_body.decode("utf-8"))
    except HTTPError as exc:
        logger.warning("TinyFish HTTP %s: %s", exc.code, exc.read(300).decode("utf-8", "replace"))
        return None
    if body.get("status") != "COMPLETED" or not isinstance(body.get("result"), dict):
        logger.warning("TinyFish HTTP %s error response: %s", response.status, response_body[:300].decode("utf-8", "replace"))
        return None
    hospitals = body["result"].get("hospitals")
    if not isinstance(hospitals, list):
        return None
    valid, rejected = validate_hospitals(hospitals)
    return valid or None


async def tinyfish_lookup(lat, lng, timeout=8):
    """Best-effort enrichment, isolated by a hard timeout."""
    api_key = os.getenv("TINYFISH_API_KEY")
    if not api_key:
        logger.info("TinyFish skipped; reason=no_api_key; rejected_entries=0")
        return None
    if place_for_coordinates(lat, lng) is None:
        logger.info("TinyFish skipped; reason=coordinates_outside_Delhi_NCR; rejected_entries=0")
        return None
    try:
        return await asyncio.wait_for(asyncio.to_thread(_call_tinyfish, lat, lng, api_key, timeout), timeout=timeout)
    except Exception as exc:
        logger.warning("TinyFish request failed: %s", type(exc).__name__)
        return None


def load_live_cache():
    global _LIVE_CACHE
    if not LIVE_CACHE_PATH.exists():
        _LIVE_CACHE = None
        return
    try:
        data = json.loads(LIVE_CACHE_PATH.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("live_hospitals"), list) and data.get("fetched_at"):
            validated, rejected = validate_hospitals(data["live_hospitals"])
            if validated and not rejected:
                _LIVE_CACHE = {**data, "live_hospitals": validated, "live_source": "tinyfish"}
                return
            logger.warning("Deleting invalid TinyFish cache; rejected_entries=%d; reasons=%s", sum(rejected.values()), rejected or "no_valid_entries")
        elif LIVE_CACHE_PATH.exists():
            logger.warning("Deleting invalid TinyFish cache; rejected_entries=0; reasons=invalid_cache_shape")
    except (OSError, ValueError):
        logger.warning("Deleting unreadable TinyFish cache; rejected_entries=0; reason=invalid_cache")
    _LIVE_CACHE = None
    try:
        LIVE_CACHE_PATH.unlink(missing_ok=True)
    except OSError as exc:
        logger.warning("Could not delete invalid TinyFish cache: %s", type(exc).__name__)


async def refresh_live(lat=28.54, lng=77.27, timeout=90):
    global _LIVE_CACHE
    if place_for_coordinates(lat, lng) is None:
        logger.info("TinyFish skipped; reason=coordinates_outside_Delhi_NCR; rejected_entries=0")
        return None
    live = await tinyfish_lookup(lat, lng, timeout)
    if not live:
        return None
    live, rejected = validate_hospitals(live)
    if not live:
        logger.warning("TinyFish refresh rejected all entries; reasons=%s", rejected or "no_valid_entries")
        return None
    record = {"live_hospitals": live, "live_source": "tinyfish", "fetched_at": datetime.now(timezone.utc).isoformat()}
    _LIVE_CACHE = record
    try:
        temporary = LIVE_CACHE_PATH.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(LIVE_CACHE_PATH)
    except OSError as exc:
        logger.warning("Could not save TinyFish hospital cache: %s", exc)
    return record


def start_refresh(lat=28.54, lng=77.27, timeout=90):
    global _REFRESH_TASK
    if _REFRESH_TASK is not None and not _REFRESH_TASK.done():
        return False
    _REFRESH_TASK = asyncio.create_task(refresh_live(lat, lng, timeout))
    return True


def cached_live(lat=None, lng=None):
    if _LIVE_CACHE is None:
        load_live_cache()
    if lat is None or lng is None:
        return _LIVE_CACHE
    if place_for_coordinates(lat, lng) is None:
        return None
    return _LIVE_CACHE.get("live_hospitals") if _LIVE_CACHE else None
