import csv, math
from datetime import datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CSV=ROOT.parent/"data"/"caregivers.csv"
ROLES={"paramedic_home_visit":{"medic"},"home_nursing":{"medic"},"lab_test_home":{"phlebotomist"},"teleconsultation":{"doctor"}}
def haversine(a,b,c,d):
    r=6371; p=math.pi/180; x=math.sin((c-a)*p/2)**2+math.cos(a*p)*math.cos(c*p)*math.sin((d-b)*p/2)**2
    return 2*r*math.asin(math.sqrt(x))
def match(care_type, location, language="English", limit=3):
    out=[]; now=datetime.now().strftime("%H:%M"); lat=location.get("lat",28.6139); lng=location.get("lng",77.209)
    if care_type=="emergency_112": return []
    try: rows=list(csv.DictReader(CSV.open(encoding="utf-8-sig",newline="")))
    except OSError: return []
    for row in rows:
        if row.get("active","").lower()!="true" or row.get("role") not in ROLES.get(care_type,set()): continue
        dist=haversine(lat,lng,float(row["base_lat"]),float(row["base_lng"]))
        doctor=row["role"]=="doctor"
        if not doctor and dist>float(row.get("max_radius_km") or 0): continue
        langs=[x.strip().lower() for x in row.get("languages","").split(";")]; desired="hindi" if language in ("Hindi","Hinglish") else "english"
        lscore=1 if desired in langs else .5 if "english" in langs or "hindi" in langs else 0
        skills=row.get("skills","").lower(); terms={"home_nursing":["nursing","wound","injection","catheter","post_surgical","vitals"],"paramedic_home_visit":["vitals","nursing","nebulization"],"lab_test_home":["sample","blood","lab","phlebotomy"],"teleconsultation":["teleconsultation","report_review"]}.get(care_type,[])
        sscore=1 if any(t in skills for t in terms) else .5
        maxr=float(row.get("max_radius_km") or 1); proximity=1 if doctor else max(0,1-dist/maxr)
        rating=float(row.get("rating") or 0)/5
        free_from=row.get("free_from",""); free_until=row.get("free_until",""); available=bool(free_from and free_until and free_from<=now<=free_until)
        score=.35*lscore+.30*proximity+.20*sscore+.15*rating+(.025 if row.get("tier")=="premium" else 0)
        if not available: score*=.75
        reason=("Hindi" if lscore>=.9 else "English" if lscore else "")+"-speaking"
        reason+=f", {dist:.1f} km away" if not doctor else ", teleconsultation"
        reason+=f", free {free_from}-{free_until}" if available else f", next available {free_from or 'schedule pending'}-{free_until}" if free_from else ", availability pending"
        out.append({"caregiver_id":row["caregiver_id"],"score":round(score,3),"reason":reason,"_available":available})
    out.sort(key=lambda x:(x["_available"],x["score"]),reverse=True)
    return [{k:v for k,v in x.items() if k!="_available"} for x in out[:limit]]
