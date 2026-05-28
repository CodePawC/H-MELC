"""工作流 API Phase 0。

对齐：docs/06_接口设计/01_API接口设计.md §八（启动、我的待办、同意/驳回）。
持久化：`workflow` schema，参见 Alembic e008_workflow_core；已连 PG 但未建表时对 SQL 异常返回 **503**。
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError

from app.core.audit_emit import emit_audit
from app.core.deps import DbSession
from app.core.responses import envelope_ok
from app.db.session import engine
from app.modules.auth.deps import require_roles
from app.modules.auth.rbac import RBAC_WORKFLOW_START, RBAC_WORKFLOW_TASK_READ
from app.modules.auth.schemas import JwtClaims
from app.modules.workflow.schemas import WorkflowStartBody, WorkflowTaskOutcomeBody
from app.modules.workflow import service as wf_svc

router = APIRouter(prefix="/workflows", tags=["workflow"])


def _ensure_pg_workflow() -> None:
    if engine.dialect.name != "postgresql":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="工作流需在 PostgreSQL 执行 `alembic upgrade head`（含 e008_workflow_core）后使用。",
        )


PgWorkflow = Depends(_ensure_pg_workflow)

_WORKFLOW_PG_NOT_READY = (
    "工作流持久化未就绪：请在目标库执行 alembic upgrade head（含 e008_workflow_core）。"
)


def _workflow_admin(actor: JwtClaims) -> bool:
    return bool(actor.roles.intersection({"SYS_ADMIN", "DEVICE_ADMIN"}))


@router.get("", summary="模块信息（兼容早期占位契约）")
def workflow_root() -> dict[str, object]:
    return envelope_ok(
        data={
            "module": "workflow",
            "name": "工作流",
            "paths": {
                "start": "/api/v1/workflows/start",
                "tasks_my": "/api/v1/workflows/tasks/my",
                "task_approve": "/api/v1/workflows/tasks/{task_id}/approve",
                "task_reject": "/api/v1/workflows/tasks/{task_id}/reject",
            },
        }
    )


@router.post("/start", dependencies=[PgWorkflow])
def workflow_start(
    db: DbSession,
    body: WorkflowStartBody,
    actor: JwtClaims = Depends(require_roles(*RBAC_WORKFLOW_START)),
) -> dict:
    """§八·1"""
    try:
        inst, task = wf_svc.start_process(db, body, starter_user_id=actor.sub)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_WORKFLOW_PG_NOT_READY) from exc
    emit_audit(
        db,
        actor,
        action="WORKFLOW_INSTANCE_START",
        object_type="wf_process_instance",
        object_id=inst.id,
        after_data={
            "process_key": inst.process_key,
            "title": inst.title,
            "task_id": str(task.id),
            "assignee_user_id": str(task.assignee_user_id),
        },
    )
    return envelope_ok(
        data={
            "instance": wf_svc.instance_to_api(inst),
            "initial_task": wf_svc.task_to_api(task),
        },
    )


@router.get("/tasks/my", dependencies=[PgWorkflow])
def workflow_my_tasks(
    db: DbSession,
    actor: JwtClaims = Depends(require_roles(*RBAC_WORKFLOW_TASK_READ)),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    """§八·2"""
    try:
        rows, total = wf_svc.list_my_pending_tasks(
            db, assignee_user_id=actor.sub, page=page, page_size=page_size
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_WORKFLOW_PG_NOT_READY) from exc
    return envelope_ok(
        data={
            "items": [wf_svc.task_to_api(r) for r in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
        },
    )


@router.post("/tasks/{task_id}/approve", dependencies=[PgWorkflow])
def workflow_task_approve(
    db: DbSession,
    task_id: UUID,
    body: WorkflowTaskOutcomeBody = Body(default_factory=WorkflowTaskOutcomeBody),
    actor: JwtClaims = Depends(require_roles(*RBAC_WORKFLOW_TASK_READ)),
) -> dict:
    """§八·3"""
    comment = body.comment
    try:
        rc, payload = wf_svc.approve_or_reject(
            db,
            task_id=task_id,
            actor_user_id=actor.sub,
            is_admin_escalation=_workflow_admin(actor),
            decision="approve",
            comment=comment,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_WORKFLOW_PG_NOT_READY) from exc
    if rc == "not_found":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(payload))
    if rc == "forbidden":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(payload))
    if rc != "ok":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(payload))
    assert isinstance(payload, dict)
    emit_audit(
        db,
        actor,
        action="WORKFLOW_TASK_APPROVE",
        object_type="wf_user_task",
        object_id=task_id,
        after_data={
            "instance_id": payload["instance"]["id"],
            "instance_status": payload["instance"]["status"],
        },
    )
    return envelope_ok(data=payload)


@router.post("/tasks/{task_id}/reject", dependencies=[PgWorkflow])
def workflow_task_reject(
    db: DbSession,
    task_id: UUID,
    body: WorkflowTaskOutcomeBody = Body(default_factory=WorkflowTaskOutcomeBody),
    actor: JwtClaims = Depends(require_roles(*RBAC_WORKFLOW_TASK_READ)),
) -> dict:
    """§八·4"""
    comment = body.comment
    try:
        rc, payload = wf_svc.approve_or_reject(
            db,
            task_id=task_id,
            actor_user_id=actor.sub,
            is_admin_escalation=_workflow_admin(actor),
            decision="reject",
            comment=comment,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_WORKFLOW_PG_NOT_READY) from exc
    if rc == "not_found":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(payload))
    if rc == "forbidden":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(payload))
    if rc != "ok":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(payload))
    assert isinstance(payload, dict)
    emit_audit(
        db,
        actor,
        action="WORKFLOW_TASK_REJECT",
        object_type="wf_user_task",
        object_id=task_id,
        after_data={
            "instance_id": payload["instance"]["id"],
            "instance_status": payload["instance"]["status"],
        },
    )
    return envelope_ok(data=payload)
