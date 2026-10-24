# CareCompass Sathi backend

Offline FastAPI routing prototype. It uses local rules and a TF-IDF/logistic-regression model trained from `../data/triage_dataset.jsonl`; no API key is needed. The API supports CORS for all origins and listens on port 8000.

From the repository root:

```powershell
python -m pip install -r backend/requirements.txt
cd backend
uvicorn app.main:app --reload --port 8000
```

Run the requested checks from `backend/` with `python -m pytest -q` and `python eval.py`. Evaluate only on the JSONL training dataset, with a deterministic stratified 20% holdout. `python predict.py path/to/input.csv` or `.jsonl` writes `predictions.csv` in the current directory.

`POST /triage` accepts `user_input`, `language`, `location`, and `conversation_history`. Emergency phrases are checked before the classifier and responses route to 112 with first-aid guidance. Other endpoints provide mock dispatch, curated hospitals, text prescription parsing, reminders, safe home-care guidance, and age-aware greetings. Image OCR and optional LLM extraction are not implemented in this offline prototype; image uploads return a clear limitation message.
