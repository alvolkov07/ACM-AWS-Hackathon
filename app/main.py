
import hashlib
import hmac
import ipaddress
import json
import logging
import math
import os
import re
import secrets
import smtplib
import socket
import statistics
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
 
import anthropic
from bson import ObjectId
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, OperationFailure
 
logger = logging.getLogger("agri_supply")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
 
# ---------- configuration ----------
SERPAPI_KEY = os.getenv("SERPAPI_KEY", "")
USE_BEDROCK = os.getenv("USE_BEDROCK") == "1"
PROVIDER = "bedrock" if USE_BEDROCK else "anthropic"
 
MODEL_IDS = {
    "haiku": {"anthropic": "claude-haiku-5-5"},
    "sonnet": {"anthropic": "claude-sonnet-5-5"},
    "opus": {"anthropic": "claude-opus-5-5"},
}
# Bedrock model ids vary by region/account: set CLAUDE_MODEL explicitly when USE_BEDROCK=1.
TIER_ENV = {"fast": ("CLAUDE_FAST_TIER", "haiku"), "smart": ("CLAUDE_SMART_TIER", "sonnet")}
 
 
def model_for(task):
    forced = os.getenv("CLAUDE_MODEL")
    if forced:
        return forced
    env, default = TIER_ENV[task]
    tier = os.getenv(env) or os.getenv("CLAUDE_TIER") or default
    tier = tier.strip().lower()
    model = MODEL_IDS.get(tier, MODEL_IDS[default]).get(PROVIDER)
    if not model:
        raise RuntimeError("Set CLAUDE_MODEL when USE_BEDROCK=1")
    return model
 
 
db = MongoClient(os.getenv("MONGO_URL", "mongodb://localhost:27017"),
                 serverSelectionTimeoutMS=5000, tz_aware=True)["agrisupply"]
llm = None
try:
    if USE_BEDROCK:
        llm = anthropic.AnthropicBedrock(aws_region=os.getenv("AWS_REGION", "us-east-1"))
    elif os.getenv("ANTHROPIC_API_KEY"):
        llm = anthropic.Anthropic()
except Exception:
    logger.exception("AI client could not be initialized; rule-based fallbacks remain available")
 
app = FastAPI(title="Agri-Supply API", version="2.0.0")
HERE = os.path.dirname(__file__)
SEARCH_CACHE = timedelta(hours=24)
ENRICH_CACHE = timedelta(days=30)
MAX_RESULTS = 8   # businesses shown per search
ENRICH_TOP = 5    # businesses that get reviews fetched (1 SerpAPI credit each)
 
 
# ---------- helpers ----------
def now():
    return datetime.now(timezone.utc).isoformat()
 
 
def clean(d):
    if isinstance(d, list):
        return [clean(x) for x in d]
    if isinstance(d, dict):
        return {k: clean(v) for k, v in d.items() if k not in ("password", "salt", "token", "token_hash")}
    if isinstance(d, ObjectId):
        return str(d)
    if isinstance(d, datetime):
        return d.isoformat()
    return d
 
 
def oid(x):
    try:
        return ObjectId(x)
    except Exception:
        raise HTTPException(404, "Not found")
 
 
def ask(system, messages, max_tokens=1200, task="fast"):
    if llm is None:
        raise RuntimeError("AI provider is not configured")
    if isinstance(messages, str):
        messages = [{"role": "user", "content": messages}]
    r = llm.messages.create(model=model_for(task), max_tokens=max_tokens, system=system, messages=messages)
    if not r.content or not getattr(r.content[0], "text", None):
        raise RuntimeError("AI provider returned an empty response")
    return r.content[0].text
 
 
def ask_json(system, text, fallback, max_tokens=1200, task="fast"):
    try:
        response = ask(system, text, max_tokens, task)
        match = re.search(r"\{.*\}", response, re.S)
        if not match:
            raise ValueError("AI response did not contain JSON")
        value = json.loads(match.group())
        if not isinstance(value, dict):
            raise ValueError("AI response JSON was not an object")
        return value
    except Exception as exc:  # network/API errors must not break the workflow
        logger.warning("Using fallback response: %s", exc)
        return fallback
 
 
