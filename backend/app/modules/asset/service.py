"""设备台账持久化与服务逻辑。

设计来源：
- docs/03_数据库设计/04_核心表结构设计.md
- docs/06_接口设计/01_API接口设计.md §一
"""

from __future__ import annotations

import secrets
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.modules.asset.models import (
    Asset,
    AssetIntakeFile,
    AssetIntakeTask,
    AssetQrCode,
    EquipmentClassificationBindingLog,
    EquipmentClassificationImpact,
)
from app.modules.asset.schemas import (
    AssetCreate,
    AssetIntakeApproveRequest,
    AssetIntakeCreateAssetRequest,
    AssetIntakeFileCreate,
    AssetIntakeFileRead,
    AssetIntakeReviewRequest,
    AssetIntakeTaskCreate,
    AssetIntakeTaskRead,
    AssetRead,
    AssetUpdate,
    ClassificationImpactAdjustRequest,
    ClassificationBindRequest,
    ClassificationImpactRead,
    QrRead,
)
from app.modules.auth.schemas import JwtClaims
from app.modules.hmdm.client import HmdmClientError, HmdmNotConfiguredError
from app.modules.hmdm.models import HmdmClassificationChange


def _normalize_page(page: int, page_size: int) -> tuple[int, int]:
    p = max(1, page)
    ps = min(100, max(1, page_size))
    return p, ps


def _asset_list_conditions(
    *,
    keyword: str | None = None,
    department_id: UUID | None = None,
    category_code: str | None = None,
    main_status: str | None = None,
    risk_level: str | None = None,
    classification_match_status: str | None = None,
    classification_change_status: str | None = None,
) -> list:
    conds: list = [Asset.deleted_at.is_(None)]
    if department_id:
        conds.append(Asset.department_id == department_id)
    if category_code:
        conds.append(Asset.category_code == category_code)
    if main_status:
        conds.append(Asset.main_status == main_status)
    if risk_level:
        conds.append(Asset.risk_level == risk_level)
    if classification_match_status:
        conds.append(Asset.classification_match_status == classification_match_status)
    if classification_change_status:
        conds.append(Asset.classification_change_status == classification_change_status)
    if keyword:
        like = f"%{keyword}%"
        conds.append(
            or_(
                Asset.asset_name.ilike(like),
                Asset.asset_code.ilike(like),
                Asset.brand.ilike(like),
                Asset.model.ilike(like),
                Asset.department_name.ilike(like),
                Asset.location.ilike(like),
                Asset.serial_number.ilike(like),
                Asset.registration_no.ilike(like),
                Asset.classification_code.ilike(like),
                Asset.classification_name.ilike(like),
            )
        )
    return conds


def list_assets(
    session: Session,
    *,
    keyword: str | None = None,
    department_id: UUID | None = None,
    category_code: str | None = None,
    main_status: str | None = None,
    risk_level: str | None = None,
    classification_match_status: str | None = None,
    classification_change_status: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[AssetRead], int, int, int]:
    conds = _asset_list_conditions(
        keyword=keyword,
        department_id=department_id,
        category_code=category_code,
        main_status=main_status,
        risk_level=risk_level,
        classification_match_status=classification_match_status,
        classification_change_status=classification_change_status,
    )
    stmt = select(Asset).where(*conds)
    count_stmt = select(func.count()).select_from(Asset).where(*conds)
    total = session.execute(count_stmt).scalar_one()

    stmt = stmt.order_by(Asset.updated_at.desc())
    page, page_size = _normalize_page(page, page_size)
    offset = (page - 1) * page_size

    rows = session.execute(stmt.offset(offset).limit(page_size)).scalars().all()
    items = [AssetRead.model_validate(r) for r in rows]
    return items, int(total), page, page_size


def get_asset_strict(session: Session, asset_id: UUID) -> Asset | None:
    row = session.get(Asset, asset_id)
    if row is None or row.deleted_at is not None:
        return None
    return row


def detail_bundle(session: Session, asset_id: UUID) -> dict | None:
    """组装 §一·2 详情壳：维修记录在 PostgreSQL 已迁移时为该设备工单摘要列表。"""
    asset = get_asset_strict(session, asset_id)
    if asset is None:
        return None
    qr_rows: Sequence[AssetQrCode] = (
        session.execute(
            select(AssetQrCode)
            .where(
                AssetQrCode.asset_id == asset_id,
                AssetQrCode.status == "ACTIVE",
            )
            .order_by(AssetQrCode.qr_version.desc(), AssetQrCode.generated_at.desc())
        )
        .scalars()
        .all()
    )
    qrs = [QrRead.model_validate(q).model_dump(mode="json") for q in qr_rows]
    from app.db.session import engine

    repairs: list[dict] = []
    if engine.dialect.name == "postgresql":
        from app.modules.repair.service import list_repair_summaries_for_asset

        repairs = list_repair_summaries_for_asset(session, asset_id)
    impacts = (
        session.execute(
            select(EquipmentClassificationImpact)
            .where(EquipmentClassificationImpact.equipment_id == asset_id)
            .order_by(EquipmentClassificationImpact.created_at.desc())
            .limit(20)
        )
        .scalars()
        .all()
    )

    return {
        "asset": AssetRead.model_validate(asset).model_dump(mode="json"),
        "classification_impacts": [ClassificationImpactRead.model_validate(x).model_dump(mode="json") for x in impacts],
        "qr_codes": qrs,
        "lifecycle_events": [],
        "repairs": repairs,
        "pm_records": [],
        "calibration_records": [],
        "attachments": [],
        "ai_health": {"score": float(asset.ai_health_score) if asset.ai_health_score is not None else None},
    }


def _with_mdm_reference_defaults(data: dict) -> dict:
    """资产档案只保存当前设备绑定的 H-UMDG 分类引用，不复制目录全集。"""
    now = datetime.now(timezone.utc)
    if data.get("mdm_source") == "h-mdm":
        if not data.get("mdm_synced_at"):
            data["mdm_synced_at"] = now
        if data.get("mdm_category_id") and not data.get("classification_id"):
            data["classification_id"] = data["mdm_category_id"]
        if data.get("mdm_category_code") and not data.get("classification_code"):
            data["classification_code"] = data["mdm_category_code"]
        if data.get("mdm_category_name") and not data.get("classification_name"):
            data["classification_name"] = data["mdm_category_name"]
        if data.get("mdm_category_version") and not data.get("classification_version_id"):
            data["classification_version_id"] = data["mdm_category_version"]
        if data.get("mdm_category_code") and not data.get("hmdm_equipment_category_code"):
            data["hmdm_equipment_category_code"] = data["mdm_category_code"]
        if data.get("mdm_category_name") and not data.get("hmdm_equipment_category_name"):
            data["hmdm_equipment_category_name"] = data["mdm_category_name"]
        if data.get("classification_match_status") in (None, "unclassified"):
            data["classification_match_status"] = "confirmed"
        if not data.get("classification_match_method"):
            data["classification_match_method"] = "h-mdm_selector"
    if data.get("department_source") == "h-mdm" and not data.get("department_synced_at"):
        data["department_synced_at"] = now
    if data.get("person_source") == "h-mdm" and not data.get("person_synced_at"):
        data["person_synced_at"] = now
    if data.get("discipline_source") == "h-mdm" and not data.get("discipline_synced_at"):
        data["discipline_synced_at"] = now
    if data.get("org_source") == "h-mdm" and not data.get("org_synced_at"):
        data["org_synced_at"] = now
    return data


