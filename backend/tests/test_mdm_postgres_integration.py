"""MDM 集成测试：PostgreSQL · e006."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import SessionLocal
from app.modules.mdm.models import CategoryEntry
from pg_jwt_helpers import pg_schema_has_table, skip_without_identity_jwt


@pytest.fixture
def require_postgres_db() -> None:
    from app.db.session import engine

    if engine.dialect.name != "postgresql":
        pytest.skip("需 PostgreSQL + e006 mdm")
    if not pg_schema_has_table(engine, schema="mdm", name="category_entry"):
        pytest.skip("需 PostgreSQL 已执行 alembic（mdm.category_entry）")
    if not pg_schema_has_table(engine, schema="identity", name="app_user"):
        pytest.skip("需 PostgreSQL 已迁移 identity.app_user（本模块含帐号 seed）")


def test_mdm_parent_child_and_duplicate(
    client: TestClient,
    require_postgres_db,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    h = skip_without_identity_jwt(pg_admin_headers)
    dim = "PYTEST_EQUIP"
    root_code = f"P_ROOT_{uuid.uuid4().hex[:8]}"
    child_code = f"P_CHILD_{uuid.uuid4().hex[:8]}"

    cre_root = client.post(
        "/api/v1/mdm/category-entries",
        headers=h,
        json={"dimension_code": dim, "category_code": root_code, "name": "根节点"},
    )
    assert cre_root.status_code == 200, cre_root.text
    rid = cre_root.json()["data"]["id"]

    cre_ch = client.post(
        "/api/v1/mdm/category-entries",
        headers=h,
        json={
            "dimension_code": dim,
            "category_code": child_code,
            "name": "子节点",
            "parent_id": rid,
            "sort_order": 1,
        },
    )
    assert cre_ch.status_code == 200

    lst = client.get("/api/v1/mdm/category-entries", params={"dimension_code": dim}, headers=h)
    assert lst.json()["data"]["total"] >= 2

    roots = client.get(
        "/api/v1/mdm/category-entries",
        params={"dimension_code": dim, "roots_only": "true"},
        headers=h,
    )
    assert roots.status_code == 200
    assert all(x["category_code"] != child_code for x in roots.json()["data"]["items"])

    dup = client.post(
        "/api/v1/mdm/category-entries",
        headers=h,
        json={"dimension_code": dim, "category_code": root_code, "name": "重复"},
    )
    assert dup.status_code == 409

    bad_parent = client.post(
        "/api/v1/mdm/category-entries",
        headers=h,
        json={
            "dimension_code": "OTHER_DIM",
            "category_code": f"BAD_{uuid.uuid4().hex[:6]}",
            "name": "错维",
            "parent_id": rid,
        },
    )
    assert bad_parent.status_code == 422

    db = SessionLocal()
    try:
        db.execute(delete(CategoryEntry).where(CategoryEntry.dimension_code == dim))
        db.commit()
    except SQLAlchemyError:
        db.rollback()
    finally:
        db.close()


def test_mdm_read_for_dept_only(
    client: TestClient,
    require_postgres_db,
) -> None:
    """DEPT_USER ∈ RBAC_ASSET_READ，可列 MDM。"""
    from app.db.session import engine

    from app.modules.auth.service import hash_password
    from app.modules.identity.models import AppUser, UserRole

    suf = uuid.uuid4().hex[:8]
    u, p = f"dread_{suf}", f"Dr-{suf}!"
    uid = uuid.uuid4()
    db = SessionLocal()
    try:
        db.add(AppUser(id=uid, username=u, password_hash=hash_password(p), is_active=True))
        db.add(UserRole(user_id=uid, role_code="DEPT_USER"))
        db.commit()
    finally:
        db.close()

    try:
        lg = client.post("/api/v1/auth/login", json={"username": u, "password": p})
        assert lg.status_code == 200
        th = {"Authorization": f"Bearer {lg.json()['data']['access_token']}"}
        r = client.get("/api/v1/mdm/category-entries", headers=th)
        assert r.status_code == 200
    finally:
        from app.modules.audit.models import AuditLog

        dc = SessionLocal()
        try:
            if pg_schema_has_table(engine, schema="audit", name="audit_log"):
                dc.execute(delete(AuditLog).where(AuditLog.username == u))
            dc.execute(delete(UserRole).where(UserRole.user_id == uid))
            dc.execute(delete(AppUser).where(AppUser.id == uid))
            dc.commit()
        except SQLAlchemyError:
            dc.rollback()
        finally:
            dc.close()
