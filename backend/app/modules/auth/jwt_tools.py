"""JWT 签发与解析（HS256）。支持 standalone 和 unified 双模式。"""

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
    """解码 JWT，返回原始 payload。"""
    s = get_settings()
    return jwt.decode(token, s.jwt_secret_key, algorithms=[s.jwt_algorithm])


def extract_roles_from_payload(payload: dict[str, Any]) -> list[str]:
    """从 JWT payload 提取角色列表。

    standalone 模式：payload["roles"] = ["SYS_ADMIN", ...]
    unified 模式：payload["systems"]["H-MELC"]["roles"] = ["SYS_ADMIN", ...]
    """
    # unified 模式
    systems = payload.get("systems")
    if isinstance(systems, dict):
        melc = systems.get("H-MELC")
        if isinstance(melc, dict):
            roles = melc.get("roles", [])
            if roles:
                return roles

    # standalone 模式
    raw = payload.get("roles", [])
    return list(raw) if isinstance(raw, list) else [str(raw)] if raw else []