def create_asset(session: Session, payload: AssetCreate) -> AssetRead | None:
    asset = Asset(**_with_mdm_reference_defaults(payload.model_dump()))
    session.add(asset)
    try:
        session.flush()
        qr = AssetQrCode(
            asset_id=asset.id,
            qr_token=_new_qr_token(),
            qr_version=1,
            status="ACTIVE",
        )
        session.add(qr)
        session.commit()
        session.refresh(asset)
        return AssetRead.model_validate(asset)
    except IntegrityError:
        session.rollback()
        return None


def update_asset(session: Session, asset_id: UUID, payload: AssetUpdate) -> AssetRead | None:
    asset = get_asset_strict(session, asset_id)
    if asset is None:
        return None
    data = _with_mdm_reference_defaults(payload.model_dump(exclude_unset=True))
    for k, v in data.items():
        setattr(asset, k, v)
    try:
        session.commit()
        session.refresh(asset)
        return AssetRead.model_validate(asset)
    except IntegrityError:
        session.rollback()
        return None


def _task_query(task_id: UUID):
    return select(AssetIntakeTask).options(selectinload(AssetIntakeTask.files)).where(AssetIntakeTask.id == task_id)


def _task_read(task: AssetIntakeTask) -> AssetIntakeTaskRead:
    task.files.sort(key=lambda x: x.created_at or datetime.min.replace(tzinfo=timezone.utc))
    return AssetIntakeTaskRead.model_validate(task)


def create_intake_task(session: Session, payload: AssetIntakeTaskCreate, actor: JwtClaims) -> AssetIntakeTaskRead:
    title = payload.title or f"智能建档任务 {datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    task = AssetIntakeTask(
        title=title,
        mode=payload.mode,
        intake_source=payload.intake_source,
        status="draft",
        ai_extraction_status="pending",
        ai_review_status="draft",
        created_by=str(actor.sub),
        created_by_name=actor.username,
    )
    session.add(task)
    session.commit()
    return _task_read(
        session.execute(_task_query(task.id)).scalar_one()
    )


def get_intake_task(session: Session, task_id: UUID) -> AssetIntakeTaskRead | None:
    task = session.execute(_task_query(task_id)).scalar_one_or_none()
    return _task_read(task) if task else None


def add_intake_file(session: Session, task_id: UUID, payload: AssetIntakeFileCreate) -> AssetIntakeFileRead | None:
    task = session.execute(_task_query(task_id)).scalar_one_or_none()
    if task is None:
        return None
    row = AssetIntakeFile(
        task_id=task.id,
        file_name=payload.file_name,
        file_type=payload.file_type,
        mime_type=payload.mime_type,
        size_bytes=payload.size_bytes,
        storage_uri=payload.storage_uri or f"mock://asset-intake/{task.id}/{payload.file_name}",
        preview_url=payload.preview_url,
        archive_status="raw_archived",
    )
    session.add(row)
    session.flush()
    ids = [str(x) for x in (task.source_file_ids or [])]
    ids.append(str(row.id))
    task.source_file_ids = ids
    task.evidence_file_ids = list(dict.fromkeys([*(task.evidence_file_ids or []), str(row.id)]))
    task.status = "collecting"
    session.commit()
    session.refresh(row)
    return AssetIntakeFileRead.model_validate(row)


def _mock_field(value: Any, confidence: int, *, source: str, basis: str, conflict: bool = False) -> dict[str, Any]:
    return {
        "value": value,
        "confidence": confidence,
        "source": source,
        "basis": basis,
        "mock": True,
        "conflict": conflict,
    }


def _mock_extraction_payload(task: AssetIntakeTask) -> dict[str, Any]:
    provider = {
        "provider": "mock_extraction_provider",
        "mock": True,
        "warning": "OCR/AI 服务尚未接入真实供应商，当前结果仅用于智能建档流程联调，必须人工审核后才能正式建档。",
        "task_id": str(task.id),
    }
    fields = {
        "basic": {
            "device_name": _mock_field("病人监护仪", 96, source="铭牌照片", basis="铭牌设备名称区域识别"),
            "generic_name": _mock_field("病人监护设备", 93, source="注册证", basis="注册证产品名称归一"),
            "brand": _mock_field("迈瑞", 91, source="铭牌照片", basis="品牌 Logo 与文本识别"),
            "model": _mock_field("iPM12", 89, source="铭牌照片", basis="型号字段识别"),
            "specification": _mock_field("多参数监护配置", 82, source="说明书", basis="规格型号段落抽取"),
            "serial_number": _mock_field("SN-IPM12-202605-001", 88, source="铭牌照片", basis="SN/出厂编号识别"),
            "manufacturer_name": _mock_field("深圳迈瑞生物医疗电子股份有限公司", 93, source="注册证", basis="生产企业字段识别"),
            "production_date": _mock_field("2026-03-18", 86, source="铭牌照片", basis="生产日期字段识别"),
            "registration_no": _mock_field("国械注准20163211140", 94, source="注册证", basis="注册证编号识别"),
            "management_class": _mock_field("II", 91, source="H-UMDG 匹配", basis="分类目录管理类别推断"),
        },
        "procurement": {
            "supplier_name": _mock_field("华东医械供应链有限公司", 87, source="发票", basis="销方名称识别"),
            "contract_no": _mock_field("HT-2026-ME-0518", 84, source="合同", basis="合同编号识别"),
            "invoice_no": _mock_field("FP-202605180092", 81, source="发票", basis="发票号码识别"),
            "purchase_amount": _mock_field(186000, 78, source="发票", basis="价税合计识别"),
            "purchase_date": _mock_field("2026-05-18", 80, source="合同", basis="签订日期识别"),
            "arrival_date": _mock_field("2026-05-22", 76, source="到货单", basis="到货日期识别"),
            "acceptance_date": _mock_field("2026-05-25", 83, source="验收单", basis="验收日期识别"),
        },
        "usage": {
            "department_name": _mock_field("ICU一病区", 86, source="验收单", basis="使用科室字段识别"),
            "location": _mock_field("住院楼 8F ICU 监护区", 79, source="验收单", basis="安装地点字段识别"),
            "responsible_person": _mock_field("张主任", 74, source="验收单", basis="责任人签名旁文本识别"),
            "install_date": _mock_field("2026-05-26", 82, source="验收单", basis="启用/安装日期识别"),
        },
    }
    components = [
        {"name": "病人监护仪主机", "type": "main_device", "quantity": 1, "independent_qr": True, "confidence": 94, "mock": True},
        {"name": "血氧探头", "type": "probe", "quantity": 2, "independent_qr": False, "confidence": 88, "mock": True},
        {"name": "心电导联线", "type": "cable", "quantity": 1, "independent_qr": False, "confidence": 86, "mock": True},
        {"name": "无创血压模块", "type": "module", "quantity": 1, "independent_qr": True, "confidence": 81, "mock": True},
        {"name": "中央监护软件授权", "type": "software_license", "quantity": 1, "independent_qr": False, "confidence": 78, "mock": True},
    ]
    return {"provider": provider, "fields": fields, "components": components}


def _review_payload_from_extraction(extracted_fields: dict[str, Any], components: list[dict[str, Any]]) -> dict[str, Any]:
    payload: dict[str, Any] = {"basic": {}, "procurement": {}, "usage": {}, "components": components}
    for section in ("basic", "procurement", "usage"):
        section_fields = extracted_fields.get(section)
        if not isinstance(section_fields, dict):
            continue
        payload[section] = {
            key: value.get("value") if isinstance(value, dict) else value
            for key, value in section_fields.items()
        }
    return payload


