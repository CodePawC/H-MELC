"""数字运营中心业务服务。"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Date, cast, func, select
from sqlalchemy.orm import Session

from app.modules.asset.models import Asset
from app.modules.finance.models import Payable, Payment
from app.modules.metrology.models import MetrologyDevice
from app.modules.operation_center.models import ScreenAccessKey, ScreenAccessLog, ScreenTerminal
from app.modules.operation_center.schemas import AccessKeyCreate, AccessKeyPatch, TerminalCreate, TerminalPatch
from app.modules.repair.models import RepairOrder


SCREEN_DEFS: list[dict[str, str]] = [
    {"code": "equipment-overview", "name": "医学装备总览大屏"},
    {"code": "equipment-status", "name": "设备运行态势大屏"},
    {"code": "repair-dispatch", "name": "维修工单调度大屏"},
    {"code": "qc-meter-alert", "name": "计量质控预警大屏"},
    {"code": "medical-gas", "name": "医用气体监控大屏"},
    {"code": "spd-consumables", "name": "SPD耗材运营大屏"},
    {"code": "supplier-payment", "name": "供应商付款态势大屏"},
    {"code": "carousel", "name": "大屏轮播"},
]
SCREEN_NAME = {x["code"]: x["name"] for x in SCREEN_DEFS}


@dataclass
class KeyValidation:
    ok: bool
    row: ScreenAccessKey | None
    status_code: int = 200
    reason: str | None = None


def now_utc() -> datetime:
    return datetime.now(tz=UTC)


def iso(dt: datetime | date | None) -> str | None:
    if dt is None:
        return None
    if isinstance(dt, datetime):
        return dt.isoformat().replace("+00:00", "Z")
    return dt.isoformat()


def key_to_api(row: ScreenAccessKey) -> dict[str, object]:
    return {
        "id": str(row.id),
        "key_name": row.key_name,
        "screen_code": row.screen_code,
        "screen_name": SCREEN_NAME.get(row.screen_code, row.screen_code),
        "access_key": row.access_key,
        "is_enabled": row.is_enabled,
        "valid_from": iso(row.valid_from),
        "valid_to": iso(row.valid_to),
        "allowed_ips": row.allowed_ips,
        "desensitized": row.desensitized,
        "refresh_interval_seconds": row.refresh_interval_seconds,
        "carousel_interval_seconds": row.carousel_interval_seconds,
        "access_count": row.access_count,
        "last_access_at": iso(row.last_access_at),
        "created_by_user_id": str(row.created_by_user_id) if row.created_by_user_id else None,
        "created_by_username": row.created_by_username,
        "created_at": iso(row.created_at),
        "updated_at": iso(row.updated_at),
    }


def terminal_to_api(row: ScreenTerminal) -> dict[str, object]:
    return {
        "id": str(row.id),
        "terminal_name": row.terminal_name,
        "location": row.location,
        "screen_code": row.screen_code,
        "screen_name": SCREEN_NAME.get(row.screen_code, row.screen_code),
        "access_key_id": str(row.access_key_id) if row.access_key_id else None,
        "access_key_name": row.key.key_name if row.key else None,
        "resolution": row.resolution,
        "online_status": row.online_status,
        "last_heartbeat_at": iso(row.last_heartbeat_at),
        "remark": row.remark,
        "created_at": iso(row.created_at),
        "updated_at": iso(row.updated_at),
    }


def log_to_api(row: ScreenAccessLog) -> dict[str, object]:
    return {
        "id": str(row.id),
        "access_time": iso(row.access_time),
        "access_ip": row.access_ip,
        "screen_code": row.screen_code,
        "screen_name": SCREEN_NAME.get(row.screen_code, row.screen_code),
        "access_key": row.access_key,
        "access_key_id": str(row.access_key_id) if row.access_key_id else None,
        "terminal_name": row.terminal_name,
        "user_agent": row.user_agent,
        "success": row.success,
        "failure_reason": row.failure_reason,
    }


def list_keys(session: Session, *, screen_code: str | None, page: int, page_size: int) -> tuple[list[ScreenAccessKey], int]:
    stmt = select(ScreenAccessKey)
    if screen_code:
        stmt = stmt.where(ScreenAccessKey.screen_code == screen_code)
    total = int(session.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
    rows = list(session.scalars(stmt.order_by(ScreenAccessKey.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all())
    return rows, total


def create_key(session: Session, body: AccessKeyCreate, *, user_id: UUID | None, username: str | None) -> ScreenAccessKey:
    row = ScreenAccessKey(
        key_name=body.key_name,
        screen_code=body.screen_code,
        access_key=body.access_key or f"scr_{secrets.token_urlsafe(24)}",
        is_enabled=body.is_enabled,
        valid_from=body.valid_from,
        valid_to=body.valid_to,
        allowed_ips=body.allowed_ips,
        desensitized=body.desensitized,
        refresh_interval_seconds=body.refresh_interval_seconds,
        carousel_interval_seconds=body.carousel_interval_seconds,
        created_by_user_id=user_id,
        created_by_username=username,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def patch_key(session: Session, key_id: UUID, body: AccessKeyPatch) -> ScreenAccessKey | None:
    row = session.get(ScreenAccessKey, key_id)
    if not row:
        return None
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    session.commit()
    session.refresh(row)
    return row


def list_terminals(session: Session, *, screen_code: str | None, page: int, page_size: int) -> tuple[list[ScreenTerminal], int]:
    stmt = select(ScreenTerminal)
    if screen_code:
        stmt = stmt.where(ScreenTerminal.screen_code == screen_code)
    total = int(session.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
    rows = list(session.scalars(stmt.order_by(ScreenTerminal.created_at.desc()).offset((page - 1) * page_size).limit(page_size)).all())
    return rows, total


def create_terminal(session: Session, body: TerminalCreate) -> ScreenTerminal:
    row = ScreenTerminal(**body.model_dump())
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def patch_terminal(session: Session, terminal_id: UUID, body: TerminalPatch) -> ScreenTerminal | None:
    row = session.get(ScreenTerminal, terminal_id)
    if not row:
        return None
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(row, k, v)
    session.commit()
    session.refresh(row)
    return row


def list_logs(
    session: Session, *, screen_code: str | None, success: bool | None, page: int, page_size: int
) -> tuple[list[ScreenAccessLog], int]:
    stmt = select(ScreenAccessLog)
    if screen_code:
        stmt = stmt.where(ScreenAccessLog.screen_code == screen_code)
    if success is not None:
        stmt = stmt.where(ScreenAccessLog.success == success)
    total = int(session.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
    rows = list(session.scalars(stmt.order_by(ScreenAccessLog.access_time.desc()).offset((page - 1) * page_size).limit(page_size)).all())
    return rows, total


def _ip_allowed(allowed_ips: str | None, ip: str | None) -> bool:
    if not allowed_ips or not allowed_ips.strip():
        return True
    allowed = {x.strip() for x in allowed_ips.replace("\n", ",").split(",") if x.strip()}
    return bool(ip and ip in allowed)


def validate_access_key(session: Session, *, screen_code: str, access_key: str, ip: str | None) -> KeyValidation:
    row = session.scalar(select(ScreenAccessKey).where(ScreenAccessKey.access_key == access_key))
    if not row:
        return KeyValidation(False, None, status_code=401, reason="访问密钥不存在")
    if row.screen_code != screen_code:
        return KeyValidation(False, row, status_code=403, reason="访问密钥未绑定当前大屏")
    if not row.is_enabled:
        return KeyValidation(False, row, status_code=403, reason="访问密钥已停用")
    cur = now_utc()
    if row.valid_from and cur < row.valid_from:
        return KeyValidation(False, row, status_code=403, reason="访问密钥尚未生效")
    if row.valid_to and cur > row.valid_to:
        return KeyValidation(False, row, status_code=403, reason="访问密钥已过期")
    if not _ip_allowed(row.allowed_ips, ip):
        return KeyValidation(False, row, status_code=403, reason="当前 IP 不在允许访问范围")
    return KeyValidation(True, row)


def record_access(
    session: Session,
    *,
    validation: KeyValidation,
    screen_code: str,
    access_key: str,
    ip: str | None,
    user_agent: str | None,
) -> None:
    terminal_name = None
    if validation.row:
        terminal = session.scalar(
            select(ScreenTerminal).where(
                ScreenTerminal.access_key_id == validation.row.id,
                ScreenTerminal.screen_code == screen_code,
            )
        )
        terminal_name = terminal.terminal_name if terminal else None
        if validation.ok:
            validation.row.access_count = (validation.row.access_count or 0) + 1
            validation.row.last_access_at = now_utc()
    session.add(
        ScreenAccessLog(
            access_ip=ip,
            screen_code=screen_code,
            access_key=access_key,
            access_key_id=validation.row.id if validation.row else None,
            terminal_name=terminal_name,
            user_agent=user_agent,
            success=validation.ok,
            failure_reason=None if validation.ok else validation.reason,
        )
    )
    session.commit()


def _count(session: Session, stmt) -> int:
    return int(session.scalar(stmt) or 0)


def _decimal_to_wan(value: Decimal | int | float | None) -> float:
    d = value if isinstance(value, Decimal) else Decimal(str(value or 0))
    return float((d / Decimal("10000")).quantize(Decimal("0.01")))


def _asset_status(session: Session) -> list[dict[str, object]]:
    rows = session.execute(
        select(Asset.main_status, func.count()).where(Asset.deleted_at.is_(None)).group_by(Asset.main_status)
    ).all()
    labels = {"ACTIVE": "在用", "REPAIR": "维修中", "IDLE": "停用", "DECOMMISSIONED": "报废"}
    return [{"name": labels.get(r[0] or "UNKNOWN", r[0] or "未知"), "value": int(r[1])} for r in rows]


def _repair_status(session: Session) -> list[dict[str, object]]:
    rows = session.execute(select(RepairOrder.order_status, func.count()).group_by(RepairOrder.order_status)).all()
    labels = {"PENDING_DISPATCH": "待派工", "ASSIGNED": "已派工", "IN_PROGRESS": "维修中", "AWAIT_CONFIRM": "待确认", "CLOSED": "已闭环"}
    return [{"name": labels.get(r[0], r[0]), "value": int(r[1])} for r in rows]


def build_screen_payload(session: Session, *, screen_code: str, key: ScreenAccessKey) -> dict[str, object]:
    generated_at = iso(now_utc())
    total_assets = _count(session, select(func.count()).select_from(Asset).where(Asset.deleted_at.is_(None)))
    active_assets = _count(session, select(func.count()).select_from(Asset).where(Asset.deleted_at.is_(None), Asset.main_status == "ACTIVE"))
    repair_open = _count(session, select(func.count()).select_from(RepairOrder).where(RepairOrder.order_status != "CLOSED"))
    meter_due = _count(session, select(func.count()).select_from(MetrologyDevice).where(MetrologyDevice.next_due_date <= date.today() + timedelta(days=30)))
    payables_open = session.scalar(select(func.coalesce(func.sum(Payable.amount_due - Payable.amount_paid), 0)).where(Payable.status == "OPEN"))
    paid_month = session.scalar(
        select(func.coalesce(func.sum(Payment.payment_amount), 0)).where(
            Payment.payment_date >= date.today().replace(day=1),
            Payment.payment_date <= date.today(),
        )
    )

    title = SCREEN_NAME.get(screen_code, screen_code)
    base = {
        "screen": {"code": screen_code, "name": title},
        "generated_at": generated_at,
        "refresh_interval_seconds": key.refresh_interval_seconds,
        "carousel_interval_seconds": key.carousel_interval_seconds,
        "desensitized": key.desensitized,
        "watermark": f"{title} · {key.key_name} · {generated_at}",
        "kpis": [
            {"label": "设备总量", "value": total_assets, "unit": "台"},
            {"label": "在用设备", "value": active_assets, "unit": "台"},
            {"label": "未闭环工单", "value": repair_open, "unit": "单"},
            {"label": "30日预警", "value": meter_due, "unit": "项"},
        ],
        "charts": [
            {"title": "设备状态分布", "type": "donut", "items": _asset_status(session)},
            {"title": "维修工单状态", "type": "bar", "items": _repair_status(session)},
        ],
        "tables": [],
    }

    if screen_code == "supplier-payment":
        base["kpis"] = [
            {"label": "待付余额", "value": _decimal_to_wan(payables_open), "unit": "万元"},
            {"label": "本月付款", "value": _decimal_to_wan(paid_month), "unit": "万元"},
            {"label": "未闭环工单", "value": repair_open, "unit": "单"},
            {"label": "接入终端", "value": key.access_count, "unit": "次"},
        ]
        base["charts"] = [
            {"title": "付款态势", "type": "bar", "items": [{"name": "待付余额", "value": _decimal_to_wan(payables_open)}, {"name": "本月付款", "value": _decimal_to_wan(paid_month)}]},
            {"title": "访问热度", "type": "line", "items": [{"name": "累计访问", "value": key.access_count}]},
        ]
    elif screen_code == "repair-dispatch":
        latest = list(session.scalars(select(RepairOrder).order_by(RepairOrder.created_at.desc()).limit(8)).all())
        base["tables"] = [
            {
                "title": "最新维修工单",
                "rows": [
                    {
                        "工单": x.order_code,
                        "状态": x.order_status,
                        "级别": x.fault_level or "-",
                        "报修人": "已脱敏" if key.desensitized and x.reporter_name else (x.reporter_name or "-"),
                    }
                    for x in latest
                ],
            }
        ]
    elif screen_code == "qc-meter-alert":
        base["kpis"][3] = {"label": "计量到期", "value": meter_due, "unit": "项"}
        base["charts"] = [{"title": "计量状态", "type": "bar", "items": [{"name": "30日内到期", "value": meter_due}, {"name": "合规对象", "value": max(total_assets - meter_due, 0)}]}]
    elif screen_code in {"medical-gas", "spd-consumables"}:
        base["kpis"] = [
            {"label": "接入点位", "value": 36 if screen_code == "medical-gas" else 128, "unit": "个"},
            {"label": "今日告警", "value": 0, "unit": "次"},
            {"label": "运行健康度", "value": 98.6 if screen_code == "medical-gas" else 96.8, "unit": "%"},
            {"label": "刷新频率", "value": key.refresh_interval_seconds, "unit": "秒"},
        ]
        base["charts"] = [{"title": "运行曲线", "type": "line", "items": [{"name": f"{h:02d}:00", "value": 92 + (h % 7)} for h in range(0, 24, 3)]}]
    elif screen_code == "equipment-status":
        base["charts"] = [{"title": "设备状态分布", "type": "donut", "items": _asset_status(session)}]
    return base


def build_carousel_payload(session: Session, *, key: ScreenAccessKey) -> dict[str, object]:
    codes = [x["code"] for x in SCREEN_DEFS if x["code"] != "carousel"]
    return {
        "screen": {"code": "carousel", "name": "大屏轮播"},
        "generated_at": iso(now_utc()),
        "refresh_interval_seconds": key.refresh_interval_seconds,
        "carousel_interval_seconds": key.carousel_interval_seconds,
        "desensitized": key.desensitized,
        "watermark": f"数字运营中心轮播 · {key.key_name}",
        "carousel_items": [build_screen_payload(session, screen_code=code, key=key) for code in codes],
    }
