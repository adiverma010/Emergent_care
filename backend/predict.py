"""python predict.py input.csv|input.jsonl"""
import csv,json,sys
from pathlib import Path
from app.classifier import predict
from app.redflags import detect_red_flags

def records(path):
    p=Path(path)
    if p.suffix.lower()==".jsonl":
        for line in p.read_text(encoding="utf-8").splitlines():
            o=json.loads(line); yield {"id":o.get("id",""),"user_input":o.get("request",{}).get("user_input",o.get("user_input",""))}
    else:
        with p.open(encoding="utf-8-sig",newline="") as f:
            for row in csv.DictReader(f):yield {"id":row.get("id", ""),"user_input":row.get("user_input",row.get("request",""))}
def main():
    if len(sys.argv)<2:raise SystemExit("Usage: python predict.py INPUT.csv|INPUT.jsonl")
    with open("predictions.csv","w",newline="",encoding="utf-8") as f:
        w=csv.DictWriter(f,fieldnames=["id","care_type","urgency","red_flags","follow_up"]);w.writeheader()
        for row in records(sys.argv[1]):
            flags=detect_red_flags(row["user_input"])
            if flags: care,urg="emergency_112","emergency"
            else: care,urg,cc,uc=predict(row["user_input"]); care,urg=(None,None) if cc<.36 else (care,urg)
            w.writerow({"id":row["id"],"care_type":care or "","urgency":urg or "","red_flags":";".join(flags),"follow_up":"yes" if not care else "no"})
    print("Wrote predictions.csv")
if __name__=="__main__":main()
