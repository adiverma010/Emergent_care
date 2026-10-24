TIMES={"OD":["08:00"],"BD":["08:00","20:00"],"TDS":["08:00","14:00","20:00"],"QID":["08:00","12:00","16:00","20:00"],"once daily":["08:00"],"twice daily":["08:00","20:00"],"three times daily":["08:00","14:00","20:00"],"four times daily":["08:00","12:00","16:00","20:00"]}
def schedule(medicines):
    out=[]
    for m in medicines:
        f=(m.get("frequency") or "").strip(); times=TIMES.get(f.upper(),TIMES.get(f.lower(),[])); note=(m.get("food_note") or "").lower()
        out.append({"medicine":m.get("name",""),"times":times,"with_food":True if note in ("after food","with food") else False if note=="before food" else m.get("with_food"),"days":m.get("duration")})
    return {"timetable":out,"note":"Times are suggested reminders from the stated frequency; confirm timing with a clinician or pharmacist."}
