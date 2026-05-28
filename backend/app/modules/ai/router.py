"""AI 网关 API。

对齐：docs/06_接口设计/01_API接口设计.md §六 · `POST /ai/tasks`、`GET /ai/tasks/{id}`、`GET /ai/results/{id}`、`POST /ai/results/{id}/review`。
占位实现：入库并同步写入占位结果；真正推理由 ai-service/队列接替。
已连 PG 但未建 `ai` 相关表时：路由内捕获 SQL 异常返回 **503**。
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError

from app.core.audit_emit import emit_audit
from app.core.deps import DbSession
from app.core.responses import envelope_ok
from app.db.session import engine
from app.modules.ai.schemas import AiResultReviewBody, AiTaskCreate
from app.modules.ai import service
from app.modules.auth.deps import require_roles
from app.modules.auth.rbac import RBAC_AI_RESULT_REVIEW, RBAC_AI_TASK_CREATE, RBAC_AI_TASK_READ
from app.modules.auth.schemas import JwtClaims

router = APIRouter(prefix="/ai", tags=["ai"])


def _ensure_pg_ai() -> None:
    if engine.dialect.name != "postgresql":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI 任务台账需在 PostgreSQL 执行 `alembic upgrade head`（含 e007_ai_knowledge）后使用。",
        )


PgAiStore = Depends(_ensure_pg_ai)

_AI_PG_NOT_READY = (
    "AI 任务/结果持久化未就绪：请在目标库执行 alembic upgrade head（含 e007_ai_knowledge）。"
)


@router.get("", summary="模块信息（兼容早期占位契约）")
def ai_root() -> dict[str, object]:
    return envelope_ok(
        data={
            "module": "ai",
            "name": "AI 任务网关",
            "paths": {
                "tasks_create": "/api/v1/ai/tasks",
                "task_detail": "/api/v1/ai/tasks/{task_id}",
                "result_detail": "/api/v1/ai/results/{result_id}",
                "result_review": "/api/v1/ai/results/{result_id}/review",
            },
        }
    )


@router.post("/tasks", dependencies=[PgAiStore])
def create_ai_task(
    db: DbSession,
    body: AiTaskCreate,
    actor: JwtClaims = Depends(require_roles(*RBAC_AI_TASK_CREATE)),
) -> dict:
    """§六·1 创建 AI 任务（同步占位管线）"""
    try:
        task, result = service.create_ai_task_stub(
            db,
            task_type=body.task_type,
            payload=body.payload,
            created_by_user_id=actor.sub,
        )
        emit_audit(
            db,
            actor,
            action="AI_TASK_CREATE",
            object_type="ai_task",
            object_id=task.id,
            after_data={
                "task_type": task.task_type,
                "status": task.status,
                "result_id": str(result.id),
            },
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_AI_PG_NOT_READY) from exc
    return envelope_ok(data=service.task_to_read(task))


@router.get("/tasks/{task_id}", dependencies=[PgAiStore])
def get_ai_task(
    db: DbSession,
    task_id: UUID,
    _actor: JwtClaims = Depends(require_roles(*RBAC_AI_TASK_READ)),
) -> dict:
    """§六·2 查询任务"""
    try:
        row = service.get_task_detail(db, task_id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_AI_PG_NOT_READY) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="任务不存在")
    return envelope_ok(data=service.task_to_read(row))


@router.get("/results/{result_id}", dependencies=[PgAiStore])
def get_ai_result_detail(
    db: DbSession,
    result_id: UUID,
    _actor: JwtClaims = Depends(require_roles(*RBAC_AI_TASK_READ)),
) -> dict:
    """§六·3 AI 输出"""
    try:
        row = service.get_result_detail(db, result_id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_AI_PG_NOT_READY) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="结果不存在")
    return envelope_ok(data=service.result_to_read(row))


@router.post("/results/{result_id}/review", dependencies=[PgAiStore])
def review_ai_result(
    db: DbSession,
    result_id: UUID,
    body: AiResultReviewBody,
    actor: JwtClaims = Depends(require_roles(*RBAC_AI_RESULT_REVIEW)),
) -> dict:
    """§六·4 人工确认 AI 输出"""
    try:
        row = service.review_result(db, result_id, body, actor.sub)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="结果不存在")
        emit_audit(
            db,
            actor,
            action="AI_RESULT_REVIEW",
            object_type="ai_result",
            object_id=row.id,
            after_data={
                "task_id": str(row.task_id),
                "review_status": row.review_status,
            },
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_AI_PG_NOT_READY) from exc
    return envelope_ok(data=service.result_to_read(row))
