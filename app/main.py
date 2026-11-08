import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import smtplib
import urllib.parse
import urllib.request
from email.message import EmailMessage
from datetime import datetime, timezone
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from pymongo import MongoClient
from bson import ObjectId
import anthropic

logger = logging.getLogger("agri_supply")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

MODEL_TIER = os.getenv("CLAUDE_TIER", "haiku").lower()
MODEL_IDS = {
    "haiku": {
        "anthropic": "claude-haiku-4-5",
        "bedrock": "anthropic.claude-3-5-haiku-20241022-v1:0",
    },
    "sonnet": {
        "anthropic": "claude-sonnet-4-5",
        "bedrock": "anthropic.claude-3-5-sonnet-20241022-v2:0",
    },
    "opus": {
        "anthropic": "claude-opus-4-5",
        "bedrock": "anthropic.claude-3-opus-20240229-v1:0",
    },
}
PROVIDER = "bedrock" if os.getenv("USE_BEDROCK") == "1" else "anthropic"
MODEL = os.getenv("CLAUDE_MODEL") or MODEL_IDS.get(MODEL_TIER, MODEL_IDS["haiku"])[PROVIDER]
db = MongoClient(os.getenv("MONGO_URL", "mongodb://localhost:27017"), serverSelectionTimeoutMS=5000)["agrisupply"]
llm = None
try:
    if os.getenv("USE_BEDROCK") == "1":
        llm = anthropic.AnthropicBedrock(aws_region=os.getenv("AWS_REGION", "us-east-1"))
    elif os.getenv("ANTHROPIC_API_KEY"):
        llm = anthropic.Anthropic()
except Exception:
    logger.exception("AI client could not be initialized; rule-based fallbacks remain available")

app = FastAPI(title="Agri-Supply API", version="1.0.0")
HERE = os.path.dirname(__file__)

# ---------- helpers ----------
def now(): return datetime.now(timezone.utc).isoformat()

def clean(d):
    if isinstance(d, list): return [clean(x) for x in d]
    if isinstance(d, dict): return {k: clean(v) for k, v in d.items() if k not in ("password", "salt", "token")}
    if isinstance(d, ObjectId): return str(d)
    return d

def oid(x):
    try: return ObjectId(x)
    except Exception: raise HTTPException(404, "Not found")

def ask(system, messages, max_tokens=1200):
    if llm is None:
        raise RuntimeError("AI provider is not configured")
    if isinstance(messages, str): messages = [{"role": "user", "content": messages}]
    r = llm.messages.create(model=MODEL, max_tokens=max_tokens, system=system, messages=messages)
    if not r.content or not getattr(r.content[0], "text", None):
        raise RuntimeError("AI provider returned an empty response")
    return r.content[0].text

def ask_json(system, text, fallback, max_tokens=1200):
    try:
        response = ask(system, text, max_tokens)
        match = re.search(r"\{.*\}", response, re.S)
        if not match:
            raise ValueError("AI response did not contain JSON")
        value = json.loads(match.group())
        if not isinstance(value, dict):
            raise ValueError("AI response JSON was not an object")
        return value
    except (RuntimeError, ValueError, json.JSONDecodeError) as exc:
        logger.warning("Using fallback response: %s", exc)
        return fallback

def hash_pw(pw, salt): return hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 100_000).hex()

def user(authorization: str = Header("")):
    token = authorization.removeprefix("Bearer ").strip() if authorization else ""
    u = db.users.find_one({"token": token}) if token else None
    if not u: raise HTTPException(401, "Not logged in")
    return u

def own(coll, id, u):
    doc = db[coll].find_one({"_id": oid(id), "user_id": str(u["_id"])})
    if not doc: raise HTTPException(404, "Not found")
    return doc

