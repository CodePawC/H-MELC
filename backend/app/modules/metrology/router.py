"""计量与合规 API · docs/06 · 十一。"""

from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.core.audit_emit import emit_audit
from app.core.deps import DbSession
from app.core.responses import envelope_ok
from app.db.session import engine
from app.modules.auth.deps import require_roles
from app.modules.auth.rbac import RBAC_METROLOGY_READ, RBAC_METROLOGY_WRITE
from app.modules.auth.schemas import JwtClaims
from app.modules.metrology.schemas import (
    CalibrationPlanUpsert,
    MetrologyCertificateCreate,
    MetrologyDeviceUpsert,
)
from app.modules.metrology import service as mt_svc

router = APIRouter(prefix="/metrology", tags=["metrology"])

_PG_DETAIL = "计量与合规模块需在 PostgreSQL 执行 `alembic upgrade head`（含 e018_metrology_core）后使用。"
_SQL_FAIL = "计量与合规持久化查询失败：请确认 metrology schema 已创建并完成迁移。"


def _ensure_pg_metrology() -> None:
    if engine.dialect.name != "postgresql":
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PG_DETAIL)


PgMetrology = Depends(_ensure_pg_metrology)


def _unwrap(raw: object) -> object:
    if isinstance(raw, tuple):
        code, msg = raw
        if code == "not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
    return raw


@router.get("")
def metrology_root() -> dict[str, object]:
    return envelope_ok(
        data={
            "module": "metrology",
            "name": "计量与合规",
            "paths": {
                "devices": "/api/v1/metrology/devices",
                "calibration_plans": "/api/v1/metrology/calibration-plans",
                "certificates": "/api/v1/metrology/certificates",
                "alerts_expiry": "/api/v1/metrology/alerts/expiry",
            },
        }
    )


@router.get("/devices", dependencies=[PgMetrology])
def list_devices(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_METROLOGY_READ)),
    department_id: UUID | None = Query(None),
    regulatory_class: str | None = Query(None),
    calibration_status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    try:
        rows, total = mt_svc.list_devices(
            db,
            department_id=department_id,
            regulatory_class=regulatory_class,
            calibration_status=calibration_status,
            page=page,
            page_size=page_size,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data={"items": [mt_svc.device_to_api(x) for x in rows], "total": total, "page": page, "page_size": page_size})


@router.post("/devices", dependencies=[PgMetrology])
def upsert_device(
    db: DbSession,
    body: MetrologyDeviceUpsert,
    actor: JwtClaims = Depends(require_roles(*RBAC_METROLOGY_WRITE)),
) -> dict:
    try:
        row = _unwrap(mt_svc.upsert_device(db, body))
        emit_audit(db, actor, action="METROLOGY_DEVICE_UPSERT", object_type="metrology_device", object_id=row.id, after_data=body.model_dump(mode="json"))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data=mt_svc.device_to_api(row))


@router.get("/devices/{asset_id}", dependencies=[PgMetrology])
def get_device_bundle(
    db: DbSession,
    asset_id: UUID,
    _actor: JwtClaims = Depends(require_roles(*RBAC_METROLOGY_READ)),
) -> dict:
    try:
        data = mt_svc.get_device_bundle(db, asset_id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    if data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="计量档案不存在")
    return envelope_ok(data=data)


@router.get("/calibration-plans", dependencies=[PgMetrology])
def list_plans(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_METROLOGY_READ)),
    asset_id: UUID | None = Query(None),
    plan_status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    try:
        rows, total = mt_svc.list_plans(db, asset_id=asset_id, plan_status=plan_status, page=page, page_size=page_size)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data={"items": [mt_svc.plan_to_api(x) for x in rows], "total": total, "page": page, "page_size": page_size})


@router.post("/calibration-plans", dependencies=[PgMetrology])
def create_plan(
    db: DbSession,
    body: CalibrationPlanUpsert,
    actor: JwtClaims = Depends(require_roles(*RBAC_METROLOGY_WRITE)),
) -> dict:
    try:
        row = _unwrap(mt_svc.create_or_update_plan(db, body))
        emit_audit(db, actor, action="METROLOGY_PLAN_CREATE", object_type="calibration_plan", object_id=row.id, after_data=body.model_dump(mode="json"))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data=mt_svc.plan_to_api(row))


@router.patch("/calibration-plans/{plan_id}", dependencies=[PgMetrology])
def patch_plan(
    db: DbSession,
    plan_id: UUID,
    body: CalibrationPlanUpsert,
    actor: JwtClaims = Depends(require_roles(*RBAC_METROLOGY_WRITE)),
) -> dict:
    try:
        row = _unwrap(mt_svc.create_or_update_plan(db, body, plan_id=plan_id))
        emit_audit(db, actor, action="METROLOGY_PLAN_PATCH", object_type="calibration_plan", object_id=row.id, after_data=body.model_dump(mode="json"))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data=mt_svc.plan_to_api(row))


@router.get("/certificates", dependencies=[PgMetrology])
def list_certificates(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_METROLOGY_READ)),
    asset_id: UUID | None = Query(None),
    valid_to_before: date | None = Query(None),
    keyword: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    try:
        rows, total = mt_svc.list_certificates(db, asset_id=asset_id, valid_to_before=valid_to_before, keyword=keyword, page=page, page_size=page_size)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data={"items": [mt_svc.cert_to_api(x) for x in rows], "total": total, "page": page, "page_size": page_size})


@router.post("/certificates", dependencies=[PgMetrology])
def create_certificate(
    db: DbSession,
    body: MetrologyCertificateCreate,
    actor: JwtClaims = Depends(require_roles(*RBAC_METROLOGY_WRITE)),
) -> dict:
    try:
        row = _unwrap(mt_svc.create_certificate(db, body))
        emit_audit(db, actor, action="METROLOGY_CERTIFICATE_CREATE", object_type="metrology_certificate", object_id=row.id, after_data=body.model_dump(mode="json"))
    except HTTPException:
        raise
    except IntegrityError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="证书编号已存在") from exc
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data=mt_svc.cert_to_api(row))


@router.get("/certificates/{certificate_id}", dependencies=[PgMetrology])
def get_certificate(
    db: DbSession,
    certificate_id: UUID,
    _actor: JwtClaims = Depends(require_roles(*RBAC_METROLOGY_READ)),
) -> dict:
    try:
        row = mt_svc.get_certificate(db, certificate_id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="证书不存在")
    return envelope_ok(data=mt_svc.cert_to_api(row))


@router.get("/portfolios/{portfolio_code}", dependencies=[PgMetrology])
def get_portfolio(
    db: DbSession,
    portfolio_code: str,
    _actor: JwtClaims = Depends(require_roles(*RBAC_METROLOGY_READ)),
) -> dict:
    try:
        data = mt_svc.portfolio(db, portfolio_code)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data=data)


@router.get("/alerts/expiry", dependencies=[PgMetrology])
def alerts_expiry(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_METROLOGY_READ)),
    within_days: int = Query(30, ge=1, le=366),
    department_id: UUID | None = Query(None),
) -> dict:
    try:
        items = mt_svc.expiry_alerts(db, within_days=within_days, department_id=department_id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data={"items": items, "total": len(items), "within_days": within_days})