def hash_pw(pw, salt):
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 200_000).hex()
 
 
def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()
 
 
def user(authorization: str = Header("")):
    token = authorization.removeprefix("Bearer ").strip() if authorization else ""
    u = db.users.find_one({"token_hash": hash_token(token)}) if token else None
    if not u:
        raise HTTPException(401, "Not logged in")
    return u
 
 
def own(coll, id, u):
    doc = db[coll].find_one({"_id": oid(id), "user_id": str(u["_id"])})
    if not doc:
        raise HTTPException(404, "Not found")
    return doc


def object_ids(values):
    """Convert stored IDs without letting one corrupt value break a workflow."""
    ids = []
    for value in values or []:
        try:
            ids.append(ObjectId(value))
        except (TypeError, ValueError):
            logger.warning("Ignoring invalid stored ObjectId: %r", value)
    return ids
 
 
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
    to: str = Field(default="", max_length=254)
 
 
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
    query = urllib.parse.urlencode({
        "q": location, "format": "jsonv2", "addressdetails": 1, "limit": 1, "countrycodes": "us"})
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
    if len(state_code) != 2:
        state_code = address.get("state_code", "").upper()
    if len(state_code) != 2:
        raise HTTPException(422, "Please provide a location in a US state.")
    return {
        "farm_location": location,
        "farm_display_name": result.get("display_name", location),
        "farm_latitude": float(result["lat"]),
        "farm_longitude": float(result["lon"]),
        "farm_state": state_code,
        "farm_state_name": address.get("state", state_code),
    }
 
 
def haversine_miles(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = (math.sin((p2 - p1) / 2) ** 2
         + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2)
    return round(3958.8 * 2 * math.asin(math.sqrt(a)), 1)
 
 
# ---------- SerpAPI ----------
def serp(params):
    if not SERPAPI_KEY:
        raise HTTPException(503, "SERPAPI_KEY is not configured")
    url = "https://serpapi.com/search.json?" + urllib.parse.urlencode({**params, "api_key": SERPAPI_KEY})
    try:
        with urllib.request.urlopen(url, timeout=25) as response:
            data = json.load(response)
    except Exception as exc:
        logger.warning("SerpAPI request failed (%s): %s", params.get("engine"), exc)
        raise HTTPException(503, "Business search is temporarily unavailable")
    if data.get("error") and "hasn't returned any results" not in data["error"]:
        logger.warning("SerpAPI error: %s", data["error"])
        raise HTTPException(503, "Business search is temporarily unavailable")
    return data
 
 
STATE_ZIP = re.compile(r"\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\b")
US_STATE_CODES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID",
    "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS",
    "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK",
    "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
    "WI", "WY",
}
 
 
def address_state(address):
    m = STATE_ZIP.search(address or "")
    if m:
        return m.group(1)
    parts = re.findall(r"\b[A-Z]{2}\b", (address or "").upper())
    return next((part for part in parts if part in US_STATE_CODES), "")


def number(value, default=0.0):
    try:
        if isinstance(value, str):
            value = value.replace(",", "").strip()
        return float(value)
    except (TypeError, ValueError):
        return default
 
 
