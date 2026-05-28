from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
import uuid

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.modules.hmdm import client as hmdm_client
from app.modules.hmdm.models import (
    EquipmentStandardNameRequest,
    HmdmClassificationChange,
    HmdmDictionaryCache,
    ManufacturerVendorRequest,
)
from app.modules.hmdm.schemas import (
    DeviceClassificationCandidate,
    DeviceClassificationChangeCreate,
    DeviceClassificationChangeRead,
    DeviceClassificationMatchRequest,
    DeviceClassificationMatchResponse,
    EquipmentStandardNameRequestCreate,
    ManufacturerVendorRequestCreate,
)


SOURCE_CATEGORY = "equipment_category"
SOURCE_STANDARD_NAME = "equipment_standard_name"
SOURCE_DEVICE_CLASSIFICATION = "device_classification"
SOURCE_VENDOR = "manufacturer_vendor"


_FALLBACK_CLASSIFICATIONS: tuple[dict[str, Any], ...] = (
    {
        "classification_id": "DC-PATIENT-MONITOR",
        "classification_code": "07-04-01",
        "catalog_item": "病人监护设备",
        "management_class": "II",
        "version_id": "HUDMP-2026-CURRENT",
        "product_description": "用于监测患者生命体征并显示、记录或报警的医疗设备。",
        "intended_use": "用于急诊、ICU、手术室及普通病区的患者监护。",
        "examples": ["病人监护仪", "多参数监护仪", "床旁监护仪"],
        "keywords": ["监护", "monitor", "intellivue", "benevision", "病人监护", "生命体征"],
    },
    {
        "classification_id": "DC-ECG-MONITOR",
        "classification_code": "07-03-02",
        "catalog_item": "心电监护设备",
        "management_class": "II",
        "version_id": "HUDMP-2026-CURRENT",
        "product_description": "用于采集和分析心电信号，可联动报警和趋势分析。",
        "intended_use": "用于心内、急诊、ICU 等场景的心电监护。",
        "examples": ["心电监护仪", "除颤监护仪"],
        "keywords": ["心电", "ecg", "除颤", "beneheart"],
    },
    {
        "classification_id": "DC-VENTILATOR",
        "classification_code": "08-01-01",
        "catalog_item": "呼吸治疗设备",
        "management_class": "III",
        "version_id": "HUDMP-2026-CURRENT",
        "product_description": "用于提供或辅助患者通气支持的生命支持类设备。",
        "intended_use": "用于急救、ICU、麻醉复苏等场景的机械通气。",
        "examples": ["呼吸机", "急救呼吸机", "有创呼吸机"],
        "keywords": ["呼吸机", "ventilator", "savina", "通气"],
    },
    {
        "classification_id": "DC-CT",
        "classification_code": "06-01-02",
        "catalog_item": "X射线计算机体层摄影设备",
        "management_class": "III",
        "version_id": "HUDMP-2026-CURRENT",
        "product_description": "用于获得人体断层影像并支持临床诊断。",
        "intended_use": "用于医学影像检查、诊断和随访。",
        "examples": ["CT", "螺旋CT", "计算机断层扫描仪"],
        "keywords": ["ct", "revolution", "断层", "x射线"],
    },
    {
        "classification_id": "DC-INFUSION-PUMP",
        "classification_code": "14-02-01",
        "catalog_item": "输注泵",
        "management_class": "II",
        "version_id": "HUDMP-2026-CURRENT",
        "product_description": "用于按设定速率、剂量输注液体或药物。",
        "intended_use": "用于病区、手术室、ICU 的药液精确输注。",
        "examples": ["注射泵", "输液泵", "输注泵"],
        "keywords": ["注射泵", "输液泵", "perfusor", "space", "输注"],
    },
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _norm_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, list):
        return " ".join(_norm_text(x) for x in value)
    return str(value).strip().lower()


