import math
HOSPITALS=[{"name":"AIIMS New Delhi","lat":28.5672,"lng":77.2100,"phone":"011-26588500","emergency":True},{"name":"Safdarjung Hospital","lat":28.5688,"lng":77.2066,"phone":"011-26165060","emergency":True},{"name":"Indraprastha Apollo Hospital","lat":28.5407,"lng":77.2830,"phone":"011-71791090","emergency":True},{"name":"Max Super Speciality Hospital Saket","lat":28.5275,"lng":77.2066,"phone":"011-26515050","emergency":True},{"name":"Fortis Memorial Research Institute Gurugram","lat":28.4595,"lng":77.0724,"phone":"0124-4962200","emergency":True},{"name":"Yashoda Super Speciality Hospital Ghaziabad","lat":28.6692,"lng":77.4477,"phone":"0120-4182000","emergency":True}]
def distance(a,b,c,d):
    r=6371;p=math.pi/180;x=math.sin((c-a)*p/2)**2+math.cos(a*p)*math.cos(c*p)*math.sin((d-b)*p/2)**2
    return 2*r*math.asin(math.sqrt(x))
def tinyfish_lookup(lat,lng):
    """Hook for a future TinyFish web-agent lookup; static curated list is offline fallback."""
    return None
def nearby(lat,lng):
    found=tinyfish_lookup(lat,lng) or HOSPITALS
    return sorted([{**h,"distance_km":round(distance(lat,lng,h["lat"],h["lng"]),2)} for h in found],key=lambda h:h["distance_km"])
