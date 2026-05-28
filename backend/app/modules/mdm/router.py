"""MDM · 多维分类条目 API（Phase 0）。

对齐概要：docs/01_需求文档/07_统一主数据与多分类体系设计.md；已连 PG 但未建 mdm 表时对 SQL 异常返回 **503**。
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError

from app.core.audit_emit import emit_audit
from app.core.deps import DbSession
from app.core.responses import envelope_ok
from app.db.session import engine
from app.modules.hmdm.client import HmdmClientError, HmdmNotConfiguredError
from app.modules.auth.deps import require_roles
from app.modules.auth.rbac import RBAC_ASSET_READ, RBAC_ASSET_WRITE
from app.modules.auth.schemas import JwtClaims
from app.modules.mdm.schemas import (
    CampusListResponse,
    BusinessPartnerListResponse,
    CategoryEntryCreate,
    DepartmentDisciplineMappingListResponse,
    DepartmentListResponse,
    DepartmentTreeResponse,
    DeviceCategoryListResponse,
    DeviceCategoryTreeResponse,
    DisciplineListResponse,
    DisciplineTreeResponse,
    MdmMatchRequest,
    MdmMatchResponse,
    PersonListResponse,
)
from app.modules.mdm.service import create_entry as mdm_create
from app.modules.mdm.service import list_entries
from app.modules.mdm.service import (
    get_department_detail,
    get_department_tree,
    get_device_category_detail,
    get_device_category_tree,
    get_discipline_detail,
    get_discipline_tree,
    get_person_detail,
    list_campuses,
    list_department_discipline_mappings,
    get_business_partner_detail,
    list_departments,
    list_device_categories,
    list_disciplines,
    list_persons,
    list_business_partners,
    match_business_partner,
)


router = APIRouter(prefix="/mdm", tags=["mdm"])


def _ensure_pg_mdm() -> None:
    if engine.dialect.name != "postgresql":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MDM 需在 PostgreSQL 执行 alembic upgrade head（含 e006_mdm_categories）后访问。",
        )


PgMdmStore = Depends(_ensure_pg_mdm)

_MDM_PG_NOT_READY = (
    "MDM 持久化未就绪：请在目标库执行 alembic upgrade head（含 e006_mdm_categories）。"
)

_HMDM_UNAVAILABLE = "H-UMDG 主数据服务暂不可用，无法获取医疗器械分类目录，请稍后重试或联系管理员。"
_HMDM_ORG_UNAVAILABLE = "H-UMDG 主数据服务不可用，无法获取科室/人员/学科信息。"


def _raise_hmdm_error(exc: Exception) -> None:
    if isinstance(exc, HmdmClientError) and exc.status_code in {401, 403}:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="H-UMDG 接口鉴权失败，请检查集成配置或 API Key。",
        ) from exc
    if isinstance(exc, HmdmNotConfiguredError):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_HMDM_UNAVAILABLE) from exc
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="H-UMDG 主数据服务连接失败。") from exc


def _raise_hmdm_org_error(exc: Exception) -> None:
    if isinstance(exc, HmdmClientError) and exc.status_code in {401, 403}:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="H-UMDG 接口鉴权失败，请检查集成配置或 API Key。",
        ) from exc
    if isinstance(exc, HmdmNotConfiguredError):
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_HMDM_ORG_UNAVAILABLE) from exc
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="H-UMDG 主数据服务连接失败。") from exc


@router.get("", summary="模块信息（路径发现）")
def mdm_root() -> dict[str, object]:
    return envelope_ok(
        data={
            "module": "mdm",
            "name": "主数据与分类",
            "paths": {"category_entries": "/api/v1/mdm/category-entries"},
        }
    )


@router.get("/device-categories", summary="H-UMDG 医疗器械分类目录列表")
async def list_hmdm_device_categories(
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
    keyword: str | None = Query(None, description="分类名称或关键词模糊搜索"),
    code: str | None = Query(None, description="分类编码搜索"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    try:
        items, total, pg, psz = await list_device_categories(
            keyword=keyword,
            code=code,
            page=page,
            page_size=page_size,
        )
    except Exception as exc:
        _raise_hmdm_error(exc)
    payload = DeviceCategoryListResponse(
        connected=True,
        source="h-mdm",
        degraded=False,
        items=items,
        total=total,
        page=pg,
        page_size=psz,
    )
    return envelope_ok(data=payload.model_dump(mode="json"))


@router.get("/device-categories/tree", summary="H-UMDG 医疗器械分类目录树")
async def tree_hmdm_device_categories(
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
    keyword: str | None = Query(None, description="目录树关键词"),
) -> dict:
    try:
        items = await get_device_category_tree(keyword=keyword)
    except Exception as exc:
        _raise_hmdm_error(exc)
    payload = DeviceCategoryTreeResponse(connected=True, source="h-mdm", degraded=False, items=items)
    return envelope_ok(data=payload.model_dump(mode="json"))


@router.get("/device-categories/search", summary="H-UMDG 医疗器械分类目录搜索")
async def search_hmdm_device_categories(
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
    keyword: str | None = Query(None, description="分类名称或关键词模糊搜索"),
    code: str | None = Query(None, description="分类编码搜索"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    return await list_hmdm_device_categories(
        _actor=_actor,
        keyword=keyword,
        code=code,
        page=page,
        page_size=page_size,
    )


@router.get("/device-categories/{category_id}", summary="H-UMDG 医疗器械分类目录详情")
async def get_hmdm_device_category(
    category_id: str,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    try:
        item = await get_device_category_detail(category_id)
    except Exception as exc:
        _raise_hmdm_error(exc)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="未找到匹配的医疗器械分类目录。")
    return envelope_ok(data=item.model_dump(mode="json"))


@router.get("/campuses", summary="H-UMDG 院区主数据列表")
async def list_hmdm_campuses(
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
    keyword: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> dict:
    try:
        items, total, pg, psz = await list_campuses(keyword=keyword, page=page, page_size=page_size)
    except Exception as exc:
        _raise_hmdm_org_error(exc)
    payload = CampusListResponse(connected=True, source="h-mdm", degraded=False, items=items, total=total, page=pg, page_size=psz)
    return envelope_ok(data=payload.model_dump(mode="json"))


@router.get("/departments", summary="H-UMDG 科室主数据列表")
async def list_hmdm_departments(
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
    keyword: str | None = Query(None),
    campus_id: str | None = Query(None),
    department_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> dict:
    try:
        items, total, pg, psz = await list_departments(keyword=keyword, campus_id=campus_id, department_type=department_type, page=page, page_size=page_size)
    except Exception as exc:
        _raise_hmdm_org_error(exc)
    payload = DepartmentListResponse(connected=True, source="h-mdm", degraded=False, items=items, total=total, page=pg, page_size=psz)
    return envelope_ok(data=payload.model_dump(mode="json"))


@router.get("/departments/tree", summary="H-UMDG 科室树")
async def tree_hmdm_departments(
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
    keyword: str | None = Query(None),
    campus_id: str | None = Query(None),
) -> dict:
    try:
        items = await get_department_tree(keyword=keyword, campus_id=campus_id)
    except Exception as exc:
        _raise_hmdm_org_error(exc)
    payload = DepartmentTreeResponse(connected=True, source="h-mdm", degraded=False, items=items)
    return envelope_ok(data=payload.model_dump(mode="json"))


@router.get("/departments/search", summary="H-UMDG 科室主数据搜索")
async def search_hmdm_departments(
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
    keyword: str | None = Query(None),
    campus_id: str | None = Query(None),
    department_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> dict:
    return await list_hmdm_departments(
        _actor=_actor,
        keyword=keyword,
        campus_id=campus_id,
        department_type=department_type,
        page=page,
        page_size=page_size,
    )


@router.get("/departments/{department_id}", summary="H-UMDG 科室主数据详情")
async def get_hmdm_department(
    department_id: str,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    try:
        item = await get_department_detail(department_id)
    except Exception as exc:
        _raise_hmdm_org_error(exc)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="未找到匹配的主数据，请检查关键词或提交主数据补充申请。")
    return envelope_ok(data=item.model_dump(mode="json"))


@router.get("/persons", summary="H-UMDG 人员主数据列表")
async def list_hmdm_persons(
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
    keyword: str | None = Query(None),
    department_id: str | None = Query(None),
    campus_id: str | None = Query(None),
    person_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> dict:
    try:
        items, total, pg, psz = await list_persons(keyword=keyword, department_id=department_id, campus_id=campus_id, person_type=person_type, page=page, page_size=page_size)
    except Exception as exc:
        _raise_hmdm_org_error(exc)
    payload = PersonListResponse(connected=True, source="h-mdm", degraded=False, items=items, total=total, page=pg, page_size=psz)
    return envelope_ok(data=payload.model_dump(mode="json"))


@router.get("/persons/search", summary="H-UMDG 人员主数据搜索")
async def search_hmdm_persons(
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
    keyword: str | None = Query(None),
    department_id: str | None = Query(None),
    campus_id: str | None = Query(None),
    person_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> dict:
    return await list_hmdm_persons(
        _actor=_actor,
        keyword=keyword,
        department_id=department_id,
        campus_id=campus_id,
        person_type=person_type,
        page=page,
        page_size=page_size,
    )


@router.get("/persons/{person_id}", summary="H-UMDG 人员主数据详情")
async def get_hmdm_person(
    person_id: str,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    try:
        item = await get_person_detail(person_id)
    except Exception as exc:
        _raise_hmdm_org_error(exc)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="未找到匹配的主数据，请检查关键词或提交主数据补充申请。")
    return envelope_ok(data=item.model_dump(mode="json"))


@router.get("/disciplines", summary="H-UMDG 学科主数据列表")
async def list_hmdm_disciplines(
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
    keyword: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> dict:
    try:
        items, total, pg, psz = await list_disciplines(keyword=keyword, page=page, page_size=page_size)
    except Exception as exc:
        _raise_hmdm_org_error(exc)
    payload = DisciplineListResponse(connected=True, source="h-mdm", degraded=False, items=items, total=total, page=pg, page_size=psz)
    return envelope_ok(data=payload.model_dump(mode="json"))


@router.get("/disciplines/tree", summary="H-UMDG 学科树")
async def tree_hmdm_disciplines(
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
    keyword: str | None = Query(None),
) -> dict:
    try:
        items = await get_discipline_tree(keyword=keyword)
    except Exception as exc:
        _raise_hmdm_org_error(exc)
    payload = DisciplineTreeResponse(connected=True, source="h-mdm", degraded=False, items=items)
    return envelope_ok(data=payload.model_dump(mode="json"))


@router.get("/disciplines/{discipline_id}", summary="H-UMDG 学科主数据详情")
async def get_hmdm_discipline(
    discipline_id: str,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    try:
        item = await get_discipline_detail(discipline_id)
    except Exception as exc:
        _raise_hmdm_org_error(exc)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="未找到匹配的主数据，请检查关键词或提交主数据补充申请。")
    return envelope_ok(data=item.model_dump(mode="json"))


@router.get("/department-discipline-mappings", summary="H-UMDG 科室-学科映射")
async def list_hmdm_department_discipline_mappings(
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
    department_id: str | None = Query(None),
    discipline_id: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> dict:
    try:
        items, total, pg, psz = await list_department_discipline_mappings(department_id=department_id, discipline_id=discipline_id, page=page, page_size=page_size)
    except Exception as exc:
        _raise_hmdm_org_error(exc)
    payload = DepartmentDisciplineMappingListResponse(connected=True, source="h-mdm", degraded=False, items=items, total=total, page=pg, page_size=psz)
    return envelope_ok(data=payload.model_dump(mode="json"))


@router.get("/business-partners", summary="H-UMDG 往来单位主数据列表")
async def list_hmdm_business_partners(
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
    keyword: str | None = Query(None),
    role_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    try:
        items, total, pg, psz = await list_business_partners(keyword=keyword, role_type=role_type, page=page, page_size=page_size)
    except Exception as exc:
        _raise_hmdm_org_error(exc)
    payload = BusinessPartnerListResponse(connected=True, source="h-mdm", degraded=False, items=items, total=total, page=pg, page_size=psz)
    return envelope_ok(data=payload.model_dump(mode="json"))


@router.get("/business-partners/search", summary="H-UMDG 往来单位主数据搜索")
async def search_hmdm_business_partners(
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
    keyword: str | None = Query(None),
    role_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    return await list_hmdm_business_partners(
        _actor=_actor,
        keyword=keyword,
        role_type=role_type,
        page=page,
        page_size=page_size,
    )


@router.get("/business-partners/{partner_id}", summary="H-UMDG 往来单位主数据详情")
async def get_hmdm_business_partner(
    partner_id: str,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    try:
        item = await get_business_partner_detail(partner_id)
    except Exception as exc:
        _raise_hmdm_org_error(exc)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="未找到匹配的主数据，请检查关键词或提交主数据补充申请。")
    return envelope_ok(data=item.model_dump(mode="json"))


def _category_match_dict(item, confidence: int, request: MdmMatchRequest) -> dict[str, object]:
    basis = []
    if request.device_name:
        basis.append(f"设备名称“{request.device_name}”匹配")
    if request.generic_name:
        basis.append(f"通用名称“{request.generic_name}”匹配")
    if request.model:
        basis.append(f"型号“{request.model}”辅助匹配")
    if request.registration_no:
        basis.append(f"注册证编号“{request.registration_no}”辅助匹配")
    if not basis:
        basis.append("关键词模糊匹配")
    data = item.model_dump(mode="json")
    data["confidence"] = confidence
    data["matchBasis"] = basis
    data["degraded"] = False
    return data


@router.post("/match/device-category", summary="H-UMDG 医疗器械分类目录智能匹配")
async def match_hmdm_device_category(
    body: MdmMatchRequest,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    keyword = body.keyword or body.generic_name or body.device_name or body.registration_no or body.model
    try:
        items, _total, _pg, _psz = await list_device_categories(keyword=keyword, page=1, page_size=8)
        if not items and keyword != "病人监护设备":
            items, _total, _pg, _psz = await list_device_categories(keyword="病人监护设备", page=1, page_size=8)
    except Exception as exc:
        _raise_hmdm_error(exc)
    candidates = [_category_match_dict(item, max(72, 92 - index * 5), body) for index, item in enumerate(items)]
    payload = MdmMatchResponse(
        connected=True,
        source="h-mdm",
        degraded=False,
        recommendation=candidates[0] if candidates else None,
        candidates=candidates,
        message=None if candidates else "未找到匹配的医疗器械分类目录。",
    )
    return envelope_ok(data=payload.model_dump(mode="json"))


def _mock_match_response(name: str | None, kind: str) -> dict:
    payload = MdmMatchResponse(
        connected=True,
        source="mock",
        degraded=True,
        recommendation={
            "name": name or "待匹配",
            "kind": kind,
            "source": "mock",
            "mock": True,
            "confidence": 80,
            "message": f"{kind} 主数据匹配适配器已预留，当前未作为正式 H-UMDG 引用保存。",
        },
        candidates=[],
        message="当前接口为可替换 mock provider，不得作为正式主数据引用保存。",
    )
    return envelope_ok(data=payload.model_dump(mode="json"))


@router.post("/match/manufacturer", summary="厂家主数据匹配占位适配器")
async def match_hmdm_manufacturer(
    body: MdmMatchRequest,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    try:
        recommendation, candidates, message = await match_business_partner(
            keyword=body.manufacturer or body.keyword,
            role_type="生产厂家",
            page_size=8,
        )
    except Exception as exc:
        _raise_hmdm_org_error(exc)
    payload = MdmMatchResponse(
        connected=True,
        source="h-mdm",
        degraded=False,
        recommendation=recommendation,
        candidates=candidates,
        message=message,
    )
    return envelope_ok(data=payload.model_dump(mode="json"))


@router.post("/match/supplier", summary="供应商主数据匹配占位适配器")
async def match_hmdm_supplier(
    body: MdmMatchRequest,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    try:
        recommendation, candidates, message = await match_business_partner(
            keyword=body.supplier or body.keyword,
            role_type="供应商",
            page_size=8,
        )
    except Exception as exc:
        _raise_hmdm_org_error(exc)
    payload = MdmMatchResponse(
        connected=True,
        source="h-mdm",
        degraded=False,
        recommendation=recommendation,
        candidates=candidates,
        message=message,
    )
    return envelope_ok(data=payload.model_dump(mode="json"))


@router.post("/match/registration-certificate", summary="注册证主数据匹配占位适配器")
async def match_hmdm_registration_certificate(
    body: MdmMatchRequest,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    return _mock_match_response(body.registration_no or body.keyword, "注册证")


@router.get("/category-entries", dependencies=[PgMdmStore])
def list_category_entries(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
    dimension_code: str | None = Query(None, max_length=64),
    parent_id: UUID | None = Query(None, description="仅查询该父节点下一层（不传则不按父过滤）"),
    roots_only: bool = Query(False, description="为 True 时仅返回顶层节点 parent_id IS NULL"),
    keyword: str | None = Query(None),
    include_inactive: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
) -> dict:
    if roots_only and parent_id is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="roots_only 与 parent_id 不可同时指定",
        )
    try:
        items, total, pg, psz = list_entries(
            db,
            dimension_code=dimension_code,
            parent_id=str(parent_id) if parent_id is not None else None,
            keyword=keyword,
            include_inactive=include_inactive,
            page=page,
            page_size=page_size,
            roots_only=roots_only,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_MDM_PG_NOT_READY) from exc
    return envelope_ok(
        data={
            "items": [i.model_dump(mode="json") for i in items],
            "total": total,
            "page": pg,
            "page_size": psz,
        }
    )


@router.post("/category-entries", dependencies=[PgMdmStore])
def create_category_entry(
    db: DbSession,
    body: CategoryEntryCreate,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    try:
        outcome = mdm_create(db, body)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_MDM_PG_NOT_READY) from exc
    if outcome == "BAD_PARENT":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="parent_id 不存在、未激活或与 dimension_code 不一致",
        )
    if outcome == "DUPLICATE":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="dimension_code+category_code 已存在")

    row = outcome
    emit_audit(
        db,
        actor,
        action="MDM_CATEGORY_CREATE",
        object_type="mdm.category_entry",
        object_id=row.id,
        after_data=row.model_dump(mode="json"),
    )
    return envelope_ok(data=row.model_dump(mode="json"))

