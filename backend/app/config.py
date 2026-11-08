"""Environment configuration, logging and model selection."""

import logging
import os
from datetime import timedelta

logger = logging.getLogger("agri_supply")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

SERPAPI_KEY = os.getenv("SERPAPI_KEY", "")
USE_BEDROCK = os.getenv("USE_BEDROCK") == "1"
PROVIDER = "bedrock" if USE_BEDROCK else "anthropic"

MODEL_IDS = {
    "haiku": {"anthropic": "claude-haiku-5-5"},
    "sonnet": {"anthropic": "claude-sonnet-5-5"},
    "opus": {"anthropic": "claude-opus-5-5"},
}
# Bedrock model ids vary by region/account: set CLAUDE_MODEL explicitly when USE_BEDROCK=1.
TIER_ENV = {
    "fast": ("CLAUDE_FAST_TIER", "haiku"),
    "smart": ("CLAUDE_SMART_TIER", "sonnet"),
}

SEARCH_CACHE = timedelta(hours=24)
ENRICH_CACHE = timedelta(days=30)
MAX_RESULTS = 8  # businesses shown per search
ENRICH_TOP = 5  # businesses that get reviews fetched (1 SerpAPI credit each)


def model_for(task):
    forced = os.getenv("CLAUDE_MODEL")
    if forced:
        return forced
    env, default = TIER_ENV[task]
    tier = os.getenv(env) or os.getenv("CLAUDE_TIER") or default
    tier = tier.strip().lower()
    model = MODEL_IDS.get(tier, MODEL_IDS[default]).get(PROVIDER)
    if not model:
        raise RuntimeError("Set CLAUDE_MODEL when USE_BEDROCK=1")
    return model
