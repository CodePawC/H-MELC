"""MDM 分类条目服务."""

from __future__ import annotations

from typing import Any
from typing import Literal
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.modules.hmdm import client as hmdm_client
from app.modules.mdm.models import CategoryEntry
from app.modules.mdm.schemas import (
    BusinessPartnerMappingRead,
    BusinessPartnerQualificationRead,
    BusinessPartnerRead,
    BusinessPartnerRoleRead,
    CampusRead,
    CategoryEntryCreate,
    CategoryEntryRead,
    DepartmentDisciplineMappingRead,
    DepartmentRead,
    DeviceCategoryRead,
    DisciplineRead,
    PersonRead,
)


def _normalize_page(page: int, page_size: int) -> tuple[int, int]:
    p = max(1, page)
    ps = min(100, max(1, page_size))
    return p, ps


MdCreateOutcome = CategoryEntryRead | Literal["BAD_PARENT", "DUPLICATE"]


def create_entry(session: Session, body: CategoryEntryCreate) -> MdCreateOutcome:
    if body.parent_id is not None:
        parent = session.get(CategoryEntry, body.parent_id)
        if parent is None or parent.dimension_code != body.dimension_code or not parent.is_active:
            return "BAD_PARENT"
    row = CategoryEntry(
        dimension_code=body.dimension_code,
        category_code=body.category_code,
        name=body.name,
        parent_id=body.parent_id,
        sort_order=body.sort_order,
    )
    session.add(row)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        return "DUPLICATE"
    session.refresh(row)
    return CategoryEntryRead.model_validate(row)


def list_entries(
    session: Session,
    *,
    dimension_code: str | None = None,
    parent_id: str | None = None,
    roots_only: bool = False,
    keyword: str | None = None,
    include_inactive: bool = False,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[CategoryEntryRead], int, int, int]:
    conds = []
    if dimension_code:
        conds.append(CategoryEntry.dimension_code == dimension_code)
    if roots_only:
        conds.append(CategoryEntry.parent_id.is_(None))
    elif parent_id is not None:
        try:
            pid = UUID(parent_id)
        except ValueError:
            pid = None
        if pid is not None:
            conds.append(CategoryEntry.parent_id == pid)

    if not include_inactive:
        conds.append(CategoryEntry.is_active.is_(True))
    if keyword:
        kw = f"%{keyword}%"
        conds.append(
            or_(
                CategoryEntry.name.ilike(kw),
                CategoryEntry.category_code.ilike(kw),
            )
        )

    stmt = select(CategoryEntry).where(*conds) if conds else select(CategoryEntry)
    count_stmt = select(func.count()).select_from(CategoryEntry)
    if conds:
        count_stmt = count_stmt.where(*conds)

    total = session.execute(count_stmt).scalar_one()
    page, page_size = _normalize_page(page, page_size)
    offset = (page - 1) * page_size
    stmt = stmt.order_by(CategoryEntry.dimension_code.asc(), CategoryEntry.sort_order.asc(), CategoryEntry.name.asc())
    rows = session.execute(stmt.offset(offset).limit(page_size)).scalars().all()
    return [CategoryEntryRead.model_validate(r) for r in rows], int(total), page, page_size


def _text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _extract_data(payload: Any) -> Any:
    if isinstance(payload, dict) and "data" in payload:
        return payload["data"]
    return payload


def _extract_items(payload: Any) -> list[dict[str, Any]]:
    data = _extract_data(payload)
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        for key in ("records", "items", "children"):
            if isinstance(data.get(key), list):
                return [x for x in data[key] if isinstance(x, dict)]
        if data.get("id") or data.get("code") or data.get("name"):
            return [data]
    if isinstance(payload, dict):
        for key in ("records", "items", "children"):
            if isinstance(payload.get(key), list):
                return [x for x in payload[key] if isinstance(x, dict)]
    return []


def _extract_total(payload: Any, fallback: int) -> int:
    data = _extract_data(payload)
    if isinstance(data, dict):
        for key in ("total", "totalCount", "count"):
            value = data.get(key)
            if isinstance(value, int):
                return value
            if isinstance(value, str) and value.isdigit():
                return int(value)
    return fallback


