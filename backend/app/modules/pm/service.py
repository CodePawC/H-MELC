"""PM 领域服务 · docs/06 · 十"""

from __future__ import annotations

import calendar
import uuid
from datetime import UTC, date, datetime
from uuid import UUID

from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.asset.models import Asset
from app.modules.pm.models import PmInspectionTask, PmPlan, PmTask
from app.modules.pm.schemas import PmInspectionTaskRead, PmPlanCreate, PmPlanPatch, PmPlanRead, PmTaskRead


FREQUENCY_MONTHS = {"MONTHLY": 1, "QUARTERLY": 3, "SEMI_ANNUAL": 6, "YEARLY": 12}


def add_months(base: date, months_delta: int) -> date:
    y, m = base.year, base.month + months_delta
    while m > 12:
        y += 1
        m -= 12
    while m < 1:
        y -= 1
        m += 12
    last_day = calendar.monthrange(y, m)[1]
    return date(y, m, min(base.day, last_day))


def next_cycle_due(from_day: date, frequency: str) -> date:
    md = FREQUENCY_MONTHS.get(frequency.upper(), 1)
    return add_months(from_day, md)


def _norm_page(page: int, page_size: int) -> tuple[int, int]:
    return max(1, page), min(100, max(1, page_size))


def asset_exists(session: Session, asset_id: UUID) -> bool:
    stmt = select(func.count()).select_from(Asset).where(Asset.id == asset_id, Asset.deleted_at.is_(None))
    return int(session.scalar(stmt) or 0) > 0


def plan_to_read(p: PmPlan) -> PmPlanRead:
    return PmPlanRead.model_validate(p)


def task_to_read(t: PmTask) -> PmTaskRead:
    return PmTaskRead.model_validate(t)


def inspection_to_read(r: PmInspectionTask) -> PmInspectionTaskRead:
    return PmInspectionTaskRead.model_validate(r)


def ensure_initial_task(session: Session, plan: PmPlan) -> None:
    if plan.plan_status != "ACTIVE":
        return
    cnt = session.scalar(select(func.count()).select_from(PmTask).where(PmTask.plan_id == plan.id)) or 0
    if int(cnt) > 0:
        return
    t = PmTask(
        id=uuid.uuid4(),
        plan_id=plan.id,
        asset_id=plan.asset_id,
        due_date=plan.next_due_date,
        task_status="PENDING",
    )
    session.add(t)


def list_plans(
    session: Session,
    *,
    keyword: str | None,
    asset_id: UUID | None,
    department_id: UUID | None,
    plan_status: str | None,
    date_from: date | None,
    date_to: date | None,
    page: int,
    page_size: int,
) -> tuple[list[PmPlanRead], int]:
    p, ps = _norm_page(page, page_size)
    conds = []
    if keyword:
        like = f"%{keyword}%"
        conds.append(or_(PmPlan.title.ilike(like), PmPlan.code.ilike(like)))
    if asset_id:
        conds.append(PmPlan.asset_id == asset_id)
    if department_id:
        conds.append(PmPlan.owner_department_id == department_id)
    if plan_status:
        conds.append(PmPlan.plan_status == plan_status)
    if date_from:
        conds.append(PmPlan.next_due_date >= date_from)
    if date_to:
        conds.append(PmPlan.next_due_date <= date_to)

    stmt = select(PmPlan)
    count_stmt = select(func.count()).select_from(PmPlan)
    if conds:
        stmt = stmt.where(and_(*conds))
        count_stmt = count_stmt.where(and_(*conds))
    total = int(session.scalar(count_stmt) or 0)
    stmt = stmt.order_by(PmPlan.next_due_date.asc(), PmPlan.updated_at.desc()).offset((p - 1) * ps).limit(ps)
    rows = list(session.scalars(stmt).all())
    return [plan_to_read(x) for x in rows], total


def create_plan(session: Session, body: PmPlanCreate) -> PmPlanRead | tuple[str, str]:
    if not asset_exists(session, body.asset_id):
        return ("bad_request", "asset_id 不存在或已删除")
    plan = PmPlan(
        id=uuid.uuid4(),
        title=body.title,
        code=body.code,
        asset_id=body.asset_id,
        frequency=body.frequency,
        next_due_date=body.next_due_date,
        owner_department_id=body.owner_department_id,
        mdm_department_id=body.mdm_department_id,
        department_code=body.department_code,
        department_name=body.department_name,
        department_source=body.department_source,
        department_version=body.department_version,
        department_synced_at=body.department_synced_at or (datetime.now(tz=UTC) if body.department_source == "h-mdm" else None),
        description=body.description,
        plan_status=body.plan_status,
    )
    session.add(plan)
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        return ("conflict", "计划编码 code 已存在")
    ensure_initial_task(session, plan)
    session.commit()
    session.refresh(plan)
    return plan_to_read(plan)


