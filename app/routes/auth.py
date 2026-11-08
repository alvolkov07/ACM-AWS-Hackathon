"""Account routes: register, login, profile and farm location."""
import hmac
import secrets

from fastapi import APIRouter, Depends, HTTPException
from pymongo.errors import DuplicateKeyError

from ..database import db
from ..geo import geocode_location
from ..schemas import EMAIL_FORMAT, FarmLocation, Login, Register
from ..security import hash_pw, hash_token, user
from ..utils import clean

router = APIRouter(prefix="/api")


@router.post("/register")
def register(r: Register):
    r.username = r.username.strip()
    r.email = r.email.strip().lower()
    if not EMAIL_FORMAT.fullmatch(r.email):
        raise HTTPException(422, "Enter a valid email address")
    location = geocode_location(r.farm_location.strip())
    if db.users.find_one({"username": r.username}):
        raise HTTPException(400, "Username taken")
    salt, token = secrets.token_hex(8), secrets.token_hex(24)
    try:
        db.users.insert_one({
            **r.model_dump(exclude={"password"}),
            **location,
            "salt": salt,
            "password": hash_pw(r.password, salt),
            "token_hash": hash_token(token),
        })
    except DuplicateKeyError:
        raise HTTPException(400, "Username taken")
    return {"token": token}


@router.post("/login")
def login(r: Login):
    u = db.users.find_one({"username": r.username.strip()})
    if not u or not hmac.compare_digest(u["password"], hash_pw(r.password, u["salt"])):
        raise HTTPException(401, "Wrong username or password")
    token = secrets.token_hex(24)
    db.users.update_one({"_id": u["_id"]}, {"$set": {"token_hash": hash_token(token)}})
    return {"token": token}


@router.get("/me")
def me(u=Depends(user)):
    return clean(u)


@router.put("/me/location")
def update_location(r: FarmLocation, u=Depends(user)):
    location = geocode_location(r.farm_location.strip())
    db.users.update_one({"_id": u["_id"]}, {"$set": location})
    return clean({**u, **location})
