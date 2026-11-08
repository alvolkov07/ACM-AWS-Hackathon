"""Health check route."""
from fastapi import APIRouter, HTTPException

from .. import ai
from ..config import SERPAPI_KEY, logger
from ..database import db

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    try:
        db.command("ping")
        return {"status": "ok", "database": "ok", "ai": "configured" if ai.llm else "fallback",
                "search": "serpapi" if SERPAPI_KEY else "missing SERPAPI_KEY"}
    except Exception as exc:
        logger.warning("Health check failed: %s", exc)
        raise HTTPException(503, "Database unavailable")