def _category_path(item: dict[str, Any], parent_path: str | None = None) -> str:
    raw_path = _text(item.get("path") or item.get("fullPath") or item.get("categoryPath"))
    if raw_path:
        return raw_path
    parts: list[str] = []
    if parent_path:
        parts.extend([x.strip() for x in parent_path.replace(">", "/").split("/") if x.strip()])
    for key in (
        "majorCategoryName",
        "regulatoryMajorCategory",
        "level1CategoryName",
        "primaryProductCategory",
        "level2CategoryName",
        "secondaryProductCategory",
        "name",
        "catalogItem",
        "classificationName",
    ):
        value = _text(item.get(key))
        if value and value not in parts:
            parts.append(value)
    return " / ".join(parts)


def _enabled(item: dict[str, Any]) -> bool:
    value = item.get("enabled")
    if isinstance(value, bool):
        return value
    status = _text(item.get("status") or item.get("state")).lower()
    if status in {"disabled", "inactive", "停用", "作废"}:
        return False
    return True


def _int_or_none(value: Any) -> int | None:
    try:
        return int(value) if value is not None and value != "" else None
    except (TypeError, ValueError):
        return None


def _map_campus(item: dict[str, Any]) -> CampusRead | None:
    item_id = _text(item.get("id") or item.get("campusId") or item.get("campus_id") or item.get("code") or item.get("campusCode"))
    code = _text(item.get("code") or item.get("campusCode") or item.get("campus_code"))
    name = _text(item.get("name") or item.get("campusName") or item.get("campus_name"))
    if not item_id or not code or not name:
        return None
    return CampusRead(
        id=item_id,
        code=code,
        name=name,
        shortName=_text(item.get("shortName") or item.get("campusShortName") or item.get("campus_short_name")) or None,
        organizationId=_text(item.get("organizationId") or item.get("organization_id")) or None,
        address=_text(item.get("address")) or None,
        source="h-mdm",
        version=_text(item.get("version") or item.get("updatedAt")) or None,
        enabled=_enabled(item),
        sortOrder=_int_or_none(item.get("sortOrder") or item.get("sort_order")),
    )


def _map_department(item: dict[str, Any]) -> DepartmentRead | None:
    item_id = _text(item.get("id") or item.get("departmentId") or item.get("department_id") or item.get("dept_id"))
    code = _text(item.get("code") or item.get("departmentCode") or item.get("department_code") or item.get("dept_code"))
    name = _text(item.get("name") or item.get("departmentName") or item.get("department_name") or item.get("dept_name"))
    if not item_id or not code or not name:
        return None
    return DepartmentRead(
        id=item_id,
        code=code,
        name=name,
        shortName=_text(item.get("shortName") or item.get("departmentShortName") or item.get("department_short_name") or item.get("dept_short_name")) or None,
        campusId=_text(item.get("campusId") or item.get("campus_id")) or None,
        campusCode=_text(item.get("campusCode") or item.get("campus_code")) or None,
        campusName=_text(item.get("campusName") or item.get("campus_name")) or None,
        parentId=_text(item.get("parentId") or item.get("parentDepartmentId") or item.get("parent_department_id") or item.get("parent_dept_id")) or None,
        type=_text(item.get("type") or item.get("departmentType") or item.get("department_type") or item.get("dept_type")) or None,
        isClinical=bool(item.get("isClinical") or item.get("is_clinical")),
        isMedtech=bool(item.get("isMedtech") or item.get("is_medtech")),
        isNursingUnit=bool(item.get("isNursingUnit") or item.get("is_nursing_unit")),
        isAdmin=bool(item.get("isAdmin") or item.get("is_admin")),
        isLogistics=bool(item.get("isLogistics") or item.get("is_logistics")),
        wardFlag=bool(item.get("wardFlag") or item.get("ward_flag")),
        costCenterCode=_text(item.get("costCenterCode") or item.get("cost_center_code")) or None,
        source="h-mdm",
        version=_text(item.get("version") or item.get("updatedAt")) or None,
        enabled=_enabled(item),
        children=[x for x in (_map_department(child) for child in item.get("children", []) if isinstance(child, dict)) if x is not None],
    )