def extract_intake_task(session: Session, task_id: UUID) -> AssetIntakeTaskRead | None:
    task = session.execute(_task_query(task_id)).scalar_one_or_none()
    if task is None:
        return None
    payload = _mock_extraction_payload(task)
    fields = payload["fields"]
    components = payload["components"]
    task.ai_extraction_status = "mock_completed"
    task.ai_extraction_confidence = 92
    task.ai_extraction_raw_result = payload
    task.extracted_fields = fields
    task.component_structure = components
    task.review_payload = _review_payload_from_extraction(fields, components)
    task.status = "extracted"
    session.commit()
    return get_intake_task(session, task_id)


def _field_value(task: AssetIntakeTask, section: str, key: str) -> str:
    value = (task.review_payload or {}).get(section, {}).get(key)
    if value is None:
        raw = (task.extracted_fields or {}).get(section, {}).get(key)
        value = raw.get("value") if isinstance(raw, dict) else raw
    return str(value or "").strip()


def _category_to_match(category: Any, confidence: int, reasons: list[str]) -> dict[str, Any]:
    return {
        "id": category.id,
        "code": category.code,
        "name": category.name,
        "path": category.path,
        "parentId": category.parentId,
        "level": category.level,
        "managementClass": category.managementClass,
        "source": category.source,
        "version": category.version,
        "enabled": category.enabled,
        "confidence": confidence,
        "matchBasis": reasons,
        "degraded": False,
    }


async def match_intake_mdm(session: Session, task_id: UUID) -> AssetIntakeTaskRead | None:
    task = session.execute(_task_query(task_id)).scalar_one_or_none()
    if task is None:
        return None
    keyword = (
        _field_value(task, "basic", "generic_name")
        or _field_value(task, "basic", "device_name")
        or _field_value(task, "basic", "registration_no")
        or task.title
    )
    from app.modules.mdm.service import list_device_categories, match_business_partner

    try:
        categories, total, page, page_size = await list_device_categories(keyword=keyword, page=1, page_size=8)
        if not categories and keyword != "病人监护设备":
            categories, total, page, page_size = await list_device_categories(keyword="病人监护设备", page=1, page_size=8)
    except HmdmNotConfiguredError as exc:
        task.mdm_match_result = {
            "connected": False,
            "source": "h-mdm",
            "degraded": True,
            "message": "H-UMDG 主数据服务不可用，无法自动匹配分类目录。",
            "error": str(exc),
            "selectedCategory": None,
        }
        task.status = "mdm_unavailable"
        session.commit()
        return get_intake_task(session, task_id)
    except HmdmClientError as exc:
        detail = "H-UMDG 接口鉴权失败，请检查集成配置或 API Key。" if exc.status_code in {401, 403} else "H-UMDG 主数据服务连接失败。"
        task.mdm_match_result = {
            "connected": False,
            "source": "h-mdm",
            "degraded": True,
            "message": detail,
            "error": str(exc),
            "authFailed": exc.status_code in {401, 403},
            "selectedCategory": None,
        }
        task.status = "mdm_unavailable"
        session.commit()
        return get_intake_task(session, task_id)

    reasons = [
        f"设备名称“{_field_value(task, 'basic', 'device_name') or keyword}”匹配",
        f"型号“{_field_value(task, 'basic', 'model') or '—'}”辅助匹配",
        f"注册证编号“{_field_value(task, 'basic', 'registration_no') or '—'}”辅助匹配",
        "同义词/通用名称归一匹配",
    ]
    candidates = [_category_to_match(category, max(72, 92 - index * 5), reasons) for index, category in enumerate(categories)]
    recommendation = candidates[0] if candidates else None
    manufacturer_name = _field_value(task, "basic", "manufacturer_name")
    supplier_name = _field_value(task, "procurement", "supplier_name")
    registration_holder_name = _field_value(task, "basic", "registration_holder_name") or manufacturer_name
    try:
        manufacturer_rec, manufacturer_candidates, manufacturer_message = await match_business_partner(
            keyword=manufacturer_name,
            role_type="生产厂家",
            page_size=5,
        )
        supplier_rec, supplier_candidates, supplier_message = await match_business_partner(
            keyword=supplier_name,
            role_type="供应商",
            page_size=5,
        )
        holder_rec, holder_candidates, holder_message = await match_business_partner(
            keyword=registration_holder_name,
            role_type="注册证持有人",
            page_size=5,
        )
    except HmdmNotConfiguredError:
        manufacturer_rec = supplier_rec = holder_rec = None
        manufacturer_candidates = supplier_candidates = holder_candidates = []
        manufacturer_message = supplier_message = holder_message = "H-UMDG 往来单位主数据服务不可用。"
    except HmdmClientError as exc:
        manufacturer_rec = supplier_rec = holder_rec = None
        manufacturer_candidates = supplier_candidates = holder_candidates = []
        message = "H-UMDG 接口鉴权失败，请检查集成配置或 API Key。" if exc.status_code in {401, 403} else "H-UMDG 主数据服务连接失败。"
        manufacturer_message = supplier_message = holder_message = message

    task.mdm_match_result = {
        "connected": True,
        "source": "h-mdm",
        "degraded": False,
        "keyword": keyword,
        "total": total,
        "page": page,
        "page_size": page_size,
        "categoryRecommendation": recommendation,
        "candidates": candidates,
        "selectedCategory": recommendation,
        "manufacturerRecommendation": manufacturer_rec,
        "manufacturerCandidates": manufacturer_candidates,
        "manufacturerMessage": manufacturer_message,
        "brandRecommendation": {
            "name": _field_value(task, "basic", "brand"),
            "source": "mock",
            "mock": True,
            "confidence": 86,
            "message": "品牌主数据匹配适配器已预留，当前结果来自 mock provider。",
        },
        "supplierRecommendation": supplier_rec,
        "supplierCandidates": supplier_candidates,
        "supplierMessage": supplier_message,
        "registrationHolderRecommendation": holder_rec,
        "registrationHolderCandidates": holder_candidates,
        "registrationHolderMessage": holder_message,
        "registrationCertificateRecommendation": {
            "registrationNo": _field_value(task, "basic", "registration_no"),
            "source": "mock",
            "mock": True,
            "confidence": 90,
            "message": "注册证主数据匹配适配器已预留，当前结果来自 mock provider。",
        },
    }
    task.status = "mdm_matched" if recommendation else "mdm_no_match"
    session.commit()
    return get_intake_task(session, task_id)


def _selected_category(task: AssetIntakeTask) -> dict[str, Any] | None:
    result = task.mdm_match_result or {}
    selected = result.get("selectedCategory") or result.get("categoryRecommendation")
    return selected if isinstance(selected, dict) else None


def _valid_hmdm_category(category: dict[str, Any] | None) -> bool:
    if not category:
        return False
    return category.get("source") == "h-mdm" and category.get("degraded") is not True and bool(category.get("id"))


def _valid_hmdm_ref(item: dict[str, Any] | None) -> bool:
    if not item:
        return False
    return item.get("source") == "h-mdm" and item.get("degraded") is not True and bool(item.get("id"))


def _partner_ref(review: dict[str, Any], *keys: str) -> dict[str, Any] | None:
    for key in keys:
        value = review.get(key)
        if isinstance(value, dict):
            return value
    partners = review.get("mdmBusinessPartners")
    if isinstance(partners, dict):
        for key in keys:
            value = partners.get(key)
            if isinstance(value, dict):
                return value
    return None


def _partner_field(partner: dict[str, Any] | None, key: str) -> str | None:
    if not partner:
        return None
    aliases = {
        "id": ("id", "org_id"),
        "code": ("code", "org_code", "organization_code"),
        "name": ("name", "org_name", "standard_name"),
        "version": ("version", "updated_at", "updatedAt"),
    }
    for candidate in aliases.get(key, (key,)):
        value = partner.get(candidate)
        if value:
            return str(value)
    return None


