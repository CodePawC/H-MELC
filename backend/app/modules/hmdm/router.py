"""标准主数据服务适配 API。

标准主数据服务负责权威字典和机构主数据；H-MELC 只消费标准编码、标准名称、当前状态和必要快照。
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.core.deps import DbSession
from app.core.responses import envelope_ok
from app.db.session import engine
from app.modules.auth.deps import require_roles
from app.modules.auth.rbac import RBAC_ASSET_READ, RBAC_ASSET_WRITE
from app.modules.auth.schemas import JwtClaims
from app.modules.hmdm import client as hmdm_client
from app.modules.hmdm import service
from app.modules.hmdm.schemas import (
    DeviceClassificationChangeCreate,
    DeviceClassificationChangeRead,
    DeviceClassificationMatchRequest,
    DeviceClassificationRequestCreate,
    EquipmentStandardNameRequestCreate,
    HmdmCacheStatusResponse,
    HmdmStatusResponse,
    ManufacturerVendorRequestCreate,
    OrganizationMasterRequestCreate,
    RequestRead,
)


router = APIRouter(prefix="/hmdm", tags=["hmdm"])
master_data_router = APIRouter(prefix="/master-data", tags=["master-data"])


def _ensure_pg_integration() -> None:
    if engine.dialect.name != "postgresql":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="标准主数据缓存与申请需 PostgreSQL 执行 alembic upgrade head（integration schema）。",
        )
    try:
        inspector = sa_inspect(engine)
        if not inspector.has_table("hmdm_dictionary_cache", schema="integration"):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="主数据服务集成表未就绪：请执行 alembic upgrade head（含 e021_hmdm_external_integration）。",
            )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="主数据服务集成表状态检查失败，请确认 PostgreSQL 与 Alembic 迁移。",
        ) from exc


PgIntegrationStore = Depends(_ensure_pg_integration)


@router.get("")
def hmdm_root() -> dict:
    return envelope_ok(
        data={
            "module": "hmdm",
            "name": "主数据来源设置",
            "boundary": "主数据服务可以来自任意符合规范的标准数据服务；H-MELC 只通过适配器代理查询、保存引用快照、只读缓存和候选申请。",
            "paths": {
                "status": "/api/v1/hmdm/status",
                "equipment_categories_tree": "/api/v1/hmdm/equipment-categories/tree",
                "equipment_standard_names": "/api/v1/hmdm/equipment-standard-names",
                "manufacturer_vendors": "/api/v1/hmdm/manufacturer-vendors",
                "device_classification_requests": "/api/v1/hmdm/device-classification-requests",
                "organization_master_requests": "/api/v1/hmdm/organization-master-requests",
                "device_classification_match": "/api/v1/master-data/device-classification/match",
                "device_classification_changes": "/api/v1/master-data/device-classification/changes",
                "cache_status": "/api/v1/hmdm/cache/status",
            },
        }
    )


@router.get("/status", dependencies=[PgIntegrationStore])
async def hmdm_status(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    s = get_settings()
    connected = False
    last_failure_reason = None
    last_success_at = None
    if hmdm_client.is_configured():
        try:
            await hmdm_client.request_json("/api/v1/master-data/health")
            connected = True
            last_success_at = datetime.now(timezone.utc)
        except Exception as exc:
            last_failure_reason = str(exc)
    else:
        last_failure_reason = "MASTER_DATA_BASE_URL 未配置或 MASTER_DATA_MODE=local"
    cache = service.cache_status(db)
    if connected:
        last_success_at = cache.get("latest_synced_at") or last_success_at
    payload = HmdmStatusResponse(
        hmdm_base_url=hmdm_client.configured_base_url(),
        connected=connected,
        last_success_at=last_success_at,
        last_failure_reason=last_failure_reason,
        api_key_configured=bool(s.master_data_token()),
        cache_enabled=s.effective_master_data_cache_enabled(),
        cache_status=cache,
    )
    return envelope_ok(data=payload.model_dump(mode="json"))


@router.get("/equipment-categories/tree", dependencies=[PgIntegrationStore])
async def equipment_categories_tree(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    try:
        data = await service.fetch_with_cache(
            db,
            source_type=service.SOURCE_DEVICE_CLASSIFICATION,
            path="/api/v1/master-data/device-classification/tree",
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return envelope_ok(data=data)


@router.get("/equipment-standard-names", dependencies=[PgIntegrationStore])
async def equipment_standard_names(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
    keyword: str | None = Query(None),
    category_id: str | None = Query(None),
) -> dict:
    try:
        data = {
            "payload": await service.fetch_device_classification_catalog(
                keyword=keyword,
                category_code=category_id,
                page_size=50,
            ),
            "degraded": False,
            "from_cache": False,
            "error": None,
        }
        service.upsert_cache(db, service.SOURCE_DEVICE_CLASSIFICATION, data["payload"])
    except Exception as exc:
        try:
            data = {
                "payload": service.cache_payload(db, service.SOURCE_DEVICE_CLASSIFICATION, keyword=keyword),
                "degraded": True,
                "from_cache": True,
                "error": str(exc),
            }
        except Exception:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return envelope_ok(data=data)


@router.get("/equipment-standard-names/{item_id}", dependencies=[PgIntegrationStore])
async def equipment_standard_name_detail(
    item_id: str,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    try:
        payload = await hmdm_client.request_json(f"/api/external/equipment-standard-names/{item_id}")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return envelope_ok(data={"payload": payload, "degraded": False, "from_cache": False})


@router.get("/manufacturer-vendors", dependencies=[PgIntegrationStore])
async def manufacturer_vendors(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
    keyword: str | None = Query(None),
    role_type: str | None = Query(None),
    business_domain: str | None = Query(None),
) -> dict:
    try:
        data = await service.fetch_with_cache(
            db,
            source_type=service.SOURCE_VENDOR,
            path="/api/external/manufacturer-vendors",
            params={"keyword": keyword, "role_type": role_type, "business_domain": business_domain},
            keyword_for_cache=keyword,
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return envelope_ok(data=data)


@router.get("/manufacturer-vendors/{item_id}", dependencies=[PgIntegrationStore])
async def manufacturer_vendor_detail(
    item_id: str,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    try:
        payload = await hmdm_client.request_json(f"/api/external/manufacturer-vendors/{item_id}")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return envelope_ok(data={"payload": payload, "degraded": False, "from_cache": False})


@router.get("/manufacturer-vendors/{item_id}/relations", dependencies=[PgIntegrationStore])
async def manufacturer_vendor_relations(
    item_id: str,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    try:
        payload = await hmdm_client.request_json(f"/api/external/manufacturer-vendors/{item_id}/relations")
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return envelope_ok(data={"payload": payload, "degraded": False, "from_cache": False})


@router.post("/equipment-standard-name-requests", dependencies=[PgIntegrationStore])
def create_equipment_standard_name_request(
    db: DbSession,
    body: EquipmentStandardNameRequestCreate,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    try:
        row = service.create_equipment_name_request(db, body, submitted_by=str(actor.sub))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="主数据服务申请表未就绪") from exc
    data = RequestRead.model_validate(row).model_dump(mode="json")
    data["proposed_name"] = row.proposed_name
    return envelope_ok(data=data)


@router.post("/manufacturer-vendor-requests", dependencies=[PgIntegrationStore])
def create_manufacturer_vendor_request(
    db: DbSession,
    body: ManufacturerVendorRequestCreate,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    try:
        row = service.create_manufacturer_vendor_request(db, body, submitted_by=str(actor.sub))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="主数据服务申请表未就绪") from exc
    data = RequestRead.model_validate(row).model_dump(mode="json")
    data["proposed_standard_name"] = row.proposed_standard_name
    return envelope_ok(data=data)


@router.post("/device-classification-requests", dependencies=[PgIntegrationStore])
def create_device_classification_request(
    db: DbSession,
    body: DeviceClassificationRequestCreate,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    try:
        row = service.create_device_classification_request(db, body, submitted_by=str(actor.sub))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="主数据服务申请表未就绪") from exc
    data = RequestRead.model_validate(row).model_dump(mode="json")
    data["proposed_name"] = row.proposed_name
    data["proposed_code"] = row.proposed_code
    return envelope_ok(data=data)


@router.post("/organization-master-requests", dependencies=[PgIntegrationStore])
def create_organization_master_request(
    db: DbSession,
    body: OrganizationMasterRequestCreate,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    try:
        row = service.create_organization_master_request(db, body, submitted_by=str(actor.sub))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="主数据服务申请表未就绪") from exc
    data = RequestRead.model_validate(row).model_dump(mode="json")
    data["object_type"] = row.object_type
    data["proposed_name"] = row.proposed_name
    data["proposed_code"] = row.proposed_code
    return envelope_ok(data=data)


@router.get("/supplement-requests", dependencies=[PgIntegrationStore])
def list_supplement_requests(
    db: DbSession,
    status_filter: str | None = Query(None, alias="status"),
    request_type: str | None = Query(None, alias="type"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    """列出所有类型的主数据补充申请。"""
    from app.modules.hmdm.models import (
        EquipmentStandardNameRequest,
        ManufacturerVendorRequest,
        DeviceClassificationRequest,
        OrganizationMasterRequest,
    )
    from sqlalchemy import union_all, literal_column

    result: list[dict] = []
    models = {
        "equipment_standard_name": EquipmentStandardNameRequest,
        "manufacturer_vendor": ManufacturerVendorRequest,
        "device_classification": DeviceClassificationRequest,
        "organization_master": OrganizationMasterRequest,
    }
    for req_type, model_cls in models.items():
        if request_type and request_type != req_type:
            continue
        q = select(model_cls)
        if status_filter:
            q = q.where(model_cls.status == status_filter)
        rows = db.scalars(q.order_by(model_cls.created_at.desc()).limit(page_size)).all()
        for row in rows:
            item = RequestRead.model_validate(row).model_dump(mode="json")
            item["request_type"] = req_type
            if hasattr(row, "proposed_name"):
                item["proposed_name"] = row.proposed_name
            elif hasattr(row, "proposed_standard_name"):
                item["proposed_name"] = row.proposed_standard_name
            result.append(item)

    return envelope_ok(data={"items": result, "total": len(result), "page": page, "page_size": page_size})


@router.get("/cache/status", dependencies=[PgIntegrationStore])
def hmdm_cache_status(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    return envelope_ok(data=HmdmCacheStatusResponse.model_validate(service.cache_status(db)).model_dump(mode="json"))


@router.post("/cache/refresh", dependencies=[PgIntegrationStore])
async def refresh_hmdm_cache(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    refreshed: dict[str, int] = {}
    try:
        tree = await service.fetch_device_classification_tree()
        refreshed[service.SOURCE_DEVICE_CLASSIFICATION] = service.upsert_cache(db, service.SOURCE_DEVICE_CLASSIFICATION, tree)
        catalog = await service.fetch_device_classification_catalog(page_size=100)
        refreshed[service.SOURCE_DEVICE_CLASSIFICATION] += service.upsert_cache(db, service.SOURCE_DEVICE_CLASSIFICATION, catalog)
        vendors = await hmdm_client.request_json("/api/external/manufacturer-vendors")
        refreshed[service.SOURCE_VENDOR] = service.upsert_cache(db, service.SOURCE_VENDOR, vendors)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return envelope_ok(data={"refreshed": refreshed, "cache_status": service.cache_status(db)})


@master_data_router.post("/device-classification/match", dependencies=[PgIntegrationStore])
async def match_device_classification(
    db: DbSession,
    body: DeviceClassificationMatchRequest,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    """标准医疗器械分类目录匹配代理；返回多个候选项，不维护本地权威目录。"""
    try:
        payload = await service.match_device_classification(db, body)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="主数据分类匹配缓存不可用") from exc
    return envelope_ok(
        data=payload.model_dump(mode="json", by_alias=True),
        message="success",
    )


@master_data_router.get("/device-classification/changes", dependencies=[PgIntegrationStore])
async def list_device_classification_changes(
    db: DbSession,
    since: datetime | None = Query(None),
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    """拉取 标准医疗器械分类目录增量变更。"""
    try:
        rows = await service.pull_classification_changes(db, since=since)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="主数据分类变更记录不可用") from exc
    return envelope_ok(data={"changes": [r.model_dump(mode="json", by_alias=True) for r in rows]})


@master_data_router.post("/device-classification/changes/mock", dependencies=[PgIntegrationStore])
def mock_device_classification_change(
    db: DbSession,
    body: DeviceClassificationChangeCreate,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    """本地联调用：模拟 标准主数据服务 发布一条医疗器械分类目录变更。"""
    try:
        row = service.upsert_classification_change(db, body)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="主数据分类变更记录不可用") from exc
    return envelope_ok(data={"change": DeviceClassificationChangeRead.model_validate(row).model_dump(mode="json", by_alias=True)})
