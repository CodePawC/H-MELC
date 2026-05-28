"""JWT 签发与解析（HS256）。"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

import jwt

from app.core.config import get_settings


def create_access_token(*, subject: UUID, username: str, roles: list[str]) -> tuple[str, int]:
    """返回 (token, expires_in_seconds)。"""
    s = get_settings()
    now = datetime.now(tz=UTC)
    exp = now + timedelta(minutes=s.jwt_access_token_expire_minutes)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "username": username,
        "roles": roles,
        "iat": int(now.timestamp()),
        "exp": exp,
    }
    token = jwt.encode(payload, s.jwt_secret_key, algorithm=s.jwt_algorithm)
    ttl = int((exp - now).total_seconds())
    return token, ttl


def decode_token(token: str) -> dict[str, Any]:
    s = get_settings()
    return jwt.decode(token, s.jwt_secret_key, algorithms=[s.jwt_algorithm])
