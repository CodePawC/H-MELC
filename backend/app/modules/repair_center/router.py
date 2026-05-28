"""统一报修中心 API。

对齐 docs/06_接口设计/01_API接口设计.md · 统一报修中心：多渠道消息、AI识别、
人工确认、渠道配置、规则配置与进度查询。
"""

from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.core.audit_emit import emit_audit
from app.core.deps import DbSession
from app.core.responses import envelope_ok
from app.db.session import engine
from app.modules.auth.deps import get_current_claims_optional, require_roles
from app.modules.auth.rbac import RBAC_REPAIR_ASSIGN, RBAC_REPAIR_CREATE, RBAC_REPAIR_READ
from app.modules.auth.schemas import JwtClaims
from app.modules.repair_center import service as rc_svc
from app.modules.repair_center.schemas import (
    AiSessionCreate,
    AiSessionMessageCreate,
    AssignReviewerBody,
    ChannelConfigCreate,
    ChannelConfigPatch,
    MessageConfirmBody,
    RuleConfigPatch,
    UnifiedRepairMessageCreate,
)

router = APIRouter(prefix="/repair-center", tags=["repair-center"])

_PG_DETAIL = "统一报修中心需在 PostgreSQL 执行 `alembic upgrade head`（含 e020_repair_center）后使用。"
_SQL_FAIL = "统一报修中心查询失败：请确认 repair schema 已创建并完成 e020_repair_center 迁移。"


def _ensure_pg_repair_center() -> None:
    if engine.dialect.name != "postgresql":
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PG_DETAIL)


PgRepairCenter = Depends(_ensure_pg_repair_center)


def _unwrap(result: object) -> object:
    if isinstance(result, tuple):
        code, msg = result
        if code == "not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        if code == "conflict":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
    return result


@router.get("")
def repair_center_root() -> dict[str, object]:
    """模块发现：报修工单只是统一报修中心生成的结果。"""
    return envelope_ok(
        data={
            "module": "repair-center",
            "name": "统一报修中心",
            "positioning": "多渠道报修中枢，识别确认后统一生成 repair_order 工单",
            "paths": {
                "workbench": "/api/v1/repair-center/workbench",
                "messages": "/api/v1/repair-center/messages",
                "pending_confirmations": "/api/v1/repair-center/pending-confirmations",
                "ai_sessions": "/api/v1/repair-center/ai-sessions",
                "channel_configs": "/api/v1/repair-center/channel-configs",
                "rule_config": "/api/v1/repair-center/rule-config",
                "progress": "/api/v1/repair-center/progress",
                "repair_orders": "/api/v1/repairs",
            },
            "supported_entries": [
                "电脑端后台",
                "手机端登录",
                "设备二维码一键报修",
                "微信公众号",
                "企业微信",
                "飞书机器人",
                "钉钉机器人",
                "系统内AI聊天框",
                "语音",
                "图片",
                "设备科人工代录",
                "系统预警自动生成",
            ],
        }
    )


@router.get("/workbench", dependencies=[PgRepairCenter])
def workbench(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_READ)),
) -> dict:
    try:
        stats = rc_svc.build_workbench_stats(db)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data={"stats": stats})


@router.get("/messages", dependencies=[PgRepairCenter])
def list_messages(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_READ)),
    source_channel: str | None = Query(None),
    raw_message_type: str | None = Query(None),
    sender_department: str | None = Query(None),
    confirm_status: str | None = Query(None),
    keyword: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    try:
        rows, total, stats, page, page_size = rc_svc.list_messages(
            db,
            source_channel=source_channel,
            raw_message_type=raw_message_type,
            sender_department=sender_department,
            confirm_status=confirm_status,
            keyword=keyword,
            date_from=date_from,
            date_to=date_to,
            page=page,
            page_size=page_size,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(
        data={
            "items": [rc_svc.get_message_bundle(db, x.id)["message"] for x in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
            "stats": stats,
        }
    )


@router.post("/messages", dependencies=[PgRepairCenter])
def create_message(
    db: DbSession,
    body: UnifiedRepairMessageCreate,
    actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_CREATE)),
) -> dict:
    try:
        row = rc_svc.create_message(db, body)
        extract = rc_svc.ai_extract_message(db, row.id)
        bundle = rc_svc.get_message_bundle(db, row.id) or {"message": None}
        emit_audit(
            db,
            actor,
            action="REPAIR_CENTER_MESSAGE_CREATE",
            object_type="unified_repair_message",
            object_id=row.id,
            after_data={"message_no": row.message_no, "source_channel": row.source_channel},
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    data = dict(bundle)
    data["latest_extract"] = data.get("latest_extract") or (rc_svc.extract_to_api(extract) if extract else None)
    return envelope_ok(data=data)


@router.get("/messages/{message_id}", dependencies=[PgRepairCenter])
def get_message(
    db: DbSession,
    message_id: UUID,
    _actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_READ)),
) -> dict:
    try:
        bundle = rc_svc.get_message_bundle(db, message_id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    if bundle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="报修消息不存在")
    return envelope_ok(data=bundle)


