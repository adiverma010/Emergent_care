import uuid,time
from .hospitals import nearby
STORE={}
def create(body):
    lat=body.get("location",{}).get("lat",28.6139); lng=body.get("location",{}).get("lng",77.209)
    h=nearby(lat,lng)[0]; ident=str(uuid.uuid4()); packet={"patient":body.get("patient",{}),"red_flag":body.get("red_flag"),"summary":body.get("summary")}
    STORE[ident]={"created":time.time(),"hospital":h,"packet":packet}
    return {"dispatch_id":ident,"status":"notified","eta_minutes":18,"hospital":{"name":h["name"],"distance_km":h["distance_km"],"phone":h["phone"]},"packet":packet}
def get(ident):
    x=STORE.get(ident)
    if not x:return None
    elapsed=time.time()-x["created"]; status="notified" if elapsed<10 else "ambulance_assigned" if elapsed<25 else "en_route"
    return {"dispatch_id":ident,"status":status,"eta_minutes":max(2,18-int(elapsed/5)),"hospital":{"name":x["hospital"]["name"],"distance_km":x["hospital"]["distance_km"],"phone":x["hospital"]["phone"]},"packet":x["packet"]}