def _review_ref(review: dict[str, Any], *keys: str) -> dict[str, Any] | None:
    for key in keys:
        value = review.get(key)
        if isinstance(value, dict):
            return value
    return None


def review_intake_task(
    session: Session,
    task_id: UUID,
    payload: AssetIntakeReviewRequest,
    actor: JwtClaims,
) -> AssetIntakeTaskRead | None:
    task = session.execute(_task_query(task_id)).scalar_one_or_none()
    if task is None:
        return None
    task.review_payload = payload.review_payload or task.review_payload or {}
    task.ai_review_status = payload.review_status
    task.status = "pending_review" if payload.review_status == "pending_review" else payload.review_status
    task.ai_reviewed_by = actor.username
    match_result = dict(task.mdm_match_result or {})
    if payload.selected_mdm_category is not None:
        match_result["selectedCategory"] = payload.selected_mdm_category
    task.mdm_match_result = match_result
    session.commit()
    return get_intake_task(session, task_id)


def approve_intake_task(
    session: Session,
    task_id: UUID,
    _payload: AssetIntakeApproveRequest,
    actor: JwtClaims,
) -> AssetIntakeTaskRead | None:
    task = session.execute(_task_query(task_id)).scalar_one_or_none()
    if task is None:
        return None
    if not task.review_payload:
        raise ValueError("请先完成人工审核并保存审核结果。")
    if not _valid_hmdm_category(_selected_category(task)):
        raise ValueError("当前为降级数据或未选择 H-UMDG 分类目录，不允许作为正式主数据引用保存。")
    task.ai_review_status = "approved"
    task.status = "approved"
    task.ai_reviewed_by = actor.username
    task.ai_reviewed_at = datetime.now(timezone.utc)
    session.commit()
    return get_intake_task(session, task_id)


def _date_or_none(value: Any) -> date | None:
    if isinstance(value, date):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return date.fromisoformat(value.strip()[:10])
        except ValueError:
            return None
    return None


def _asset_code() -> str:
    return f"AI-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid4().hex[:8].upper()}"


def create_asset_from_intake(
    session: Session,
    task_id: UUID,
    payload: AssetIntakeCreateAssetRequest,
) -> tuple[AssetRead | None, AssetIntakeTaskRead | None]:
    task = session.execute(_task_query(task_id)).scalar_one_or_none()
    if task is None:
        return None, None
    if task.ai_review_status != "approved":
        raise ValueError("未完成人工审核通过，不允许正式生成设备档案。")
    category = _selected_category(task)
    if not _valid_hmdm_category(category):
        raise ValueError("当前为降级数据或未选择 H-UMDG 分类目录，不允许作为正式主数据引用保存。")

    review = task.review_payload or _review_payload_from_extraction(task.extracted_fields or {}, task.component_structure or [])
    basic = review.get("basic") if isinstance(review.get("basic"), dict) else {}
    procurement = review.get("procurement") if isinstance(review.get("procurement"), dict) else {}
    usage = review.get("usage") if isinstance(review.get("usage"), dict) else {}
    department = _review_ref(review, "mdmDepartment", "selectedDepartment")
    person = _review_ref(review, "mdmPerson", "selectedPerson")
    discipline = _review_ref(review, "mdmDiscipline", "selectedDiscipline")
    manufacturer = _partner_ref(review, "manufacturer", "mdmManufacturer", "manufacturerPartner")
    supplier = _partner_ref(review, "supplier", "mdmSupplier", "supplierPartner")
    brand_owner = _partner_ref(review, "brandOwner", "mdmBrandOwner", "brandOwnerPartner")
    registration_holder = _partner_ref(review, "registrationHolder", "mdmRegistrationHolder", "registrationHolderPartner")
    maintainer = _partner_ref(review, "maintainer", "mdmMaintainer", "maintainerPartner")
    installer = _partner_ref(review, "installer", "mdmInstaller", "installerPartner")
    if department is not None and not _valid_hmdm_ref(department):
        raise ValueError("当前科室主数据不是 H-UMDG 正式引用，不允许保存为有效主数据引用。")
    if person is not None and not _valid_hmdm_ref(person):
        raise ValueError("当前人员主数据不是 H-UMDG 正式引用，不允许保存为有效主数据引用。")
    if discipline is not None and not _valid_hmdm_ref(discipline):
        raise ValueError("当前学科主数据不是 H-UMDG 正式引用，不允许保存为有效主数据引用。")
    for label, partner in [
        ("生产厂家", manufacturer),
        ("供应商", supplier),
        ("品牌方", brand_owner),
        ("注册证持有人", registration_holder),
        ("维保商", maintainer),
        ("安装单位", installer),
    ]:
        if partner is not None and not _valid_hmdm_ref(partner):
            raise ValueError(f"当前{label}不是 H-UMDG 正式往来单位引用，不允许保存为有效主数据引用。")
    org_version = (
        _partner_field(manufacturer, "version")
        or _partner_field(supplier, "version")
        or _partner_field(brand_owner, "version")
        or _partner_field(registration_holder, "version")
        or _partner_field(maintainer, "version")
        or _partner_field(installer, "version")
    )

    asset_payload = AssetCreate(
        asset_code=payload.asset_code or _asset_code(),
        asset_name=str(basic.get("device_name") or basic.get("generic_name") or task.title),
        brand=str(basic.get("brand") or "") or None,
        model=str(basic.get("model") or "") or None,
        serial_number=str(basic.get("serial_number") or "") or None,
        registration_no=str(basic.get("registration_no") or "") or None,
        manufacturer_org_id=_partner_field(manufacturer, "id"),
        manufacturer_org_code=_partner_field(manufacturer, "code"),
        manufacturer_name=_partner_field(manufacturer, "name") or str(basic.get("manufacturer_name") or "") or None,
        supplier_org_id=_partner_field(supplier, "id"),
        supplier_org_code=_partner_field(supplier, "code"),
        supplier_name=_partner_field(supplier, "name") or str(procurement.get("supplier_name") or "") or None,
        brand_owner_org_id=_partner_field(brand_owner, "id"),
        brand_owner_org_code=_partner_field(brand_owner, "code"),
        brand_owner_name=_partner_field(brand_owner, "name"),
        registration_holder_org_id=_partner_field(registration_holder, "id"),
        registration_holder_org_code=_partner_field(registration_holder, "code"),
        registration_holder_name=_partner_field(registration_holder, "name"),
        maintainer_org_id=_partner_field(maintainer, "id"),
        maintainer_org_code=_partner_field(maintainer, "code"),
        maintainer_name=_partner_field(maintainer, "name"),
        installer_org_id=_partner_field(installer, "id"),
        installer_org_code=_partner_field(installer, "code"),
        installer_name=_partner_field(installer, "name"),
        org_source="h-mdm" if any([manufacturer, supplier, brand_owner, registration_holder, maintainer, installer]) else None,
        org_version=org_version,
        department_name=str((department or {}).get("name") or usage.get("department_name") or "") or None,
        campus_id=str((department or {}).get("campusId") or (person or {}).get("campusId") or "") or None,
        campus_code=str((department or {}).get("campusCode") or (person or {}).get("campusCode") or "") or None,
        campus_name=str((department or {}).get("campusName") or (person or {}).get("campusName") or "") or None,
        mdm_department_id=str((department or {}).get("id") or "") or None,
        department_code=str((department or {}).get("code") or "") or None,
        department_source="h-mdm" if department else None,
        department_version=str((department or {}).get("version") or "") or None,
        mdm_person_id=str((person or {}).get("id") or "") or None,
        person_code=str((person or {}).get("code") or "") or None,
        person_name=str((person or {}).get("name") or usage.get("responsible_person") or "") or None,
        person_department_id=str((person or {}).get("departmentId") or "") or None,
        person_department_name=str((person or {}).get("departmentName") or "") or None,
        person_source="h-mdm" if person else None,
        person_version=str((person or {}).get("version") or "") or None,
        mdm_discipline_id=str((discipline or {}).get("id") or "") or None,
        discipline_code=str((discipline or {}).get("code") or "") or None,
        discipline_name=str((discipline or {}).get("name") or "") or None,
        discipline_source="h-mdm" if discipline else None,
        discipline_version=str((discipline or {}).get("version") or "") or None,
        location=str(usage.get("location") or "") or None,
        purchase_date=_date_or_none(procurement.get("purchase_date")),
        install_date=_date_or_none(usage.get("install_date")),
        original_value=procurement.get("purchase_amount") or None,
        main_status="ACTIVE",
        management_class=str(category.get("managementClass") or basic.get("management_class") or "") or None,
        mdm_category_id=str(category["id"]),
        mdm_category_code=str(category.get("code") or ""),
        mdm_category_name=str(category.get("name") or ""),
        mdm_category_path=str(category.get("path") or ""),
        mdm_category_version=str(category.get("version") or ""),
        mdm_source="h-mdm",
        hmdm_equipment_category_code=str(category.get("code") or ""),
        hmdm_equipment_category_name=str(category.get("name") or ""),
        hmdm_standard_name=str(basic.get("generic_name") or basic.get("device_name") or ""),
        hmdm_management_class=str(category.get("managementClass") or basic.get("management_class") or "") or None,
        classification_id=str(category["id"]),
        classification_code=str(category.get("code") or ""),
        classification_name=str(category.get("name") or ""),
        classification_version_id=str(category.get("version") or ""),
        classification_match_status="confirmed",
        classification_match_method="ai_ocr_hmdm_review",
        classification_match_score=category.get("confidence") or task.ai_extraction_confidence,
        intake_source=task.intake_source,
        ai_extraction_status=task.ai_extraction_status,
        ai_extraction_confidence=task.ai_extraction_confidence,
        ai_extraction_raw_result=task.ai_extraction_raw_result,
        ai_review_status=task.ai_review_status,
        ai_reviewed_by=task.ai_reviewed_by,
        ai_reviewed_at=task.ai_reviewed_at,
        source_file_ids=[str(x) for x in (task.source_file_ids or [])],
        evidence_file_ids=[str(x) for x in (task.evidence_file_ids or [])],
    )
    asset = create_asset(session, asset_payload)
    if asset is None:
        return None, get_intake_task(session, task_id)
    task = session.execute(_task_query(task_id)).scalar_one()
    task.created_asset_id = asset.id
    task.status = "asset_created"
    session.commit()
    return asset, get_intake_task(session, task_id)


