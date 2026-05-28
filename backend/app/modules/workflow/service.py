"""工作流领域服务 Phase 0：单笔待办完结即结单。"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Literal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.workflow.models import WfProcessInstance, WfUserTask
from app.modules.workflow.schemas import WorkflowStartBody

PENDING = "PENDING"
APPROVED = "APPROVED"
REJECTED = "REJECTED"
OPEN = "OPEN"
CLOSED = "CLOSED"
CANCELLED = "CANCELLED"


def task_to_api(r: WfUserTask) -> dict[str, Any]:
    return {
        "id": r.id,
        "instance_id": r.instance_id,
        "assignee_user_id": r.assignee_user_id,
        "status": r.status,
        "summary": r.summary,
        "outcome_comment": r.outcome_comment,
        "payload": dict(r.payload or {}),
        "created_at": r.created_at,
        "completed_at": r.completed_at,
    }


def instance_to_api(i: WfProcessInstance) -> dict[str, Any]:
    return {
        "id": i.id,
        "process_key": i.process_key,
        "title": i.title,
        "status": i.status,
        "started_by_user_id": i.started_by_user_id,
        "payload": dict(i.payload or {}),
        "started_at": i.started_at,
        "ended_at": i.ended_at,
    }


def start_process(
    db: Session,
    body: WorkflowStartBody,
    *,
    starter_user_id: UUID,
) -> tuple[WfProcessInstance, WfUserTask]:
    assignee = body.first_assignee_user_id or starter_user_id
    pid = uuid.uuid4()
    inst = WfProcessInstance(
        id=pid,
        process_key=body.process_key,
        title=body.title,
        status=OPEN,
        started_by_user_id=starter_user_id,
        payload=dict(body.payload),
    )
    db.add(inst)
    db.flush()

    tid = uuid.uuid4()
    task = WfUserTask(
        id=tid,
        instance_id=pid,
        assignee_user_id=assignee,
        status=PENDING,
        summary=f"待审批：{body.title}",
        payload={},
    )
    db.add(task)
    db.commit()
    db.refresh(inst)
    db.refresh(task)
    return inst, task


def list_my_pending_tasks(
    db: Session,
    *,
    assignee_user_id: UUID,
    page: int,
    page_size: int,
) -> tuple[list[WfUserTask], int]:
    j = WfUserTask.instance_id == WfProcessInstance.id
    filt = (
        WfUserTask.assignee_user_id == assignee_user_id,
        WfUserTask.status == PENDING,
        WfProcessInstance.status == OPEN,
    )
    cnt_stmt = (
        select(func.count(WfUserTask.id)).select_from(WfUserTask).join(WfProcessInstance, j).where(*filt)
    )
    total = int(db.scalar(cnt_stmt) or 0)

    stmt = (
        select(WfUserTask)
        .join(WfProcessInstance, j)
        .where(*filt)
        .order_by(WfUserTask.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = list(db.scalars(stmt).all())
    return rows, total


def approve_or_reject(
    db: Session,
    *,
    task_id: UUID,
    actor_user_id: UUID,
    is_admin_escalation: bool,
    decision: Literal["approve", "reject"],
    comment: str | None,
) -> tuple[str, Any]:
    task = db.get(WfUserTask, task_id)
    if task is None:
        return "not_found", "任务不存在"
    if task.status != PENDING:
        return "conflict", "任务当前状态不允许审批"

    assignee_ok = actor_user_id == task.assignee_user_id
    if not assignee_ok and not is_admin_escalation:
        return "forbidden", "仅待办认领人或全院管理员可操作"

    inst = db.get(WfProcessInstance, task.instance_id)
    if inst is None or inst.status != OPEN:
        return "conflict", "流程已结束"

    now = datetime.now(timezone.utc)
    if decision == "approve":
        task.status = APPROVED
        inst.status = CLOSED
    else:
        task.status = REJECTED
        inst.status = CANCELLED

    task.outcome_comment = comment
    task.completed_at = now
    inst.ended_at = now
    db.add(task)
    db.add(inst)
    db.commit()
    db.refresh(task)
    db.refresh(inst)
    return "ok", {
        "task": task_to_api(task),
        "instance": instance_to_api(inst),
    }