def _candidate_from_payload(item: dict[str, Any]) -> dict[str, Any]:
    examples = item.get("examples") or item.get("example_names") or item.get("product_examples") or item.get("productExamples") or item.get("品名举例") or []
    if isinstance(examples, str):
        examples = [x.strip() for x in examples.replace("，", ",").split(",") if x.strip()]
    return {
        "classification_id": str(item.get("classification_id") or item.get("classificationId") or item.get("id") or item.get("catalogId") or item.get("category_id") or item.get("category_code") or ""),
        "classification_code": str(item.get("classification_code") or item.get("classificationCode") or item.get("catalogCode") or item.get("category_code") or item.get("code") or ""),
        "catalog_item": str(item.get("catalog_item") or item.get("catalogItem") or item.get("classification_name") or item.get("classificationName") or item.get("category_name") or item.get("name") or item.get("source_name") or ""),
        "management_class": item.get("management_class") or item.get("managementClass") or item.get("hmdm_management_class"),
        "version_id": item.get("version_id") or item.get("versionId") or item.get("sourceBatchId") or item.get("classification_version_id"),
        "product_description": item.get("product_description") or item.get("productDescription") or item.get("description"),
        "intended_use": item.get("intended_use") or item.get("intendedUse"),
        "examples": examples if isinstance(examples, list) else [],
        "keywords": item.get("keywords") or [],
    }


def _score_candidate(req: DeviceClassificationMatchRequest, item: dict[str, Any]) -> tuple[int, list[str]]:
    haystack = " ".join(
        _norm_text(x)
        for x in [
            item.get("classification_code"),
            item.get("catalog_item"),
            item.get("product_description"),
            item.get("intended_use"),
            item.get("examples"),
            item.get("keywords"),
            item.get("management_class"),
        ]
    )
    signals = [
        ("设备名称", req.device_name, 28),
        ("品牌", req.brand, 8),
        ("型号", req.model, 10),
        ("注册证名称", req.registration_name, 22),
        ("注册证编号", req.registration_certificate_no, 8),
        ("管理类别", req.management_class, 14),
        ("使用科室", req.department, 5),
        ("用途描述", req.intended_use, 12),
        ("原院内分类", req.original_category, 10),
    ]
    score = 42
    reasons: list[str] = []
    for label, value, weight in signals:
        text = _norm_text(value)
        if not text:
            continue
        parts = [text]
        parts.extend([p for p in text.replace("/", " ").replace("-", " ").split() if len(p) >= 2])
        if any(p and p in haystack for p in parts):
            score += weight
            reasons.append(f"{label}命中")
    if req.management_class and _norm_text(req.management_class) == _norm_text(item.get("management_class")):
        score += 8
        reasons.append("管理类别一致")
    if not reasons and any(k in _norm_text(req.device_name) for k in ["监护", "呼吸", "ct", "泵"]):
        score += 8
        reasons.append("设备名称与目录关键词相近")
    return max(1, min(100, score)), reasons or ["基于设备名称、注册证名称、用途描述和品名举例综合推荐"]