def _map_person(item: dict[str, Any]) -> PersonRead | None:
    item_id = _text(item.get("id") or item.get("personId") or item.get("person_id"))
    code = _text(item.get("code") or item.get("personCode") or item.get("person_code"))
    name = _text(item.get("name") or item.get("personName") or item.get("person_name"))
    if not item_id or not code or not name:
        return None
    return PersonRead(
        id=item_id,
        code=code,
        employeeNo=_text(item.get("employeeNo") or item.get("employee_no")) or None,
        name=name,
        gender=_text(item.get("gender")) or None,
        departmentId=_text(item.get("departmentId") or item.get("department_id")) or None,
        departmentCode=_text(item.get("departmentCode") or item.get("department_code")) or None,
        departmentName=_text(item.get("departmentName") or item.get("department_name")) or None,
        campusId=_text(item.get("campusId") or item.get("campus_id")) or None,
        campusCode=_text(item.get("campusCode") or item.get("campus_code")) or None,
        campusName=_text(item.get("campusName") or item.get("campus_name")) or None,
        position=_text(item.get("position")) or None,
        jobTitle=_text(item.get("jobTitle") or item.get("job_title")) or None,
        professionalTitle=_text(item.get("professionalTitle") or item.get("professional_title")) or None,
        type=_text(item.get("type") or item.get("personType") or item.get("person_type")) or None,
        phone=_text(item.get("phone")) or None,
        email=_text(item.get("email")) or None,
        source="h-mdm",
        version=_text(item.get("version") or item.get("updatedAt")) or None,
        enabled=_enabled(item),
    )


def _map_discipline(item: dict[str, Any]) -> DisciplineRead | None:
    item_id = _text(item.get("id") or item.get("disciplineId") or item.get("discipline_id"))
    code = _text(item.get("code") or item.get("disciplineCode") or item.get("discipline_code"))
    name = _text(item.get("name") or item.get("disciplineName") or item.get("discipline_name"))
    if not item_id or not code or not name:
        return None
    related = item.get("relatedDepartments") or item.get("related_departments") or []
    return DisciplineRead(
        id=item_id,
        code=code,
        name=name,
        shortName=_text(item.get("shortName") or item.get("disciplineShortName") or item.get("discipline_short_name")) or None,
        type=_text(item.get("type") or item.get("disciplineType") or item.get("discipline_type")) or None,
        parentId=_text(item.get("parentId") or item.get("parentDisciplineId") or item.get("parent_discipline_id")) or None,
        level=_int_or_none(item.get("level")),
        isKeyDiscipline=bool(item.get("isKeyDiscipline") or item.get("is_key_discipline")),
        relatedDepartments=[x for x in related if isinstance(x, dict)],
        source="h-mdm",
        version=_text(item.get("version") or item.get("updatedAt")) or None,
        enabled=_enabled(item),
        children=[x for x in (_map_discipline(child) for child in item.get("children", []) if isinstance(child, dict)) if x is not None],
    )


def _map_mapping(item: dict[str, Any]) -> DepartmentDisciplineMappingRead | None:
    item_id = _text(item.get("id") or item.get("mappingId") or item.get("mapping_id"))
    department_id = _text(item.get("departmentId") or item.get("department_id"))
    discipline_id = _text(item.get("disciplineId") or item.get("discipline_id"))
    relation_type = _text(item.get("relationType") or item.get("relation_type"))
    if not item_id or not department_id or not discipline_id or not relation_type:
        return None
    weight = item.get("weight")
    try:
        weight_value = float(weight) if weight is not None else None
    except (TypeError, ValueError):
        weight_value = None
    return DepartmentDisciplineMappingRead(
        id=item_id,
        departmentId=department_id,
        departmentCode=_text(item.get("departmentCode") or item.get("department_code")) or None,
        departmentName=_text(item.get("departmentName") or item.get("department_name")) or None,
        disciplineId=discipline_id,
        disciplineCode=_text(item.get("disciplineCode") or item.get("discipline_code")) or None,
        disciplineName=_text(item.get("disciplineName") or item.get("discipline_name")) or None,
        relationType=relation_type,
        isPrimary=bool(item.get("isPrimary") or item.get("is_primary")),
        weight=weight_value,
        source="h-mdm",
        version=_text(item.get("version") or item.get("updatedAt")) or None,
        enabled=_enabled(item),
    )


