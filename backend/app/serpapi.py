"""SerpAPI client and Google Maps place parsing."""

import json
import re
import urllib.parse
import urllib.request

from fastapi import HTTPException

from .config import SERPAPI_KEY, logger
from .utils import number

# Countries whose suppliers are silently excluded from results regardless of
# search scope.  The customer never sees this list — they just receive results
# from trusted origins only.  Criteria: US government export-control / sanctions
# designations (OFAC, BIS Entity List) and supply-chain security advisories.
BLOCKED_COUNTRIES = {
    # Active OFAC comprehensive sanctions
    "Russia", "RU",
    "China", "CN",          # BIS Entity List / ITAR concerns at scale
    "Iran", "IR",
    "North Korea", "KP",
    "Syria", "SY",
    "Cuba", "CU",
    "Venezuela", "VE",
    "Belarus", "BY",
    # Additional high-risk supply-chain origins per US/EU advisories
    "Myanmar", "MM",
    "Nicaragua", "NI",
    "Sudan", "SD",
    "South Sudan", "SS",
    "Somalia", "SO",
    "Libya", "LY",
    "Yemen", "YE",
    "Mali", "ML",
    "Eritrea", "ER",
    "Zimbabwe", "ZW",
    "Haiti", "HT",
}


def _is_blocked_country(address: str) -> bool:
    """Return True if the address string contains a blocked country name or code."""
    if not address:
        return False
    upper = address.upper()
    for name in BLOCKED_COUNTRIES:
        # Match whole words only to avoid e.g. "IR" inside "Irving, TX"
        if re.search(r"\b" + re.escape(name.upper()) + r"\b", upper):
            return True
    return False

STATE_ZIP = re.compile(r"\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\b")
US_STATE_CODES = {
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
}


def serp(params):
    if not SERPAPI_KEY:
        raise HTTPException(503, "SERPAPI_KEY is not configured")
    url = "https://serpapi.com/search.json?" + urllib.parse.urlencode(
        {**params, "api_key": SERPAPI_KEY}
    )
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


def address_state(address):
    m = STATE_ZIP.search(address or "")
    if m:
        return m.group(1)
    parts = re.findall(r"\b[A-Z]{2}\b", (address or "").upper())
    return next((part for part in parts if part in US_STATE_CODES), "")


def serp_places(query, lat, lon, state, with_ll=True, scope="local"):
    """Fetch Google Maps places via SerpAPI.

    scope values:
      local         – pin set to farm location, state filter enforced (default)
      statewide     – no pin, state filter enforced
      nationwide    – no pin, no state filter (US only via gl=us)
      international – no pin, no state filter, global search with blocked-country filter
    """
    params = {
        "engine": "google_maps",
        "q": query,
        "type": "search",
        "hl": "en",
    }

    if scope == "international":
        # Global search — no country restriction in params; we filter post-fetch
        params["gl"] = "us"  # keep results in English/USD context
    else:
        params["gl"] = "us"

    # Use farm coordinates as the map center for local searches
    if with_ll and scope == "local":
        params["ll"] = f"@{lat},{lon},10z"
    elif scope == "statewide" and with_ll:
        # Zoom out further so the whole state is visible
        params["ll"] = f"@{lat},{lon},7z"

    data = serp(params)
    raw = data.get("local_results") or (
        [data["place_results"]] if data.get("place_results") else []
    )
    out = []
    for p in raw:
        gps = p.get("gps_coordinates") or {}
        place_id = p.get("place_id") or p.get("data_id")
        if (
            not p.get("title")
            or not place_id
            or "latitude" not in gps
            or "longitude" not in gps
        ):
            continue
        if p.get("permanently_closed") or p.get("temporarily_closed"):
            continue
        addr = p.get("address", "")

        # Always silently filter blocked countries regardless of scope
        if _is_blocked_country(addr):
            logger.debug("Filtered supplier from blocked country: %s (%s)", p["title"], addr)
            continue

        # State-level filter for local and statewide scopes
        if scope in ("local", "statewide") and address_state(addr) != state:
            continue

        out.append(
            {
                "place_id": place_id,
                "data_id": p.get("data_id", ""),
                "name": p["title"],
                "address": addr,
                "state": address_state(addr) or state,
                "latitude": gps["latitude"],
                "longitude": gps["longitude"],
                "phone": p.get("phone", ""),
                "website": p.get("website", ""),
                "category": p.get("type", ""),
                "hours": p.get("operating_hours") or p.get("hours", ""),
                "rating": number(p.get("rating")),
                "review_count": int(number(p.get("reviews"))),
                "maps_url": f"https://www.google.com/maps/place/?q=place_id:{place_id}",
                "search_scope": scope,
            }
        )
    return out
