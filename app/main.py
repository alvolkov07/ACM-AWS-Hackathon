import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import smtplib
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

MODEL = os.getenv("CLAUDE_MODEL", "claude-haiku-4-5")
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

def ask_json(system, text, fallback):
    try:
        response = ask(system, text, 800)
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
    farm_location: str = Field(default="", max_length=200)
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
class Company(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    email: str = Field(min_length=3, max_length=254)
    address: str = Field(default="", max_length=250)
    state: str = Field(default="", max_length=100)
    services: list[str] = Field(default_factory=list, max_length=20)
    rating: float = Field(default=3.0, ge=0, le=5)

# ---------- auth ----------
@app.post("/api/register")
def register(r: Register):
    r.username = r.username.strip()
    r.email = r.email.strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", r.email):
        raise HTTPException(422, "Enter a valid email address")
    if db.users.find_one({"username": r.username}): raise HTTPException(400, "Username taken")
    salt, token = secrets.token_hex(8), secrets.token_hex(24)
    db.users.insert_one({**r.model_dump(exclude={"password"}), "salt": salt, "password": hash_pw(r.password, salt), "token": token})
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

# ---------- workflow 1: find service -> companies ----------
@app.post("/api/workflows")
def start_workflow(b: Prompt, u=Depends(user)):
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
    companies = list(db.companies.find({"services": service}).sort("rating", -1))
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
    companies = list(db.companies.find({"services": w["service"]}).sort("rating", -1))
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
        d = ask_json(
            'You write short, polite business emails on behalf of a farmer asking for a quote. '
            'Reply ONLY JSON: {"subject": "...", "body": "..."}',
            f"Farm: {u.get('farm_name')} in {u.get('farm_location')}. Farmer name: {u['username']}.\n"
            f"Company: {c['name']}. Need: {w['prompt']}\nExtra details: {b.details}",
            {"subject": f"Quote request: {w['service']}", "body": w["prompt"]})
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
    return {"id": str(db.companies.insert_one(company).inserted_id)}

SEED = [
    ("GreenField Irrigation", "sales@greenfield.example.com", "12 Main St", "CA", ["irrigation", "pumps"], 4.7),
    ("AquaFarm Systems", "hello@aquafarm.example.com", "88 River Rd", "TX", ["irrigation"], 4.2),
    ("SeedCo", "orders@seedco.example.com", "5 Plow Ln", "IA", ["seeds"], 4.5),
    ("HarvestGen Seeds", "info@harvestgen.example.com", "301 Barn Ave", "NE", ["seeds", "fertilizer"], 4.0),
    ("SoilBoost", "team@soilboost.example.com", "77 Loam St", "KS", ["fertilizer"], 4.6),
    ("TractorWorks", "service@tractorworks.example.com", "9 Diesel Dr", "IL", ["equipment repair", "equipment rental"], 4.4),
    ("FarmFix Mobile", "book@farmfix.example.com", "45 Wrench Way", "OH", ["equipment repair"], 3.9),
    ("CropGuard Pest Control", "contact@cropguard.example.com", "2 Shield Rd", "WA", ["pest control"], 4.3),
]

@app.on_event("startup")
def seed():
    db.users.create_index("username", unique=True)
    db.emails.create_index([("workflow_id", 1), ("company_id", 1)])
    if db.companies.count_documents({}) == 0:
        db.companies.insert_many([dict(zip(["name", "email", "address", "state", "services", "rating"], s)) for s in SEED])

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