def serp_places(query, lat, lon, state, with_ll=True):
    params = {"engine": "google_maps", "q": query, "type": "search", "hl": "en", "gl": "us"}
    if with_ll:
        params["ll"] = f"@{lat},{lon},10z"
    data = serp(params)
    raw = data.get("local_results") or ([data["place_results"]] if data.get("place_results") else [])
    out = []
    for p in raw:
        gps = p.get("gps_coordinates") or {}
        place_id = p.get("place_id") or p.get("data_id")
        if not p.get("title") or not place_id or "latitude" not in gps or "longitude" not in gps:
            continue
        if p.get("permanently_closed") or p.get("temporarily_closed"):
            continue
        addr = p.get("address", "")
        if address_state(addr) != state:  # only businesses in the farmer's state
            continue
        out.append({
            "place_id": place_id,
            "data_id": p.get("data_id", ""),
            "name": p["title"],
            "address": addr,
            "state": state,
            "latitude": gps["latitude"],
            "longitude": gps["longitude"],
            "phone": p.get("phone", ""),
            "website": p.get("website", ""),
            "category": p.get("type", ""),
            "hours": p.get("operating_hours") or p.get("hours", ""),
            "rating": number(p.get("rating")),
            "review_count": int(number(p.get("reviews"))),
            "maps_url": f"https://www.google.com/maps/place/?q=place_id:{place_id}",
        })
    return out
 
 
# ---------- trust / reputation scoring ----------
def trust_score(c):
    """0-5 score from rating (Bayesian-adjusted), review volume, rating consistency, profile completeness."""
    rating = float(c.get("rating") or 0)
    n = int(c.get("review_count") or 0)
    adjusted = (rating * n + 3.8 * 30) / (n + 30) if n else 3.0 * 0.6  # small penalty for no reviews
    volume = min(math.log10(n + 1) / math.log10(501), 1) * 5  # ~500 reviews saturates
    sample = [r["rating"] for r in c.get("reviews", []) if r.get("rating")]
    consistency = max(0.0, 5 - statistics.pstdev(sample) * 1.25) if len(sample) >= 2 else adjusted
    profile = (2 if c.get("website") else 0) + (1.5 if c.get("phone") else 0) + (1.5 if c.get("hours") else 0)
    score = adjusted * 0.55 + volume * 0.20 + consistency * 0.10 + profile * 0.15
    return round(min(score, 5.0), 2)
 
 
def trust_label(score):
    return "Excellent" if score >= 4.3 else "Good" if score >= 3.8 else "Fair" if score >= 3.2 else "Limited data"
 
 
