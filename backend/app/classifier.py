import json, re
from pathlib import Path
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import FeatureUnion
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import f1_score
import joblib
import os

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT.parent / "data" / "triage_dataset.jsonl"
MODEL_PATH = Path(__file__).resolve().parents[1] / "model.joblib"
_models = None
CARE = ["paramedic_home_visit", "home_nursing", "lab_test_home", "teleconsultation", "emergency_112"]
URGENCY = ["emergency", "same_day", "scheduled"]

def read_rows():
    rows=[]
    with DATA.open(encoding="utf-8") as f:
        for line in f:
            try:
                o=json.loads(line); q=o.get("request",{}); a=o.get("response",{})
                if q.get("user_input") and a.get("care_type") and a.get("urgency"):
                    rows.append((q["user_input"], a["care_type"], a["urgency"]))
            except Exception: pass
    return rows
def _vectorizer():
    return FeatureUnion([("char",TfidfVectorizer(analyzer="char",ngram_range=(2,5),min_df=1,sublinear_tf=True)),("word",TfidfVectorizer(analyzer="word",ngram_range=(1,2),token_pattern=r"(?u)\b\w+\b",min_df=1,sublinear_tf=True))])
def models():
    global _models
    if _models is None:
        if MODEL_PATH.is_file():
            try:
                _models = joblib.load(MODEL_PATH)
                return _models
            except Exception:
                # A missing, stale, or truncated local cache is rebuilt safely.
                _models = None
        _models = train_models()
        temp_path = MODEL_PATH.with_suffix(MODEL_PATH.suffix + ".tmp")
        joblib.dump(_models, temp_path)
        os.replace(temp_path, MODEL_PATH)
    return _models

def train_models():
    rows=read_rows(); X=[r[0] for r in rows]
    if not rows:
        raise ValueError(f"No valid training rows found in {DATA}")
    v=_vectorizer(); Xv=v.fit_transform(X)
    cs=LogisticRegression(max_iter=1000,class_weight="balanced").fit(Xv,[r[1] for r in rows])
    us=LogisticRegression(max_iter=1000,class_weight="balanced").fit(Xv,[r[2] for r in rows])
    return (v,cs,us)

def warmup():
    """Load or train and persist the prediction models for app startup."""
    return models()
def predict(text):
    v,c,u=models(); x=v.transform([text]); cp=c.predict_proba(x)[0]; up=u.predict_proba(x)[0]
    ci=int(cp.argmax()); ui=int(up.argmax())
    return c.classes_[ci],u.classes_[ui],float(cp[ci]),float(up[ui])
def evaluate():
    rows=read_rows(); X=[r[0] for r in rows]; cy=[r[1] for r in rows]; uy=[r[2] for r in rows]
    xtr,xte,ctr,cte,utr,ute=train_test_split(X,cy,uy,test_size=.2,random_state=42,stratify=cy)
    v=_vectorizer(); a=v.fit_transform(xtr); b=v.transform(xte)
    cm=LogisticRegression(max_iter=1000,class_weight="balanced").fit(a,ctr); um=LogisticRegression(max_iter=1000,class_weight="balanced").fit(a,utr)
    cp=cm.predict(b); up=um.predict(b)
    # Emergency recall includes labeled emergencies and any known red-flag phrase.
    from .redflags import detect_red_flags
    actual=[(y=="emergency_112" or bool(detect_red_flags(t))) for t,y in zip(xte,cte)]
    pred=[(p=="emergency_112" or bool(detect_red_flags(t))) for t,p in zip(xte,cp)]
    tp=sum(x and y for x,y in zip(actual,pred)); denom=sum(actual)
    return {"rows":len(rows),"care_type_macro_f1":f1_score(cte,cp,average="macro"),"urgency_macro_f1":f1_score(ute,up,average="macro"),"emergency_recall":tp/denom if denom else 0,"holdout":len(xte)}
