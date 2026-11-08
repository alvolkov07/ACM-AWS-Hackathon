"""SerpAPI client and Google Maps place parsing."""

import json
import re
import urllib.parse
import urllib.request

from fastapi import HTTPException

from .config import SERPAPI_KEY, logger
from .utils import number

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


def serp_places(query, lat, lon, state, with_ll=True):
    params = {
        "engine": "google_maps",
        "q": query,
        "type": "search",
        "hl": "en",
        "gl": "us",
    }
    if with_ll:
        params["ll"] = f"@{lat},{lon},10z"
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
        if address_state(addr) != state:  # only businesses in the farmer's state
            continue
        out.append(
            {
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
            }
        )
    return out
