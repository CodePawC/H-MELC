"""MDM 分类 API 形状."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CategoryEntryCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    dimension_code: str = Field(..., min_length=1, max_length=64, description="分类维度编码，如 CLINICAL_ADMIN")
    category_code: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=255)
    parent_id: UUID | None = None
    sort_order: int = Field(default=0, ge=-1_000_000, le=1_000_000)


class CategoryEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    dimension_code: str
    category_code: str
    name: str
    parent_id: UUID | None = None
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


class DeviceCategoryRead(BaseModel):
    """OS 前端使用的 H-UMDG 医疗器械分类目录统一形状。"""

    id: str
    code: str
    name: str
    path: str
    parentId: str | None = None
    level: int | None = None
    managementClass: str | None = None
    source: str = "h-mdm"
    version: str | None = None
    enabled: bool = True


class DeviceCategoryListResponse(BaseModel):
    connected: bool
    source: str = "h-mdm"
    degraded: bool = False
    items: list[DeviceCategoryRead]
    total: int
    page: int
    page_size: int


class DeviceCategoryTreeResponse(BaseModel):
    connected: bool
    source: str = "h-mdm"
    degraded: bool = False
    items: list[DeviceCategoryRead]


class CampusRead(BaseModel):
    id: str
    code: str
    name: str
    shortName: str | None = None
    organizationId: str | None = None
    address: str | None = None
    source: str = "h-mdm"
    version: str | None = None
    enabled: bool = True
    sortOrder: int | None = None


class CampusListResponse(BaseModel):
    connected: bool
    source: str = "h-mdm"
    degraded: bool = False
    items: list[CampusRead]
    total: int
    page: int
    page_size: int


class DepartmentRead(BaseModel):
    id: str
    code: str
    name: str
    shortName: str | None = None
    campusId: str | None = None
    campusCode: str | None = None
    campusName: str | None = None
    parentId: str | None = None
    type: str | None = None
    isClinical: bool = False
    isMedtech: bool = False
    isNursingUnit: bool = False
    isAdmin: bool = False
    isLogistics: bool = False
    wardFlag: bool = False
    costCenterCode: str | None = None
    source: str = "h-mdm"
    version: str | None = None
    enabled: bool = True
    children: list["DepartmentRead"] = Field(default_factory=list)


class DepartmentListResponse(BaseModel):
    connected: bool
    source: str = "h-mdm"
    degraded: bool = False
    items: list[DepartmentRead]
    total: int
    page: int
    page_size: int


class DepartmentTreeResponse(BaseModel):
    connected: bool
    source: str = "h-mdm"
    degraded: bool = False
    items: list[DepartmentRead]


class PersonRead(BaseModel):
    id: str
    code: str
    employeeNo: str | None = None
    name: str
    gender: str | None = None
    departmentId: str | None = None
    departmentCode: str | None = None
    departmentName: str | None = None
    campusId: str | None = None
    campusCode: str | None = None
    campusName: str | None = None
    position: str | None = None
    jobTitle: str | None = None
    professionalTitle: str | None = None
    type: str | None = None
    phone: str | None = None
    email: str | None = None
    source: str = "h-mdm"
    version: str | None = None
    enabled: bool = True


class PersonListResponse(BaseModel):
    connected: bool
    source: str = "h-mdm"
    degraded: bool = False
    items: list[PersonRead]
    total: int
    page: int
    page_size: int


class DisciplineRead(BaseModel):
    id: str
    code: str
    name: str
    shortName: str | None = None
    type: str | None = None
    parentId: str | None = None
    level: int | None = None
    isKeyDiscipline: bool = False
    relatedDepartments: list[dict[str, Any]] = Field(default_factory=list)
    source: str = "h-mdm"
    version: str | None = None
    enabled: bool = True
    children: list["DisciplineRead"] = Field(default_factory=list)


class DisciplineListResponse(BaseModel):
    connected: bool
    source: str = "h-mdm"
    degraded: bool = False
    items: list[DisciplineRead]
    total: int
    page: int
    page_size: int


class DisciplineTreeResponse(BaseModel):
    connected: bool
    source: str = "h-mdm"
    degraded: bool = False
    items: list[DisciplineRead]


class DepartmentDisciplineMappingRead(BaseModel):
    id: str
    departmentId: str
    departmentCode: str | None = None
    departmentName: str | None = None
    disciplineId: str
    disciplineCode: str | None = None
    disciplineName: str | None = None
    relationType: str
    isPrimary: bool = False
    weight: float | None = None
    source: str = "h-mdm"
    version: str | None = None
    enabled: bool = True


class DepartmentDisciplineMappingListResponse(BaseModel):
    connected: bool
    source: str = "h-mdm"
    degraded: bool = False
    items: list[DepartmentDisciplineMappingRead]
    total: int
    page: int
    page_size: int


class BusinessPartnerRoleRead(BaseModel):
    id: str
    roleType: str
    roleName: str | None = None
    businessDomain: str | None = None
    status: str | None = None
    qualificationRequired: bool = False


class BusinessPartnerQualificationRead(BaseModel):
    id: str
    qualificationType: str
    certificateNo: str | None = None
    certificateName: str | None = None
    validFrom: str | None = None
    validTo: str | None = None
    status: str | None = None


class BusinessPartnerMappingRead(BaseModel):
    id: str
    sourceSystem: str
    externalCode: str | None = None
    externalName: str | None = None
    confidence: float | None = None
    status: str | None = None


class BusinessPartnerRead(BaseModel):
    id: str
    code: str
    name: str
    shortName: str | None = None
    formerName: str | None = None
    englishName: str | None = None
    unifiedSocialCreditCode: str | None = None
    orgType: str | None = None
    registeredAddress: str | None = None
    officeAddress: str | None = None
    contactPhone: str | None = None
    website: str | None = None
    roles: list[BusinessPartnerRoleRead] = Field(default_factory=list)
    qualifications: list[BusinessPartnerQualificationRead] = Field(default_factory=list)
    externalMappings: list[BusinessPartnerMappingRead] = Field(default_factory=list)
    qualificationStatus: str | None = None
    hasOriginalFactoryAuthorization: bool = False
    hasMaintenanceAuthorization: bool = False
    source: str = "h-mdm"
    version: str | None = None
    enabled: bool = True


class BusinessPartnerListResponse(BaseModel):
    connected: bool
    source: str = "h-mdm"
    degraded: bool = False
    items: list[BusinessPartnerRead]
    total: int
    page: int
    page_size: int


class MdmMatchRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, str_strip_whitespace=True)

    keyword: str | None = Field(None, max_length=255)
    device_name: str | None = Field(None, alias="deviceName", max_length=255)
    generic_name: str | None = Field(None, alias="genericName", max_length=255)
    brand: str | None = Field(None, max_length=128)
    model: str | None = Field(None, max_length=128)
    registration_no: str | None = Field(None, alias="registrationNo", max_length=128)
    manufacturer: str | None = Field(None, max_length=255)
    supplier: str | None = Field(None, max_length=255)


class MdmMatchResponse(BaseModel):
    connected: bool
    source: str = "h-mdm"
    degraded: bool = False
    recommendation: dict[str, Any] | None = None
    candidates: list[dict[str, Any]] = Field(default_factory=list)
    message: str | None = None
