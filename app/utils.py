"""Small shared helpers: timestamps, serialization, ID parsing, number parsing."""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import HTTPException

from .config import logger


def now():
    return datetime.now(timezone.utc).isoformat()


def clean(d):
    if isinstance(d, list):
        return [clean(x) for x in d]
    if isinstance(d, dict):
        return {
            k: clean(v)
            for k, v in d.items()
            if k not in ("password", "salt", "token", "token_hash")
        }
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


def object_ids(values):
    """Convert stored IDs without letting one corrupt value break a workflow."""
    ids = []
    for value in values or []:
        try:
            ids.append(ObjectId(value))
        except (TypeError, ValueError):
            logger.warning("Ignoring invalid stored ObjectId: %r", value)
    return ids


def number(value, default=0.0):
    try:
        if isinstance(value, str):
            value = value.replace(",", "").strip()
        return float(value)
    except (TypeError, ValueError):
        return default
