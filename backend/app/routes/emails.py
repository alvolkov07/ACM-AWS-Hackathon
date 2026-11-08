"""Email routes: edit drafts, send via SMTP, log supplier replies."""
import os
import smtplib
from email.message import EmailMessage

from fastapi import APIRouter, Depends, HTTPException

from ..database import db
from ..schemas import EMAIL_FORMAT, EmailEdit, Reply
from ..security import own, user
from ..utils import now

router = APIRouter(prefix="/api/emails")


@router.put("/{eid}")
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


@router.post("/{eid}/send")
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


@router.post("/{eid}/reply")
def log_reply(eid: str, b: Reply, u=Depends(user)):
    e = own("emails", eid, u)
    db.emails.update_one({"_id": e["_id"]}, {"$set": {"reply": b.text}})
    return {"ok": True}
