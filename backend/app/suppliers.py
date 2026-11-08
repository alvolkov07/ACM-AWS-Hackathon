"""Supplier search: find nearby businesses, cache them, enrich the best ones."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from .config import ENRICH_CACHE, ENRICH_TOP, MAX_RESULTS, SEARCH_CACHE
from .database import db
from .enrichment import enrich
from .geo import haversine_miles
from .serpapi import serp_places
from .trust import trust_label, trust_score


def save_company(c):
    c["trust_score"] = trust_score(c)
    c["trust_label"] = trust_label(c["trust_score"])
    c["updated_at"] = datetime.now(timezone.utc)
    db.companies.update_one({"place_id": c["place_id"]}, {"$set": c}, upsert=True)
    return db.companies.find_one({"place_id": c["place_id"]})


def search_companies(query, u, scope="local"):
    """Find real businesses based on scope, cache them, enrich the best ones."""
    state = u["farm_state"]
    lat, lon = u["farm_latitude"], u["farm_longitude"]
    key = f"{query.lower()}|{scope}|{state}|{round(lat, 1)}|{round(lon, 1)}"
    cached = db.searches.find_one({"key": key})
    if cached and datetime.now(timezone.utc) - cached["at"] < SEARCH_CACHE:
        found = list(db.companies.find({"_id": {"$in": cached["company_ids"]}}))
        if found:
            return found

    places = serp_places(query, lat, lon, state, with_ll=True, scope=scope)

    # Fallback widening logic per scope
    if scope == "local" and len(places) < 3:
        # Widen to statewide if local turns up too few results
        more = serp_places(
            f"{query} {u.get('farm_state_name', state)}", lat, lon, state,
            with_ll=False, scope="statewide"
        )
        seen = {p["place_id"] for p in places}
        places += [p for p in more if p["place_id"] not in seen]
    elif scope == "statewide" and len(places) < 3:
        # Widen to nationwide if statewide turns up too few results
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

    # reuse fresh enrichment from earlier searches, enrich the rest in parallel
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
