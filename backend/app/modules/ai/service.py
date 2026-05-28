"""AI 任务领域逻辑：同步占位管线（创建即完成直至接入队列）。"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.modules.ai.models import AiResult, AiTask
from app.modules.ai.schemas import AiResultReviewBody


def create_ai_task_stub(
    db: Session,
    *,
    task_type: str,
    payload: dict[str, Any],
    created_by_user_id: UUID | None,
    autocommit: bool = True,
) -> tuple[AiTask, AiResult]:
    """创建任务并以占位输出立即标记为完成；后续可替换为 enqueue + worker。

    `autocommit=False` 时仅 flush，由调用方统一 commit（如财务发票与 finance.invoice 同事务）。
    """
    task = AiTask(
        id=uuid.uuid4(),
        task_type=task_type,
        status="RUNNING",
        input_payload=dict(payload),
        created_by_user_id=created_by_user_id,
    )
    db.add(task)
    db.flush()

    out = {
        "stub": True,
        "note": "AI 占位完成：异步推理将由 ai-service/队列接管；参见 docs/04_AI设计/。",
        "task_type": task_type,
        "accepted_input_keys": sorted(payload.keys()),
    }
    result = AiResult(
        id=uuid.uuid4(),
        task_id=task.id,
        output_payload=out,
        review_status="PENDING",
    )
    db.add(result)
    db.flush()

    task.status = "SUCCEEDED"
    db.add(task)
    db.flush()
    if autocommit:
        db.commit()
        db.refresh(task)
        db.refresh(result)
    return task, result


def get_task_detail(db: Session, task_id: UUID) -> AiTask | None:
    stmt = select(AiTask).where(AiTask.id == task_id).options(joinedload(AiTask.result))
    return db.execute(stmt).unique().scalar_one_or_none()


def get_result_detail(db: Session, result_id: UUID) -> AiResult | None:
    return db.get(AiResult, result_id)


def review_result(db: Session, result_id: UUID, body: AiResultReviewBody, reviewer_id: UUID) -> AiResult | None:
    row = db.get(AiResult, result_id)
    if row is None:
        return None
    row.review_status = body.confirm_status
    row.review_comment = body.comment
    row.reviewed_by_user_id = reviewer_id
    row.reviewed_at = datetime.now(timezone.utc)
    db.add(row)
    associated = db.get(AiTask, row.task_id)
    if associated is not None:
        associated.updated_at = datetime.now(timezone.utc)
        db.add(associated)
    db.commit()
    db.refresh(row)
    return row


def task_to_read(task: AiTask) -> dict[str, Any]:
    rid = task.result.id if task.result is not None else None
    return {
        "id": task.id,
        "task_type": task.task_type,
        "status": task.status,
        "input_payload": dict(task.input_payload or {}),
        "error_message": task.error_message,
        "result_id": rid,
        "created_at": task.created_at,
    }


def result_to_read(row: AiResult) -> dict[str, Any]:
    return {
        "id": row.id,
        "task_id": row.task_id,
        "output_payload": dict(row.output_payload or {}),
        "review_status": row.review_status,
        "review_comment": row.review_comment,
        "reviewed_by_user_id": row.reviewed_by_user_id,
        "reviewed_at": row.reviewed_at,
        "created_at": row.created_at,
    }
