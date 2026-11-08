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

# Rough shipping cost estimate per mile (USD) — used to flag far suppliers.
# Based on typical LTL freight rates for agricultural inputs (~$0.05–$0.10/mi).
SHIPPING_COST_PER_MILE = 0.07


def save_company(c):
    c["trust_score"] = trust_score(c)
    c["trust_label"] = trust_label(c["trust_score"])
    c["updated_at"] = datetime.now(timezone.utc)
    db.companies.update_one({"place_id": c["place_id"]}, {"$set": c}, upsert=True)
    return db.companies.find_one({"place_id": c["place_id"]})


def _budget_fit_label(score: int) -> str:
    """Convert a 1-3 AI price score to a friendly label."""
    if score == 1:
        return BUDGET_FIT_BEST
    if score == 2:
        return BUDGET_FIT_GOOD
    if score == 3:
        return BUDGET_FIT_OVER
    return BUDGET_FIT_UNKNOWN


def _shipping_tier(distance_miles: float) -> tuple[str, float]:
    """
    Return (label, estimated_cost) based on distance.
    Cost is a rough freight estimate for low-income farmers to plan their budget.
    """
    if distance_miles <= 0:
        return ("Pickup available", 0.0)
    cost = round(distance_miles * SHIPPING_COST_PER_MILE, 2)
    if distance_miles <= 30:
        return (f"~${cost:.0f} est. shipping", cost)
    if distance_miles <= 100:
        return (f"~${cost:.0f} est. shipping", cost)
    if distance_miles <= 500:
        return (f"~${cost:.0f} est. shipping (long haul)", cost)
    return (f"~${cost:.0f} est. shipping (very far)", cost)


def score_companies_for_budget(companies, budget_label: str, service_query: str):
    """
    Score each company on three dimensions and produce a combined `value_rank`:

      1. price_score   — AI-inferred price tier from reviews (1=cheapest, 3=premium)
      2. satisfaction  — derived from trust_score / rating (higher = better)
      3. shipping_cost — estimated from distance_miles (lower = better)

    All three feed into a single `value_rank` (lower is better, 1 = top pick).
    Each company also gets:
      - budget_fit      : human label ("Best value", "Good fit", etc.)
      - shipping_label  : estimated shipping cost string
      - value_score     : 0–100 composite shown to the farmer (higher = better)
    """
    if not companies:
        return companies

    # --- Step 1: Ask AI to rate price tier from review signals ---
    profiles = []
    for i, c in enumerate(companies):
        dist = c.get("distance_miles")
        dist_str = f"{dist:.0f} mi away" if dist is not None else "distance unknown"
        profiles.append(
            f"{i}: {c['name']} | {dist_str} | "
            f"rating={c.get('rating', '?')}/5 ({c.get('review_count', 0)} reviews) | "
            f"reviews: {c.get('review_summary', 'none')}"
        )

    prompt = (
        f"A low-income farmer needs: {service_query}\n"
        f"Their budget is {budget_label}.\n\n"
        "For each supplier, infer their price tier from review text and rating patterns:\n"
        "1 = Budget-friendly / affordable (good value for the price)\n"
        "2 = Mid-range (probably within budget)\n"
        "3 = Premium / expensive (reviews mention high prices or luxury service)\n\n"
        "Suppliers:\n" + "\n".join(profiles) + "\n\n"
        "Reply ONLY with a JSON object mapping each index to its price tier score, e.g. "
        '{"0": 1, "1": 2, "2": 3}'
    )

    try:
        response = ask(
            "You are a procurement assistant helping low-income farmers find affordable suppliers. "
            "Use review text and rating patterns to infer price tier. "
            "If reviews mention 'affordable', 'fair price', 'cheap', or 'great value' score 1. "
            "If reviews mention 'expensive', 'pricey', 'premium', or 'high-end' score 3. "
            "Otherwise score 2. Never invent facts.",
            prompt,
            max_tokens=400,
            task="fast",
        )
        match = re.search(r"\{.*\}", response, re.S)
        price_scores = json.loads(match.group()) if match else {}
    except Exception as exc:
        logger.warning("Budget scoring failed, using defaults: %s", exc)
        price_scores = {}

    # --- Step 2: Compute composite value score for each company ---
    for i, c in enumerate(companies):
        # Price tier (1–3, lower = cheaper)
        raw = price_scores.get(str(i))
        try:
            price_score = int(raw) if raw is not None else 2
        except (TypeError, ValueError):
            price_score = 2
        price_score = price_score if price_score in (1, 2, 3) else 2

        # Customer satisfaction (0–5 from trust_score)
        satisfaction = float(c.get("trust_score") or c.get("rating") or 3.0)

        # Shipping cost estimate
        distance = float(c.get("distance_miles") or 0)
        shipping_label, shipping_cost = _shipping_tier(distance)

        # Normalise shipping cost into a 0–1 penalty (0 = free, 1 = very expensive)
        # Cap at $500 shipping so outliers don't dominate
        shipping_penalty = min(shipping_cost / 500.0, 1.0)

        # Composite value_score (0–100, higher = better pick for this farmer):
        #   40% price affordability  (price_score 1→100, 2→60, 3→20)
        #   40% customer satisfaction (scaled 0–5 → 0–100)
        #   20% shipping proximity   (lower penalty = higher score)
        price_component    = {1: 100, 2: 60, 3: 20}[price_score]
        sat_component      = (satisfaction / 5.0) * 100
        shipping_component = (1.0 - shipping_penalty) * 100

        value_score = round(
            price_component * 0.40
            + sat_component  * 0.40
            + shipping_component * 0.20
        )

        c["budget_score"]   = price_score
        c["budget_fit"]     = _budget_fit_label(price_score)
        c["shipping_label"] = shipping_label
        c["shipping_cost_est"] = round(shipping_cost, 2)
        c["value_score"]    = value_score  # 0–100 shown to farmer

    # --- Step 3: Rank by value_score descending ---
    companies.sort(key=lambda c: -c.get("value_score", 0))
    for rank, c in enumerate(companies, start=1):
        c["value_rank"] = rank  # 1 = top pick

    return companies


def search_companies(query, u, scope="local", budget_label=""):
    """Find real businesses based on scope, cache them, enrich the best ones.

    If budget_label is provided, companies are scored on price, satisfaction,
    and shipping cost, then ranked by a composite value_score.
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
        # Score on price + satisfaction + shipping, sort by value_score
        saved = score_companies_for_budget(saved, budget_label, query)
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
