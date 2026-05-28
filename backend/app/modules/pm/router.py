"""预防性维护 PM API · docs/06 · 十

持久化：`pm` schema（Alembic e017_pm_core）；未迁库或非 PostgreSQL 时返回 **503**。
"""

from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError

from app.core.audit_emit import emit_audit
from app.core.deps import DbSession
from app.core.responses import envelope_ok
from app.db.session import engine
from app.modules.auth.deps import require_roles
from app.modules.auth.rbac import RBAC_PM_EXECUTE, RBAC_PM_READ, RBAC_PM_WRITE
from app.modules.auth.schemas import JwtClaims
from app.modules.pm.schemas import (
    PmInspectionRecordBody,
    PmPlanCreate,
    PmPlanPatch,
    PmTaskCompleteBody,
)
from app.modules.pm import service as pm_svc

router = APIRouter(prefix="/pm", tags=["pm"])

_PG_DETAIL = "PM 需在 PostgreSQL 执行 `alembic upgrade head`（含 e017_pm_core）后使用。"


def _ensure_pg_pm() -> None:
    if engine.dialect.name != "postgresql":
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PG_DETAIL)


PgPm = Depends(_ensure_pg_pm)

_PM_SQL_FAIL = "PM 持久化查询失败：请确认 pm schema 已创建并完成迁移。"


def _unwrap_plan(result: object) -> object:
    if isinstance(result, tuple):
        code, msg = result
        if code == "not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        if code == "conflict":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
    return result


def _unwrap_task(result: object) -> object:
    return _unwrap_plan(result)


@router.get("")
def pm_root() -> dict[str, object]:
    """模块发现（契约烟测与接口配置页）。"""
    return envelope_ok(
        data={
            "module": "pm",
            "name": "预防性维护",
            "paths": {
                "plans": "/api/v1/pm/plans",
                "tasks": "/api/v1/pm/tasks",
                "inspection_tasks": "/api/v1/pm/inspection-tasks",
                "stats_emergency": "/api/v1/pm/stats/emergency-readiness",
                "alerts_overdue": "/api/v1/pm/alerts/overdue",
            },
        }
    )


@router.get("/plans", dependencies=[PgPm])
def list_plans(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_PM_READ)),
    keyword: str | None = Query(None),
    asset_id: UUID | None = Query(None),
    department_id: UUID | None = Query(None),
    plan_status: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    try:
        items, total = pm_svc.list_plans(
            db,
            keyword=keyword,
            asset_id=asset_id,
            department_id=department_id,
            plan_status=plan_status,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PM_SQL_FAIL) from exc
    return envelope_ok(
        data={
            "items": [x.model_dump(mode="json") for x in items],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    )


@router.post("/plans", dependencies=[PgPm])
def create_plan(
    db: DbSession,
    body: PmPlanCreate,
    actor: JwtClaims = Depends(require_roles(*RBAC_PM_WRITE)),
) -> dict:
    try:
        row = _unwrap_plan(pm_svc.create_plan(db, body))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PM_SQL_FAIL) from exc
    emit_audit(
        db,
        actor,
        action="PM_PLAN_CREATE",
        object_type="pm_plan",
        object_id=row.id,
        after_data={"title": row.title, "asset_id": str(row.asset_id), "frequency": row.frequency},
    )
    return envelope_ok(data={"plan": row.model_dump(mode="json")})


@router.get("/plans/{plan_id}", dependencies=[PgPm])
def get_plan(
    db: DbSession,
    plan_id: UUID,
    _actor: JwtClaims = Depends(require_roles(*RBAC_PM_READ)),
) -> dict:
    try:
        row = pm_svc.get_plan(db, plan_id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PM_SQL_FAIL) from exc
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="计划不存在")
    return envelope_ok(data={"plan": row.model_dump(mode="json")})


@router.patch("/plans/{plan_id}", dependencies=[PgPm])
def patch_plan(
    db: DbSession,
    plan_id: UUID,
    body: PmPlanPatch,
    actor: JwtClaims = Depends(require_roles(*RBAC_PM_WRITE)),
) -> dict:
    try:
        row = _unwrap_plan(pm_svc.patch_plan(db, plan_id, body))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PM_SQL_FAIL) from exc
    emit_audit(
        db,
        actor,
        action="PM_PLAN_PATCH",
        object_type="pm_plan",
        object_id=row.id,
        after_data=body.model_dump(exclude_unset=True),
    )
    return envelope_ok(data={"plan": row.model_dump(mode="json")})


