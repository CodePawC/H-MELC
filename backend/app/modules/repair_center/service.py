"""统一报修中心业务服务。

多渠道消息先进入 `unified_repair_message`，AI 识别与人工确认完成后再生成
既有 `repair.repair_order`，保证报修入口与工单闭环解耦。
"""

from __future__ import annotations

import re
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.modules.asset.models import Asset
from app.modules.repair import service as repair_svc
from app.modules.repair.models import RepairOrder
from app.modules.repair.schemas import RepairCreate
from app.modules.repair_center.models import (
    RepairAiExtractResult,
    RepairAiSession,
    RepairChannelConfig,
    RepairDispatch,
    RepairNotificationLog,
    RepairOrderLog,
    RepairRuleConfig,
    UnifiedRepairMessage,
)
from app.modules.repair_center.schemas import (
    AiSessionCreate,
    AiSessionMessageCreate,
    ChannelConfigCreate,
    ChannelConfigPatch,
    MessageConfirmBody,
    RuleConfigPatch,
    UnifiedRepairMessageCreate,
    UnifiedRepairMessageRead,
)

DEFAULT_RULE_CODE = "DEFAULT_REPAIR_RULE"

PENDING_CONFIRM_STATUSES = {
    "PENDING",
    "WAIT_USER_CONFIRM",
    "WAIT_USER_SELECT",
    "PENDING_MANUAL_CONFIRM",
    "PENDING_EMERGENCY_REVIEW",
    "NEED_MORE_INFO",
}


def _now() -> datetime:
    return datetime.now(tz=UTC)


def _iso(value: datetime | date | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat().replace("+00:00", "Z")
    return value.isoformat()


def _uuid(value: UUID | None) -> str | None:
    return str(value) if value else None


def _gen_no(prefix: str) -> str:
    return f"{prefix}{datetime.now().strftime('%Y%m%d')}{uuid.uuid4().hex[:10].upper()}"


def _message_to_api(row: UnifiedRepairMessage) -> dict[str, Any]:
    return UnifiedRepairMessageRead.model_validate(row).model_dump(mode="json")


def extract_to_api(row: RepairAiExtractResult) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "message_id": str(row.message_id),
        "session_id": _uuid(row.session_id),
        "extracted_json": row.extracted_json,
        "extracted_department": row.extracted_department,
        "extracted_location": row.extracted_location,
        "extracted_device_name": row.extracted_device_name,
        "extracted_fault_description": row.extracted_fault_description,
        "extracted_fault_category": row.extracted_fault_category,
        "extracted_urgency": row.extracted_urgency,
        "affects_clinical_use": row.affects_clinical_use,
        "suspected_emergency_device": row.suspected_emergency_device,
        "suspected_life_support_device": row.suspected_life_support_device,
        "matched_device_candidates": row.matched_device_candidates,
        "matched_device_id": _uuid(row.matched_device_id),
        "matched_confidence": str(row.matched_confidence) if row.matched_confidence is not None else None,
        "confirmation_strategy": row.confirmation_strategy,
        "human_review_status": row.human_review_status,
        "reviewed_by": _uuid(row.reviewed_by),
        "reviewed_at": _iso(row.reviewed_at),
        "created_at": _iso(row.created_at),
    }