def qrcode_public_view(session: Session, asset_id: UUID) -> dict | None:
    asset = get_asset_strict(session, asset_id)
    if asset is None:
        return None
    qr = (
        session.execute(
            select(AssetQrCode)
            .where(AssetQrCode.asset_id == asset.id)
            .order_by(AssetQrCode.qr_version.desc(), AssetQrCode.generated_at.desc())
            .limit(1)
        )
        .scalar_one_or_none()
    )
    if qr is None:
        qr = AssetQrCode(asset_id=asset.id, qr_token=_new_qr_token(), qr_version=1, status="ACTIVE")
        session.add(qr)
        session.commit()
        session.refresh(qr)
    return {
        "asset_id": str(asset.id),
        "asset_code": asset.asset_code,
        "qr_token": qr.qr_token,
        "status": qr.status,
        "version": qr.qr_version,
    }


@dataclass(frozen=True)
class _LabelTemplatePreset:
    template_code: str
    template_name: str
    description: str
    paper_type_code: str
    paper_type_name: str
    layout_code: str
    layout_name: str
    label_width_mm: float
    label_height_mm: float
    display_scale: float
    print_density: int
    print_label_type: int
    print_mode: int
    is_default: bool = False


_LABEL_TEMPLATE_PRESETS: tuple[_LabelTemplatePreset, ...] = (
    _LabelTemplatePreset(
        template_code="ASSET_QR_50X30_V1",
        template_name="资产二维码 50×30",
        description="通用设备资产标签：左侧二维码，右侧设备名称、编码、风险信息。",
        paper_type_code="GAP",
        paper_type_name="间隙标签纸",
        layout_code="QR_LEFT_DETAIL",
        layout_name="二维码左侧 + 信息右侧",
        label_width_mm=50.0,
        label_height_mm=30.0,
        display_scale=8,
        print_density=3,
        print_label_type=1,
        print_mode=1,
        is_default=True,
    ),
    _LabelTemplatePreset(
        template_code="ASSET_QR_60X40_SINGLE_FEED",
        template_name="资产二维码 60×40 单张适配",
        description="针对 60×40 纸仓在标准 40mm 间隙模式下额外走纸的机型；底层按 60×20 画布提交以保证单张出纸。",
        paper_type_code="GAP_60X40_SINGLE_FEED",
        paper_type_name="60×40 间隙纸（单张适配）",
        layout_code="QR_LEFT_STRIP",
        layout_name="二维码左侧 + 条形信息",
        label_width_mm=60.0,
        label_height_mm=20.0,
        display_scale=8,
        print_density=3,
        print_label_type=1,
        print_mode=1,
    ),
    _LabelTemplatePreset(
        template_code="ASSET_QR_50X25_STRIP",
        template_name="资产二维码 50×25（热敏）",
        description="条形标签：适合常见 50×25mm 热敏资产标签纸。",
        paper_type_code="GAP",
        paper_type_name="热敏间隙标签纸",
        layout_code="QR_LEFT_STRIP",
        layout_name="二维码左侧 + 条形信息",
        label_width_mm=50.0,
        label_height_mm=25.0,
        display_scale=8,
        print_density=3,
        print_label_type=1,
        print_mode=1,
    ),
    _LabelTemplatePreset(
        template_code="ASSET_QR_50X25_TRANSFER",
        template_name="资产二维码 50×25（热转印）",
        description="条形标签：适合 50×25mm 热转印间隙资产标签纸，默认提高浓度以改善清晰度。",
        paper_type_code="TAG",
        paper_type_name="热转印间隙标签纸",
        layout_code="QR_LEFT_STRIP",
        layout_name="二维码左侧 + 条形信息",
        label_width_mm=50.0,
        label_height_mm=25.0,
        display_scale=8,
        print_density=8,
        print_label_type=1,
        print_mode=2,
    ),
    _LabelTemplatePreset(
        template_code="ASSET_QR_50X20_STRIP",
        template_name="资产二维码 50×20",
        description="条形标签：适合常见 50×20mm 资产标签纸。",
        paper_type_code="GAP",
        paper_type_name="间隙标签纸",
        layout_code="QR_LEFT_STRIP",
        layout_name="二维码左侧 + 条形信息",
        label_width_mm=50.0,
        label_height_mm=20.0,
        display_scale=8,
        print_density=3,
        print_label_type=1,
        print_mode=1,
    ),
    _LabelTemplatePreset(
        template_code="ASSET_QR_40X30_COMPACT",
        template_name="资产二维码 40×30",
        description="小型标签：适合手持设备、探头附件等空间较小的资产。",
        paper_type_code="GAP",
        paper_type_name="间隙标签纸",
        layout_code="QR_LEFT_COMPACT",
        layout_name="紧凑二维码 + 编码",
        label_width_mm=40.0,
        label_height_mm=30.0,
        display_scale=8,
        print_density=3,
        print_label_type=1,
        print_mode=1,
    ),
    _LabelTemplatePreset(
        template_code="ASSET_QR_30X20_MINI",
        template_name="迷你二维码 30×20",
        description="迷你标签：仅保留二维码、资产名称短文本和资产编码。",
        paper_type_code="GAP",
        paper_type_name="间隙标签纸",
        layout_code="MINI_QR_LEFT",
        layout_name="迷你二维码 + 短编码",
        label_width_mm=30.0,
        label_height_mm=20.0,
        display_scale=8,
        print_density=3,
        print_label_type=1,
        print_mode=1,
    ),
    _LabelTemplatePreset(
        template_code="ASSET_QR_60X40_DETAIL",
        template_name="详细资产标签 60×40（标准间隙）",
        description="标准 60×40 间隙纸详细标签；若当前打印机走出两张纸，请改用“60×40 单张适配”模板。",
        paper_type_code="GAP",
        paper_type_name="间隙标签纸",
        layout_code="QR_LEFT_FULL",
        layout_name="二维码左侧 + 多行详情",
        label_width_mm=60.0,
        label_height_mm=40.0,
        display_scale=8,
        print_density=3,
        print_label_type=1,
        print_mode=1,
    ),
    _LabelTemplatePreset(
        template_code="ASSET_TAG_50X30_TRANSFER",
        template_name="热转印间隙标签 50×30",
        description="热转印间隙纸预设：适合 B50/B50W、B32、Z401、M2、M3 等热转印机型。",
        paper_type_code="TAG",
        paper_type_name="热转印间隙标签纸",
        layout_code="QR_LEFT_DETAIL",
        layout_name="二维码左侧 + 信息右侧",
        label_width_mm=50.0,
        label_height_mm=30.0,
        display_scale=8,
        print_density=8,
        print_label_type=1,
        print_mode=2,
    ),
)