@router.post("/messages/{message_id}/ai-extract", dependencies=[PgRepairCenter])
def ai_extract_message(
    db: DbSession,
    message_id: UUID,
    actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_CREATE)),
) -> dict:
    try:
        result = rc_svc.ai_extract_message(db, message_id)
        if result is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="报修消息不存在")
        emit_audit(
            db,
            actor,
            action="REPAIR_CENTER_AI_EXTRACT",
            object_type="unified_repair_message",
            object_id=message_id,
            after_data={"extract_result_id": str(result.id), "strategy": result.confirmation_strategy},
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data=rc_svc.get_message_bundle(db, message_id))


@router.post("/messages/{message_id}/confirm", dependencies=[PgRepairCenter])
def confirm_message(
    db: DbSession,
    message_id: UUID,
    body: MessageConfirmBody,
    actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_CREATE)),
) -> dict:
    try:
        payload = _unwrap(
            rc_svc.confirm_message(
                db,
                message_id,
                body,
                actor_id=actor.sub,
                actor_name=actor.username,
            )
        )
        emit_audit(
            db,
            actor,
            action="REPAIR_CENTER_MESSAGE_CONFIRM",
            object_type="unified_repair_message",
            object_id=message_id,
            after_data={"confirm_action": body.confirm_action},
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data=payload)


@router.post("/messages/{message_id}/assign-reviewer", dependencies=[PgRepairCenter])
def assign_reviewer(
    db: DbSession,
    message_id: UUID,
    body: AssignReviewerBody,
    actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_ASSIGN)),
) -> dict:
    try:
        payload = rc_svc.assign_reviewer(db, message_id, body.reviewer_id, body.comment)
        if payload is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="报修消息不存在")
        emit_audit(
            db,
            actor,
            action="REPAIR_CENTER_ASSIGN_REVIEWER",
            object_type="unified_repair_message",
            object_id=message_id,
            after_data={"reviewer_id": str(body.reviewer_id)},
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data=payload)


@router.post("/pending-confirmations/{message_id}/assign-reviewer", dependencies=[PgRepairCenter])
def assign_pending_reviewer(
    db: DbSession,
    message_id: UUID,
    body: AssignReviewerBody,
    actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_ASSIGN)),
) -> dict:
    return assign_reviewer(db, message_id, body, actor)


@router.get("/pending-confirmations", dependencies=[PgRepairCenter])
def list_pending_confirmations(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_READ)),
    source_channel: str | None = Query(None),
    keyword: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    try:
        rows, total, stats, page, page_size = rc_svc.list_messages(
            db,
            source_channel=source_channel,
            keyword=keyword,
            pending_only=True,
            page=page,
            page_size=page_size,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(
        data={
            "items": [rc_svc.get_message_bundle(db, x.id) for x in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
            "stats": stats,
        }
    )


@router.post("/ai-sessions", dependencies=[PgRepairCenter])
def create_ai_session(
    db: DbSession,
    body: AiSessionCreate,
    actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_CREATE)),
) -> dict:
    try:
        row = rc_svc.create_ai_session(db, body, user_id=actor.sub)
        emit_audit(db, actor, action="REPAIR_AI_SESSION_CREATE", object_type="repair_ai_session", object_id=row.id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data=rc_svc.session_to_api(row))


