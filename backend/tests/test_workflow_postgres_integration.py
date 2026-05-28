"""工作流集成测试：PostgreSQL · e008."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, inspect as sa_inspect
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import SessionLocal, engine
from app.modules.auth.service import hash_password
from app.modules.identity.models import AppUser, UserRole
from app.modules.workflow.models import WfProcessInstance
from pg_jwt_helpers import skip_without_identity_jwt


def _workflow_tables_ready() -> bool:
    if engine.dialect.name != "postgresql":
        return False
    try:
        return bool(sa_inspect(engine).has_table("process_instance", schema="workflow"))
    except SQLAlchemyError:
        return False


@pytest.fixture
def require_postgres_db() -> None:
    if engine.dialect.name != "postgresql":
        pytest.skip("需 PostgreSQL + e008 workflow")
    if not _workflow_tables_ready():
        pytest.skip("需 PostgreSQL 已执行 alembic（workflow.process_instance 等）")


@pytest.fixture(autouse=True)
def _purge_pytest_process_key() -> None:
    yield
    if engine.dialect.name != "postgresql":
        return
    if not _workflow_tables_ready():
        return
    db = SessionLocal()
    try:
        db.execute(delete(WfProcessInstance).where(WfProcessInstance.process_key == "pytest_wf"))
        db.commit()
    except SQLAlchemyError:
        db.rollback()
    finally:
        db.close()


def test_workflow_pending_approve(
    client: TestClient,
    require_postgres_db,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    h = skip_without_identity_jwt(pg_admin_headers)
    title = f"pytest_wf_{uuid.uuid4().hex[:8]}"
    st = client.post(
        "/api/v1/workflows/start",
        headers=h,
        json={
            "process_key": "pytest_wf",
            "title": title,
            "payload": {"tier": "L1"},
        },
    )
    assert st.status_code == 200, st.text
    out = st.json()["data"]
    tid = out["initial_task"]["id"]
    assert out["initial_task"]["status"] == "PENDING"

    lst = client.get("/api/v1/workflows/tasks/my", headers=h)
    assert lst.status_code == 200
    items = lst.json()["data"]["items"]
    assert any(str(x["id"]) == tid for x in items)

    ap = client.post(f"/api/v1/workflows/tasks/{tid}/approve", headers=h, json={})
    assert ap.status_code == 200
    assert ap.json()["data"]["instance"]["status"] == "CLOSED"
    assert ap.json()["data"]["task"]["status"] == "APPROVED"


def test_workflow_engineer_cannot_approve_others_task_then_owner_approves(
    client: TestClient,
    require_postgres_db,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    """经办人不是待办认领人且非 SYS_ADMIN/DEVICE_ADMIN 时驳回；认领人（本例为发起管理员）可通过。"""
    h_admin = skip_without_identity_jwt(pg_admin_headers)
    suf = uuid.uuid4().hex[:10]
    oid = uuid.uuid4()
    uname = f"wf_peer_{suf}"

    db = SessionLocal()
    try:
        peer = AppUser(
            id=oid,
            username=uname,
            password_hash=hash_password("PeerPw-1!!"),
            display_name="workflow peer",
            is_active=True,
        )
        db.add(peer)
        db.add(UserRole(user_id=oid, role_code="ENGINEER"))
        db.commit()
    finally:
        db.close()

    try:
        peer_login = client.post(
            "/api/v1/auth/login",
            json={"username": uname, "password": "PeerPw-1!!"},
        )
        assert peer_login.status_code == 200, peer_login.text
        peer_tok = peer_login.json()["data"]["access_token"]
        h_peer = {"Authorization": f"Bearer {peer_tok}"}

        title = f"pytest_wf_{uuid.uuid4().hex[:8]}"
        st = client.post(
            "/api/v1/workflows/start",
            headers=h_admin,
            json={
                "process_key": "pytest_wf",
                "title": title,
            },
        )
        assert st.status_code == 200, st.text
        tid = st.json()["data"]["initial_task"]["id"]

        bad = client.post(f"/api/v1/workflows/tasks/{tid}/approve", headers=h_peer, json={})
        assert bad.status_code == 403

        ok = client.post(f"/api/v1/workflows/tasks/{tid}/approve", headers=h_admin, json={})
        assert ok.status_code == 200
        assert ok.json()["data"]["task"]["status"] == "APPROVED"
    finally:
        dc = SessionLocal()
        try:
            dc.execute(delete(AppUser).where(AppUser.id == oid))
            dc.commit()
        finally:
            dc.close()


def test_workflow_admin_escalation_approve_assignee_task(
    client: TestClient,
    require_postgres_db,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    """SYS_ADMIN/DEVICE_ADMIN 可批改派给他人的 OPEN 待办。"""
    h_admin = skip_without_identity_jwt(pg_admin_headers)
    suf = uuid.uuid4().hex[:10]
    oid = uuid.uuid4()
    uname = f"wf_esc_{suf}"

    db = SessionLocal()
    try:
        peer = AppUser(
            id=oid,
            username=uname,
            password_hash=hash_password("EscPw-1!!"),
            display_name="escalate peer",
            is_active=True,
        )
        db.add(peer)
        db.add(UserRole(user_id=oid, role_code="ENGINEER"))
        db.commit()
    finally:
        db.close()

    try:
        title = f"pytest_wf_{uuid.uuid4().hex[:8]}"
        st = client.post(
            "/api/v1/workflows/start",
            headers=h_admin,
            json={
                "process_key": "pytest_wf",
                "title": title,
                "first_assignee_user_id": str(oid),
            },
        )
        assert st.status_code == 200, st.text
        tid = st.json()["data"]["initial_task"]["id"]

        ok = client.post(f"/api/v1/workflows/tasks/{tid}/approve", headers=h_admin, json={})
        assert ok.status_code == 200
        assert ok.json()["data"]["task"]["status"] == "APPROVED"
    finally:
        dc = SessionLocal()
        try:
            dc.execute(delete(AppUser).where(AppUser.id == oid))
            dc.commit()
        finally:
            dc.close()
