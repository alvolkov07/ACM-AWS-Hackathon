"""App entry point: builds the FastAPI app, wires routers and startup.

The API only serves /api routes. The web front-end is a separate Next.js app
(frontend/) that forwards /api requests here.
"""
from fastapi import FastAPI

from .config import SERPAPI_KEY, logger
from .database import ensure_indexes
from .routes import auth, emails, health, workflows

app = FastAPI(title="Agri-Supply API", version="2.0.0")

app.include_router(auth.router)
app.include_router(workflows.router)
app.include_router(emails.router)
app.include_router(health.router)


@app.on_event("startup")
def startup():
    ensure_indexes()
    if not SERPAPI_KEY:
        logger.warning("SERPAPI_KEY is not set; supplier search will return 503")