@router.get("/tasks", dependencies=[PgPm])
def list_tasks(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_PM_READ)),
    plan_id: UUID | None = Query(None),
    asset_id: UUID | None = Query(None),
    task_status: str | None = Query(None),
    assigned_engineer_id: UUID | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    try:
        items, total = pm_svc.list_tasks(
            db,
            plan_id=plan_id,
            asset_id=asset_id,
            task_status=task_status,
            assigned_engineer_id=assigned_engineer_id,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PM_SQL_FAIL) from exc
    return envelope_ok(
        data={
            "items": [x.model_dump(mode="json") for x in items],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    )


@router.post("/tasks/{task_id}/complete", dependencies=[PgPm])
def complete_task(
    db: DbSession,
    task_id: UUID,
    body: PmTaskCompleteBody,
    actor: JwtClaims = Depends(require_roles(*RBAC_PM_EXECUTE)),
) -> dict:
    try:
        row = _unwrap_task(
            pm_svc.complete_task(
                db,
                task_id,
                result_summary=body.result_summary,
                executed_at=body.executed_at,
                engineer_id=body.engineer_id,
                actor_sub=actor.sub,
                mdm_person_id=body.mdm_person_id,
                person_code=body.person_code,
                person_name=body.person_name,
                person_source=body.person_source,
                person_version=body.person_version,
                person_synced_at=body.person_synced_at,
            )
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PM_SQL_FAIL) from exc
    emit_audit(
        db,
        actor,
        action="PM_TASK_COMPLETE",
        object_type="pm_task",
        object_id=row.id,
        after_data={"plan_id": str(row.plan_id), "executed_at": row.executed_at.isoformat() if row.executed_at else None},
    )
    return envelope_ok(data={"task": row.model_dump(mode="json")})


@router.get("/inspection-tasks", dependencies=[PgPm])
def list_inspection_tasks(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_PM_READ)),
    inspection_type: str | None = Query(None),
    department_id: UUID | None = Query(None),
    task_status: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    try:
        items, total = pm_svc.list_inspection_tasks(
            db,
            inspection_type=inspection_type,
            department_id=department_id,
            task_status=task_status,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PM_SQL_FAIL) from exc
    return envelope_ok(
        data={
            "items": [x.model_dump(mode="json") for x in items],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    )


@router.post("/inspection-tasks/{inspection_task_id}/records", dependencies=[PgPm])
def submit_inspection_record(
    db: DbSession,
    inspection_task_id: UUID,
    body: PmInspectionRecordBody,
    actor: JwtClaims = Depends(require_roles(*RBAC_PM_EXECUTE)),
) -> dict:
    try:
        row = _unwrap_task(
            pm_svc.submit_inspection_record(
                db,
                inspection_task_id,
                checklist_result=body.checklist_result,
                remark=body.remark,
                inspector_id=body.inspector_id,
                actor_sub=actor.sub,
            )
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PM_SQL_FAIL) from exc
    emit_audit(
        db,
        actor,
        action="PM_INSPECTION_RECORD",
        object_type="pm_inspection_task",
        object_id=row.id,
        after_data={"task_status": row.task_status},
    )
    return envelope_ok(data={"task": row.model_dump(mode="json")})


@router.get("/stats/emergency-readiness", dependencies=[PgPm])
def emergency_readiness(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_PM_READ)),
) -> dict:
    try:
        payload = pm_svc.emergency_readiness(db)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PM_SQL_FAIL) from exc
    return envelope_ok(data=payload)


@router.get("/alerts/overdue", dependencies=[PgPm])
def alerts_overdue(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_PM_READ)),
    limit: int = Query(100, ge=1, le=500),
) -> dict:
    try:
        items = pm_svc.list_overdue_alerts(db, limit=limit)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PM_SQL_FAIL) from exc
    return envelope_ok(data={"items": items})