def get_plan(session: Session, plan_id: UUID) -> PmPlanRead | None:
    p = session.get(PmPlan, plan_id)
    return plan_to_read(p) if p else None


def patch_plan(session: Session, plan_id: UUID, body: PmPlanPatch) -> PmPlanRead | tuple[str, str]:
    p = session.get(PmPlan, plan_id)
    if not p:
        return ("not_found", "计划不存在")
    data = body.model_dump(exclude_unset=True)
    if "code" in data and data["code"] is None:
        p.code = None
        data.pop("code", None)
    for k, v in data.items():
        setattr(p, k, v)
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        return ("conflict", "计划编码 code 已存在")
    ensure_initial_task(session, p)
    session.commit()
    session.refresh(p)
    return plan_to_read(p)


def list_tasks(
    session: Session,
    *,
    plan_id: UUID | None,
    asset_id: UUID | None,
    task_status: str | None,
    assigned_engineer_id: UUID | None,
    date_from: date | None,
    date_to: date | None,
    page: int,
    page_size: int,
) -> tuple[list[PmTaskRead], int]:
    p, ps = _norm_page(page, page_size)
    today = datetime.now(tz=UTC).date()
    conds = []
    if plan_id:
        conds.append(PmTask.plan_id == plan_id)
    if asset_id:
        conds.append(PmTask.asset_id == asset_id)
    if assigned_engineer_id:
        conds.append(PmTask.assigned_engineer_id == assigned_engineer_id)
    if date_from:
        conds.append(PmTask.due_date >= date_from)
    if date_to:
        conds.append(PmTask.due_date <= date_to)
    if task_status:
        if task_status == "OVERDUE":
            conds.append(
                and_(
                    PmTask.task_status.in_(("PENDING", "IN_PROGRESS")),
                    PmTask.due_date < today,
                ),
            )
        else:
            conds.append(PmTask.task_status == task_status)

    stmt = select(PmTask)
    count_stmt = select(func.count()).select_from(PmTask)
    if conds:
        stmt = stmt.where(and_(*conds))
        count_stmt = count_stmt.where(and_(*conds))
    total = int(session.scalar(count_stmt) or 0)
    stmt = stmt.order_by(PmTask.due_date.asc(), PmTask.created_at.desc()).offset((p - 1) * ps).limit(ps)
    rows = list(session.scalars(stmt).all())
    return [task_to_read(x) for x in rows], total


def complete_task(
    session: Session,
    task_id: UUID,
    *,
    result_summary: str | None,
    executed_at: datetime | None,
    engineer_id: UUID | None,
    actor_sub: UUID,
    mdm_person_id: str | None = None,
    person_code: str | None = None,
    person_name: str | None = None,
    person_source: str | None = None,
    person_version: str | None = None,
    person_synced_at: datetime | None = None,
) -> PmTaskRead | tuple[str, str]:
    task = session.get(PmTask, task_id)
    if not task:
        return ("not_found", "任务不存在")
    if task.task_status == "DONE":
        return ("conflict", "任务已完成")

    plan = session.get(PmPlan, task.plan_id)
    if not plan:
        return ("bad_request", "所属计划不存在")

    done_at = executed_at or datetime.now(tz=UTC)
    eng = engineer_id or actor_sub

    task.task_status = "DONE"
    task.result_summary = result_summary
    task.executed_at = done_at
    task.assigned_engineer_id = eng
    task.mdm_person_id = mdm_person_id
    task.person_code = person_code
    task.person_name = person_name
    task.person_source = person_source
    task.person_version = person_version
    task.person_synced_at = person_synced_at or (datetime.now(tz=UTC) if person_source == "h-mdm" else None)

    if plan.plan_status == "ACTIVE":
        base_day = max(task.due_date, done_at.date())
        plan.next_due_date = next_cycle_due(base_day, plan.frequency)
        nxt = PmTask(
            id=uuid.uuid4(),
            plan_id=plan.id,
            asset_id=plan.asset_id,
            due_date=plan.next_due_date,
            task_status="PENDING",
        )
        session.add(nxt)

    session.commit()
    session.refresh(task)
    return task_to_read(task)