def _role_text(role_type: str) -> str:
    labels = {
        "manufacturer": "生产厂家",
        "brand_owner": "品牌方",
        "registrant": "注册人",
        "registration_holder": "注册证持有人",
        "supplier": "供应商",
        "maintainer": "维保商",
        "after_sales": "售后服务商",
        "authorized_agent": "授权代理商",
        "domestic_general_agent": "国内总代理",
        "third_party_repair": "第三方维修商",
        "metrology_institute": "计量检定机构",
        "testing_institution": "检测机构",
        "software_service": "软件服务商",
        "distributor": "配送商",
        "logistics_provider": "物流单位",
    }
    return labels.get(role_type, role_type)


def _map_partner_role(item: dict[str, Any]) -> BusinessPartnerRoleRead | None:
    role_id = _text(item.get("id") or item.get("role_id"))
    role_type = _text(item.get("roleType") or item.get("role_type"))
    if not role_id or not role_type:
        return None
    return BusinessPartnerRoleRead(
        id=role_id,
        roleType=role_type,
        roleName=_text(item.get("roleName") or item.get("role_name")) or _role_text(role_type),
        businessDomain=_text(item.get("businessDomain") or item.get("business_domain")) or None,
        status=_text(item.get("status") or item.get("role_status")) or None,
        qualificationRequired=bool(item.get("qualificationRequired") or item.get("qualification_required")),
    )


def _map_partner_qualification(item: dict[str, Any]) -> BusinessPartnerQualificationRead | None:
    item_id = _text(item.get("id") or item.get("qualification_id"))
    qtype = _text(item.get("qualificationType") or item.get("qualification_type"))
    if not item_id or not qtype:
        return None
    return BusinessPartnerQualificationRead(
        id=item_id,
        qualificationType=qtype,
        certificateNo=_text(item.get("certificateNo") or item.get("certificate_no")) or None,
        certificateName=_text(item.get("certificateName") or item.get("certificate_name")) or None,
        validFrom=_text(item.get("validFrom") or item.get("valid_from")) or None,
        validTo=_text(item.get("validTo") or item.get("valid_to")) or None,
        status=_text(item.get("status")) or None,
    )


def _map_partner_mapping(item: dict[str, Any]) -> BusinessPartnerMappingRead | None:
    item_id = _text(item.get("id") or item.get("mapping_id"))
    source_system = _text(item.get("sourceSystem") or item.get("source_system") or item.get("system_name"))
    if not item_id or not source_system:
        return None
    confidence = item.get("confidence", item.get("mapping_confidence"))
    try:
        confidence_value = float(confidence) if confidence is not None else None
    except (TypeError, ValueError):
        confidence_value = None
    return BusinessPartnerMappingRead(
        id=item_id,
        sourceSystem=source_system,
        externalCode=_text(item.get("externalCode") or item.get("external_code")) or None,
        externalName=_text(item.get("externalName") or item.get("external_name")) or None,
        confidence=confidence_value,
        status=_text(item.get("status") or item.get("audit_status")) or None,
    )


