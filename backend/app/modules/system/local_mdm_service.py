"""本地主数据服务（local mode）。

当 MASTER_DATA_MODE=local 时，H-MELC 通过此服务读取本地基础数据。
表结构在 local_mdm schema 中（迁移 e034）。
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import func, or_, select, text

from app.db.session import SessionLocal


def list_local_departments(keyword: str | None = None, status: str | None = None, page: int = 1, page_size: int = 20) -> tuple[list[dict[str, Any]], int]:
    with SessionLocal() as db:
        where = "1=1"
        params: dict[str, Any] = {}
        if keyword:
            where += " AND (name ILIKE :kw OR code ILIKE :kw)"
            params["kw"] = f"%{keyword}%"
        if status and status != "all":
            where += " AND status = :st"
            params["st"] = status
        total = db.execute(text(f"SELECT count(*) FROM local_mdm.local_department WHERE {where}"), params).scalar() or 0
        rows = db.execute(text(f"SELECT * FROM local_mdm.local_department WHERE {where} ORDER BY code LIMIT :limit OFFSET :offset"), {**params, "limit": page_size, "offset": (page-1)*page_size}).all()
        return [dict(r._mapping) for r in rows], total


def list_local_persons(keyword: str | None = None, status: str | None = None, page: int = 1, page_size: int = 20) -> tuple[list[dict[str, Any]], int]:
    with SessionLocal() as db:
        where = "1=1"
        params: dict[str, Any] = {}
        if keyword:
            where += " AND (name ILIKE :kw OR code ILIKE :kw)"
            params["kw"] = f"%{keyword}%"
        if status and status != "all":
            where += " AND status = :st"
            params["st"] = status
        total = db.execute(text(f"SELECT count(*) FROM local_mdm.local_person WHERE {where}"), params).scalar() or 0
        rows = db.execute(text(f"SELECT * FROM local_mdm.local_person WHERE {where} ORDER BY code LIMIT :limit OFFSET :offset"), {**params, "limit": page_size, "offset": (page-1)*page_size}).all()
        return [dict(r._mapping) for r in rows], total


def list_local_locations(keyword: str | None = None, location_type: str | None = None, status: str | None = None, page: int = 1, page_size: int = 20) -> tuple[list[dict[str, Any]], int]:
    with SessionLocal() as db:
        where = "1=1"
        params: dict[str, Any] = {}
        if keyword:
            where += " AND (name ILIKE :kw OR code ILIKE :kw)"
            params["kw"] = f"%{keyword}%"
        if location_type:
            where += " AND type = :lt"
            params["lt"] = location_type
        if status and status != "all":
            where += " AND status = :st"
            params["st"] = status
        total = db.execute(text(f"SELECT count(*) FROM local_mdm.local_location WHERE {where}"), params).scalar() or 0
        rows = db.execute(text(f"SELECT * FROM local_mdm.local_location WHERE {where} ORDER BY type, code LIMIT :limit OFFSET :offset"), {**params, "limit": page_size, "offset": (page-1)*page_size}).all()
        return [dict(r._mapping) for r in rows], total