@router.get("/ai-sessions/{session_id}", dependencies=[PgRepairCenter])
def get_ai_session(
    db: DbSession,
    session_id: UUID,
    _actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_READ)),
) -> dict:
    try:
        row = rc_svc.get_ai_session(db, session_id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI报修会话不存在")
    return envelope_ok(data=rc_svc.session_to_api(row))


@router.post("/ai-sessions/{session_id}/messages", dependencies=[PgRepairCenter])
def append_ai_session_message(
    db: DbSession,
    session_id: UUID,
    body: AiSessionMessageCreate,
    actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_CREATE)),
) -> dict:
    try:
        payload = _unwrap(rc_svc.append_ai_session_message(db, session_id, body))
        emit_audit(
            db,
            actor,
            action="REPAIR_AI_SESSION_MESSAGE",
            object_type="repair_ai_session",
            object_id=session_id,
            after_data={"raw_message_type": body.raw_message_type},
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data=payload)


@router.get("/progress", dependencies=[PgRepairCenter])
def query_progress(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_READ)),
    sender_id: str | None = Query(None),
    sender_phone: str | None = Query(None),
    order_code: str | None = Query(None),
    limit: int = Query(5, ge=1, le=20),
) -> dict:
    try:
        items = rc_svc.list_progress(
            db,
            sender_id=sender_id,
            sender_phone=sender_phone,
            order_code=order_code,
            limit=limit,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data={"items": items, "total": len(items)})


@router.get("/channel-configs", dependencies=[PgRepairCenter])
def list_channel_configs(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_READ)),
    channel_type: str | None = Query(None),
) -> dict:
    try:
        rows, total = rc_svc.list_channel_configs(db, channel_type=channel_type)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data={"items": [rc_svc.channel_to_api(x) for x in rows], "total": total})


@router.post("/channel-configs", dependencies=[PgRepairCenter])
def create_channel_config(
    db: DbSession,
    body: ChannelConfigCreate,
    actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_ASSIGN)),
) -> dict:
    try:
        row = rc_svc.create_channel_config(db, body)
        emit_audit(
            db,
            actor,
            action="REPAIR_CHANNEL_CONFIG_CREATE",
            object_type="repair_channel_config",
            object_id=row.id,
            after_data={"channel_type": row.channel_type, "channel_name": row.channel_name},
        )
    except IntegrityError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="渠道配置已存在或不合法") from exc
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data=rc_svc.channel_to_api(row))


@router.patch("/channel-configs/{config_id}", dependencies=[PgRepairCenter])
def patch_channel_config(
    db: DbSession,
    config_id: UUID,
    body: ChannelConfigPatch,
    actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_ASSIGN)),
) -> dict:
    try:
        row = rc_svc.patch_channel_config(db, config_id, body)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="渠道配置不存在")
        emit_audit(
            db,
            actor,
            action="REPAIR_CHANNEL_CONFIG_PATCH",
            object_type="repair_channel_config",
            object_id=row.id,
            after_data=body.model_dump(mode="json", exclude_unset=True),
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data=rc_svc.channel_to_api(row))


@router.get("/rule-config", dependencies=[PgRepairCenter])
def get_rule_config(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_READ)),
) -> dict:
    try:
        row = rc_svc.get_or_create_rule_config(db)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data=rc_svc.rule_to_api(row))


@router.patch("/rule-config", dependencies=[PgRepairCenter])
def patch_rule_config(
    db: DbSession,
    body: RuleConfigPatch,
    actor: JwtClaims = Depends(require_roles(*RBAC_REPAIR_ASSIGN)),
) -> dict:
    try:
        row = rc_svc.patch_rule_config(db, body)
        emit_audit(
            db,
            actor,
            action="REPAIR_RULE_CONFIG_PATCH",
            object_type="repair_rule_config",
            object_id=row.id,
            after_data=body.model_dump(mode="json", exclude_unset=True),
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data=rc_svc.rule_to_api(row))


@router.post("/webhooks/{channel_type}", dependencies=[PgRepairCenter])
def channel_webhook(
    db: DbSession,
    channel_type: str,
    payload: dict[str, Any],
    _actor: JwtClaims | None = Depends(get_current_claims_optional),
) -> dict:
    """多渠道消息回调入口。

    生产接入时应在网关或此处按渠道校验签名/Token；这里先统一落标准消息结构，
    便于微信、企业微信、飞书、钉钉等入口共用同一个报修中枢。
    """
    try:
        row = rc_svc.create_message_from_webhook(db, channel_type=channel_type, payload=payload)
        bundle = rc_svc.get_message_bundle(db, row.id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data=bundle)