def _map_business_partner(item: dict[str, Any]) -> BusinessPartnerRead | None:
    item_id = _text(item.get("id") or item.get("org_id") or item.get("organizationId"))
    code = _text(item.get("code") or item.get("org_code") or item.get("organization_code"))
    name = _text(item.get("name") or item.get("org_name") or item.get("standard_name"))
    if not item_id or not code or not name:
        return None
    roles = [_map_partner_role(x) for x in item.get("roles", []) if isinstance(x, dict)]
    qualifications = [_map_partner_qualification(x) for x in item.get("qualifications", []) if isinstance(x, dict)]
    mappings_raw = item.get("mdm_external_mappings") or item.get("external_mappings") or []
    mappings = [_map_partner_mapping(x) for x in mappings_raw if isinstance(x, dict)]
    role_types = {x.roleType for x in roles if x is not None}
    qualification_names = {x.qualificationType for x in qualifications if x is not None}
    return BusinessPartnerRead(
        id=item_id,
        code=code,
        name=name,
        shortName=_text(item.get("shortName") or item.get("short_name") or item.get("org_short_name")) or None,
        formerName=_text(item.get("formerName") or item.get("former_name")) or None,
        englishName=_text(item.get("englishName") or item.get("english_name")) or None,
        unifiedSocialCreditCode=_text(item.get("unifiedSocialCreditCode") or item.get("unified_social_credit_code")) or None,
        orgType=_text(item.get("orgType") or item.get("org_type") or item.get("organization_type")) or None,
        registeredAddress=_text(item.get("registeredAddress") or item.get("registered_address") or item.get("address")) or None,
        officeAddress=_text(item.get("officeAddress") or item.get("office_address")) or None,
        contactPhone=_text(item.get("contactPhone") or item.get("contact_phone")) or None,
        website=_text(item.get("website")) or None,
        roles=[x for x in roles if x is not None],
        qualifications=[x for x in qualifications if x is not None],
        externalMappings=[x for x in mappings if x is not None],
        qualificationStatus=_text(item.get("qualificationStatus") or item.get("qualification_status")) or ("valid" if qualifications else "unknown"),
        hasOriginalFactoryAuthorization=("manufacturer" in role_types or "原厂授权服务证明" in qualification_names),
        hasMaintenanceAuthorization=("maintainer" in role_types or "authorized_maintenance" in role_types or "原厂授权服务证明" in qualification_names),
        source="h-mdm",
        version=_text(item.get("version") or item.get("updated_at") or item.get("updatedAt")) or None,
        enabled=_enabled(item),
    )


def _map_device_category(item: dict[str, Any], *, parent_path: str | None = None) -> DeviceCategoryRead | None:
    category_id = _text(
        item.get("id")
        or item.get("classificationId")
        or item.get("catalogId")
        or item.get("categoryId")
        or item.get("code")
    )
    code = _text(
        item.get("code")
        or item.get("classificationCode")
        or item.get("catalogCode")
        or item.get("categoryCode")
    )
    name = _text(
        item.get("name")
        or item.get("catalogItem")
        or item.get("classificationName")
        or item.get("categoryName")
    )
    if not category_id or not code or not name:
        return None
    level_value = item.get("level")
    try:
        level = int(level_value) if level_value is not None else None
    except (TypeError, ValueError):
        level = None
    return DeviceCategoryRead(
        id=category_id,
        code=code,
        name=name,
        path=_category_path(item, parent_path=parent_path),
        parentId=_text(item.get("parentId") or item.get("parent_id")) or None,
        level=level,
        managementClass=_text(item.get("managementClass") or item.get("management_class")) or None,
        source="h-mdm",
        version=_text(item.get("version") or item.get("versionId") or item.get("sourceBatchId")) or None,
        enabled=_enabled(item),
    )


def _map_tree_items(items: list[dict[str, Any]], *, parent_path: str | None = None) -> list[DeviceCategoryRead]:
    mapped: list[DeviceCategoryRead] = []
    for item in items:
        current = _map_device_category(item, parent_path=parent_path)
        next_path = current.path if current else parent_path
        if current is not None:
            mapped.append(current)
        children = item.get("children")
        if isinstance(children, list):
            mapped.extend(_map_tree_items([x for x in children if isinstance(x, dict)], parent_path=next_path))
    return mapped


async def list_device_categories(
    *,
    keyword: str | None = None,
    code: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[DeviceCategoryRead], int, int, int]:
    pg, psz = _normalize_page(page, page_size)
    params: dict[str, Any] = {"page": pg, "pageSize": psz}
    if keyword:
        params["keyword"] = keyword
    if code:
        params["categoryCode"] = code
    payload = await hmdm_client.request_json("/api/v1/master-data/device-classification/catalog", params=params)
    raw_items = _extract_items(payload)
    items = [x for x in (_map_device_category(item) for item in raw_items) if x is not None]
    return items, _extract_total(payload, len(items)), pg, psz


async def get_device_category_tree(*, keyword: str | None = None) -> list[DeviceCategoryRead]:
    params: dict[str, Any] = {"maxDepth": 3}
    if keyword:
        params["keyword"] = keyword
    payload = await hmdm_client.request_json("/api/v1/master-data/device-classification/tree", params=params)
    return _map_tree_items(_extract_items(payload))