def list_label_templates() -> dict:
    default = next((x for x in _LABEL_TEMPLATE_PRESETS if x.is_default), _LABEL_TEMPLATE_PRESETS[0])
    return {
        "items": [asdict(x) for x in _LABEL_TEMPLATE_PRESETS],
        "default_template_code": default.template_code,
    }


def get_label_template(template_code: str | None = None) -> _LabelTemplatePreset | None:
    code = (template_code or "").strip() or next(
        (x.template_code for x in _LABEL_TEMPLATE_PRESETS if x.is_default),
        _LABEL_TEMPLATE_PRESETS[0].template_code,
    )
    return next((x for x in _LABEL_TEMPLATE_PRESETS if x.template_code == code), None)


def print_label_payload(session: Session, asset_id: UUID, template_code: str | None = None) -> dict | None:
    """生成精臣 PC Web SDK 可消费的资产标签打印载荷。"""
    preset = get_label_template(template_code)
    if preset is None:
        return None
    asset = get_asset_strict(session, asset_id)
    if asset is None:
        return None
    qr = qrcode_public_view(session, asset_id)
    if qr is None:
        return None

    qr_token = str(qr["qr_token"])
    qr_value = f"mep://asset/{asset.id}?token={qr_token}"

    return {
        "asset": {
            "asset_id": str(asset.id),
            "asset_code": asset.asset_code,
            "asset_name": asset.asset_name,
            "main_status": asset.main_status,
        },
        "qr": qr,
        "sdk": {
            "package_version": "web-4.0.6_20260325",
            "service_ws_url": "ws://127.0.0.1:37989",
            "service_required": True,
            "service_installer_hint": "backend/web-4.0.6_20260325/打印服务（必须安装）/jcPrinterSdk_4.0.6_20251120.exe",
            "integration_mode": "PC 管理端浏览器连接本机精臣打印服务；后端仅生成标签数据。",
        },
        "template": {
            "template_code": preset.template_code,
            "template_name": preset.template_name,
            "paper_type_code": preset.paper_type_code,
            "paper_type_name": preset.paper_type_name,
            "layout_code": preset.layout_code,
            "layout_name": preset.layout_name,
            "label_width_mm": preset.label_width_mm,
            "label_height_mm": preset.label_height_mm,
            "display_scale": preset.display_scale,
            "print_density": preset.print_density,
            "print_label_type": preset.print_label_type,
            "print_mode": preset.print_mode,
        },
        "print_data": _build_label_print_data(asset, qr_value, preset),
    }


def bind_classification(
    session: Session,
    asset_id: UUID,
    payload: ClassificationBindRequest,
    actor: JwtClaims,
) -> tuple[AssetRead | None, ClassificationImpactRead | None]:
    asset = get_asset_strict(session, asset_id)
    if asset is None:
        return None, None
    before_id = asset.classification_id
    before_code = asset.classification_code
    asset.classification_id = payload.classification_id
    asset.classification_code = payload.classification_code
    asset.classification_name = payload.classification_name
    asset.classification_version_id = payload.classification_version_id
    asset.management_class = payload.management_class or asset.management_class or asset.hmdm_management_class
    asset.mdm_category_id = payload.classification_id
    asset.mdm_category_code = payload.classification_code
    asset.mdm_category_name = payload.classification_name
    asset.mdm_category_version = payload.classification_version_id
    asset.mdm_source = "h-mdm"
    asset.mdm_synced_at = datetime.now(timezone.utc)
    asset.classification_match_status = "confirmed"
    asset.classification_match_method = payload.match_method
    asset.classification_match_score = payload.match_score
    asset.classification_confirmed_by = actor.username or str(actor.sub)
    asset.classification_confirmed_at = datetime.now(timezone.utc)
    asset.classification_change_status = None

    session.add(
        EquipmentClassificationBindingLog(
            equipment_id=asset.id,
            old_classification_id=before_id,
            old_classification_code=before_code,
            new_classification_id=payload.classification_id,
            new_classification_code=payload.classification_code,
            classification_version_id=payload.classification_version_id,
            action="bind" if before_id is None else "rebind",
            match_method=payload.match_method,
            match_score=payload.match_score,
            confirm_reason=payload.confirm_reason,
            actor_id=str(actor.sub),
            actor_username=actor.username,
        )
    )

    pending = (
        session.execute(
            select(EquipmentClassificationImpact)
            .where(
                EquipmentClassificationImpact.equipment_id == asset.id,
                EquipmentClassificationImpact.status == "pending",
            )
            .order_by(EquipmentClassificationImpact.created_at.desc())
            .limit(1)
        )
        .scalar_one_or_none()
    )
    if pending is not None:
        pending.status = "adjusted" if before_id and before_id != payload.classification_id else "confirmed"
        pending.handled_by = actor.username or str(actor.sub)
        pending.handled_at = datetime.now(timezone.utc)

    session.commit()
    session.refresh(asset)
    return AssetRead.model_validate(asset), ClassificationImpactRead.model_validate(pending) if pending else None


_REMAP_REQUIRED_CHANGE_TYPES = {"deprecated", "merged", "split"}


def _refresh_classification_review_state(session: Session, asset: Asset) -> None:
    session.flush()
    pending = (
        session.execute(
            select(EquipmentClassificationImpact).where(
                EquipmentClassificationImpact.equipment_id == asset.id,
                EquipmentClassificationImpact.status == "pending",
            )
        )
        .scalars()
        .all()
    )
    if pending:
        has_deprecated = any(x.change_type == "deprecated" for x in pending)
        asset.classification_change_status = "expired" if has_deprecated else "pending"
        asset.classification_match_status = "expired" if has_deprecated else "need_review"
        return

    asset.classification_change_status = None
    if asset.classification_id:
        asset.classification_match_status = "confirmed"
    else:
        asset.classification_match_status = "unclassified"