def channel_to_api(row: RepairChannelConfig) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "channel_name": row.channel_name,
        "channel_type": row.channel_type,
        "enabled": row.enabled,
        "robot_name": row.robot_name,
        "webhook_url": row.webhook_url,
        "token_secret": row.token_secret,
        "callback_url": row.callback_url,
        "supported_message_types": row.supported_message_types,
        "default_rule_code": row.default_rule_code,
        "bound_department_scope": row.bound_department_scope,
        "bound_user_scope": row.bound_user_scope,
        "allow_auto_create_order": row.allow_auto_create_order,
        "require_manual_confirm": row.require_manual_confirm,
        "metadata": row.channel_metadata,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def rule_to_api(row: RepairRuleConfig) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "rule_code": row.rule_code,
        "rule_name": row.rule_name,
        "enabled": row.enabled,
        "allow_ai_auto_create_order": row.allow_ai_auto_create_order,
        "channel_confirm_rules": row.channel_confirm_rules,
        "emergency_auto_upgrade": row.emergency_auto_upgrade,
        "night_shift_notify": row.night_shift_notify,
        "night_shift_time_range": row.night_shift_time_range,
        "dispatch_timeout_minutes": row.dispatch_timeout_minutes,
        "acceptance_timeout_hours": row.acceptance_timeout_hours,
        "high_value_notify_threshold": (
            str(row.high_value_notify_threshold) if row.high_value_notify_threshold is not None else None
        ),
        "repeat_repair_window_days": row.repeat_repair_window_days,
        "repeat_repair_threshold": row.repeat_repair_threshold,
        "life_support_spare_hint": row.life_support_spare_hint,
        "allow_clinical_progress_view": row.allow_clinical_progress_view,
        "metadata": row.rule_metadata,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def session_to_api(row: RepairAiSession) -> dict[str, Any]:
    return {
        "id": str(row.id),
        "session_no": row.session_no,
        "channel_message_id": _uuid(row.channel_message_id),
        "source_channel": row.source_channel,
        "user_id": _uuid(row.user_id),
        "user_name": row.user_name,
        "department_id": _uuid(row.department_id),
        "session_status": row.session_status,
        "current_intent": row.current_intent,
        "last_question": row.last_question,
        "metadata": row.session_metadata,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


def create_message(session: Session, body: UnifiedRepairMessageCreate) -> UnifiedRepairMessage:
    row = UnifiedRepairMessage(
        message_no=_gen_no("RM"),
        source_channel=body.source_channel,
        source_channel_name=body.source_channel_name,
        sender_id=body.sender_id,
        sender_name=body.sender_name,
        sender_phone=body.sender_phone,
        sender_department=body.sender_department,
        raw_message_type=body.raw_message_type,
        raw_message_content=body.raw_message_content,
        voice_file_url=body.voice_file_url,
        image_file_url=body.image_file_url,
        video_file_url=body.video_file_url,
        transcribed_text=body.transcribed_text or (body.raw_message_content if body.raw_message_type == "VOICE" else None),
        matched_device_id=body.asset_id,
        matched_confidence=Decimal("100.00") if body.asset_id else None,
        confirm_status="WAIT_USER_CONFIRM" if body.asset_id else "PENDING",
        message_metadata=body.metadata,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def list_messages(
    session: Session,
    *,
    source_channel: str | None = None,
    raw_message_type: str | None = None,
    sender_department: str | None = None,
    confirm_status: str | None = None,
    keyword: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    pending_only: bool = False,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[UnifiedRepairMessage], int, dict[str, int], int, int]:
    stmt = select(UnifiedRepairMessage)
    conditions = []
    if source_channel:
        conditions.append(UnifiedRepairMessage.source_channel == source_channel)
    if raw_message_type:
        conditions.append(UnifiedRepairMessage.raw_message_type == raw_message_type)
    if sender_department:
        conditions.append(UnifiedRepairMessage.sender_department == sender_department)
    if confirm_status:
        conditions.append(UnifiedRepairMessage.confirm_status == confirm_status)
    if pending_only:
        conditions.append(UnifiedRepairMessage.confirm_status.in_(PENDING_CONFIRM_STATUSES))
    if keyword:
        like = f"%{keyword}%"
        conditions.append(
            or_(
                UnifiedRepairMessage.message_no.ilike(like),
                UnifiedRepairMessage.sender_name.ilike(like),
                UnifiedRepairMessage.raw_message_content.ilike(like),
                UnifiedRepairMessage.transcribed_text.ilike(like),
                UnifiedRepairMessage.ai_extracted_device_name.ilike(like),
                UnifiedRepairMessage.ai_extracted_fault_description.ilike(like),
            )
        )
    if date_from:
        conditions.append(func.date(UnifiedRepairMessage.created_at) >= date_from)
    if date_to:
        conditions.append(func.date(UnifiedRepairMessage.created_at) <= date_to)
    if conditions:
        stmt = stmt.where(*conditions)

    page = max(1, page)
    page_size = min(100, max(1, page_size))
    total = int(session.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
    rows = list(
        session.scalars(
            stmt.order_by(UnifiedRepairMessage.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        ).all()
    )
    return rows, total, build_workbench_stats(session), page, page_size


def build_workbench_stats(session: Session) -> dict[str, int]:
    today = date.today()
    overdue_before = _now() - timedelta(hours=2)
    return {
        "today_repair": int(
            session.scalar(
                select(func.count()).select_from(UnifiedRepairMessage).where(func.date(UnifiedRepairMessage.created_at) == today)
            )
            or 0
        ),
        "ai_recognized_repair": int(
            session.scalar(select(func.count()).select_from(RepairAiExtractResult).where(func.date(RepairAiExtractResult.created_at) == today))
            or 0
        ),
        "wechat_repair": int(
            session.scalar(select(func.count()).select_from(UnifiedRepairMessage).where(UnifiedRepairMessage.source_channel == "WECHAT"))
            or 0
        ),
        "feishu_repair": int(
            session.scalar(select(func.count()).select_from(UnifiedRepairMessage).where(UnifiedRepairMessage.source_channel == "FEISHU"))
            or 0
        ),
        "pending_confirm_messages": int(
            session.scalar(select(func.count()).select_from(UnifiedRepairMessage).where(UnifiedRepairMessage.confirm_status.in_(PENDING_CONFIRM_STATUSES)))
            or 0
        ),
        "pending_dispatch_orders": int(
            session.scalar(select(func.count()).select_from(RepairOrder).where(RepairOrder.order_status == "PENDING_DISPATCH"))
            or 0
        ),
        "in_progress_orders": int(
            session.scalar(select(func.count()).select_from(RepairOrder).where(RepairOrder.order_status == "IN_PROGRESS"))
            or 0
        ),
        "emergency_device_faults": int(
            session.scalar(
                select(func.count())
                .select_from(RepairAiExtractResult)
                .where(RepairAiExtractResult.suspected_emergency_device.is_(True))
            )
            or 0
        ),
        "overdue_unhandled": int(
            session.scalar(
                select(func.count())
                .select_from(UnifiedRepairMessage)
                .where(
                    UnifiedRepairMessage.converted_order_id.is_(None),
                    UnifiedRepairMessage.created_at < overdue_before,
                    UnifiedRepairMessage.confirm_status.in_(PENDING_CONFIRM_STATUSES),
                )
            )
            or 0
        ),
    }


def get_message_bundle(session: Session, message_id: UUID) -> dict[str, Any] | None:
    msg = session.get(UnifiedRepairMessage, message_id)
    if msg is None:
        return None
    extracts = list(
        session.scalars(
            select(RepairAiExtractResult)
            .where(RepairAiExtractResult.message_id == message_id)
            .order_by(RepairAiExtractResult.created_at.desc())
        ).all()
    )
    order = session.get(RepairOrder, msg.converted_order_id) if msg.converted_order_id else None
    timeline = _build_message_timeline(session, msg, extracts, order)
    return {
        "message": _message_to_api(msg),
        "latest_extract": extract_to_api(extracts[0]) if extracts else None,
        "extract_results": [extract_to_api(x) for x in extracts],
        "converted_order": _order_to_progress(order) if order else None,
        "timeline": timeline,
    }


def _build_message_timeline(
    session: Session,
    msg: UnifiedRepairMessage,
    extracts: list[RepairAiExtractResult],
    order: RepairOrder | None,
) -> list[dict[str, Any]]:
    items = [
        {
            "type": "MESSAGE_RECEIVED",
            "title": "统一报修中心接收入口消息",
            "time": _iso(msg.created_at),
            "content": msg.raw_message_content or msg.transcribed_text or msg.raw_message_type,
        }
    ]
    for extract in reversed(extracts):
        items.append(
            {
                "type": "AI_EXTRACTED",
                "title": "AI识别报修信息",
                "time": _iso(extract.created_at),
                "content": extract.extracted_fault_description or extract.extracted_device_name,
                "confidence": str(extract.matched_confidence) if extract.matched_confidence is not None else None,
            }
        )
    logs = list(
        session.scalars(
            select(RepairNotificationLog)
            .where(RepairNotificationLog.message_id == msg.id)
            .order_by(RepairNotificationLog.created_at.asc())
        ).all()
    )
    for log in logs:
        items.append(
            {
                "type": "NOTIFICATION",
                "title": log.notify_target_name or log.notify_target_type or "消息提醒",
                "time": _iso(log.sent_at or log.created_at),
                "content": log.notify_content,
                "status": log.notify_status,
            }
        )
    if order:
        items.append(
            {
                "type": "ORDER_CREATED",
                "title": "已生成标准报修工单",
                "time": _iso(order.created_at),
                "content": order.order_code,
                "status": order.order_status,
            }
        )
    return sorted(items, key=lambda x: x.get("time") or "")


def _source_text(msg: UnifiedRepairMessage) -> str:
    return (msg.transcribed_text or msg.raw_message_content or "").strip()


def _first_match(text: str, words: list[str]) -> str | None:
    for word in words:
        if word in text:
            return word
    return None


def _extract_department(text: str, fallback: str | None) -> str | None:
    if fallback:
        return fallback
    candidates = ["ICU", "急诊科", "急诊", "内镜中心", "手术室", "抢救室", "呼吸科", "检验科", "放射科"]
    hit = _first_match(text.upper() if "ICU" in text.upper() else text, candidates)
    if hit == "急诊":
        return "急诊科"
    if hit == "抢救室":
        return "急诊科"
    return hit


def _extract_location(text: str) -> str | None:
    bed = re.search(r"([A-Za-z0-9一二三四五六七八九十百]+床)", text)
    if bed:
        return bed.group(1)
    room = re.search(r"([\u4e00-\u9fa5A-Za-z0-9]+(?:室|中心|备用间|检查间|抢救室))", text)
    return room.group(1) if room else None


def _extract_device_and_category(text: str) -> tuple[str | None, str | None]:
    rules = [
        ("除颤", "除颤仪", "电源/急救设备异常"),
        ("呼吸机", "呼吸机", "通气/生命支持异常"),
        ("监护仪", "病人监护仪", "参数异常 / NIBP模块异常" if "血压" in text else "报警/监测异常"),
        ("内镜", "电子内镜主机 CV-290" if "290" in text else "电子内镜主机", "图像链路异常"),
        ("麻醉机", "麻醉机", "生命支持/气路异常"),
        ("输注泵", "输注泵", "输注异常"),
        ("注射泵", "注射泵", "输注异常"),
        ("心电图", "心电图机", "采集异常"),
        ("超声", "超声诊断仪", "成像异常"),
        ("DR", "DR设备", "影像设备异常"),
        ("CT", "CT设备", "影像设备异常"),
    ]
    for key, device, category in rules:
        if key in text:
            return device, category
    return None, None


def _extract_urgency(text: str, device_name: str | None) -> str:
    critical_words = ["危急", "抢救", "急救", "无法开机", "不能开机", "停机", "生命支持"]
    high_words = ["报警", "一直报警", "影响", "当前患者", "检查中", "打不上去", "图像闪", "较急"]
    emergency_device = bool(device_name and any(x in device_name for x in ["除颤", "呼吸机", "监护仪", "麻醉机"]))
    if any(x in text for x in critical_words) and emergency_device:
        return "危急"
    if any(x in text for x in high_words):
        return "较急"
    return "一般"


def _clinical_impact(text: str, urgency: str) -> bool:
    return urgency in {"危急", "较急"} or any(x in text for x in ["患者", "诊疗", "检查", "抢救", "无法使用", "不能用"])


def _is_emergency_device(device_name: str | None) -> bool:
    return bool(device_name and any(x in device_name for x in ["除颤", "呼吸机", "监护仪", "麻醉机", "输注泵", "注射泵"]))


def _is_life_support_device(device_name: str | None) -> bool:
    return bool(device_name and any(x in device_name for x in ["呼吸机", "麻醉机", "除颤", "监护仪"]))


def _candidate_devices(session: Session, device_name: str | None, department: str | None, location: str | None) -> list[dict[str, Any]]:
    if not device_name:
        return []
    tokens = [x for x in re.split(r"\s+|/|-", device_name) if x]
    conds = [Asset.deleted_at.is_(None)]
    if tokens:
        conds.append(or_(*[Asset.asset_name.ilike(f"%{token}%") for token in tokens[:3]]))
    rows = list(session.scalars(select(Asset).where(*conds).order_by(Asset.created_at.desc()).limit(5)).all())
    items: list[dict[str, Any]] = []
    for idx, asset in enumerate(rows):
        confidence = Decimal("92.00") if idx == 0 else Decimal(str(max(55, 78 - idx * 9)))
        name_hit = device_name in asset.asset_name or any(token in asset.asset_name for token in tokens)
        if name_hit:
            confidence = min(Decimal("98.00"), confidence + Decimal("4.00"))
        items.append(
            {
                "device_id": str(asset.id),
                "asset_code": asset.asset_code,
                "device_name": asset.asset_name,
                "department": department,
                "location": location,
                "confidence": str(confidence.quantize(Decimal("0.01"))),
                "display": f"{asset.asset_name} {asset.asset_code}",
            }
        )
    return items


def _confirmation_strategy(confidence: Decimal | None, has_candidates: bool, emergency: bool) -> tuple[str, str]:
    if emergency and (confidence is None or confidence < Decimal("85.00")):
        return "EMERGENCY_PUSH_AND_REVIEW", "PENDING_EMERGENCY_REVIEW"
    if confidence is not None and confidence >= Decimal("85.00"):
        return "USER_CONFIRM", "WAIT_USER_CONFIRM"
    if has_candidates:
        return "SELECT_CANDIDATE", "WAIT_USER_SELECT"
    return "HUMAN_REVIEW", "PENDING_MANUAL_CONFIRM"


def ai_extract_message(session: Session, message_id: UUID, *, session_id: UUID | None = None) -> RepairAiExtractResult | None:
    msg = session.get(UnifiedRepairMessage, message_id)
    if msg is None:
        return None
    text = _source_text(msg)
    department = _extract_department(text, msg.sender_department)
    location = _extract_location(text)
    device_name, category = _extract_device_and_category(text)
    urgency = _extract_urgency(text, device_name)
    affects = _clinical_impact(text, urgency)
    emergency_device = _is_emergency_device(device_name)
    life_support = _is_life_support_device(device_name)
    candidates = _candidate_devices(session, device_name, department, location)

    matched_device_id = msg.matched_device_id
    confidence = msg.matched_confidence
    if not matched_device_id and candidates:
        matched_device_id = UUID(candidates[0]["device_id"])
        confidence = Decimal(candidates[0]["confidence"])

    strategy, status = _confirmation_strategy(confidence, bool(candidates), emergency_device)
    extracted_json = {
        "department": department,
        "location": location,
        "device_name": device_name,
        "fault_description": text,
        "fault_category": category,
        "urgency": urgency,
        "affects_clinical_use": affects,
        "suspected_emergency_device": emergency_device,
        "suspected_life_support_device": life_support,
        "questions": [
            "请问是否影响当前患者使用？",
            "设备屏幕是否有报警代码？",
            "是否方便上传一张故障照片？",
            "是否需要设备科立即处理？",
        ],
    }
    result = RepairAiExtractResult(
        message_id=msg.id,
        session_id=session_id,
        extracted_json=extracted_json,
        extracted_department=department,
        extracted_location=location,
        extracted_device_name=device_name,
        extracted_fault_description=text,
        extracted_fault_category=category,
        extracted_urgency=urgency,
        affects_clinical_use=affects,
        suspected_emergency_device=emergency_device,
        suspected_life_support_device=life_support,
        matched_device_candidates={"items": candidates},
        matched_device_id=matched_device_id,
        matched_confidence=confidence,
        confirmation_strategy=strategy,
    )
    msg.ai_extracted_department = department
    msg.ai_extracted_location = location
    msg.ai_extracted_device_name = device_name
    msg.ai_extracted_fault_description = text
    msg.ai_extracted_urgency = urgency
    msg.matched_device_id = matched_device_id
    msg.matched_confidence = confidence
    msg.confirm_status = status
    if msg.raw_message_type == "VOICE" and not msg.transcribed_text:
        msg.transcribed_text = text
    session.add(result)
    session.add(msg)
    if emergency_device:
        session.add(
            RepairNotificationLog(
                message_id=msg.id,
                channel_type="INTERNAL",
                notify_target_type="DUTY_ENGINEER",
                notify_target_name="设备科值班人员",
                notify_content=f"急救/生命支持设备疑似故障：{department or '-'} {location or ''} {device_name or ''} {text}",
                notify_status="PENDING",
            )
        )
    session.commit()
    session.refresh(result)
    return result


def latest_extract(session: Session, message_id: UUID) -> RepairAiExtractResult | None:
    return session.scalar(
        select(RepairAiExtractResult)
        .where(RepairAiExtractResult.message_id == message_id)
        .order_by(RepairAiExtractResult.created_at.desc())
        .limit(1)
    )


def confirm_message(
    session: Session,
    message_id: UUID,
    body: MessageConfirmBody,
    *,
    actor_id: UUID | None = None,
    actor_name: str | None = None,
) -> dict[str, Any] | tuple[str, str]:
    msg = session.get(UnifiedRepairMessage, message_id)
    if msg is None:
        return "not_found", "报修消息不存在"

    if body.confirm_action == "IGNORE":
        msg.confirm_status = "IGNORED"
        session.add(msg)
        session.commit()
        session.refresh(msg)
        return {"message": _message_to_api(msg), "converted_order": None}

    if body.confirm_action == "NEED_MORE_INFO":
        msg.confirm_status = "NEED_MORE_INFO"
        _add_message_log(session, msg, action="NEED_MORE_INFO", actor_id=actor_id, actor_name=actor_name, content=body.comment)
        session.commit()
        session.refresh(msg)
        return {"message": _message_to_api(msg), "converted_order": None}

    if body.confirm_action in {"SELECT_DEVICE", "MANUAL_REVIEW"}:
        if body.selected_device_id:
            if session.get(Asset, body.selected_device_id) is None:
                return "not_found", "选择的设备不存在"
            msg.matched_device_id = body.selected_device_id
            msg.matched_confidence = Decimal("100.00")
            msg.confirm_status = "STAFF_CONFIRMED" if body.confirm_action == "MANUAL_REVIEW" else "USER_CONFIRMED"
        else:
            msg.confirm_status = "PENDING_MANUAL_CONFIRM"
        _add_message_log(session, msg, action=body.confirm_action, actor_id=actor_id, actor_name=actor_name, content=body.comment)
        session.commit()
        session.refresh(msg)
        return {"message": _message_to_api(msg), "converted_order": None}

    device_id = body.selected_device_id or msg.matched_device_id
    if device_id is None:
        return "conflict", "请先确认设备，再生成正式报修工单"
    if session.get(Asset, device_id) is None:
        return "not_found", "匹配设备不存在或已删除"

    ext = latest_extract(session, msg.id)
    urgency = body.urgency or msg.ai_extracted_urgency
    fault_description = body.fault_description or msg.ai_extracted_fault_description or msg.raw_message_content or msg.transcribed_text
    order_body = RepairCreate(
        asset_id=device_id,
        fault_description=fault_description,
        fault_type=ext.extracted_fault_category if ext else None,
        fault_level=urgency,
        priority=_priority_from_urgency(urgency),
        reporter_name=msg.sender_name,
        reporter_phone=msg.sender_phone,
    )
    order = repair_svc.create_repair(session, order_body)
    if order is None:
        return "not_found", "匹配设备不存在或已删除"

    msg.matched_device_id = device_id
    msg.converted_order_id = order.id
    msg.confirm_status = "CONVERTED"
    _add_message_log(
        session,
        msg,
        action="CREATE_ORDER",
        actor_id=actor_id,
        actor_name=actor_name,
        content=body.comment or f"统一报修中心生成工单 {order.order_code}",
        to_status="PENDING_DISPATCH",
    )
    session.add(
        RepairDispatch(
            repair_order_id=order.id,
            dispatch_status="PENDING_DISPATCH",
            dispatch_reason="统一报修中心确认后生成，等待设备科派工",
        )
    )
    session.add(msg)
    session.commit()
    session.refresh(msg)
    return {"message": _message_to_api(msg), "converted_order": order.model_dump(mode="json")}


def _priority_from_urgency(urgency: str | None) -> str | None:
    if urgency in {"危急", "CRITICAL", "EMERGENCY"}:
        return "EMERGENCY"
    if urgency in {"较急", "HIGH", "URGENT"}:
        return "HIGH"
    if urgency:
        return "NORMAL"
    return None


def _add_message_log(
    session: Session,
    msg: UnifiedRepairMessage,
    *,
    action: str,
    actor_id: UUID | None,
    actor_name: str | None,
    content: str | None,
    to_status: str | None = None,
) -> None:
    if msg.converted_order_id:
        session.add(
            RepairOrderLog(
                repair_order_id=msg.converted_order_id,
                from_status=None,
                to_status=to_status,
                action=action,
                operator_id=actor_id,
                operator_name=actor_name,
                content=content,
                log_metadata={"source_message_id": str(msg.id), "message_no": msg.message_no},
            )
        )
    else:
        session.add(
            RepairNotificationLog(
                message_id=msg.id,
                channel_type="INTERNAL",
                notify_target_type="REPAIR_CENTER",
                notify_target_name="统一报修中心",
                notify_content=content or action,
                notify_status="RECORDED",
                sent_at=_now(),
                notify_metadata={"action": action, "operator_id": str(actor_id) if actor_id else None},
            )
        )


def assign_reviewer(session: Session, message_id: UUID, reviewer_id: UUID, comment: str | None) -> dict[str, Any] | None:
    msg = session.get(UnifiedRepairMessage, message_id)
    if msg is None:
        return None
    msg.confirm_status = "PENDING_MANUAL_CONFIRM"
    session.add(
        RepairNotificationLog(
            message_id=msg.id,
            channel_type="INTERNAL",
            notify_target_type="REVIEWER",
            notify_target_id=str(reviewer_id),
            notify_content=comment or "待确认报修消息需人工核实设备",
            notify_status="PENDING",
        )
    )
    session.add(msg)
    session.commit()
    session.refresh(msg)
    return _message_to_api(msg)


def create_ai_session(session: Session, body: AiSessionCreate, *, user_id: UUID | None = None) -> RepairAiSession:
    row = RepairAiSession(
        session_no=_gen_no("RS"),
        source_channel=body.source_channel,
        user_id=user_id,
        user_name=body.user_name,
        current_intent=body.current_intent,
        last_question="请直接描述设备故障，也可以发送语音或图片。",
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def get_ai_session(session: Session, session_id: UUID) -> RepairAiSession | None:
    return session.get(RepairAiSession, session_id)


def append_ai_session_message(
    session: Session,
    session_id: UUID,
    body: AiSessionMessageCreate,
) -> dict[str, Any] | tuple[str, str]:
    row = session.get(RepairAiSession, session_id)
    if row is None:
        return "not_found", "AI报修会话不存在"
    msg_body = UnifiedRepairMessageCreate(
        source_channel=row.source_channel or "AI_CHAT",
        source_channel_name="系统内AI报修助手",
        sender_id=str(row.user_id) if row.user_id else None,
        sender_name=row.user_name,
        raw_message_type=body.raw_message_type,
        raw_message_content=body.content,
        voice_file_url=body.voice_file_url,
        image_file_url=body.image_file_url,
        transcribed_text=body.content if body.raw_message_type == "VOICE" else None,
        metadata={"ai_session_id": str(row.id), "action": body.action},
    )
    msg = create_message(session, msg_body)
    row.channel_message_id = msg.id
    extract = ai_extract_message(session, msg.id, session_id=row.id)
    row.last_question = _assistant_reply(extract)
    session.add(row)
    session.commit()
    session.refresh(row)
    bundle = get_message_bundle(session, msg.id)
    return {
        "session": session_to_api(row),
        "message": bundle["message"] if bundle else _message_to_api(msg),
        "latest_extract": bundle["latest_extract"] if bundle else (extract_to_api(extract) if extract else None),
        "assistant_reply": row.last_question,
        "actions": ["确认报修", "更换设备", "补充照片", "转人工确认", "取消"],
    }


def _assistant_reply(extract: RepairAiExtractResult | None) -> str:
    if extract is None:
        return "我还没有识别到完整报修信息，请补充设备名称、位置和故障现象。"
    device = extract.extracted_device_name or "待确认设备"
    dept = extract.extracted_department or "待确认科室"
    fault = extract.extracted_fault_description or "待补充故障"
    urgency = extract.extracted_urgency or "待确认"
    return f"我识别到您可能要报修：设备 {device}，科室 {dept}，故障 {fault}，紧急程度 {urgency}。请确认是否生成报修工单。"


def list_channel_configs(session: Session, *, channel_type: str | None = None) -> tuple[list[RepairChannelConfig], int]:
    ensure_default_channel_configs(session)
    stmt = select(RepairChannelConfig)
    if channel_type:
        stmt = stmt.where(RepairChannelConfig.channel_type == channel_type)
    total = int(session.scalar(select(func.count()).select_from(stmt.subquery())) or 0)
    rows = list(session.scalars(stmt.order_by(RepairChannelConfig.created_at.desc())).all())
    return rows, total


def ensure_default_channel_configs(session: Session) -> None:
    exists = int(session.scalar(select(func.count()).select_from(RepairChannelConfig)) or 0)
    if exists:
        return
    defaults = [
        {
            "channel_name": "院内AI报修助手",
            "channel_type": "AI_CHAT",
            "robot_name": "AI报修助手",
            "callback_url": "/api/v1/repair-center/ai-sessions",
            "supported_message_types": {"items": ["TEXT", "VOICE", "IMAGE"]},
            "bound_department_scope": {"label": "全院临床科室"},
            "bound_user_scope": {"label": "院内登录用户"},
            "allow_auto_create_order": False,
            "require_manual_confirm": True,
        },
        {
            "channel_name": "微信公众号报修",
            "channel_type": "WECHAT",
            "robot_name": "医学装备报修服务",
            "callback_url": "/api/v1/repair-center/webhooks/wechat",
            "supported_message_types": {"items": ["TEXT", "VOICE", "IMAGE"]},
            "bound_department_scope": {"label": "绑定公众号用户"},
            "bound_user_scope": {"label": "微信 OpenID 映射"},
            "allow_auto_create_order": False,
            "require_manual_confirm": True,
        },
        {
            "channel_name": "企业微信报修",
            "channel_type": "WEWORK",
            "robot_name": "设备科值班机器人",
            "callback_url": "/api/v1/repair-center/webhooks/wework",
            "supported_message_types": {"items": ["TEXT", "VOICE", "IMAGE", "CARD"]},
            "bound_department_scope": {"label": "企业通讯录科室"},
            "bound_user_scope": {"label": "企业微信用户"},
            "allow_auto_create_order": False,
            "require_manual_confirm": True,
        },
        {
            "channel_name": "飞书机器人",
            "channel_type": "FEISHU",
            "robot_name": "设备科值班机器人",
            "callback_url": "/api/v1/repair-center/webhooks/feishu",
            "supported_message_types": {"items": ["TEXT", "VOICE", "IMAGE", "CARD"]},
            "bound_department_scope": {"label": "急诊、ICU、手术室优先"},
            "bound_user_scope": {"label": "飞书用户"},
            "allow_auto_create_order": False,
            "require_manual_confirm": True,
        },
        {
            "channel_name": "钉钉机器人",
            "channel_type": "DINGTALK",
            "robot_name": "设备科报修机器人",
            "callback_url": "/api/v1/repair-center/webhooks/dingtalk",
            "supported_message_types": {"items": ["TEXT", "VOICE", "IMAGE", "CARD"]},
            "bound_department_scope": {"label": "钉钉组织架构"},
            "bound_user_scope": {"label": "钉钉用户"},
            "allow_auto_create_order": False,
            "require_manual_confirm": True,
        },
        {
            "channel_name": "短信入口",
            "channel_type": "SMS",
            "robot_name": "短信网关",
            "callback_url": "/api/v1/repair-center/webhooks/sms",
            "supported_message_types": {"items": ["TEXT"]},
            "bound_department_scope": {"label": "手机号归属科室"},
            "bound_user_scope": {"label": "手机号"},
            "allow_auto_create_order": False,
            "require_manual_confirm": True,
        },
        {
            "channel_name": "内部系统消息",
            "channel_type": "INTERNAL",
            "robot_name": "平台消息中心",
            "callback_url": "/api/v1/repair-center/messages",
            "supported_message_types": {"items": ["TEXT", "ALERT"]},
            "bound_department_scope": {"label": "全院"},
            "bound_user_scope": {"label": "院内用户"},
            "allow_auto_create_order": False,
            "require_manual_confirm": True,
        },
        {
            "channel_name": "App / H5 移动端",
            "channel_type": "MOBILE",
            "robot_name": "移动端报修",
            "callback_url": "/api/v1/repair-center/messages",
            "supported_message_types": {"items": ["TEXT", "VOICE", "IMAGE", "VIDEO"]},
            "bound_department_scope": {"label": "全院"},
            "bound_user_scope": {"label": "院内登录用户"},
            "allow_auto_create_order": False,
            "require_manual_confirm": True,
        },
        {
            "channel_name": "设备二维码扫码入口",
            "channel_type": "DEVICE_QR",
            "robot_name": "资产中心设备身份二维码",
            "callback_url": "/api/v1/scan/asset → /api/v1/repair-center/messages",
            "supported_message_types": {"items": ["TEXT", "VOICE", "IMAGE", "VIDEO"]},
            "bound_department_scope": {"label": "设备当前使用科室"},
            "bound_user_scope": {"label": "扫码登录用户"},
            "allow_auto_create_order": False,
            "require_manual_confirm": False,
            "channel_metadata": {"boundary": "二维码属于资产中心设备身份，统一报修中心仅使用扫码入口"},
        },
    ]
    for item in defaults:
        session.add(RepairChannelConfig(enabled=True, **item))
    session.commit()


def create_channel_config(session: Session, body: ChannelConfigCreate) -> RepairChannelConfig:
    row = RepairChannelConfig(
        channel_name=body.channel_name,
        channel_type=body.channel_type,
        enabled=body.enabled,
        robot_name=body.robot_name,
        webhook_url=body.webhook_url,
        token_secret=body.token_secret,
        callback_url=body.callback_url,
        supported_message_types=body.supported_message_types,
        default_rule_code=body.default_rule_code,
        bound_department_scope=body.bound_department_scope,
        bound_user_scope=body.bound_user_scope,
        allow_auto_create_order=body.allow_auto_create_order,
        require_manual_confirm=body.require_manual_confirm,
        channel_metadata=body.metadata,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def patch_channel_config(session: Session, config_id: UUID, body: ChannelConfigPatch) -> RepairChannelConfig | None:
    row = session.get(RepairChannelConfig, config_id)
    if row is None:
        return None
    values = body.model_dump(exclude_unset=True)
    if "metadata" in values:
        row.channel_metadata = values.pop("metadata")
    for key, value in values.items():
        setattr(row, key, value)
    row.updated_at = _now()
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def get_or_create_rule_config(session: Session) -> RepairRuleConfig:
    row = session.scalar(select(RepairRuleConfig).where(RepairRuleConfig.rule_code == DEFAULT_RULE_CODE))
    if row is not None:
        return row
    row = RepairRuleConfig(
        rule_code=DEFAULT_RULE_CODE,
        rule_name="统一报修中心默认规则",
        allow_ai_auto_create_order=False,
        channel_confirm_rules={
            "WECHAT": "USER_CONFIRM",
            "WEWORK": "USER_CONFIRM",
            "FEISHU": "USER_CONFIRM",
            "DINGTALK": "USER_CONFIRM",
            "VOICE": "MANUAL_CONFIRM_IF_LOW_CONFIDENCE",
        },
        emergency_auto_upgrade=True,
        night_shift_notify=True,
        night_shift_time_range="18:00-08:00",
        dispatch_timeout_minutes=30,
        acceptance_timeout_hours=24,
        high_value_notify_threshold=Decimal("1000000.00"),
        repeat_repair_window_days=30,
        repeat_repair_threshold=3,
        life_support_spare_hint=True,
        allow_clinical_progress_view=True,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def patch_rule_config(session: Session, body: RuleConfigPatch) -> RepairRuleConfig:
    row = get_or_create_rule_config(session)
    values = body.model_dump(exclude_unset=True)
    if "metadata" in values:
        row.rule_metadata = values.pop("metadata")
    for key, value in values.items():
        setattr(row, key, value)
    row.updated_at = _now()
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def create_message_from_webhook(session: Session, *, channel_type: str, payload: dict[str, Any]) -> UnifiedRepairMessage:
    raw_type = str(payload.get("raw_message_type") or payload.get("message_type") or payload.get("type") or "TEXT").upper()
    content = payload.get("raw_message_content") or payload.get("content") or payload.get("text") or payload.get("message")
    if content is None:
        content = str(payload)
    body = UnifiedRepairMessageCreate(
        source_channel=channel_type.upper(),
        source_channel_name=payload.get("source_channel_name") or channel_type,
        sender_id=payload.get("sender_id") or payload.get("open_id") or payload.get("user_id"),
        sender_name=payload.get("sender_name") or payload.get("user_name"),
        sender_phone=payload.get("sender_phone"),
        sender_department=payload.get("sender_department"),
        raw_message_type=raw_type,
        raw_message_content=str(content),
        voice_file_url=payload.get("voice_file_url"),
        image_file_url=payload.get("image_file_url"),
        video_file_url=payload.get("video_file_url"),
        transcribed_text=payload.get("transcribed_text"),
        metadata={"webhook_payload": payload},
    )
    msg = create_message(session, body)
    ai_extract_message(session, msg.id)
    return msg


def list_progress(
    session: Session,
    *,
    sender_id: str | None = None,
    sender_phone: str | None = None,
    order_code: str | None = None,
    limit: int = 5,
) -> list[dict[str, Any]]:
    stmt = select(RepairOrder)
    if order_code:
        stmt = stmt.where(RepairOrder.order_code == order_code)
    elif sender_id or sender_phone:
        msg_stmt = select(UnifiedRepairMessage.converted_order_id).where(UnifiedRepairMessage.converted_order_id.is_not(None))
        if sender_id:
            msg_stmt = msg_stmt.where(UnifiedRepairMessage.sender_id == sender_id)
        if sender_phone:
            msg_stmt = msg_stmt.where(UnifiedRepairMessage.sender_phone == sender_phone)
        ids = [x for x in session.scalars(msg_stmt).all() if x is not None]
        if not ids:
            return []
        stmt = stmt.where(RepairOrder.id.in_(ids))
    rows = list(session.scalars(stmt.order_by(RepairOrder.created_at.desc()).limit(max(1, min(20, limit)))).all())
    return [_order_to_progress(x) for x in rows]


def _order_to_progress(order: RepairOrder) -> dict[str, Any]:
    status_text = {
        "PENDING_DISPATCH": "待派工",
        "ASSIGNED": "已派工",
        "IN_PROGRESS": "维修中",
        "AWAIT_CONFIRM": "待验收",
        "CLOSED": "已完成",
    }.get(order.order_status, order.order_status)
    progress = {
        "PENDING_DISPATCH": "已生成标准报修工单，等待设备科审核派工",
        "ASSIGNED": "工程师已接单，准备到场处理",
        "IN_PROGRESS": "工程师正在维修处理中",
        "AWAIT_CONFIRM": "维修处理已完成，等待科室验收",
        "CLOSED": "工单已关闭并写入设备维修档案",
    }.get(order.order_status, "工单状态已更新")
    return {
        "id": str(order.id),
        "order_code": order.order_code,
        "asset_id": str(order.asset_id),
        "status": order.order_status,
        "status_text": status_text,
        "handler_id": _uuid(order.assigned_engineer_id),
        "current_progress": progress,
        "estimated_completion": None,
        "created_at": _iso(order.created_at),
        "updated_at": _iso(order.updated_at),
    }