async def get_device_category_detail(category_id: str) -> DeviceCategoryRead | None:
    payload = await hmdm_client.request_json(
        f"/api/v1/master-data/device-classification/catalog/{category_id}"
    )
    raw_items = _extract_items(payload)
    if not raw_items and isinstance(_extract_data(payload), dict):
        raw_items = [_extract_data(payload)]
    for item in raw_items:
        mapped = _map_device_category(item)
        if mapped is not None:
            return mapped
    return None


async def list_campuses(*, keyword: str | None = None, page: int = 1, page_size: int = 50):
    pg, psz = _normalize_page(page, page_size)
    params: dict[str, Any] = {"page": pg, "pageSize": psz}
    if keyword:
        params["keyword"] = keyword
    payload = await hmdm_client.request_json("/api/v1/master-data/campuses", params=params)
    items = [x for x in (_map_campus(item) for item in _extract_items(payload)) if x is not None]
    return items, _extract_total(payload, len(items)), pg, psz


async def list_departments(
    *,
    keyword: str | None = None,
    campus_id: str | None = None,
    department_type: str | None = None,
    page: int = 1,
    page_size: int = 50,
):
    pg, psz = _normalize_page(page, page_size)
    params: dict[str, Any] = {"page": pg, "pageSize": psz}
    if keyword:
        params["keyword"] = keyword
    if campus_id:
        params["campusId"] = campus_id
    if department_type:
        params["departmentType"] = department_type
    payload = await hmdm_client.request_json("/api/v1/master-data/departments", params=params)
    items = [x for x in (_map_department(item) for item in _extract_items(payload)) if x is not None]
    return items, _extract_total(payload, len(items)), pg, psz


async def get_department_tree(*, keyword: str | None = None, campus_id: str | None = None) -> list[DepartmentRead]:
    params: dict[str, Any] = {}
    if keyword:
        params["keyword"] = keyword
    if campus_id:
        params["campusId"] = campus_id
    payload = await hmdm_client.request_json("/api/v1/master-data/departments/tree", params=params)
    return [x for x in (_map_department(item) for item in _extract_items(payload)) if x is not None]


async def get_department_detail(department_id: str) -> DepartmentRead | None:
    payload = await hmdm_client.request_json(f"/api/v1/master-data/departments/{department_id}")
    raw_items = _extract_items(payload)
    if not raw_items and isinstance(_extract_data(payload), dict):
        raw_items = [_extract_data(payload)]
    for item in raw_items:
        mapped = _map_department(item)
        if mapped is not None:
            return mapped
    return None


async def list_persons(
    *,
    keyword: str | None = None,
    department_id: str | None = None,
    campus_id: str | None = None,
    person_type: str | None = None,
    page: int = 1,
    page_size: int = 50,
):
    pg, psz = _normalize_page(page, page_size)
    params: dict[str, Any] = {"page": pg, "pageSize": psz}
    if keyword:
        params["keyword"] = keyword
    if department_id:
        params["departmentId"] = department_id
    if campus_id:
        params["campusId"] = campus_id
    if person_type:
        params["personType"] = person_type
    payload = await hmdm_client.request_json("/api/v1/master-data/persons", params=params)
    items = [x for x in (_map_person(item) for item in _extract_items(payload)) if x is not None]
    return items, _extract_total(payload, len(items)), pg, psz


async def get_person_detail(person_id: str) -> PersonRead | None:
    payload = await hmdm_client.request_json(f"/api/v1/master-data/persons/{person_id}")
    raw_items = _extract_items(payload)
    if not raw_items and isinstance(_extract_data(payload), dict):
        raw_items = [_extract_data(payload)]
    for item in raw_items:
        mapped = _map_person(item)
        if mapped is not None:
            return mapped
    return None


async def list_disciplines(*, keyword: str | None = None, page: int = 1, page_size: int = 50):
    pg, psz = _normalize_page(page, page_size)
    params: dict[str, Any] = {"page": pg, "pageSize": psz}
    if keyword:
        params["keyword"] = keyword
    payload = await hmdm_client.request_json("/api/v1/master-data/disciplines", params=params)
    items = [x for x in (_map_discipline(item) for item in _extract_items(payload)) if x is not None]
    return items, _extract_total(payload, len(items)), pg, psz


async def get_discipline_tree(*, keyword: str | None = None) -> list[DisciplineRead]:
    params: dict[str, Any] = {}
    if keyword:
        params["keyword"] = keyword
    payload = await hmdm_client.request_json("/api/v1/master-data/disciplines/tree", params=params)
    return [x for x in (_map_discipline(item) for item in _extract_items(payload)) if x is not None]