def _get_pending_impact_and_asset(
    session: Session,
    impact_id: UUID,
) -> tuple[EquipmentClassificationImpact | None, Asset | None]:
    impact = session.get(EquipmentClassificationImpact, impact_id)
    if impact is None:
        return None, None
    asset = get_asset_strict(session, impact.equipment_id)
    if asset is None:
        return impact, None
    return impact, asset


def confirm_classification_impact(
    session: Session,
    impact_id: UUID,
    actor: JwtClaims,
) -> tuple[AssetRead | None, ClassificationImpactRead | None]:
    impact, asset = _get_pending_impact_and_asset(session, impact_id)
    if impact is None or asset is None:
        return None, None
    if impact.status != "pending":
        return AssetRead.model_validate(asset), ClassificationImpactRead.model_validate(impact)
    if impact.change_type in _REMAP_REQUIRED_CHANGE_TYPES:
        raise ValueError("该变更类型要求调整为新分类，不能仅确认当前分类。")

    impact.status = "confirmed"
    impact.handled_by = actor.username or str(actor.sub)
    impact.handled_at = datetime.now(timezone.utc)
    asset.classification_confirmed_by = actor.username or str(actor.sub)
    asset.classification_confirmed_at = impact.handled_at
    _refresh_classification_review_state(session, asset)
    session.commit()
    session.refresh(asset)
    session.refresh(impact)
    return AssetRead.model_validate(asset), ClassificationImpactRead.model_validate(impact)


def ignore_classification_impact(
    session: Session,
    impact_id: UUID,
    actor: JwtClaims,
) -> tuple[AssetRead | None, ClassificationImpactRead | None]:
    impact, asset = _get_pending_impact_and_asset(session, impact_id)
    if impact is None or asset is None:
        return None, None
    if impact.status != "pending":
        return AssetRead.model_validate(asset), ClassificationImpactRead.model_validate(impact)
    if impact.impact_level == "high" or impact.change_type in _REMAP_REQUIRED_CHANGE_TYPES:
        raise ValueError("高风险或需重映射的分类变更不能忽略，请确认或调整分类。")

    impact.status = "ignored"
    impact.handled_by = actor.username or str(actor.sub)
    impact.handled_at = datetime.now(timezone.utc)
    _refresh_classification_review_state(session, asset)
    session.commit()
    session.refresh(asset)
    session.refresh(impact)
    return AssetRead.model_validate(asset), ClassificationImpactRead.model_validate(impact)


def adjust_classification_impact(
    session: Session,
    impact_id: UUID,
    payload: ClassificationImpactAdjustRequest,
    actor: JwtClaims,
) -> tuple[AssetRead | None, ClassificationImpactRead | None]:
    impact, asset = _get_pending_impact_and_asset(session, impact_id)
    if impact is None or asset is None:
        return None, None
    before_id = asset.classification_id
    before_code = asset.classification_code

    asset.classification_id = payload.classification_id
    asset.classification_code = payload.classification_code
    asset.classification_name = payload.classification_name
    asset.classification_version_id = payload.classification_version_id
    asset.management_class = payload.management_class or asset.management_class or asset.hmdm_management_class
    asset.mdm_category_id = payload.classification_id
    asset.mdm_category_code = payload.classification_code
    asset.mdm_category_name = payload.classification_name
    asset.mdm_category_version = payload.classification_version_id
    asset.mdm_source = "h-mdm"
    asset.mdm_synced_at = datetime.now(timezone.utc)
    asset.classification_match_status = "remapped"
    asset.classification_match_method = payload.match_method or "manual_adjusted"
    asset.classification_match_score = payload.match_score
    asset.classification_confirmed_by = actor.username or str(actor.sub)
    asset.classification_confirmed_at = datetime.now(timezone.utc)

    session.add(
        EquipmentClassificationBindingLog(
            equipment_id=asset.id,
            old_classification_id=before_id,
            old_classification_code=before_code,
            new_classification_id=payload.classification_id,
            new_classification_code=payload.classification_code,
            classification_version_id=payload.classification_version_id,
            action="adjust",
            match_method=payload.match_method or "manual_adjusted",
            match_score=payload.match_score,
            confirm_reason=payload.handle_reason or payload.confirm_reason,
            actor_id=str(actor.sub),
            actor_username=actor.username,
        )
    )

    impact.status = "adjusted"
    impact.new_classification_id = payload.classification_id
    impact.handled_by = actor.username or str(actor.sub)
    impact.handled_at = asset.classification_confirmed_at
    _refresh_classification_review_state(session, asset)
    if asset.classification_match_status == "confirmed":
        asset.classification_match_status = "remapped"
    session.commit()
    session.refresh(asset)
    session.refresh(impact)
    return AssetRead.model_validate(asset), ClassificationImpactRead.model_validate(impact)


def _impact_level(change_type: str) -> str:
    if change_type in {"management_class_changed", "code_changed", "deprecated", "merged", "split"}:
        return "high"
    if change_type in {"intended_use_changed", "catalog_name_changed"}:
        return "medium"
    return "low"


def _impact_reason(change: HmdmClassificationChange, asset: Asset) -> str:
    name = change.classification_name or asset.classification_name or asset.asset_name
    mapping = {
        "description_changed": "产品描述发生变化，请复核设备用途与档案分类是否仍一致。",
        "intended_use_changed": "预期用途发生变化，请复核临床使用场景。",
        "example_changed": "品名举例发生变化，可用于未分类设备重新匹配。",
        "management_class_changed": "管理类别发生变化，需人工确认监管属性与风险等级。",
        "catalog_name_changed": "目录条目名称发生变化，请复核显示名称与引用快照。",
        "code_changed": "分类编码发生变化，需人工确认后调整引用编码。",
        "deprecated": "原分类已作废，必须重新映射到有效分类。",
        "merged": "原分类已合并，建议迁移到合并后的目标分类。",
        "split": "原分类已拆分，需要人工重新选择分类。",
        "new_catalog": "H-UMDG 新增目录，可用于未分类或低置信度设备重新匹配。",
    }
    return f"{name}：{mapping.get(change.change_type, 'H-UMDG 分类目录发生变化，请复核设备分类。')}"


def sync_classification_impacts(
    session: Session,
    *,
    since: datetime | None = None,
) -> tuple[list[ClassificationImpactRead], int]:
    stmt = select(HmdmClassificationChange)
    if since is not None:
        stmt = stmt.where(HmdmClassificationChange.occurred_at >= since)
    changes = session.execute(stmt.order_by(HmdmClassificationChange.occurred_at.asc())).scalars().all()
    created: list[EquipmentClassificationImpact] = []

    for change in changes:
        if change.change_type == "new_catalog":
            asset_stmt = select(Asset).where(
                Asset.deleted_at.is_(None),
                Asset.classification_match_status.in_(["unclassified", "unable_to_match", "auto_recommended", "pending_confirm"]),
            )
        else:
            asset_stmt = select(Asset).where(
                Asset.deleted_at.is_(None),
                or_(
                    Asset.classification_id == change.classification_id,
                    Asset.classification_code == change.classification_code,
                ),
            )
        assets = session.execute(asset_stmt).scalars().all()
        for asset in assets:
            if change.change_type == "example_changed" and asset.classification_match_status == "confirmed":
                continue
            exists = session.execute(
                select(EquipmentClassificationImpact.impact_id).where(
                    EquipmentClassificationImpact.equipment_id == asset.id,
                    EquipmentClassificationImpact.source_change_id == change.change_id,
                )
            ).scalar_one_or_none()
            if exists is not None:
                continue
            level = _impact_level(change.change_type)
            impact = EquipmentClassificationImpact(
                equipment_id=asset.id,
                old_classification_id=asset.classification_id,
                old_classification_code=asset.classification_code,
                new_classification_id=change.target_classification_id,
                change_type=change.change_type,
                impact_level=level,
                impact_reason=_impact_reason(change, asset),
                source_change_id=change.change_id,
                status="pending",
            )
            session.add(impact)
            created.append(impact)
            asset.classification_change_status = "expired" if change.change_type == "deprecated" else "pending"
            asset.classification_match_status = "expired" if change.change_type == "deprecated" else "need_review"

    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        return [], 0
    return [ClassificationImpactRead.model_validate(x) for x in created], len(created)