# ---------- enrichment: reviews, contact email, AI review summary ----------
JUNK_EMAIL = re.compile(r"(\.(png|jpe?g|gif|svg|webp)$|sentry|wixpress|example\.|domain\.com|your@|@2x)", re.I)
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
 
 
def public_host(url):
    try:
        host = urllib.parse.urlparse(url).hostname
        if not host:
            return False
        for info in socket.getaddrinfo(host, None):
            ip = ipaddress.ip_address(info[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return False
        return True
    except Exception:
        return False
 
 
def find_email(website):
    """Best-effort: look for a contact email on the business's own homepage/contact page."""
    if not website or not website.startswith(("http://", "https://")) or not public_host(website):
        return ""
    base = website.rstrip("/")
    for url in (base, base + "/contact", base + "/contact-us"):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 agri-supply"})
            with urllib.request.urlopen(req, timeout=6) as r:
                html = r.read(300_000).decode("utf-8", "ignore")
        except Exception:
            continue
        found = [e for e in EMAIL_RE.findall(html) if not JUNK_EMAIL.search(e)]
        if found:
            domain = urllib.parse.urlparse(website).hostname.removeprefix("www.")
            same = [e for e in found if e.lower().endswith(domain)]
            return (same or found)[0].lower()
    return ""
 
 
def fetch_reviews(data_id):
    if not data_id:
        return []
    try:
        data = serp({"engine": "google_maps_reviews", "data_id": data_id, "sort_by": "qualityScore", "hl": "en"})
    except HTTPException:
        return []
    out = []
    for r in data.get("reviews", []):
        text = (r.get("snippet") or r.get("extracted_snippet", {}).get("original") or "").strip()
        if not text:
            continue
        out.append({
            "author": (r.get("user") or {}).get("name", "Google user"),
            "rating": r.get("rating"),
            "date": r.get("date", ""),
            "text": text[:400],
        })
        if len(out) == 4:
            break
    return out
 
 
def summarize_reviews(c):
    fallback = (f"Rated {c['rating']}/5 from {c['review_count']} Google reviews." if c["review_count"]
                else "No Google reviews are available for this business yet.")
    if not c.get("reviews"):
        return fallback
    quotes = "\n".join(f"- ({r['rating']}/5) {r['text']}" for r in c["reviews"])
    try:
        return ask(
            "Summarize customer reviews of a business in 1-2 plain, neutral sentences for a farmer choosing a "
            "supplier. Use ONLY the information given. Mention both strengths and concerns if present.",
            f"{c['name']} - {c['rating']}/5 from {c['review_count']} reviews.\nSample reviews:\n{quotes}",
            max_tokens=250).strip()
    except Exception as exc:
        logger.warning("Review summary failed: %s", exc)
        return fallback
 
 
def enrich(c):
    c["reviews"] = fetch_reviews(c.get("data_id"))
    c["email"] = find_email(c.get("website", ""))
    c["review_summary"] = summarize_reviews(c)
    c["enriched_at"] = datetime.now(timezone.utc)
    return c
 
 
def save_company(c):
    c["trust_score"] = trust_score(c)
    c["trust_label"] = trust_label(c["trust_score"])
    c["updated_at"] = datetime.now(timezone.utc)
    db.companies.update_one({"place_id": c["place_id"]}, {"$set": c}, upsert=True)
    return db.companies.find_one({"place_id": c["place_id"]})
 
 
def search_companies(query, u):
    """Find real businesses near the farm (same state), cache them, enrich the best ones."""
    state = u["farm_state"]
    lat, lon = u["farm_latitude"], u["farm_longitude"]
    key = f"{query.lower()}|{state}|{round(lat, 1)}|{round(lon, 1)}"
    cached = db.searches.find_one({"key": key})
    if cached and datetime.now(timezone.utc) - cached["at"] < SEARCH_CACHE:
        found = list(db.companies.find({"_id": {"$in": cached["company_ids"]}}))
        if found:
            return found
 
    places = serp_places(query, lat, lon, state)
    if len(places) < 3:  # widen: search the whole state
        more = serp_places(f"{query} {u.get('farm_state_name', state)}", lat, lon, state, with_ll=False)
        seen = {p["place_id"] for p in places}
        places += [p for p in more if p["place_id"] not in seen]
    if not places:
        return []
 
    for p in places:
        p["distance_miles"] = haversine_miles(lat, lon, p["latitude"], p["longitude"])
        p["service_query"] = query
    places.sort(key=lambda p: trust_score(p), reverse=True)
    places = places[:MAX_RESULTS]
 
    # reuse fresh enrichment from earlier searches, enrich the rest in parallel
    to_enrich = []
    for p in places:
        old = db.companies.find_one({"place_id": p["place_id"]})
        if old and old.get("enriched_at") and datetime.now(timezone.utc) - old["enriched_at"] < ENRICH_CACHE:
            for f in ("reviews", "email", "review_summary", "enriched_at"):
                p[f] = old.get(f, "")
        elif len(to_enrich) < ENRICH_TOP:
            to_enrich.append(p)
    with ThreadPoolExecutor(max_workers=5) as pool:
        list(pool.map(enrich, to_enrich))
 
    saved = [save_company(p) for p in places]
    saved.sort(key=lambda c: (-c["trust_score"], c.get("distance_miles", 0)))
    db.searches.update_one({"key": key}, {"$set": {
        "key": key, "company_ids": [c["_id"] for c in saved], "at": datetime.now(timezone.utc)}}, upsert=True)
    return saved
 
 
# ---------- auth ----------
@app.post("/api/register")
def register(r: Register):
    r.username = r.username.strip()
    r.email = r.email.strip().lower()
    if not EMAIL_FORMAT.fullmatch(r.email):
        raise HTTPException(422, "Enter a valid email address")
    location = geocode_location(r.farm_location.strip())
    if db.users.find_one({"username": r.username}): raise HTTPException(400, "Username taken")
    salt, token = secrets.token_hex(8), secrets.token_hex(24)
    try:
        db.users.insert_one({
            **r.model_dump(exclude={"password"}),
            **location,
            "salt": salt,
            "password": hash_pw(r.password, salt),
            "token_hash": hash_token(token),
        })
    except DuplicateKeyError:
        raise HTTPException(400, "Username taken")
    return {"token": token}
 
 
@app.post("/api/login")
def login(r: Login):
    u = db.users.find_one({"username": r.username.strip()})
    if not u or not hmac.compare_digest(u["password"], hash_pw(r.password, u["salt"])):
        raise HTTPException(401, "Wrong username or password")
    token = secrets.token_hex(24)
    db.users.update_one({"_id": u["_id"]}, {"$set": {"token_hash": hash_token(token)}})
    return {"token": token}
 
 
@app.get("/api/me")
def me(u=Depends(user)):
    return clean(u)
 
 
@app.put("/api/me/location")
def update_location(r: FarmLocation, u=Depends(user)):
    location = geocode_location(r.farm_location.strip())
    db.users.update_one({"_id": u["_id"]}, {"$set": location})
    return clean({**u, **location})
 
 
# ---------- workflow 1: find service -> real nearby companies ----------
@app.post("/api/workflows")
def start_workflow(b: Prompt, u=Depends(user)):
    if not u.get("farm_state"):
        raise HTTPException(409, "Add your farm location before finding suppliers")
    info = ask_json(
        "A farmer describes what they need for their farm. Turn it into a short Google Maps search phrase for the "
        "kind of local business that would provide it (e.g. 'irrigation contractor', 'farm equipment repair', "
        "'agricultural seed supplier'). Reply ONLY JSON: "
        '{"query": "<2-5 word business search>", "service": "<1-3 word service label>", "title": "<3-5 word title>"}',
        b.prompt, {"query": b.prompt[:60], "service": b.prompt[:30], "title": b.prompt[:40]})
    query = str(info.get("query") or b.prompt[:60]).strip()[:80]
    service = str(info.get("service") or query).strip()[:60]
    companies = search_companies(query, u)
    w = {"user_id": str(u["_id"]), "prompt": b.prompt, "title": str(info.get("title") or b.prompt[:40])[:80],
         "service": service, "search_query": query, "company_ids": [str(c["_id"]) for c in companies],
         "chat": [], "created": now()}
    w["_id"] = db.workflows.insert_one(w).inserted_id
    return clean({"workflow": w, "companies": companies, "emails": []})
 
 
@app.get("/api/workflows")
def list_workflows(u=Depends(user)):
    return clean(list(db.workflows.find({"user_id": str(u["_id"])}).sort("created", -1)))
 
 
@app.get("/api/workflows/{wid}")
def get_workflow(wid: str, u=Depends(user)):
    w = own("workflows", wid, u)
    ids = object_ids(w.get("company_ids"))
    companies = list(db.companies.find({"_id": {"$in": ids}}).sort([("trust_score", -1)]))
    emails = list(db.emails.find({"workflow_id": wid}))
    return clean({"workflow": w, "companies": companies, "emails": emails})
 
 
@app.post("/api/workflows/{wid}/drafts")
def make_drafts(wid: str, b: DraftReq, u=Depends(user)):
    w = own("workflows", wid, u)
    allowed = set(w.get("company_ids", []))
    out = []
    for cid in dict.fromkeys(b.company_ids):
        if cid not in allowed:
            raise HTTPException(400, "One or more selected companies do not match this workflow")
        c = db.companies.find_one({"_id": oid(cid)})
        if not c:
            raise HTTPException(400, "One or more selected companies do not match this workflow")
        existing = db.emails.find_one({"workflow_id": wid, "company_id": cid})
        if existing:
            out.append(existing)
            continue
        farm = u.get("farm_name") or "our farm"
        place = u.get("farm_display_name") or u.get("farm_location") or "our local area"
        extra = f"{b.details.strip()}\n\n" if b.details.strip() else ""
        fallback = {
            "subject": f"Request for a Quote: {w['service'].title()} - {farm}",
            "body": (
                f"Dear {c['name']} team,\n\n"
                f"I hope this message finds you well. My name is {u['username']}, and I am writing on behalf of "
                f"{farm}, located in {place}. I came across your business and was impressed by your reputation "
                "in our area, so I wanted to reach out directly.\n\n"
                f"We are currently looking for help with the following: {w['prompt']}\n\n"
                f"{extra}"
                "Would you be able to provide a written estimate? It would be very helpful to know what the "
                "quote includes, your expected timeline, any warranty or service terms, and your earliest "
                "availability. If you need further details about our property or requirements, I would be glad "
                "to provide them or arrange a site visit.\n\n"
                "Thank you very much for your time and consideration. I understand you are likely busy, and I "
                "truly appreciate any information you can share. I look forward to hearing from you at your "
                "earliest convenience.\n\n"
                f"Warm regards,\n{u['username']}\n{u.get('farm_name') or ''}\n{u['email']}"
            ).strip(),
        }
        d = ask_json(
            "You write warm, courteous, professional procurement emails on behalf of a farmer. Write a quote "
            "request of 5 short paragraphs: (1) polite greeting and brief introduction of the farmer and farm, "
            "(2) a specific, genuine reason for contacting this company, (3) clear description of the need and any "
            "extra details provided, (4) the information requested (itemized estimate, timeline, warranty/terms, "
            "availability, site visit if needed), (5) a gracious thank-you and close. Never invent facts, prices, "
            "or details not provided. Sign with the farmer's name, farm and email. "
            'Reply ONLY JSON: {"subject": "...", "body": "..."}',
            f"Farmer: {u['username']} ({u['email']})\nFarm: {u.get('farm_name') or 'n/a'} in {place}\n"
            f"Company: {c['name']} ({c.get('address', '')}), rated {c.get('rating')}/5 on Google\n"
            f"Need: {w['prompt']}\nExtra details: {b.details or 'none'}",
            fallback, max_tokens=1800, task="smart")
        subject = str(d.get("subject") or fallback["subject"])[:200]
        body = str(d.get("body") or fallback["body"])
        e = {"workflow_id": wid, "user_id": str(u["_id"]), "company_id": cid, "company_name": c["name"],
             "to": c.get("email", ""), "subject": subject, "body": body, "status": "draft", "reply": ""}
        e["_id"] = db.emails.insert_one(e).inserted_id
        out.append(e)
    return clean(out)
 
 
@app.put("/api/emails/{eid}")
def edit_email(eid: str, b: EmailEdit, u=Depends(user)):
    e = own("emails", eid, u)
    if e.get("status", "").startswith("sent"):
        raise HTTPException(409, "Sent emails cannot be edited")
    update = {"subject": b.subject, "body": b.body}
    if b.to.strip():
        to = b.to.strip().lower()
        if not EMAIL_FORMAT.fullmatch(to):
            raise HTTPException(422, "Enter a valid recipient email address")
        update["to"] = to
    db.emails.update_one({"_id": e["_id"]}, {"$set": update})
    return {"ok": True}
 
 
@app.post("/api/emails/{eid}/send")
def send_email(eid: str, u=Depends(user)):
    e = own("emails", eid, u)
    if not e.get("subject", "").strip() or not e.get("body", "").strip():
        raise HTTPException(400, "Email subject and body are required")
    if not EMAIL_FORMAT.fullmatch(e.get("to", "")):
        raise HTTPException(400, "No recipient email found for this company. Add one before sending.")
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
            s.starttls()
            s.login(smtp_user, smtp_pass)
            s.send_message(m)
        status = "sent"
    else:
        status = "sent (simulated)"
    db.emails.update_one({"_id": e["_id"]}, {"$set": {"status": status, "sent_at": now()}})
    return {"status": status}
 
 
@app.post("/api/emails/{eid}/reply")
def log_reply(eid: str, b: Reply, u=Depends(user)):
    e = own("emails", eid, u)
    db.emails.update_one({"_id": e["_id"]}, {"$set": {"reply": b.text}})
    return {"ok": True}
 
 
# ---------- workflow 2: report + chat over email history ----------
@app.post("/api/workflows/{wid}/chat")
def chat(wid: str, b: Prompt, u=Depends(user)):
    w = own("workflows", wid, u)
    emails = list(db.emails.find({"workflow_id": wid}))
    companies = {str(c["_id"]): c for c in db.companies.find(
        {"_id": {"$in": object_ids(w.get("company_ids"))}})}
 
    def profile(e):
        c = companies.get(e["company_id"], {})
        return (f"Google rating {c.get('rating', '?')}/5 ({c.get('review_count', 0)} reviews), "
                f"trust score {c.get('trust_score', '?')}/5, {c.get('distance_miles', '?')} mi away. "
                f"Reviews: {c.get('review_summary', 'n/a')}")
 
    ctx = "\n\n".join(
        f"To: {e['company_name']} | Status: {e['status']}\nProfile: {profile(e)}\n"
        f"Subject: {e['subject']}\n{e['body']}\nCOMPANY REPLY: {e.get('reply') or 'none yet'}"
        for e in emails) or "No emails yet."
    system = (f"You are a procurement assistant for {u.get('farm_name')} ({u.get('farm_location')}). "
              f"Goal: {w['prompt']}. Use the email history below to answer questions and write comparison "
              f"reports. Only use facts present below.\n\n{ctx}")
    msgs = w.get("chat", []) + [{"role": "user", "content": b.prompt}]
    try:
        answer = ask(system, msgs, 1500, task="smart")
    except RuntimeError:
        lines = [f"{e['company_name']}: {e.get('status', 'draft')}"
                 + (f"; reply: {e['reply']}" if e.get("reply") else "; no reply logged") for e in emails]
        answer = ("AI chat is not configured, so here is a status summary:\n"
                  + ("\n".join(lines) if lines else "No email drafts exist yet."))
    msgs.append({"role": "assistant", "content": answer})
    db.workflows.update_one({"_id": w["_id"]}, {"$set": {"chat": msgs}})
    return {"answer": answer}
 
 
# ---------- startup / health ----------
@app.on_event("startup")
def startup():
    db.users.create_index("username", unique=True)
    db.users.create_index("token_hash")
    db.emails.create_index([("workflow_id", 1), ("company_id", 1)])
    try:
        db.companies.drop_index("place_id_1")
    except OperationFailure as exc:
        if exc.code != 27:
            raise
    db.companies.create_index(
        "place_id",
        unique=True,
        partialFilterExpression={"place_id": {"$type": "string"}},
    )
    db.companies.create_index([("state", 1), ("trust_score", -1)])
    db.searches.create_index("key", unique=True)
    if not SERPAPI_KEY:
        logger.warning("SERPAPI_KEY is not set; supplier search will return 503")
 
 
@app.get("/api/health")
def health():
    try:
        db.command("ping")
        return {"status": "ok", "database": "ok", "ai": "configured" if llm else "fallback",
                "search": "serpapi" if SERPAPI_KEY else "missing SERPAPI_KEY"}
    except Exception as exc:
        logger.warning("Health check failed: %s", exc)
        raise HTTPException(503, "Database unavailable")
 
 
# ---------- frontend ----------
app.mount("/static", StaticFiles(directory=os.path.join(HERE, "static")), name="static")
 
 
@app.get("/")
def index():
    return FileResponse(os.path.join(HERE, "static", "index.html"))