async def get_discipline_detail(discipline_id: str) -> DisciplineRead | None:
    payload = await hmdm_client.request_json(f"/api/v1/master-data/disciplines/{discipline_id}")
    raw_items = _extract_items(payload)
    if not raw_items and isinstance(_extract_data(payload), dict):
        raw_items = [_extract_data(payload)]
    for item in raw_items:
        mapped = _map_discipline(item)
        if mapped is not None:
            return mapped
    return None


async def list_department_discipline_mappings(
    *,
    department_id: str | None = None,
    discipline_id: str | None = None,
    page: int = 1,
    page_size: int = 50,
):
    pg, psz = _normalize_page(page, page_size)
    params: dict[str, Any] = {"page": pg, "pageSize": psz}
    if department_id:
        params["departmentId"] = department_id
    if discipline_id:
        params["disciplineId"] = discipline_id
    payload = await hmdm_client.request_json("/api/v1/master-data/department-discipline-mappings", params=params)
    items = [x for x in (_map_mapping(item) for item in _extract_items(payload)) if x is not None]
    return items, _extract_total(payload, len(items)), pg, psz


async def list_business_partners(
    *,
    keyword: str | None = None,
    role_type: str | None = None,
    page: int = 1,
    page_size: int = 20,
):
    pg, psz = _normalize_page(page, page_size)
    params: dict[str, Any] = {"page": pg, "pageSize": psz}
    if keyword:
        params["keyword"] = keyword
    if role_type:
        params["roleType"] = role_type
    payload = await hmdm_client.request_json("/api/v1/master-data/business-partners", params=params)
    items = [x for x in (_map_business_partner(item) for item in _extract_items(payload)) if x is not None]
    return items, _extract_total(payload, len(items)), pg, psz


async def get_business_partner_detail(partner_id: str) -> BusinessPartnerRead | None:
    payload = await hmdm_client.request_json(f"/api/v1/master-data/business-partners/{partner_id}")
    raw_items = _extract_items(payload)
    if not raw_items and isinstance(_extract_data(payload), dict):
        raw_items = [_extract_data(payload)]
    for item in raw_items:
        mapped = _map_business_partner(item)
        if mapped is not None:
            return mapped
    return None


async def match_business_partner(
    *,
    keyword: str | None,
    role_type: str | None,
    page_size: int = 8,
) -> tuple[dict[str, Any] | None, list[dict[str, Any]], str | None]:
    payload = await hmdm_client.request_json(
        "/api/v1/master-data/business-partners/match",
        method="POST",
        json={"keyword": keyword, "roleType": role_type, "pageSize": page_size},
    )
    data = _extract_data(payload)
    if not isinstance(data, dict):
        return None, [], "未找到匹配的往来单位主数据，请检查关键词或提交主数据补充申请。"
    candidates: list[dict[str, Any]] = []
    for item in data.get("candidates") or []:
        if isinstance(item, dict):
            partner = _map_business_partner(item)
            if partner is not None:
                payload_item = partner.model_dump(mode="json")
                payload_item["confidence"] = item.get("confidence")
                payload_item["matchBasis"] = item.get("matchBasis") or item.get("match_basis") or []
                payload_item["hasRequiredRole"] = item.get("hasRequiredRole", item.get("has_required_role", True))
                payload_item["degraded"] = item.get("degraded") is True
                candidates.append(payload_item)
    recommendation_raw = data.get("recommendation")
    recommendation = None
    if isinstance(recommendation_raw, dict):
        partner = _map_business_partner(recommendation_raw)
        if partner is not None:
            recommendation = partner.model_dump(mode="json")
            recommendation["confidence"] = recommendation_raw.get("confidence")
            recommendation["matchBasis"] = recommendation_raw.get("matchBasis") or recommendation_raw.get("match_basis") or []
            recommendation["hasRequiredRole"] = recommendation_raw.get("hasRequiredRole", recommendation_raw.get("has_required_role", True))
            recommendation["degraded"] = recommendation_raw.get("degraded") is True
    return recommendation, candidates, _text(data.get("message")) or None
