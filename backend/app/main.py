"""App entry point: builds the FastAPI app, wires routers, startup and frontend."""
import os

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import FRONTEND_DIR, SERPAPI_KEY, logger
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


# ---------- frontend (served from the separate frontend/ folder) ----------
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/")
def index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))
