"""报修维修 API。

对齐：docs/06_接口设计/01_API接口设计.md §二；持久化参见 docs/03_数据库设计/04 §三、Alembic e003。
已连 PG 但未建 repair 表时捕获 SQL 异常返回 **503**。
JWT + RBAC 见 docs/01_需求文档/03 §二及 app.modules.auth.rbac。
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
from app.modules.auth.rbac import (
    RBAC_REPAIR_ASSIGN,
    RBAC_REPAIR_CONFIRM,
    RBAC_REPAIR_CREATE,
    RBAC_REPAIR_ENGINEER_OPS,
    RBAC_REPAIR_EXTENDED_WORK,
    RBAC_REPAIR_READ,
)
from app.modules.auth.schemas import JwtClaims
from app.modules.repair.schemas import (
    RepairAssignBody,
    RepairClaimBody,
    RepairCompleteBody,
    RepairConfirmBody,
    RepairCreate,
    RepairOrderRead,
    RepairRecordCreate,
    RepairRecordRead,
)
from app.modules.repair import service


router = APIRouter(prefix="/repairs", tags=["repair"])


def _ensure_pg_repair() -> None:
    if engine.dialect.name != "postgresql":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="报修维修需在 PostgreSQL 执行 `alembic upgrade head`（含 e003_repair_core）后使用。",
        )


PgRepairStore = Depends(_ensure_pg_repair)

_REPAIR_PG_NOT_READY = (
    "报修工单持久化未就绪：请在目标库执行 alembic upgrade head（含 e003_repair_core）。"
)


def _unpack_order(result: RepairOrderRead | tuple[str, str]) -> RepairOrderRead:
    if isinstance(result, tuple):
        code, msg = result
        if code == "not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        if code == "conflict":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
    return result


def _unpack_record(result: RepairRecordRead | tuple[str, str]) -> RepairRecordRead:
    if isinstance(result, tuple):
        code, msg = result
        if code == "not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        if code == "conflict":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
    return result


@router.post("", dependencies=[PgRepairStore])
def create_repair_endpoint(
    db: DbSession,
    body: RepairCreate,
    actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_CREATE)),
) -> dict:
    """§二·1 科室报修"""
    try:
        row = service.create_repair(db, body)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="设备不存在或已删除")
        emit_audit(
            db,
            actor,
            action="REPAIR_ORDER_CREATE",
            object_type="repair_order",
            object_id=row.id,
            after_data={"order_code": row.order_code, "asset_id": str(row.asset_id), "status": row.order_status},
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_REPAIR_PG_NOT_READY) from exc
    return envelope_ok(data=row.model_dump(mode="json"))


@router.get("", dependencies=[PgRepairStore])
def list_repairs_endpoint(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_READ)),
    order_status: str | None = Query(None),
    asset_id: UUID | None = Query(None),
    department_id: UUID | None = Query(None, description="科室；对应文档字段 department_id"),
    assigned_engineer_id: UUID | None = Query(None),
    priority: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    """§二·2 清单"""
    try:
        items, total, pg, psz = service.list_repairs(
            db,
            order_status=order_status,
            asset_id=asset_id,
            department_id=department_id,
            assigned_engineer_id=assigned_engineer_id,
            priority=priority,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_REPAIR_PG_NOT_READY) from exc
    payload = {
        "items": [x.model_dump(mode="json") for x in items],
        "total": total,
        "page": pg,
        "page_size": psz,
    }
    return envelope_ok(data=payload)


@router.get("/{repair_order_id}", dependencies=[PgRepairStore])
def get_repair_detail(
    db: DbSession,
    repair_order_id: UUID,
    _actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_READ)),
) -> dict:
    """§二·3"""
    try:
        bundle = service.detail_bundle(db, repair_order_id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_REPAIR_PG_NOT_READY) from exc
    if bundle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="工单不存在")
    return envelope_ok(data=bundle.model_dump(mode="json"))


@router.post("/{repair_order_id}/claim", dependencies=[PgRepairStore])
def claim_repair_endpoint(
    db: DbSession,
    repair_order_id: UUID,
    body: RepairClaimBody,
    actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_ENGINEER_OPS)),
) -> dict:
    """§二·4"""
    try:
        row = _unpack_order(service.claim_repair(db, repair_order_id, body))
        emit_audit(
            db,
            actor,
            action="REPAIR_ORDER_CLAIM",
            object_type="repair_order",
            object_id=repair_order_id,
            after_data={"order_status": row.order_status, "engineer_id": str(body.engineer_id)},
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_REPAIR_PG_NOT_READY) from exc
    return envelope_ok(data=row.model_dump(mode="json"))


@router.post("/{repair_order_id}/assign", dependencies=[PgRepairStore])
def assign_repair_endpoint(
    db: DbSession,
    repair_order_id: UUID,
    body: RepairAssignBody,
    actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_ASSIGN)),
) -> dict:
    """§二·5"""
    try:
        row = _unpack_order(service.assign_repair(db, repair_order_id, body))
        emit_audit(
            db,
            actor,
            action="REPAIR_ORDER_ASSIGN",
            object_type="repair_order",
            object_id=repair_order_id,
            after_data={"engineer_id": str(body.engineer_id), "reason": body.reason},
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_REPAIR_PG_NOT_READY) from exc
    return envelope_ok(data=row.model_dump(mode="json"))


@router.post("/{repair_order_id}/records", dependencies=[PgRepairStore])
def add_record_endpoint(
    db: DbSession,
    repair_order_id: UUID,
    body: RepairRecordCreate,
    actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_ENGINEER_OPS)),
) -> dict:
    """§二·6"""
    try:
        row = _unpack_record(service.add_process_record(db, repair_order_id, body))
        emit_audit(
            db,
            actor,
            action="REPAIR_PROCESS_RECORD",
            object_type="repair_order",
            object_id=repair_order_id,
            after_data=row.model_dump(mode="json"),
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_REPAIR_PG_NOT_READY) from exc
    return envelope_ok(data=row.model_dump(mode="json"))


@router.post("/{repair_order_id}/complete", dependencies=[PgRepairStore])
def complete_endpoint(
    db: DbSession,
    repair_order_id: UUID,
    body: RepairCompleteBody,
    actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_ENGINEER_OPS)),
) -> dict:
    """§二·7"""
    try:
        row = _unpack_order(service.complete_repair(db, repair_order_id, body))
        emit_audit(
            db,
            actor,
            action="REPAIR_ORDER_COMPLETE",
            object_type="repair_order",
            object_id=repair_order_id,
            after_data={"order_status": row.order_status},
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_REPAIR_PG_NOT_READY) from exc
    return envelope_ok(data=row.model_dump(mode="json"))


@router.post("/{repair_order_id}/confirm", dependencies=[PgRepairStore])
def confirm_endpoint(
    db: DbSession,
    repair_order_id: UUID,
    body: RepairConfirmBody,
    actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_CONFIRM)),
) -> dict:
    """§二·8"""
    try:
        row = _unpack_order(service.confirm_repair(db, repair_order_id, body))
        emit_audit(
            db,
            actor,
            action="REPAIR_ORDER_CONFIRM",
            object_type="repair_order",
            object_id=repair_order_id,
            after_data={"order_status": row.order_status, "confirm_status": body.confirm_status},
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_REPAIR_PG_NOT_READY) from exc
    return envelope_ok(data=row.model_dump(mode="json"))


@router.post("/{repair_order_id}/outsourcing", dependencies=[PgRepairStore])
def outsource_endpoint(
    db: DbSession,
    repair_order_id: UUID,
    actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_EXTENDED_WORK)),
) -> dict:
    """§三·1"""
    try:
        row = _unpack_order(service.set_outsourced(db, repair_order_id))
        emit_audit(
            db,
            actor,
            action="REPAIR_ORDER_OUTSOURCE",
            object_type="repair_order",
            object_id=repair_order_id,
            after_data={"is_outsourced": True},
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_REPAIR_PG_NOT_READY) from exc
    return envelope_ok(data=row.model_dump(mode="json"))


@router.post("/{repair_order_id}/return-factory", dependencies=[PgRepairStore])
def return_factory_endpoint(
    db: DbSession,
    repair_order_id: UUID,
    actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_EXTENDED_WORK)),
) -> dict:
    """§三·2"""
    try:
        row = _unpack_order(service.set_return_factory(db, repair_order_id))
        emit_audit(
            db,
            actor,
            action="REPAIR_ORDER_RETURN_FACTORY",
            object_type="repair_order",
            object_id=repair_order_id,
            after_data={"is_return_factory": True},
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_REPAIR_PG_NOT_READY) from exc
    return envelope_ok(data=row.model_dump(mode="json"))
