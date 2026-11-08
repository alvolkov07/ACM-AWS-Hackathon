"""Request bodies and input validation patterns."""

import re

from pydantic import BaseModel, Field

EMAIL_FORMAT = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


class Register(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    email: str = Field(min_length=3, max_length=254)
    farm_name: str = Field(default="", max_length=100)
    farm_location: str = Field(min_length=3, max_length=200)


class Login(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)


class SearchScope(str):
    """How wide to cast the supplier search.

    local       – within ~100 miles of the farm
    statewide   – anywhere in the same US state
    nationwide  – anywhere in the United States
    international – US + trusted allied countries (high-risk origins filtered automatically)
    """
    pass


VALID_SCOPES = {"local", "statewide", "nationwide", "international"}


class Prompt(BaseModel):
    prompt: str = Field(min_length=3, max_length=2000)
    search_scope: str = Field(
        default="local",
        description="local | statewide | nationwide | international",
    )

    @property
    def scope(self) -> str:
        s = self.search_scope.strip().lower()
        return s if s in VALID_SCOPES else "local"


class DraftReq(BaseModel):
    company_ids: list[str] = Field(min_length=1, max_length=20)
    details: str = Field(default="", max_length=2000)


class EmailEdit(BaseModel):
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=10000)
    to: str = Field(default="", max_length=254)


class Reply(BaseModel):
    text: str = Field(min_length=1, max_length=10000)


class FarmLocation(BaseModel):
    farm_location: str = Field(min_length=3, max_length=200)
