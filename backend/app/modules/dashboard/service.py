"""工作台驾驶舱聚合查询。

对齐 docs/06_接口设计/01_API接口设计.md · 「工作台」院内首页汇总与专用统计接口。
数据来源：asset.asset、repair.repair_order、finance.*、workflow.*（须 PostgreSQL 且已完成迁移）。
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import Date, cast, func, select
from sqlalchemy.orm import Session

from app.modules.asset.models import Asset
from app.modules.finance.models import Payable, Payment
from app.modules.repair.models import RepairOrder
from app.modules.workflow import service as wf_svc
from app.modules.workflow.models import WfProcessInstance

# docs/01_需求文档/05 · docs/03 数据字典；未知枚举透传 code 便于排查
MAIN_STATUS_LABEL: dict[str, str] = {
    "ACTIVE": "在用",
    "REPAIR": "维修中",
    "UNDER_REPAIR": "维修中",
    "IDLE": "停用",
    "STANDBY": "停用",
    "DECOMMISSIONED": "报废",
    "SCRAPPED": "报废",
    "PENDING_ACCEPTANCE": "待验收",
    "PENDING_INSTALLATION": "待装机",
}


ORDER_STATUS_LABEL: dict[str, str] = {
    "PENDING_DISPATCH": "待派工",
    "ASSIGNED": "已派工",
    "IN_PROGRESS": "维修中",
    "AWAIT_CONFIRM": "待确认",
    "CLOSED": "已闭环",
}


def hospital_summary(session: Session) -> dict[str, object]:
    generated_at = datetime.now(tz=UTC).isoformat().replace("+00:00", "Z")

    # —— 台账 ——
    total_assets_stmt = select(func.count()).select_from(Asset).where(Asset.deleted_at.is_(None))
    total_assets = int(session.execute(total_assets_stmt).scalar_one())

    status_stmt = (
        select(Asset.main_status, func.count())
        .where(Asset.deleted_at.is_(None))
        .group_by(Asset.main_status)
        .order_by(func.count().desc())
    )
    status_rows = session.execute(status_stmt).all()
    by_main_status = [
        {
            "code": row[0] or "UNKNOWN",
            "label": MAIN_STATUS_LABEL.get(row[0] or "", row[0] or "未知"),
            "count": int(row[1]),
        }
        for row in status_rows
    ]

    # PostgreSQL：SELECT 与 GROUP BY 须为同一 coalesce 表达式对象，否则各自绑定字面量易触发 GroupingError
    category_bucket = func.coalesce(Asset.category_code, "UNKNOWN")
    cat_stmt = (
        select(category_bucket.label("category_code"), func.count().label("cnt"))
        .where(Asset.deleted_at.is_(None))
        .group_by(category_bucket)
        .order_by(func.count().desc())
        .limit(12)
    )
    cat_rows = session.execute(cat_stmt).all()
    top_categories = [{"category_code": str(r[0]), "count": int(r[1])} for r in cat_rows]

    active_stmt = (
        select(func.count())
        .select_from(Asset)
        .where(Asset.deleted_at.is_(None), Asset.main_status == "ACTIVE")
    )
    active_count = int(session.execute(active_stmt).scalar_one())

    # —— 报修工单 ——
    os_stmt = select(RepairOrder.order_status, func.count()).group_by(RepairOrder.order_status)
    os_rows = session.execute(os_stmt).all()
    by_order_status = [
        {
            "status": row[0],
            "label": ORDER_STATUS_LABEL.get(row[0], row[0]),
            "count": int(row[1]),
        }
        for row in sorted(os_rows, key=lambda x: -x[1])
    ]

    open_stmt = select(func.count()).select_from(RepairOrder).where(RepairOrder.order_status != "CLOSED")
    open_orders = int(session.execute(open_stmt).scalar_one())

    today_trunc = func.date_trunc("day", func.now())
    created_trunc = func.date_trunc("day", RepairOrder.created_at)
    today_stmt = (
        select(func.count()).select_from(RepairOrder).where(created_trunc == today_trunc)
    )
    today_created = int(session.execute(today_stmt).scalar_one())

    return {
        "generated_at": generated_at,
        "assets": {
            "total": total_assets,
            "active_count": active_count,
            "by_main_status": by_main_status,
            "top_categories": top_categories,
        },
        "repairs": {
            "today_created": today_created,
            "open_orders": open_orders,
            "by_order_status": by_order_status,
        },
    }


def repair_trend(session: Session, *, days: int) -> dict[str, object]:
    """按自然日聚合工单新建数与完成数（completed_at 非空）。对齐 docs/06 · GET /dashboard/repair-trend。"""
    generated_at = datetime.now(tz=UTC).isoformat().replace("+00:00", "Z")
    days_i = max(1, min(int(days), 90))
    end_d = datetime.now(tz=UTC).date()
    start_d = end_d - timedelta(days=days_i - 1)
    start_dt = datetime.combine(start_d, datetime.min.time(), tzinfo=UTC)

    bucket_created = cast(func.date_trunc("day", RepairOrder.created_at), Date)
    stmt_r = (
        select(bucket_created, func.count())
        .where(RepairOrder.created_at >= start_dt)
        .group_by(bucket_created)
    )
    rep_map: dict[date, int] = {row[0]: int(row[1]) for row in session.execute(stmt_r).all() if row[0] is not None}

    bucket_done = cast(func.date_trunc("day", RepairOrder.completed_at), Date)
    stmt_c = (
        select(bucket_done, func.count())
        .where(
            RepairOrder.completed_at.is_not(None),
            RepairOrder.completed_at >= start_dt,
        )
        .group_by(bucket_done)
    )
    comp_map: dict[date, int] = {row[0]: int(row[1]) for row in session.execute(stmt_c).all() if row[0] is not None}

    labels: list[str] = []
    reported: list[int] = []
    completed: list[int] = []
    cur = start_d
    while cur <= end_d:
        labels.append(f"{cur.month:02d}-{cur.day:02d}")
        reported.append(rep_map.get(cur, 0))
        completed.append(comp_map.get(cur, 0))
        cur += timedelta(days=1)

    return {
        "generated_at": generated_at,
        "days": days_i,
        "labels": labels,
        "reported": reported,
        "completed": completed,
    }


def finance_payment_summary(session: Session, *, days: int) -> dict[str, object]:
    """财务应付/付款仪表盘柱状图数据（金额单位为万元人民币）。对齐 docs/06 · GET /dashboard/finance-payment-summary。"""
    generated_at = datetime.now(tz=UTC).isoformat().replace("+00:00", "Z")
    days_i = max(1, min(int(days), 366))
    end_d = datetime.now(tz=UTC).date()
    start_d = end_d - timedelta(days=days_i - 1)
    start_dt = datetime.combine(start_d, datetime.min.time(), tzinfo=UTC)
    end_exclusive = datetime.combine(end_d + timedelta(days=1), datetime.min.time(), tzinfo=UTC)

    paid_total = session.scalar(
        select(func.coalesce(func.sum(Payment.payment_amount), 0)).where(
            Payment.payment_date >= start_d,
            Payment.payment_date <= end_d,
        )
    )
    if paid_total is None:
        paid_total = Decimal("0")
    elif not isinstance(paid_total, Decimal):
        paid_total = Decimal(str(paid_total))

    payables_created = session.scalar(
        select(func.coalesce(func.sum(Payable.amount_due), 0)).where(
            Payable.created_at >= start_dt,
            Payable.created_at < end_exclusive,
        )
    )
    payables_created = payables_created if isinstance(payables_created, Decimal) else Decimal(str(payables_created or 0))

    open_status = Payable.status == "OPEN"
    full_unpaid = session.scalar(
        select(func.coalesce(func.sum(Payable.amount_due), 0)).where(open_status, Payable.amount_paid == 0)
    )
    full_unpaid = full_unpaid if isinstance(full_unpaid, Decimal) else Decimal(str(full_unpaid or 0))

    partial_rem = session.scalar(
        select(func.coalesce(func.sum(Payable.amount_due - Payable.amount_paid), 0)).where(
            open_status,
            Payable.amount_paid > 0,
            Payable.amount_due > Payable.amount_paid,
        )
    )
    partial_rem = partial_rem if isinstance(partial_rem, Decimal) else Decimal(str(partial_rem or 0))

    overdue_rem = session.scalar(
        select(func.coalesce(func.sum(Payable.amount_due - Payable.amount_paid), 0)).where(
            open_status,
            Payable.due_date.is_not(None),
            Payable.due_date < end_d,
            Payable.amount_due > Payable.amount_paid,
        )
    )
    overdue_rem = overdue_rem if isinstance(overdue_rem, Decimal) else Decimal(str(overdue_rem or 0))

    def wan(x: Decimal) -> float:
        return float((x / Decimal("10000")).quantize(Decimal("0.01")))

    bars: list[dict[str, object]] = [
        {"key": "payables_period_face", "name": "发票金额", "value": wan(payables_created)},
        {"key": "paid_in_period", "name": "已付款", "value": wan(paid_total)},
        {"key": "open_full_unpaid", "name": "未付款", "value": wan(full_unpaid)},
        {"key": "open_partial_balance", "name": "部分付款", "value": wan(partial_rem)},
        {"key": "open_overdue_balance", "name": "逾期付款", "value": wan(overdue_rem)},
    ]

    return {
        "generated_at": generated_at,
        "window_days": days_i,
        "amount_unit": "CNY_WAN",
        "bars": bars,
    }


def workspace_tasks(session: Session, *, user_id: UUID, task_limit: int) -> dict[str, object]:
    """当前用户待办工作流任务 + 未闭环工单摘要以供工作台列表。对齐 docs/06 · GET /dashboard/workspace-tasks。"""
    generated_at = datetime.now(tz=UTC).isoformat().replace("+00:00", "Z")
    lim = max(1, min(int(task_limit), 30))
    rows, total = wf_svc.list_my_pending_tasks(session, assignee_user_id=user_id, page=1, page_size=lim)

    items: list[dict[str, object]] = []
    for r in rows:
        inst = session.get(WfProcessInstance, r.instance_id)
        items.append(
            {
                "task_id": str(r.id),
                "instance_id": str(r.instance_id),
                "summary": r.summary,
                "process_key": inst.process_key if inst else None,
                "instance_title": inst.title if inst else None,
                "created_at": r.created_at.isoformat().replace("+00:00", "Z") if r.created_at else None,
            }
        )

    open_repairs = list(
        session.scalars(
            select(RepairOrder)
            .where(RepairOrder.order_status != "CLOSED")
            .order_by(RepairOrder.created_at.desc())
            .limit(6)
        ).all()
    )
    repairs_preview = [
        {
            "id": str(o.id),
            "order_code": o.order_code,
            "status": o.order_status,
            "fault_preview": (o.fault_description or "")[:120],
            "created_at": o.created_at.isoformat().replace("+00:00", "Z") if o.created_at else None,
        }
        for o in open_repairs
    ]

    return {
        "generated_at": generated_at,
        "workflow": {"total": total, "items": items},
        "repairs_preview": repairs_preview,
    }
