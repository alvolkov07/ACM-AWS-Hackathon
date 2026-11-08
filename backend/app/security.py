"""Password/token hashing and request authentication dependencies."""

import hashlib

from fastapi import Header, HTTPException

from .database import db
from .utils import oid


def hash_pw(pw, salt):
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), 200_000).hex()


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def user(authorization: str = Header("")):
    token = authorization.removeprefix("Bearer ").strip() if authorization else ""
    u = db.users.find_one({"token_hash": hash_token(token)}) if token else None
    if not u:
        raise HTTPException(401, "Not logged in")
    return u


def own(coll, id, u):
    doc = db[coll].find_one({"_id": oid(id), "user_id": str(u["_id"])})
    if not doc:
        raise HTTPException(404, "Not found")
    return doc
