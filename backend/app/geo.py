"""Geocoding (address -> coordinates + state) and distance math."""

import json
import math
import os
import urllib.parse
import urllib.request

from fastapi import HTTPException

from .config import logger


def geocode_location(location):
    query = urllib.parse.urlencode(
        {
            "q": location,
            "format": "jsonv2",
            "addressdetails": 1,
            "limit": 1,
            "countrycodes": "us",
        }
    )
    request = urllib.request.Request(
        f"https://nominatim.openstreetmap.org/search?{query}",
        headers={
            "User-Agent": os.getenv("GEOCODING_USER_AGENT", "agri-supply-mvp/1.0")
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            results = json.load(response)
    except Exception as exc:
        logger.warning("Geocoding request failed: %s", exc)
        raise HTTPException(503, "Location lookup is temporarily unavailable")
    if not results:
        raise HTTPException(
            422, "We could not find that farm location. Include a city and state."
        )
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
    a = (
        math.sin((p2 - p1) / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    )
    return round(3958.8 * 2 * math.asin(math.sqrt(a)), 1)
