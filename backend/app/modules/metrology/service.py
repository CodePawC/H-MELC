"""计量与合规领域查询与写入。"""

from __future__ import annotations

import uuid
from datetime import date, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.modules.asset.models import Asset
from app.modules.metrology.models import CalibrationPlan, MetrologyCertificate, MetrologyDevice
from app.modules.metrology.schemas import (
    CalibrationPlanUpsert,
    MetrologyCertificateCreate,
    MetrologyDeviceUpsert,
)


def _asset_exists(session: Session, asset_id: UUID) -> bool:
    return session.get(Asset, asset_id) is not None


def device_to_api(row: MetrologyDevice) -> dict[str, Any]:
    return {
        "id": row.id,
        "asset_id": row.asset_id,
        "regulatory_class": row.regulatory_class,
        "calibration_status": row.calibration_status,
        "meter_type": row.meter_type,
        "cycle_months": row.cycle_months,
        "last_calibrated_at": row.last_calibrated_at,
        "next_due_date": row.next_due_date,
        "issuing_body": row.issuing_body,
        "remark": row.remark,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def plan_to_api(row: CalibrationPlan) -> dict[str, Any]:
    return {
        "id": row.id,
        "asset_id": row.asset_id,
        "title": row.title,
        "planned_date": row.planned_date,
        "plan_status": row.plan_status,
        "assigned_org": row.assigned_org,
        "remark": row.remark,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def cert_to_api(row: MetrologyCertificate) -> dict[str, Any]:
    return {
        "id": row.id,
        "asset_id": row.asset_id,
        "certificate_no": row.certificate_no,
        "issued_at": row.issued_at,
        "valid_to": row.valid_to,
        "issuing_body": row.issuing_body,
        "conclusion": row.conclusion,
        "object_key": row.object_key,
        "mime_type": row.mime_type,
        "file_size": row.file_size,
        "created_at": row.created_at,
    }


def list_devices(
    session: Session,
    *,
    department_id: UUID | None,
    regulatory_class: str | None,
    calibration_status: str | None,
    page: int,
    page_size: int,
) -> tuple[list[MetrologyDevice], int]:
    parts: list[Any] = []
    if regulatory_class:
        parts.append(MetrologyDevice.regulatory_class == regulatory_class)
    if calibration_status:
        parts.append(MetrologyDevice.calibration_status == calibration_status)

    stmt = select(MetrologyDevice).order_by(MetrologyDevice.next_due_date.asc().nulls_last(), MetrologyDevice.created_at.desc())
    cnt_stmt = select(func.count(MetrologyDevice.id)).select_from(MetrologyDevice)
    if department_id is not None:
        stmt = stmt.join(Asset, Asset.id == MetrologyDevice.asset_id)
        cnt_stmt = cnt_stmt.join(Asset, Asset.id == MetrologyDevice.asset_id)
        parts.append(Asset.department_id == department_id)
    if parts:
        w = and_(*parts)
        stmt = stmt.where(w)
        cnt_stmt = cnt_stmt.where(w)
    total = int(session.scalar(cnt_stmt) or 0)
    rows = session.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return list(rows), total


def upsert_device(session: Session, body: MetrologyDeviceUpsert) -> MetrologyDevice | tuple[str, str]:
    if not _asset_exists(session, body.asset_id):
        return "not_found", "设备台账不存在"
    row = session.scalar(select(MetrologyDevice).where(MetrologyDevice.asset_id == body.asset_id))
    if row is None:
        row = MetrologyDevice(id=uuid.uuid4(), asset_id=body.asset_id)
    for k, v in body.model_dump().items():
        setattr(row, k, v)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def get_device_bundle(session: Session, asset_id: UUID) -> dict[str, Any] | None:
    device = session.scalar(select(MetrologyDevice).where(MetrologyDevice.asset_id == asset_id))
    if device is None:
        return None
    certs = session.scalars(
        select(MetrologyCertificate)
        .where(MetrologyCertificate.asset_id == asset_id)
        .order_by(MetrologyCertificate.valid_to.desc())
    ).all()
    plans = session.scalars(
        select(CalibrationPlan).where(CalibrationPlan.asset_id == asset_id).order_by(CalibrationPlan.planned_date.desc())
    ).all()
    return {
        "device": device_to_api(device),
        "certificates": [cert_to_api(x) for x in certs],
        "plans": [plan_to_api(x) for x in plans],
        "current_certificate": cert_to_api(certs[0]) if certs else None,
    }


def list_plans(
    session: Session,
    *,
    asset_id: UUID | None,
    plan_status: str | None,
    page: int,
    page_size: int,
) -> tuple[list[CalibrationPlan], int]:
    parts: list[Any] = []
    if asset_id is not None:
        parts.append(CalibrationPlan.asset_id == asset_id)
    if plan_status:
        parts.append(CalibrationPlan.plan_status == plan_status)
    stmt = select(CalibrationPlan).order_by(CalibrationPlan.planned_date.asc())
    cnt_stmt = select(func.count(CalibrationPlan.id)).select_from(CalibrationPlan)
    if parts:
        w = and_(*parts)
        stmt = stmt.where(w)
        cnt_stmt = cnt_stmt.where(w)
    total = int(session.scalar(cnt_stmt) or 0)
    rows = session.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return list(rows), total


def create_or_update_plan(session: Session, body: CalibrationPlanUpsert, plan_id: UUID | None = None) -> CalibrationPlan | tuple[str, str]:
    if not _asset_exists(session, body.asset_id):
        return "not_found", "设备台账不存在"
    row = session.get(CalibrationPlan, plan_id) if plan_id else None
    if plan_id and row is None:
        return "not_found", "检定计划不存在"
    if row is None:
        row = CalibrationPlan(id=uuid.uuid4())
    for k, v in body.model_dump().items():
        setattr(row, k, v)
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def list_certificates(
    session: Session,
    *,
    asset_id: UUID | None,
    valid_to_before: date | None,
    keyword: str | None,
    page: int,
    page_size: int,
) -> tuple[list[MetrologyCertificate], int]:
    parts: list[Any] = []
    if asset_id is not None:
        parts.append(MetrologyCertificate.asset_id == asset_id)
    if valid_to_before is not None:
        parts.append(MetrologyCertificate.valid_to <= valid_to_before)
    if keyword:
        like = f"%{keyword.strip()}%"
        parts.append(or_(MetrologyCertificate.certificate_no.ilike(like), MetrologyCertificate.issuing_body.ilike(like)))
    stmt = select(MetrologyCertificate).order_by(MetrologyCertificate.valid_to.asc())
    cnt_stmt = select(func.count(MetrologyCertificate.id)).select_from(MetrologyCertificate)
    if parts:
        w = and_(*parts)
        stmt = stmt.where(w)
        cnt_stmt = cnt_stmt.where(w)
    total = int(session.scalar(cnt_stmt) or 0)
    rows = session.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return list(rows), total


def create_certificate(session: Session, body: MetrologyCertificateCreate) -> MetrologyCertificate | tuple[str, str]:
    if not _asset_exists(session, body.asset_id):
        return "not_found", "设备台账不存在"
    row = MetrologyCertificate(id=uuid.uuid4(), **body.model_dump())
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def get_certificate(session: Session, certificate_id: UUID) -> MetrologyCertificate | None:
    return session.get(MetrologyCertificate, certificate_id)


def portfolio(session: Session, portfolio_code: str) -> dict[str, Any]:
    rows, total = list_devices(
        session,
        department_id=None,
        regulatory_class=portfolio_code,
        calibration_status=None,
        page=1,
        page_size=200,
    )
    return {"portfolio_code": portfolio_code, "total": total, "items": [device_to_api(x) for x in rows]}


def expiry_alerts(session: Session, *, within_days: int, department_id: UUID | None) -> list[dict[str, Any]]:
    today = date.today()
    end = today + timedelta(days=within_days)
    devices, _ = list_devices(
        session,
        department_id=department_id,
        regulatory_class=None,
        calibration_status=None,
        page=1,
        page_size=500,
    )
    out: list[dict[str, Any]] = []
    for d in devices:
        if d.next_due_date and d.next_due_date <= end:
            severity = "HIGH" if d.next_due_date < today else "MEDIUM"
            out.append(
                {
                    "asset_id": d.asset_id,
                    "alert_type": "CALIBRATION_DUE",
                    "due_date": d.next_due_date.isoformat(),
                    "severity": severity,
                    "calibration_status": d.calibration_status,
                }
            )
    certs = session.scalars(select(MetrologyCertificate).where(MetrologyCertificate.valid_to <= end)).all()
    for c in certs:
        severity = "HIGH" if c.valid_to < today else "MEDIUM"
        out.append(
            {
                "asset_id": c.asset_id,
                "certificate_id": c.id,
                "alert_type": "CERTIFICATE_EXPIRY",
                "due_date": c.valid_to.isoformat(),
                "severity": severity,
            }
        )
    return sorted(out, key=lambda x: (x["due_date"], x["alert_type"]))
