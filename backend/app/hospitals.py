import asyncio
import json
import math
import os
from pathlib import Path
from urllib.request import Request, urlopen
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
TINYFISH_URL = "https://agent.tinyfish.ai/v1/automation/run"
_LIVE_CACHE = {}
HOSPITALS=[{"name":"AIIMS New Delhi","lat":28.5672,"lng":77.2100,"phone":"011-26588500","emergency":True},{"name":"Safdarjung Hospital","lat":28.5688,"lng":77.2066,"phone":"011-26165060","emergency":True},{"name":"Indraprastha Apollo Hospital","lat":28.5407,"lng":77.2830,"phone":"011-71791090","emergency":True},{"name":"Max Super Speciality Hospital Saket","lat":28.5275,"lng":77.2066,"phone":"011-26515050","emergency":True},{"name":"Fortis Memorial Research Institute Gurugram","lat":28.4595,"lng":77.0724,"phone":"0124-4962200","emergency":True},{"name":"Yashoda Super Speciality Hospital Ghaziabad","lat":28.6692,"lng":77.4477,"phone":"0120-4182000","emergency":True}]
def distance(a,b,c,d):
    r=6371;p=math.pi/180;x=math.sin((c-a)*p/2)**2+math.cos(a*p)*math.cos(c*p)*math.sin((d-b)*p/2)**2
    return 2*r*math.asin(math.sqrt(x))
def nearby(lat,lng):
    """Return only the curated static list; never block the main route on enrichment."""
    return sorted([{**h,"distance_km":round(distance(lat,lng,h["lat"],h["lng"]),2)} for h in HOSPITALS],key=lambda h:h["distance_km"])


def _call_tinyfish(lat, lng, api_key):
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
    with urlopen(request, timeout=8) as response:
        if response.status < 200 or response.status >= 300:
            return None
        body = json.loads(response.read().decode("utf-8"))
    if body.get("status") != "COMPLETED" or not isinstance(body.get("result"), dict):
        return None
    hospitals = body["result"].get("hospitals")
    if not isinstance(hospitals, list) or not hospitals:
        return None
    valid = []
    for item in hospitals[:3]:
        if not isinstance(item, dict):
            return None
        name, phone, address = (item.get(k) for k in ("name", "phone", "address"))
        if not all(isinstance(v, str) for v in (name, phone, address)) or not name.strip() or not address.strip():
            return None
        valid.append({"name": name.strip(), "phone": phone.strip(), "address": address.strip()})
    return valid


async def tinyfish_lookup(lat, lng):
    """Best-effort enrichment, isolated by an eight-second hard timeout."""
    api_key = os.getenv("TINYFISH_API_KEY")
    if not api_key:
        return None
    try:
        return await asyncio.wait_for(asyncio.to_thread(_call_tinyfish, lat, lng, api_key), timeout=8)
    except Exception:
        return None


async def live_nearby(lat, lng):
    static = nearby(lat, lng)
    live = await tinyfish_lookup(lat, lng)
    if live:
        _LIVE_CACHE[(round(lat, 4), round(lng, 4))] = live
    return {"hospitals": static, "live_hospitals": live, "live_source": "tinyfish" if live else None}


def cached_live(lat, lng):
    return _LIVE_CACHE.get((round(lat, 4), round(lng, 4)))
