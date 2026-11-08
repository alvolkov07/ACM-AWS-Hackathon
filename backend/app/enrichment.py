"""Supplier enrichment: reviews, contact email, AI review summary."""

import ipaddress
import re
import socket
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from fastapi import HTTPException

from .ai import ask
from .config import logger
from .serpapi import serp

JUNK_EMAIL = re.compile(
    r"(\.(png|jpe?g|gif|svg|webp)$|sentry|wixpress|example\.|domain\.com|your@|@2x)",
    re.I,
)
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
    if (
        not website
        or not website.startswith(("http://", "https://"))
        or not public_host(website)
    ):
        return ""
    base = website.rstrip("/")
    for url in (base, base + "/contact", base + "/contact-us"):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "Mozilla/5.0 agri-supply"}
            )
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
        data = serp(
            {
                "engine": "google_maps_reviews",
                "data_id": data_id,
                "sort_by": "qualityScore",
                "hl": "en",
            }
        )
    except HTTPException:
        return []
    out = []
    for r in data.get("reviews", []):
        text = (
            r.get("snippet") or r.get("extracted_snippet", {}).get("original") or ""
        ).strip()
        if not text:
            continue
        out.append(
            {
                "author": (r.get("user") or {}).get("name", "Google user"),
                "rating": r.get("rating"),
                "date": r.get("date", ""),
                "text": text[:400],
            }
        )
        if len(out) == 4:
            break
    return out


def summarize_reviews(c):
    fallback = (
        f"Rated {c['rating']}/5 from {c['review_count']} Google reviews."
        if c["review_count"]
        else "No Google reviews are available for this business yet."
    )
    if not c.get("reviews"):
        return fallback
    quotes = "\n".join(f"- ({r['rating']}/5) {r['text']}" for r in c["reviews"])
    try:
        return ask(
            "Summarize customer reviews of a business in 1-2 plain, neutral sentences for a farmer choosing a "
            "supplier. Use ONLY the information given. Mention both strengths and concerns if present.",
            f"{c['name']} - {c['rating']}/5 from {c['review_count']} reviews.\nSample reviews:\n{quotes}",
            max_tokens=250,
        ).strip()
    except Exception as exc:
        logger.warning("Review summary failed: %s", exc)
        return fallback


def enrich(c):
    c["reviews"] = fetch_reviews(c.get("data_id"))
    c["email"] = find_email(c.get("website", ""))
    c["review_summary"] = summarize_reviews(c)
    c["enriched_at"] = datetime.now(timezone.utc)
    return c
