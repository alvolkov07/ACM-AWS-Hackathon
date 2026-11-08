"""MongoDB connection and index setup."""

import os

from pymongo import MongoClient
from pymongo.errors import OperationFailure

db = MongoClient(
    os.getenv("MONGO_URL", "mongodb://localhost:27017"),
    serverSelectionTimeoutMS=5000,
    tz_aware=True,
)["agrisupply"]


def ensure_indexes():
    db.users.create_index("username", unique=True)
    db.users.create_index("token_hash")
    db.emails.create_index([("workflow_id", 1), ("company_id", 1)])
    try:
        db.companies.drop_index("place_id_1")
    except OperationFailure as exc:
        if exc.code != 27:
            raise
    db.companies.create_index(
        "place_id",
        unique=True,
        partialFilterExpression={"place_id": {"$type": "string"}},
    )
    db.companies.create_index([("state", 1), ("trust_score", -1)])
    db.searches.create_index("key", unique=True)