def _extract_items(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [x for x in payload if isinstance(x, dict)]
    if isinstance(payload, dict):
        data = payload.get("data")
        if isinstance(data, dict) and isinstance(data.get("items"), list):
            return [x for x in data["items"] if isinstance(x, dict)]
        if isinstance(data, dict) and isinstance(data.get("records"), list):
            return [x for x in data["records"] if isinstance(x, dict)]
        if isinstance(data, list):
            return [x for x in data if isinstance(x, dict)]
        if isinstance(payload.get("items"), list):
            return [x for x in payload["items"] if isinstance(x, dict)]
        if isinstance(payload.get("records"), list):
            return [x for x in payload["records"] if isinstance(x, dict)]
        if isinstance(payload.get("children"), list):
            return [payload]
    return []


def _flatten_category_tree(payload: Any) -> list[dict[str, Any]]:
    roots = _extract_items(payload)
    out: list[dict[str, Any]] = []

    def walk(node: dict[str, Any]) -> None:
        out.append(node)
        for child in node.get("children") or []:
            if isinstance(child, dict):
                walk(child)

    for root in roots:
        walk(root)
    return out


def _cache_identity(source_type: str, item: dict[str, Any]) -> tuple[str, str]:
    if source_type == SOURCE_CATEGORY:
        return str(item.get("category_code") or item.get("code") or item.get("id") or ""), str(item.get("category_name") or item.get("name") or "")
    if source_type == SOURCE_STANDARD_NAME:
        return str(item.get("equipment_name_code") or item.get("id") or item.get("code") or ""), str(item.get("standard_name") or item.get("name") or "")
    if source_type == SOURCE_DEVICE_CLASSIFICATION:
        return str(item.get("id") or item.get("classificationId") or item.get("catalogId") or item.get("code") or ""), str(item.get("name") or item.get("catalogItem") or "")
    return str(item.get("organization_code") or item.get("id") or ""), str(item.get("standard_name") or "")


def _keyword_candidates(body: DeviceClassificationMatchRequest) -> list[str]:
    values = [
        body.registration_name,
        body.device_name,
        body.original_category,
        body.intended_use,
        body.model,
        body.brand,
    ]
    seen: set[str] = set()
    out: list[str] = []
    for value in values:
        text = str(value or "").strip()
        if not text:
            continue
        parts = [text]
        for token in text.replace("/", " ").replace("-", " ").split():
            token = token.strip()
            if len(token) >= 2:
                parts.append(token)
        for part in parts:
            key = part.lower()
            if key not in seen:
                seen.add(key)
                out.append(part)
    return out


async def fetch_device_classification_catalog(
    *,
    keyword: str | None = None,
    category_code: str | None = None,
    management_class: str | None = None,
    page_size: int = 20,
) -> dict[str, Any]:
    params: dict[str, Any] = {"page": 1, "pageSize": page_size}
    if keyword:
        params["keyword"] = keyword
    if category_code:
        params["categoryCode"] = category_code
    if management_class:
        params["managementClass"] = management_class
    return await hmdm_client.request_json("/api/v1/master-data/device-classification/catalog", params=params)


async def fetch_device_classification_tree(*, keyword: str | None = None) -> dict[str, Any]:
    params: dict[str, Any] = {"maxDepth": 3}
    if keyword:
        params["keyword"] = keyword
    return await hmdm_client.request_json("/api/v1/master-data/device-classification/tree", params=params)


def upsert_cache(session: Session, source_type: str, payload: Any) -> int:
    s = get_settings()
    if not s.effective_master_data_cache_enabled():
        return 0
    if source_type == SOURCE_CATEGORY:
        items = _flatten_category_tree(payload)
    else:
        items = _extract_items(payload)
    expire_at = _now() + timedelta(seconds=max(1, s.effective_master_data_cache_ttl()))
    count = 0
    for item in items:
        source_code, source_name = _cache_identity(source_type, item)
        if not source_code or not source_name:
            continue
        stmt = insert(HmdmDictionaryCache).values(
            source_type=source_type,
            source_code=source_code,
            source_name=source_name,
            payload_json=item,
            synced_at=_now(),
            expire_at=expire_at,
            status="ACTIVE",
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["source_type", "source_code"],
            set_={
                "source_name": source_name,
                "payload_json": item,
                "synced_at": _now(),
                "expire_at": expire_at,
                "status": "ACTIVE",
                "updated_at": _now(),
            },
        )
        session.execute(stmt)
        count += 1
    session.commit()
    return count


def cache_payload(session: Session, source_type: str, *, keyword: str | None = None) -> dict[str, Any]:
    stmt = select(HmdmDictionaryCache).where(HmdmDictionaryCache.source_type == source_type)
    if keyword:
        like = f"%{keyword}%"
        stmt = stmt.where(HmdmDictionaryCache.source_name.ilike(like))
    rows = session.execute(stmt.order_by(HmdmDictionaryCache.synced_at.desc()).limit(200)).scalars().all()
    return {
        "items": [r.payload_json for r in rows],
        "degraded": True,
        "from_cache": True,
        "cache_expired": any(r.expire_at < _now() for r in rows),
    }


async def fetch_with_cache(
    session: Session,
    *,
    source_type: str,
    path: str,
    params: dict[str, Any] | None = None,
    keyword_for_cache: str | None = None,
) -> dict[str, Any]:
    s = get_settings()
    try:
        payload = await hmdm_client.request_json(path, params=params)
        upsert_cache(session, source_type, payload)
        return {"payload": payload, "degraded": False, "from_cache": False, "error": None}
    except Exception as exc:
        if s.effective_master_data_cache_enabled() and s.hmdm_fallback_to_cache:
            return {
                "payload": cache_payload(session, source_type, keyword=keyword_for_cache),
                "degraded": True,
                "from_cache": True,
                "error": str(exc),
            }
        raise


def cache_status(session: Session) -> dict[str, Any]:
    s = get_settings()
    rows = session.execute(
        select(HmdmDictionaryCache.source_type, func.count())
        .group_by(HmdmDictionaryCache.source_type)
    ).all()
    latest = session.execute(select(func.max(HmdmDictionaryCache.synced_at))).scalar_one()
    expired = session.execute(
        select(func.count()).select_from(HmdmDictionaryCache).where(HmdmDictionaryCache.expire_at < _now())
    ).scalar_one()
    return {
        "cache_enabled": s.effective_master_data_cache_enabled(),
        "fallback_to_cache": s.hmdm_fallback_to_cache,
        "ttl_seconds": s.effective_master_data_cache_ttl(),
        "counts": {str(k): int(v) for k, v in rows},
        "latest_synced_at": latest,
        "expired_count": int(expired or 0),
    }


async def match_device_classification(
    session: Session,
    body: DeviceClassificationMatchRequest,
) -> DeviceClassificationMatchResponse:
    """调用 H-UMDG 分类匹配；未配置或失败时基于只读缓存/内置样例降级返回多个候选。"""
    external_error: str | None = None
    if hmdm_client.is_configured():
        try:
            raw_items: list[dict[str, Any]] = []
            for keyword in _keyword_candidates(body)[:6]:
                payload = await fetch_device_classification_catalog(
                    keyword=keyword,
                    management_class=body.management_class,
                    page_size=20,
                )
                raw_items.extend(_extract_items(payload))
                if len(raw_items) >= 8:
                    break

            ranked: list[tuple[int, DeviceClassificationCandidate]] = []
            seen: set[str] = set()
            for item in raw_items:
                raw = _candidate_from_payload(item)
                if not raw.get("classification_id") or not raw.get("classification_code") or not raw.get("catalog_item"):
                    continue
                key = f"{raw['classification_id']}:{raw['classification_code']}"
                if key in seen:
                    continue
                seen.add(key)
                score, reasons = _score_candidate(body, raw)
                ranked.append(
                    (
                        score,
                        DeviceClassificationCandidate(
                            classificationId=raw["classification_id"],
                            classificationCode=raw["classification_code"],
                            catalogItem=raw["catalog_item"],
                            managementClass=raw.get("management_class"),
                            matchScore=score,
                            matchReason="、".join(reasons),
                            versionId=raw.get("version_id"),
                            productDescription=raw.get("product_description"),
                            intendedUse=raw.get("intended_use"),
                            examples=[str(x) for x in raw.get("examples") or []],
                        ),
                    )
                )
            if ranked:
                ranked.sort(key=lambda x: x[0], reverse=True)
                upsert_cache(session, SOURCE_DEVICE_CLASSIFICATION, {"records": raw_items})
                return DeviceClassificationMatchResponse(candidates=[x[1] for x in ranked[:8]], source="h-mdm", degraded=False)
        except Exception as exc:
            external_error = str(exc)

    rows = session.execute(
        select(HmdmDictionaryCache).where(HmdmDictionaryCache.source_type.in_([SOURCE_DEVICE_CLASSIFICATION, SOURCE_CATEGORY, SOURCE_STANDARD_NAME]))
    ).scalars().all()
    raw_items = [_candidate_from_payload(r.payload_json) for r in rows]
    raw_items.extend(dict(x) for x in _FALLBACK_CLASSIFICATIONS)

    ranked: list[tuple[int, DeviceClassificationCandidate]] = []
    seen: set[str] = set()
    for raw in raw_items:
        if not raw.get("classification_id") or not raw.get("classification_code") or not raw.get("catalog_item"):
            continue
        key = f"{raw['classification_id']}:{raw['classification_code']}"
        if key in seen:
            continue
        seen.add(key)
        score, reasons = _score_candidate(body, raw)
        if score < 45 and raw not in _FALLBACK_CLASSIFICATIONS:
            continue
        ranked.append(
            (
                score,
                DeviceClassificationCandidate(
                    classificationId=raw["classification_id"],
                    classificationCode=raw["classification_code"],
                    catalogItem=raw["catalog_item"],
                    managementClass=raw.get("management_class"),
                    matchScore=score,
                    matchReason="、".join(reasons) + (f"；H-UMDG暂不可用：{external_error}" if external_error else ""),
                    versionId=raw.get("version_id") or "HUDMP-2026-CURRENT",
                    productDescription=raw.get("product_description"),
                    intendedUse=raw.get("intended_use"),
                    examples=[str(x) for x in raw.get("examples") or []],
                ),
            )
        )
    ranked.sort(key=lambda x: x[0], reverse=True)
    return DeviceClassificationMatchResponse(
        candidates=[x[1] for x in ranked[:8]],
        source="cache" if rows else "fallback",
        degraded=bool(external_error) or not hmdm_client.is_configured(),
    )


def upsert_classification_change(
    session: Session,
    body: DeviceClassificationChangeCreate,
) -> HmdmClassificationChange:
    change_id = body.change_id or f"CHG-{uuid.uuid4().hex[:12]}"
    row = session.get(HmdmClassificationChange, change_id)
    payload = body.model_dump(exclude_unset=True)
    values = {
        "change_id": change_id,
        "classification_id": payload.get("classification_id"),
        "classification_code": payload.get("classification_code"),
        "classification_name": payload.get("classification_name"),
        "version_id": payload.get("version_id"),
        "change_type": payload["change_type"],
        "change_reason": payload.get("change_reason"),
        "old_payload": payload.get("old_payload"),
        "new_payload": payload.get("new_payload"),
        "target_classification_id": payload.get("target_classification_id"),
        "target_classification_code": payload.get("target_classification_code"),
        "occurred_at": payload.get("occurred_at") or _now(),
    }
    if row is None:
        row = HmdmClassificationChange(**values)
        session.add(row)
    else:
        for key, value in values.items():
            setattr(row, key, value)
    session.commit()
    session.refresh(row)
    return row


async def pull_classification_changes(
    session: Session,
    since: datetime | None = None,
) -> list[DeviceClassificationChangeRead]:
    if hmdm_client.is_configured():
        try:
            params = {"since": since.isoformat()} if since else {}
            payload = await hmdm_client.request_json("/api/v1/master-data/device-classification/changes", params=params)
            data = payload.get("data") if isinstance(payload, dict) else payload
            changes = data.get("changes") or data.get("records") if isinstance(data, dict) else data
            if isinstance(changes, list):
                for item in changes:
                    if isinstance(item, dict):
                        change = {
                            "changeId": item.get("changeId"),
                            "classificationId": item.get("classificationId") or item.get("catalogId"),
                            "classificationCode": item.get("classificationCode") or item.get("catalogCode"),
                            "classificationName": item.get("classificationName"),
                            "versionId": item.get("versionId") or item.get("sourceBatchId"),
                            "changeType": item.get("changeType"),
                            "changeReason": item.get("changeReason") or item.get("reason"),
                            "oldPayload": item.get("oldPayload") or item.get("beforeData"),
                            "newPayload": item.get("newPayload") or item.get("afterData"),
                            "targetClassificationId": item.get("targetClassificationId"),
                            "targetClassificationCode": item.get("targetClassificationCode"),
                            "occurredAt": item.get("occurredAt") or item.get("changedAt"),
                        }
                        upsert_classification_change(session, DeviceClassificationChangeCreate.model_validate(change))
        except Exception:
            pass

    stmt = select(HmdmClassificationChange)
    if since is not None:
        stmt = stmt.where(HmdmClassificationChange.occurred_at >= since)
    rows = session.execute(stmt.order_by(HmdmClassificationChange.occurred_at.asc())).scalars().all()
    return [DeviceClassificationChangeRead.model_validate(r) for r in rows]


def create_equipment_name_request(
    session: Session,
    body: EquipmentStandardNameRequestCreate,
    submitted_by: str,
) -> EquipmentStandardNameRequest:
    row = EquipmentStandardNameRequest(
        proposed_name=body.proposed_name,
        alias_names=body.alias_names,
        suggested_category=body.suggested_category,
        reason=body.reason,
        submitted_by=submitted_by,
        status="PENDING",
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def create_manufacturer_vendor_request(
    session: Session,
    body: ManufacturerVendorRequestCreate,
    submitted_by: str,
) -> ManufacturerVendorRequest:
    row = ManufacturerVendorRequest(
        proposed_standard_name=body.proposed_standard_name,
        english_name=body.english_name,
        short_name=body.short_name,
        alias_names=body.alias_names,
        unified_social_credit_code=body.unified_social_credit_code,
        suggested_role_type=body.suggested_role_type,
        business_domain=body.business_domain,
        contact_info=body.contact_info,
        reason=body.reason,
        submitted_by=submitted_by,
        status="PENDING",
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row
