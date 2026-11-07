import os, json, re, hashlib, secrets, smtplib
from email.message import EmailMessage
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from pymongo import MongoClient
from bson import ObjectId
import anthropic

MODEL = os.getenv("CLAUDE_MODEL", "claude-haiku-4-5")
db = MongoClient(os.getenv("MONGO_URL", "mongodb://localhost:27017"))["agrisupply"]
llm = (anthropic.AnthropicBedrock(aws_region=os.getenv("AWS_REGION", "us-east-1"))
       if os.getenv("USE_BEDROCK") == "1" else anthropic.Anthropic())

app = FastAPI()
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
    if isinstance(messages, str): messages = [{"role": "user", "content": messages}]
    r = llm.messages.create(model=MODEL, max_tokens=max_tokens, system=system, messages=messages)
    return r.content[0].text

def ask_json(system, text, fallback):
    try:
        return json.loads(re.search(r"\{.*\}", ask(system, text, 800), re.S).group())
    except Exception:
        return fallback

def hash_pw(pw, salt): return hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 100_000).hex()

def user(authorization: str = Header("")):
    u = db.users.find_one({"token": authorization.replace("Bearer ", "")}) if authorization else None
    if not u: raise HTTPException(401, "Not logged in")
    return u

def own(coll, id, u):
    doc = db[coll].find_one({"_id": oid(id), "user_id": str(u["_id"])})
    if not doc: raise HTTPException(404, "Not found")
    return doc

# ---------- models ----------
class Register(BaseModel):
    username: str; password: str; email: str; farm_name: str = ""; farm_location: str = ""
class Login(BaseModel):
    username: str; password: str
class Prompt(BaseModel):
    prompt: str
class DraftReq(BaseModel):
    company_ids: list[str]; details: str = ""
class EmailEdit(BaseModel):
    subject: str; body: str
class Reply(BaseModel):
    text: str
class Company(BaseModel):
    name: str; email: str; address: str = ""; state: str = ""; services: list[str] = []; rating: float = 3.0

# ---------- auth ----------
@app.post("/api/register")
def register(r: Register):
    if db.users.find_one({"username": r.username}): raise HTTPException(400, "Username taken")
    salt, token = secrets.token_hex(8), secrets.token_hex(24)
    db.users.insert_one({**r.dict(exclude={"password"}), "salt": salt, "password": hash_pw(r.password, salt), "token": token})
    return {"token": token}

@app.post("/api/login")
def login(r: Login):
    u = db.users.find_one({"username": r.username})
    if not u or u["password"] != hash_pw(r.password, u["salt"]): raise HTTPException(401, "Wrong username or password")
    token = secrets.token_hex(24)
    db.users.update_one({"_id": u["_id"]}, {"$set": {"token": token}})
    return {"token": token}

@app.get("/api/me")
def me(u=Depends(user)): return clean(u)

# ---------- workflow 1: find service -> companies ----------
@app.post("/api/workflows")
def start_workflow(b: Prompt, u=Depends(user)):
    known = db.companies.distinct("services")
    info = ask_json(
        f'A farmer describes what they need. Pick the ONE best matching service from this list: {known}. '
        'Reply ONLY JSON: {"service": "<item from list>", "title": "<3-5 word title>"}',
        b.prompt, {"service": "", "title": b.prompt[:40]})
    companies = list(db.companies.find({"services": info.get("service", "")}).sort("rating", -1))
    w = {"user_id": str(u["_id"]), "prompt": b.prompt, "title": info.get("title", b.prompt[:40]),
         "service": info.get("service", ""), "chat": [], "created": now()}
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
    out = []
    for cid in b.company_ids:
        c = db.companies.find_one({"_id": oid(cid)})
        if not c: continue
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
    own("emails", eid, u)
    db.emails.update_one({"_id": oid(eid)}, {"$set": b.dict()})
    return {"ok": True}

@app.post("/api/emails/{eid}/send")
def send_email(eid: str, u=Depends(user)):
    e = own("emails", eid, u)
    host = os.getenv("SMTP_HOST")
    if host:
        m = EmailMessage()
        m["From"], m["To"], m["Reply-To"], m["Subject"] = os.getenv("SMTP_USER"), e["to"], u["email"], e["subject"]
        m.set_content(e["body"])
        with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", 587))) as s:
            s.starttls(); s.login(os.getenv("SMTP_USER"), os.getenv("SMTP_PASS")); s.send_message(m)
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
    answer = ask(system, msgs, 1500)
    msgs.append({"role": "assistant", "content": answer})
    db.workflows.update_one({"_id": w["_id"]}, {"$set": {"chat": msgs}})
    return {"answer": answer}

# ---------- companies ----------
@app.post("/api/companies")
def add_company(c: Company, u=Depends(user)):
    return {"id": str(db.companies.insert_one(c.dict()).inserted_id)}

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
    if db.companies.count_documents({}) == 0:
        db.companies.insert_many([dict(zip(["name", "email", "address", "state", "services", "rating"], s)) for s in SEED])

# ---------- frontend ----------
app.mount("/static", StaticFiles(directory=os.path.join(HERE, "static")), name="static")

@app.get("/")
def index(): return FileResponse(os.path.join(HERE, "static", "index.html"))
