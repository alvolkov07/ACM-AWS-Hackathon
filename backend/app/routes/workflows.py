"""Workflow routes: find suppliers, draft quote emails, chat over email history."""
from fastapi import APIRouter, Depends, HTTPException

from ..ai import ask, ask_json
from ..database import db
from ..schemas import DraftReq, Prompt
from ..security import own, user
from ..suppliers import search_companies
from ..utils import clean, now, object_ids, oid

router = APIRouter(prefix="/api/workflows")


# ---------- workflow 1: find service -> real nearby companies ----------
@router.post("")
def start_workflow(b: Prompt, u=Depends(user)):
    if not u.get("farm_state"):
        raise HTTPException(409, "Add your farm location before finding suppliers")
    scope = b.scope
    budget_label = b.budget_label  # e.g. "$500–$1,500" or "" if not set

    budget_hint = f" The farmer's budget is {budget_label}." if budget_label else ""
    info = ask_json(
        "A farmer describes what they need for their farm. Turn it into a short Google Maps search phrase for the "
        "kind of local business that would provide it (e.g. 'irrigation contractor', 'farm equipment repair', "
        "'agricultural seed supplier'). Reply ONLY JSON: "
        '{"query": "<2-5 word business search>", "service": "<1-3 word service label>", "title": "<3-5 word title>"}',
        b.prompt + budget_hint,
        {"query": b.prompt[:60], "service": b.prompt[:30], "title": b.prompt[:40]})
    query = str(info.get("query") or b.prompt[:60]).strip()[:80]
    service = str(info.get("service") or query).strip()[:60]
    companies = search_companies(query, u, scope=scope, budget_label=budget_label)
    w = {
        "user_id": str(u["_id"]),
        "prompt": b.prompt,
        "title": str(info.get("title") or b.prompt[:40])[:80],
        "service": service,
        "search_query": query,
        "search_scope": scope,
        "budget_min": b.budget_min,
        "budget_max": b.budget_max,
        "budget_label": budget_label,
        "company_ids": [str(c["_id"]) for c in companies],
        "chat": [],
        "created": now(),
    }
    w["_id"] = db.workflows.insert_one(w).inserted_id
    return clean({"workflow": w, "companies": companies, "emails": []})


@router.get("")
def list_workflows(u=Depends(user)):
    return clean(list(db.workflows.find({"user_id": str(u["_id"])}).sort("created", -1)))


@router.get("/{wid}")
def get_workflow(wid: str, u=Depends(user)):
    w = own("workflows", wid, u)
    ids = object_ids(w.get("company_ids"))
    companies = list(db.companies.find({"_id": {"$in": ids}}).sort([("trust_score", -1)]))
    emails = list(db.emails.find({"workflow_id": wid}))
    return clean({"workflow": w, "companies": companies, "emails": emails})


@router.post("/{wid}/drafts")
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
        budget_label = w.get("budget_label", "")
        budget_line = (
            f"Our budget for this project is {budget_label}. We are a small family farm "
            f"and are looking for fair, transparent pricing within this range.\n\n"
            if budget_label else ""
        )
        fallback = {
            "subject": f"Request for a Quote: {w['service'].title()} - {farm}",
            "body": (
                f"Dear {c['name']} team,\n\n"
                f"I hope this message finds you well. My name is {u['username']}, and I am writing on behalf of "
                f"{farm}, located in {place}. I came across your business and was impressed by your reputation "
                "in our area, so I wanted to reach out directly.\n\n"
                f"We are currently looking for help with the following: {w['prompt']}\n\n"
                f"{budget_line}"
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
            "You write warm, courteous, professional procurement emails on behalf of a small low-income farmer. "
            "Write a quote request of 5 short paragraphs: (1) polite greeting and brief introduction of the "
            "farmer and farm, (2) a specific, genuine reason for contacting this company, (3) clear description "
            "of the need and any extra details provided, (4) the information requested — itemized estimate, "
            "timeline, warranty/terms, availability, site visit if needed"
            + (f", and whether services are available within a {budget_label} budget" if budget_label else "")
            + ", (5) a gracious thank-you and close. Never invent facts, prices, or details not provided. "
            "Sign with the farmer's name, farm and email. "
            'Reply ONLY JSON: {"subject": "...", "body": "..."}',
            f"Farmer: {u['username']} ({u['email']})\nFarm: {u.get('farm_name') or 'n/a'} in {place}\n"
            f"Company: {c['name']} ({c.get('address', '')}), rated {c.get('rating')}/5 on Google\n"
            f"Need: {w['prompt']}\n"
            + (f"Budget: {budget_label}\n" if budget_label else "")
            + f"Extra details: {b.details or 'none'}",
            fallback, max_tokens=1800, task="smart")
        subject = str(d.get("subject") or fallback["subject"])[:200]
        body = str(d.get("body") or fallback["body"])
        e = {"workflow_id": wid, "user_id": str(u["_id"]), "company_id": cid, "company_name": c["name"],
             "to": c.get("email", ""), "subject": subject, "body": body, "status": "draft", "reply": ""}
        e["_id"] = db.emails.insert_one(e).inserted_id
        out.append(e)
    return clean(out)


# ---------- workflow 2: report + chat over email history ----------
@router.post("/{wid}/chat")
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
