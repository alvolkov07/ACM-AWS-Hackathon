"""Supplier search: find nearby businesses, cache them, enrich the best ones."""

import json
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from .ai import ask
from .config import ENRICH_CACHE, ENRICH_TOP, MAX_RESULTS, SEARCH_CACHE, logger
from .database import db
from .enrichment import enrich
from .geo import haversine_miles
from .serpapi import serp_places
from .trust import trust_label, trust_score

# Budget fit labels shown to the farmer
BUDGET_FIT_BEST = "Best value"
BUDGET_FIT_GOOD = "Good fit"
BUDGET_FIT_OVER = "May exceed budget"
BUDGET_FIT_UNKNOWN = "Price unknown"


def save_company(c):
    c["trust_score"] = trust_score(c)
    c["trust_label"] = trust_label(c["trust_score"])
    c["updated_at"] = datetime.now(timezone.utc)
    db.companies.update_one({"place_id": c["place_id"]}, {"$set": c}, upsert=True)
    return db.companies.find_one({"place_id": c["place_id"]})


def _budget_fit_label(score: int) -> str:
    """Convert a 1-3 AI budget score into a friendly label."""
    if score == 1:
        return BUDGET_FIT_BEST
    if score == 2:
        return BUDGET_FIT_GOOD
    if score == 3:
        return BUDGET_FIT_OVER
    return BUDGET_FIT_UNKNOWN


def score_companies_for_budget(companies, budget_label: str, service_query: str):
    """
    Ask the AI to rate each company's price fit against the farmer's budget.
    Returns companies with a `budget_fit` label and `budget_score` (1=best, 3=over).
    Falls back gracefully if AI is unavailable.
    """
    if not companies:
        return companies

    profiles = []
    for i, c in enumerate(companies):
        profiles.append(
            f"{i}: {c['name']} | rating={c.get('rating', '?')}/5 "
            f"({c.get('review_count', 0)} reviews) | "
            f"reviews: {c.get('review_summary', 'none')}"
        )

    prompt = (
        f"A low-income farmer needs: {service_query}\n"
        f"Their budget is {budget_label}.\n\n"
        "For each supplier below, rate how well they fit this budget:\n"
        "1 = Best value (likely affordable, good reviews for the price)\n"
        "2 = Good fit (probably within range)\n"
        "3 = May exceed budget (premium pricing signals in reviews)\n\n"
        "Suppliers:\n" + "\n".join(profiles) + "\n\n"
        "Reply ONLY with a JSON object mapping each index to its score, e.g. "
        '{"0": 1, "1": 2, "2": 3}'
    )

    try:
        response = ask(
            "You are a procurement assistant helping low-income farmers find affordable suppliers. "
            "Use review text and rating patterns to infer price tier. Never invent facts.",
            prompt,
            max_tokens=300,
            task="fast",
        )
        match = re.search(r"\{.*\}", response, re.S)
        scores = json.loads(match.group()) if match else {}
    except Exception as exc:
        logger.warning("Budget scoring failed, skipping: %s", exc)
        scores = {}

    for i, c in enumerate(companies):
        raw = scores.get(str(i))
        try:
            score = int(raw) if raw is not None else 0
        except (TypeError, ValueError):
            score = 0
        c["budget_score"] = score if score in (1, 2, 3) else 0
        c["budget_fit"] = _budget_fit_label(c["budget_score"])

    return companies


def search_companies(query, u, scope="local", budget_label=""):
    """Find real businesses based on scope, cache them, enrich the best ones.

    If budget_label is provided, companies are additionally scored and sorted
    by budget fit (best value first, within the same trust tier).
    """
    state = u["farm_state"]
    lat, lon = u["farm_latitude"], u["farm_longitude"]
    key = f"{query.lower()}|{scope}|{state}|{round(lat, 1)}|{round(lon, 1)}"
    cached = db.searches.find_one({"key": key})
    if cached and datetime.now(timezone.utc) - cached["at"] < SEARCH_CACHE:
        found = list(db.companies.find({"_id": {"$in": cached["company_ids"]}}))
        if found:
            if budget_label:
                found = score_companies_for_budget(found, budget_label, query)
                found.sort(key=lambda c: (c.get("budget_score") or 9, -c["trust_score"]))
            return found

    places = serp_places(query, lat, lon, state, with_ll=True, scope=scope)

    # Fallback widening logic per scope
    if scope == "local" and len(places) < 3:
        more = serp_places(
            f"{query} {u.get('farm_state_name', state)}", lat, lon, state,
            with_ll=False, scope="statewide"
        )
        seen = {p["place_id"] for p in places}
        places += [p for p in more if p["place_id"] not in seen]
    elif scope == "statewide" and len(places) < 3:
        more = serp_places(query, lat, lon, state, with_ll=False, scope="nationwide")
        seen = {p["place_id"] for p in places}
        places += [p for p in more if p["place_id"] not in seen]

    if not places:
        return []

    for p in places:
        p["distance_miles"] = haversine_miles(lat, lon, p["latitude"], p["longitude"])
        p["service_query"] = query
    places.sort(key=lambda p: trust_score(p), reverse=True)
    places = places[:MAX_RESULTS]

    # Reuse fresh enrichment from earlier searches, enrich the rest in parallel
    to_enrich = []
    for p in places:
        old = db.companies.find_one({"place_id": p["place_id"]})
        if (
            old
            and old.get("enriched_at")
            and datetime.now(timezone.utc) - old["enriched_at"] < ENRICH_CACHE
        ):
            for f in ("reviews", "email", "review_summary", "enriched_at"):
                p[f] = old.get(f, "")
        elif len(to_enrich) < ENRICH_TOP:
            to_enrich.append(p)
    with ThreadPoolExecutor(max_workers=5) as pool:
        list(pool.map(enrich, to_enrich))

    saved = [save_company(p) for p in places]

    if budget_label:
        # Score and sort: best value + highest trust first
        saved = score_companies_for_budget(saved, budget_label, query)
        saved.sort(key=lambda c: (c.get("budget_score") or 9, -c["trust_score"]))
    else:
        saved.sort(key=lambda c: (-c["trust_score"], c.get("distance_miles", 0)))

    db.searches.update_one(
        {"key": key},
        {
            "$set": {
                "key": key,
                "company_ids": [c["_id"] for c in saved],
                "at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )
    return saved