def list_classification_impacts(
    session: Session,
    *,
    equipment_id: UUID | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[ClassificationImpactRead], int, int, int]:
    conds: list = []
    if equipment_id is not None:
        conds.append(EquipmentClassificationImpact.equipment_id == equipment_id)
    if status:
        conds.append(EquipmentClassificationImpact.status == status)
    stmt = select(EquipmentClassificationImpact)
    count_stmt = select(func.count()).select_from(EquipmentClassificationImpact)
    if conds:
        stmt = stmt.where(*conds)
        count_stmt = count_stmt.where(*conds)
    total = session.execute(count_stmt).scalar_one()
    page, page_size = _normalize_page(page, page_size)
    rows = (
        session.execute(
            stmt.order_by(EquipmentClassificationImpact.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .scalars()
        .all()
    )
    return [ClassificationImpactRead.model_validate(x) for x in rows], int(total), page, page_size


def _build_label_print_data(asset: Asset, qr_value: str, preset: _LabelTemplatePreset) -> dict:
    label_width = preset.label_width_mm
    label_height = preset.label_height_mm
    margin = 1.5 if label_width <= 35 else 2.0

    if preset.layout_code == "QR_LEFT_STRIP":
        qr_size = min(label_height - margin * 2, 14.5)
        qr_x = margin
        qr_y = (label_height - qr_size) / 2
        text_x = qr_x + qr_size + 1.6
        text_width = label_width - text_x - margin
        lines = [
            f"设备：{_truncate_label_value(asset.asset_name, 16)}",
            f"编码：{_truncate_label_value(asset.asset_code, 22)}",
        ]
        elements = [
            _qr_element(qr_x, qr_y, qr_size, qr_value),
            _text_element(
                x=text_x,
                y=3.2,
                width=text_width,
                height=13.5,
                value="\n".join(lines),
                font_size=2.5,
                line_spacing=0.6,
            ),
        ]
    elif preset.layout_code == "MINI_QR_LEFT":
        qr_size = min(label_height - margin * 2, 11.5)
        qr_x = margin
        qr_y = (label_height - qr_size) / 2
        text_x = qr_x + qr_size + 1.4
        text_width = label_width - text_x - margin
        lines = [
            _truncate_label_value(asset.asset_name, 8),
            _truncate_label_value(asset.asset_code, 14),
        ]
        text = _text_element(
            x=text_x,
            y=3.5,
            width=text_width,
            height=13.0,
            value="\n".join(lines),
            font_size=2.0,
            line_spacing=0.8,
        )
        elements = [_qr_element(qr_x, qr_y, qr_size, qr_value), text]
    elif preset.layout_code == "QR_LEFT_FULL":
        qr_size = min(label_height - margin * 2, 26.0)
        qr_x = margin
        qr_y = (label_height - qr_size) / 2
        text_x = qr_x + qr_size + 2.0
        text_width = label_width - text_x - margin
        lines = _asset_label_lines(asset, name_len=18, code_len=22, serial_len=20, include_status=True)
        elements = [
            _qr_element(qr_x, qr_y, qr_size, qr_value),
            _text_element(
                x=text_x,
                y=4.0,
                width=text_width,
                height=25.0,
                value="\n".join(lines),
                font_size=2.9,
                line_spacing=0.8,
            ),
            _text_element(
                x=text_x,
                y=33.0,
                width=text_width,
                height=4.0,
                value="扫码查看设备档案",
                font_size=2.3,
                vertical=1,
            ),
        ]
    else:
        compact = preset.layout_code == "QR_LEFT_COMPACT"
        qr_size = min(label_height - margin * 2 - 1.0, 18.0 if compact else 20.0)
        qr_x = margin
        qr_y = (label_height - qr_size) / 2
        text_x = qr_x + qr_size + 2.0
        text_width = label_width - text_x - margin
        lines = _asset_label_lines(
            asset,
            name_len=12 if compact else 18,
            code_len=16 if compact else 22,
            serial_len=0 if compact else 20,
            include_status=False,
        )
        elements = [
            _qr_element(qr_x, qr_y, qr_size, qr_value),
            _text_element(
                x=text_x,
                y=4.0,
                width=text_width,
                height=18.0,
                value="\n".join(lines),
                font_size=2.7 if compact else 3.0,
                line_spacing=0.9,
            ),
            _text_element(
                x=text_x,
                y=23.0,
                width=text_width,
                height=4.0,
                value="扫码查看设备档案",
                font_size=2.2 if compact else 2.4,
                vertical=1,
            ),
        ]

    return {
        "InitDrawingBoardParam": {
            "width": label_width,
            "height": label_height,
            "rotate": 0,
            "path": "ZT001.ttf",
            "verticalShift": 0,
            "HorizontalShift": 0,
        },
        "elements": elements,
    }


def _asset_label_lines(
    asset: Asset,
    *,
    name_len: int,
    code_len: int,
    serial_len: int,
    include_status: bool,
) -> list[str]:
    lines = [
        f"设备：{_truncate_label_value(asset.asset_name, name_len)}",
        f"编码：{_truncate_label_value(asset.asset_code, code_len)}",
    ]
    if serial_len and asset.serial_number:
        lines.append(f"序列号：{_truncate_label_value(asset.serial_number, serial_len)}")
    if asset.risk_level:
        lines.append(f"风险：{asset.risk_level}")
    if include_status:
        lines.append(f"状态：{asset.main_status}")
    return lines


def _qr_element(x: float, y: float, size: float, value: str) -> dict:
    return {
        "type": "qrCode",
        "json": {
            "x": round(x, 2),
            "y": round(y, 2),
            "height": round(size, 2),
            "width": round(size, 2),
            "value": value,
            "codeType": 31,
            "rotate": 0,
        },
    }


def _text_element(
    *,
    x: float,
    y: float,
    width: float,
    height: float,
    value: str,
    font_size: float,
    line_spacing: float = 1.0,
    vertical: int = 0,
) -> dict:
    return {
        "type": "text",
        "json": {
            "x": round(x, 2),
            "y": round(y, 2),
            "height": round(height, 2),
            "width": round(width, 2),
            "value": value,
            "fontFamily": "宋体",
            "rotate": 0,
            "fontSize": font_size,
            "textAlignHorizonral": 0,
            "textAlignVertical": vertical,
            "letterSpacing": 0.0,
            "lineSpacing": line_spacing,
            "lineMode": 6,
            "fontStyle": [False, False, False, False],
        },
    }


def resolve_scan(session: Session, qr_token: str) -> Asset | None:
    row = (
        session.execute(select(AssetQrCode).where(AssetQrCode.qr_token == qr_token))
        .scalar_one_or_none()
    )
    if row is None or row.status != "ACTIVE":
        return None
    return get_asset_strict(session, row.asset_id)


def _new_qr_token() -> str:
    return secrets.token_urlsafe(32)


def _truncate_label_value(value: str, max_len: int) -> str:
    value = value.strip()
    if len(value) <= max_len:
        return value
    return value[: max(1, max_len - 1)] + "…"
