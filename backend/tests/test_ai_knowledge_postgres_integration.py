"""AI 任务与知识库集成测试（PostgreSQL + e007）。"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, inspect as sa_inspect
from sqlalchemy.exc import SQLAlchemyError

from app.db.session import SessionLocal, engine
from pg_jwt_helpers import skip_without_identity_jwt
from app.modules.knowledge.models import KbDocument


def _ai_kb_integration_ready() -> bool:
    if engine.dialect.name != "postgresql":
        return False
    try:
        insp = sa_inspect(engine)
        return insp.has_table("ai_task", schema="ai") and insp.has_table(
            "kb_document", schema="knowledge"
        )
    except SQLAlchemyError:
        return False


@pytest.fixture
def require_postgres_db() -> None:
    if engine.dialect.name != "postgresql":
        pytest.skip("需 PostgreSQL + e007_ai_knowledge")
    if not _ai_kb_integration_ready():
        pytest.skip("需 PostgreSQL 已执行 alembic（ai.ai_task、knowledge.kb_document）")


@pytest.fixture(autouse=True)
def _cleanup_kb_pytest_documents() -> None:
    yield
    if engine.dialect.name != "postgresql":
        return
    try:
        if not sa_inspect(engine).has_table("kb_document", schema="knowledge"):
            return
    except SQLAlchemyError:
        return
    db = SessionLocal()
    try:
        db.execute(delete(KbDocument).where(KbDocument.title.like("pytest_kb_%")))  # type: ignore[arg-type]
        db.commit()
    except SQLAlchemyError:
        db.rollback()
    finally:
        db.close()


def test_ai_task_lifecycle_review(
    client: TestClient,
    require_postgres_db,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    h = skip_without_identity_jwt(pg_admin_headers)
    cid = uuid.uuid4().hex[:8]
    cr = client.post(
        "/api/v1/ai/tasks",
        headers=h,
        json={"task_type": "REPAIR_TRIAGE", "payload": {"case_id": cid, "fault": "NIBP 异常"}},
    )
    assert cr.status_code == 200, cr.text
    j = cr.json()
    assert j["code"] == 0
    tid = j["data"]["id"]
    assert j["data"]["status"] == "SUCCEEDED"

    gd = client.get(f"/api/v1/ai/tasks/{tid}", headers=h)
    assert gd.status_code == 200
    rid = gd.json()["data"]["result_id"]
    assert rid is not None

    gr = client.get(f"/api/v1/ai/results/{rid}", headers=h)
    assert gr.status_code == 200
    assert gr.json()["data"]["output_payload"]["stub"] is True

    rv = client.post(
        f"/api/v1/ai/results/{rid}/review",
        headers=h,
        json={"confirm_status": "ACCEPTED", "comment": "验收通过"},
    )
    assert rv.status_code == 200
    assert rv.json()["data"]["review_status"] == "ACCEPTED"


def test_kb_metadata_and_chat(
    client: TestClient,
    require_postgres_db,
    pg_admin_headers: dict[str, str] | None,
) -> None:
    h = skip_without_identity_jwt(pg_admin_headers)
    t = f"pytest_kb_{uuid.uuid4().hex[:8]}"
    up = client.post(
        "/api/v1/knowledge/documents",
        headers=h,
        data={"title": t, "source_type": "UPLOAD"},
    )
    assert up.status_code == 200, up.text
    did = up.json()["data"]["id"]

    lst = client.get("/api/v1/knowledge/documents", headers=h)
    assert lst.status_code == 200
    items = lst.json()["data"]["items"]
    assert any(x["id"] == did for x in items)

    gd = client.get(f"/api/v1/knowledge/documents/{did}", headers=h)
    assert gd.status_code == 200
    assert gd.json()["data"]["title"] == t

    nf = client.get(f"/api/v1/knowledge/documents/{uuid.uuid4()}", headers=h)
    assert nf.status_code == 404

    ch = client.post("/api/v1/knowledge/chat", headers=h, json={"question": f"请参考 {t} 的步骤", "scope": "repair"})
    assert ch.status_code == 200
    body = ch.json()
    assert body["code"] == 0 and body["data"]["stub"] is True
    assert body["data"].get("interaction_id")
    assert body["data"].get("reference_search_degraded") is False
    refs = body["data"]["references"]
    assert isinstance(refs, list)
    assert any(str(r.get("id")) == str(did) for r in refs)
