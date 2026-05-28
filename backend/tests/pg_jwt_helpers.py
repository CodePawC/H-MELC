"""PostgreSQL 契约/集成共用辅助（JWT、表就绪探测）。"""

from __future__ import annotations

import pytest
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.exc import SQLAlchemyError


def skip_without_identity_jwt(headers: dict[str, str] | None) -> dict[str, str]:
    """PostgreSQL 上未迁 **identity** 时 `pg_admin_headers` 为 None，跳过依赖院内 JWT 的断言。"""
    if headers is None:
        pytest.skip(
            "需 PostgreSQL 已执行 alembic（identity.app_user、e005_identity_auth），"
            "以便 pg_admin_headers 预置多角色 JWT"
        )
    return headers


def pg_schema_has_table(engine: object, *, schema: str, name: str) -> bool:
    """未迁库或引擎不可用时返回 False（不抛）。"""
    if getattr(engine.dialect, "name", None) != "postgresql":
        return False
    try:
        return bool(sa_inspect(engine).has_table(name, schema=schema))
    except SQLAlchemyError:
        return False