# ---------- models ----------
class Register(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    email: str = Field(min_length=3, max_length=254)
    farm_name: str = Field(default="", max_length=100)
    farm_location: str = Field(min_length=3, max_length=200)
class Login(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)
class Prompt(BaseModel):
    prompt: str = Field(min_length=3, max_length=2000)
class DraftReq(BaseModel):
    company_ids: list[str] = Field(min_length=1, max_length=20)
    details: str = Field(default="", max_length=2000)
class EmailEdit(BaseModel):
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=10000)
class Reply(BaseModel):
    text: str = Field(min_length=1, max_length=10000)
class FarmLocation(BaseModel):
    farm_location: str = Field(min_length=3, max_length=200)
class Company(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    email: str = Field(min_length=3, max_length=254)
    address: str = Field(default="", max_length=250)
    state: str = Field(default="", max_length=100)
    services: list[str] = Field(default_factory=list, max_length=20)
    rating: float = Field(default=3.0, ge=0, le=5)
    review_count: int = Field(default=0, ge=0)
    review_summary: str = Field(default="", max_length=500)
    reliability_score: float = Field(default=3.0, ge=0, le=5)
    verified: bool = False

def geocode_location(location):
    query = urllib.parse.urlencode({"q": location, "format": "jsonv2", "addressdetails": 1, "limit": 1})
    request = urllib.request.Request(
        f"https://nominatim.openstreetmap.org/search?{query}",
        headers={"User-Agent": os.getenv("GEOCODING_USER_AGENT", "agri-supply-mvp/1.0")},
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            results = json.load(response)
    except Exception as exc:
        logger.warning("Geocoding request failed: %s", exc)
        raise HTTPException(503, "Location lookup is temporarily unavailable")
    if not results:
        raise HTTPException(422, "We could not find that farm location. Include a city and state.")
    result = results[0]
    address = result.get("address", {})
    state_code = address.get("ISO3166-2-lvl4", "").split("-")[-1].upper()
    if not state_code:
        state_code = address.get("state_code", "").upper()
    if not state_code or len(state_code) != 2:
        raise HTTPException(422, "Please provide a location in a US state.")
    return {
        "farm_location": location,
        "farm_display_name": result.get("display_name", location),
        "farm_latitude": float(result["lat"]),
        "farm_longitude": float(result["lon"]),
        "farm_state": state_code,
    }

# ---------- auth ----------
@app.post("/api/register")
def register(r: Register):
    username = r.username.strip()
    email = r.email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(422, "Enter a valid email address")
    location = geocode_location(r.farm_location.strip())
    if db.users.find_one({"username": username}): raise HTTPException(400, "Username taken")
    salt, token = secrets.token_hex(8), secrets.token_hex(24)
    db.users.insert_one({
        **r.model_dump(exclude={"password"}),
        "username": username,
        "email": email,
        **location,
        "salt": salt,
        "password": hash_pw(r.password, salt),
        "token": token,
    })
    return {"token": token}

@app.post("/api/login")
def login(r: Login):
    u = db.users.find_one({"username": r.username})
    if not u or not hmac.compare_digest(u["password"], hash_pw(r.password, u["salt"])): raise HTTPException(401, "Wrong username or password")
    token = secrets.token_hex(24)
    db.users.update_one({"_id": u["_id"]}, {"$set": {"token": token}})
    return {"token": token}

@app.get("/api/me")
def me(u=Depends(user)): return clean(u)

@app.put("/api/me/location")
def update_location(r: FarmLocation, u=Depends(user)):
    location = geocode_location(r.farm_location.strip())
    db.users.update_one({"_id": u["_id"]}, {"$set": location})
    return clean({**u, **location})

# ---------- workflow 1: find service -> companies ----------
@app.post("/api/workflows")
def start_workflow(b: Prompt, u=Depends(user)):
    if not u.get("farm_state"):
        raise HTTPException(409, "Add your farm location before finding suppliers")
    known = db.companies.distinct("services")
    if not known:
        raise HTTPException(503, "Company catalog is unavailable")
    info = ask_json(
        f'A farmer describes what they need. Pick the ONE best matching service from this list: {known}. '
        'Reply ONLY JSON: {"service": "<item from list>", "title": "<3-5 word title>"}',
        b.prompt, {"service": "", "title": b.prompt[:40]})
    service = info.get("service", "")
    if service not in known:
        terms = set(re.findall(r"[a-z0-9]+", b.prompt.lower()))
        service = max(known, key=lambda item: len(terms & set(item.lower().split()))) if known else ""
    companies = list(db.companies.find({"services": service, "state": u["farm_state"]}).sort(
        [("trust_score", -1), ("rating", -1), ("review_count", -1)]
    ))
    w = {"user_id": str(u["_id"]), "prompt": b.prompt, "title": info.get("title", b.prompt[:40]),
         "service": service, "chat": [], "created": now()}
    w["_id"] = db.workflows.insert_one(w).inserted_id
    return clean({"workflow": w, "companies": companies, "emails": []})

@app.get("/api/workflows")
def list_workflows(u=Depends(user)):
    return clean(list(db.workflows.find({"user_id": str(u["_id"])}).sort("created", -1)))

@app.get("/api/workflows/{wid}")
def get_workflow(wid: str, u=Depends(user)):
    w = own("workflows", wid, u)
    companies = list(db.companies.find({"services": w["service"], "state": u.get("farm_state")}).sort(
        [("trust_score", -1), ("rating", -1), ("review_count", -1)]
    ))
    emails = list(db.emails.find({"workflow_id": wid}))
    return clean({"workflow": w, "companies": companies, "emails": emails})

@app.post("/api/workflows/{wid}/drafts")
def make_drafts(wid: str, b: DraftReq, u=Depends(user)):
    w = own("workflows", wid, u)
    company_ids = list(dict.fromkeys(b.company_ids))
    out = []
    for cid in company_ids:
        c = db.companies.find_one({"_id": oid(cid)})
        if not c or w["service"] not in c.get("services", []):
            raise HTTPException(400, "One or more selected companies do not match this workflow")
        existing = db.emails.find_one({"workflow_id": wid, "company_id": cid})
        if existing:
            out.append(existing)
            continue
        fallback_subject = f"Request for a quote: {w['service'].title()}"
        fallback_body = (
            f"Hello {c['name']} team,\n\n"
            f"My name is {u['username']}, and I am reaching out on behalf of "
            f"{u.get('farm_name') or 'our farm'} in {u.get('farm_location') or 'our local area'}.\n\n"
            f"We are looking for help with {w['prompt']}. Could you please provide "
            "a written estimate and let us know your earliest availability? Please "
            "include what is covered, expected timelines, warranty or service terms, "
            "and any information you need from us before preparing a quote.\n\n"
            f"{b.details.strip()}\n\n"
            "Thank you for your time. We would appreciate a response when convenient "
            "and look forward to learning more about how you can help.\n\n"
            f"Best regards,\n{u['username']}\n{u.get('farm_name') or ''}"
        )
        d = ask_json(
            'You write warm, polished, professional procurement emails for a farmer. '
            'Write a detailed but concise quote request with at least four short paragraphs. '
            'Reply ONLY JSON: {"subject": "...", "body": "..."}',
            f"Farm: {u.get('farm_name')} in {u.get('farm_location')}. Farmer name: {u['username']}.\n"
            f"Company: {c['name']}. Need: {w['prompt']}\nExtra details: {b.details}",
            {"subject": fallback_subject, "body": fallback_body}, max_tokens=1800)
        e = {"workflow_id": wid, "user_id": str(u["_id"]), "company_id": cid, "company_name": c["name"],
             "to": c["email"], "subject": d["subject"], "body": d["body"], "status": "draft", "reply": ""}
        e["_id"] = db.emails.insert_one(e).inserted_id
        out.append(e)
    return clean(out)

@app.put("/api/emails/{eid}")
def edit_email(eid: str, b: EmailEdit, u=Depends(user)):
    e = own("emails", eid, u)
    if e.get("status", "").startswith("sent"):
        raise HTTPException(409, "Sent emails cannot be edited")
    db.emails.update_one({"_id": e["_id"]}, {"$set": b.model_dump()})
    return {"ok": True}

@app.post("/api/emails/{eid}/send")
def send_email(eid: str, u=Depends(user)):
    e = own("emails", eid, u)
    if not e.get("subject", "").strip() or not e.get("body", "").strip():
        raise HTTPException(400, "Email subject and body are required")
    if e.get("status", "").startswith("sent"):
        return {"status": e["status"]}
    host = os.getenv("SMTP_HOST")
    if host:
        smtp_user = os.getenv("SMTP_USER")
        smtp_pass = os.getenv("SMTP_PASS")
        if not smtp_user or not smtp_pass:
            raise HTTPException(503, "SMTP_HOST is set but SMTP_USER/SMTP_PASS are missing")
        m = EmailMessage()
        m["From"], m["To"], m["Reply-To"], m["Subject"] = smtp_user, e["to"], u["email"], e["subject"]
        m.set_content(e["body"])
        with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", 587)), timeout=20) as s:
            s.starttls(); s.login(smtp_user, smtp_pass); s.send_message(m)
        status = "sent"
    else:
        status = "sent (simulated)"
    db.emails.update_one({"_id": e["_id"]}, {"$set": {"status": status, "sent_at": now()}})
    return {"status": status}

@app.post("/api/emails/{eid}/reply")
def log_reply(eid: str, b: Reply, u=Depends(user)):
    own("emails", eid, u)
    db.emails.update_one({"_id": oid(eid)}, {"$set": {"reply": b.text}})
    return {"ok": True}

# ---------- workflow 2: report + chat over email history ----------
@app.post("/api/workflows/{wid}/chat")
def chat(wid: str, b: Prompt, u=Depends(user)):
    w = own("workflows", wid, u)
    emails = list(db.emails.find({"workflow_id": wid}))
    ctx = "\n\n".join(
        f"To: {e['company_name']} | Status: {e['status']}\nSubject: {e['subject']}\n{e['body']}\nCOMPANY REPLY: {e.get('reply') or 'none yet'}"
        for e in emails) or "No emails yet."
    system = (f"You are a procurement assistant for {u.get('farm_name')} ({u.get('farm_location')}). "
              f"Goal: {w['prompt']}. Use the email history below to answer questions and write comparison reports.\n\n{ctx}")
    msgs = w.get("chat", []) + [{"role": "user", "content": b.prompt}]
    try:
        answer = ask(system, msgs, 1500)
    except RuntimeError:
        reply_lines = [
            f"{e['company_name']}: {e.get('status', 'draft')}"
            + (f"; reply: {e['reply']}" if e.get("reply") else "; no reply logged")
            for e in emails
        ]
        answer = (
            "AI chat is not configured, so here is a status summary:\n"
            + ("\n".join(reply_lines) if reply_lines else "No email drafts exist yet.")
        )
    msgs.append({"role": "assistant", "content": answer})
    db.workflows.update_one({"_id": w["_id"]}, {"$set": {"chat": msgs}})
    return {"answer": answer}

# ---------- companies ----------
@app.post("/api/companies")
def add_company(c: Company, u=Depends(user)):
    company = c.model_dump()
    company["services"] = [service.strip().lower() for service in company["services"] if service.strip()]
    company["trust_score"] = trust_score(company)
    return {"id": str(db.companies.insert_one(company).inserted_id)}

SEED = [
    {
        "name": "GreenField Irrigation", "email": "sales@greenfield.example.com",
        "address": "Fresno, California", "state": "CA", "services": ["irrigation", "pumps"],
        "rating": 4.8, "review_count": 126, "reliability_score": 4.9, "verified": True,
        "review_summary": "Farmers consistently praise responsive scheduling, clear estimates, and dependable installation.",
    },
    {
        "name": "AquaFarm Systems", "email": "hello@aquafarm.example.com",
        "address": "Lubbock, Texas", "state": "TX", "services": ["irrigation"],
        "rating": 4.4, "review_count": 84, "reliability_score": 4.5, "verified": True,
        "review_summary": "Strong reviews for practical system recommendations and reliable follow-up service.",
    },
    {
        "name": "SeedCo", "email": "orders@seedco.example.com",
        "address": "Ames, Iowa", "state": "IA", "services": ["seeds"],
        "rating": 4.6, "review_count": 203, "reliability_score": 4.7, "verified": True,
        "review_summary": "Long-running supplier with consistent fulfillment and helpful product guidance.",
    },
    {
        "name": "HarvestGen Seeds", "email": "info@harvestgen.example.com",
        "address": "Lincoln, Nebraska", "state": "NE", "services": ["seeds", "fertilizer"],
        "rating": 4.2, "review_count": 61, "reliability_score": 4.1, "verified": False,
        "review_summary": "Positive feedback for product variety, with mixed reports about peak-season response times.",
    },
    {
        "name": "SoilBoost", "email": "team@soilboost.example.com",
        "address": "Manhattan, Kansas", "state": "KS", "services": ["fertilizer"],
        "rating": 4.7, "review_count": 97, "reliability_score": 4.6, "verified": True,
        "review_summary": "Praised for consistent product quality, transparent pricing, and agronomy support.",
    },
    {
        "name": "TractorWorks", "email": "service@tractorworks.example.com",
        "address": "Champaign, Illinois", "state": "IL", "services": ["equipment repair", "equipment rental"],
        "rating": 4.5, "review_count": 112, "reliability_score": 4.4, "verified": True,
        "review_summary": "Reliable repair scheduling and strong reviews from farms needing recurring maintenance.",
    },
    {
        "name": "FarmFix Mobile", "email": "book@farmfix.example.com",
        "address": "Columbus, Ohio", "state": "OH", "services": ["equipment repair"],
        "rating": 4.0, "review_count": 44, "reliability_score": 3.8, "verified": False,
        "review_summary": "Convenient mobile service with good workmanship reviews but less predictable availability.",
    },
    {
        "name": "CropGuard Pest Control", "email": "contact@cropguard.example.com",
        "address": "Yakima, Washington", "state": "WA", "services": ["pest control"],
        "rating": 4.4, "review_count": 73, "reliability_score": 4.3, "verified": True,
        "review_summary": "Well reviewed for clear treatment plans, communication, and documented follow-up visits.",
    },
]

def trust_score(company):
    rating = float(company.get("rating", 0))
    reliability = float(company.get("reliability_score", rating))
    review_count = int(company.get("review_count", 0))
    review_confidence = min(review_count / 100, 1)
    verified_bonus = 0.15 if company.get("verified") else 0
    return round(((rating * 0.45) + (reliability * 0.4) + (review_confidence * 5 * 0.15)) + verified_bonus, 2)

@app.on_event("startup")
def seed():
    db.users.create_index("username", unique=True)
    db.emails.create_index([("workflow_id", 1), ("company_id", 1)])
    db.companies.create_index([("state", 1), ("services", 1), ("trust_score", -1)])
    for company in SEED:
        company = {**company, "trust_score": trust_score(company), "demo_data": True}
        db.companies.update_one({"name": company["name"]}, {"$set": company}, upsert=True)

@app.get("/api/health")
def health():
    try:
        db.command("ping")
        return {"status": "ok", "database": "ok", "ai": "configured" if llm else "fallback"}
    except Exception as exc:
        logger.warning("Health check failed: %s", exc)
        raise HTTPException(503, "Database unavailable")

# ---------- frontend ----------
app.mount("/static", StaticFiles(directory=os.path.join(HERE, "static")), name="static")

@app.get("/")
def index(): return FileResponse(os.path.join(HERE, "static", "index.html"))
