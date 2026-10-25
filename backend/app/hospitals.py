import asyncio
import json
import logging
import math
import os
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
HOSPITALS=[{"name":"AIIMS New Delhi","lat":28.5672,"lng":77.2100,"phone":"011-26588500","emergency":True},{"name":"Safdarjung Hospital","lat":28.5688,"lng":77.2066,"phone":"011-26165060","emergency":True},{"name":"Indraprastha Apollo Hospital","lat":28.5407,"lng":77.2830,"phone":"011-71791090","emergency":True},{"name":"Max Super Speciality Hospital Saket","lat":28.5275,"lng":77.2066,"phone":"011-26515050","emergency":True},{"name":"Fortis Memorial Research Institute Gurugram","lat":28.4595,"lng":77.0724,"phone":"0124-4962200","emergency":True},{"name":"Yashoda Super Speciality Hospital Ghaziabad","lat":28.6692,"lng":77.4477,"phone":"0120-4182000","emergency":True}]
def distance(a,b,c,d):
    r=6371;p=math.pi/180;x=math.sin((c-a)*p/2)**2+math.cos(a*p)*math.cos(c*p)*math.sin((d-b)*p/2)**2
    return 2*r*math.asin(math.sqrt(x))
def nearby(lat,lng):
    """Return only the curated static list; never block the main route on enrichment."""
    return sorted([{**h,"distance_km":round(distance(lat,lng,h["lat"],h["lng"]),2)} for h in HOSPITALS],key=lambda h:h["distance_km"])


def _call_tinyfish(lat, lng, api_key, timeout=8):
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
        "url": f"https://www.google.com/maps/search/hospitals+with+emergency+departments+near+{lat},{lng}",
        "goal": f"Find the 3 nearest hospitals with emergency departments near latitude {lat} and longitude {lng}. Return only JSON with a hospitals array, each containing name, phone, and address. Do not invent missing phone numbers; use an empty string when unavailable.",
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
    valid = []
    for item in hospitals:
        if isinstance(item, dict) and isinstance(item.get("name"), str) and item["name"].strip():
            valid.append({"name": item["name"].strip(), "phone": item.get("phone", "") if isinstance(item.get("phone", ""), str) else "", "address": item.get("address", "") if isinstance(item.get("address", ""), str) else ""})
    return valid[:3] or None


async def tinyfish_lookup(lat, lng, timeout=8):
    """Best-effort enrichment, isolated by a hard timeout."""
    api_key = os.getenv("TINYFISH_API_KEY")
    if not api_key:
        return None
    try:
        return await asyncio.wait_for(asyncio.to_thread(_call_tinyfish, lat, lng, api_key, timeout), timeout=timeout)
    except Exception as exc:
        logger.warning("TinyFish request failed: %s", type(exc).__name__)
        return None


def load_live_cache():
    global _LIVE_CACHE
    try:
        data = json.loads(LIVE_CACHE_PATH.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("live_hospitals"), list) and data["live_hospitals"] and data.get("fetched_at"):
            _LIVE_CACHE = data
    except (OSError, ValueError):
        pass


async def refresh_live(lat=28.54, lng=77.27, timeout=90):
    global _LIVE_CACHE
    live = await tinyfish_lookup(lat, lng, timeout)
    if not live:
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
    return _LIVE_CACHE.get("live_hospitals") if _LIVE_CACHE else None