def list_inspection_tasks(
    session: Session,
    *,
    inspection_type: str | None,
    department_id: UUID | None,
    task_status: str | None,
    date_from: date | None,
    date_to: date | None,
    page: int,
    page_size: int,
) -> tuple[list[PmInspectionTaskRead], int]:
    p, ps = _norm_page(page, page_size)
    today = datetime.now(tz=UTC).date()
    conds = []
    if inspection_type:
        conds.append(PmInspectionTask.inspection_type == inspection_type)
    if department_id:
        conds.append(PmInspectionTask.department_id == department_id)
    if date_from:
        conds.append(PmInspectionTask.due_date >= date_from)
    if date_to:
        conds.append(PmInspectionTask.due_date <= date_to)
    if task_status:
        if task_status == "OVERDUE":
            conds.append(
                and_(
                    PmInspectionTask.task_status.in_(("PENDING", "IN_PROGRESS")),
                    PmInspectionTask.due_date < today,
                ),
            )
        else:
            conds.append(PmInspectionTask.task_status == task_status)

    stmt = select(PmInspectionTask)
    count_stmt = select(func.count()).select_from(PmInspectionTask)
    if conds:
        stmt = stmt.where(and_(*conds))
        count_stmt = count_stmt.where(and_(*conds))
    total = int(session.scalar(count_stmt) or 0)
    stmt = stmt.order_by(PmInspectionTask.due_date.asc()).offset((p - 1) * ps).limit(ps)
    rows = list(session.scalars(stmt).all())
    return [inspection_to_read(x) for x in rows], total


def submit_inspection_record(
    session: Session,
    inspection_task_id: UUID,
    *,
    checklist_result: dict,
    remark: str | None,
    inspector_id: UUID | None,
    actor_sub: UUID,
) -> PmInspectionTaskRead | tuple[str, str]:
    row = session.get(PmInspectionTask, inspection_task_id)
    if not row:
        return ("not_found", "巡检任务不存在")
    if row.task_status == "DONE":
        return ("conflict", "巡检任务已完成")

    row.checklist_result = checklist_result
    row.remark = remark
    row.inspector_id = inspector_id or actor_sub
    row.inspected_at = datetime.now(tz=UTC)
    row.task_status = "DONE"
    session.commit()
    session.refresh(row)
    return inspection_to_read(row)


def emergency_readiness(session: Session) -> dict[str, object]:
    now = datetime.now(tz=UTC)
    window_start = date(now.year, now.month, now.day)
    # 占位统计：按 EMERGENCY_READINESS 巡检任务 DONE / 应完成（窗口内到期）
    due_any = (
        select(func.count())
        .select_from(PmInspectionTask)
        .where(
            PmInspectionTask.inspection_type == "EMERGENCY_READINESS",
            PmInspectionTask.due_date <= window_start,
        )
    )
    due_done = (
        select(func.count())
        .select_from(PmInspectionTask)
        .where(
            PmInspectionTask.inspection_type == "EMERGENCY_READINESS",
            PmInspectionTask.due_date <= window_start,
            PmInspectionTask.task_status == "DONE",
        )
    )
    total = int(session.scalar(due_any) or 0)
    done = int(session.scalar(due_done) or 0)
    rate = float(done / total) if total else None
    return {
        "generated_at": now.isoformat().replace("+00:00", "Z"),
        "window_days": 0,
        "should_inspect": total,
        "actually_inspected": done,
        "readiness_rate": rate,
        "by_department": [],
        "note": "专项巡检需在系统中创建 inspection_type=EMERGENCY_READINESS 的任务后纳入统计",
    }


def list_overdue_alerts(session: Session, *, limit: int = 100) -> list[dict[str, object]]:
    today = datetime.now(tz=UTC).date()
    lim = min(max(limit, 1), 500)
    out: list[dict[str, object]] = []

    pt_stmt = (
        select(PmTask)
        .where(
            PmTask.task_status.in_(("PENDING", "IN_PROGRESS")),
            PmTask.due_date < today,
        )
        .order_by(PmTask.due_date.asc())
        .limit(lim)
    )
    for t in session.scalars(pt_stmt).all():
        out.append(
            {
                "task_id": str(t.id),
                "type": "PM",
                "due_date": t.due_date.isoformat(),
                "asset_id": str(t.asset_id),
                "plan_id": str(t.plan_id),
                "task_status": t.task_status,
            }
        )

    insp_stmt = (
        select(PmInspectionTask)
        .where(
            PmInspectionTask.task_status.in_(("PENDING", "IN_PROGRESS")),
            PmInspectionTask.due_date < today,
        )
        .order_by(PmInspectionTask.due_date.asc())
        .limit(lim)
    )
    for r in session.scalars(insp_stmt).all():
        out.append(
            {
                "task_id": str(r.id),
                "type": "INSPECTION",
                "due_date": r.due_date.isoformat(),
                "asset_id": str(r.asset_id) if r.asset_id else None,
                "inspection_type": r.inspection_type,
                "task_status": r.task_status,
            }
        )

    out.sort(key=lambda x: x["due_date"])
    return out[:lim]
