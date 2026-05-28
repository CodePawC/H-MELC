import { apiRequest } from '../lib/api'

export type MdmModuleMeta = {
  module: string
  name?: string
  paths?: Record<string, string>
}

export type CategoryEntryRow = {
  id: string
  dimension_code: string
  category_code: string
  name: string
  parent_id?: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type CategoryEntryListPayload = {
  items: CategoryEntryRow[]
  total: number
  page: number
  page_size: number
}

export type CreateCategoryEntryPayload = {
  dimension_code: string
  category_code: string
  name: string
  parent_id?: string
  sort_order?: number
}

export type MasterDataSourceConfigRow = {
  object_code: string
  object_name: string
  authority_source: string
  available_sources?: string[]
  sync_mode: string
  sync_frequency: string
  allow_local_maintenance: 'YES' | 'NO' | 'PARTIAL' | string
  conflict_strategy: string
  last_sync_at?: string | null
  sync_status: 'UNSYNCED' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'PENDING_REVIEW' | 'CONFLICT'
  quality_score?: number | string | null
  mapping_rate?: number | string | null
  description?: string | null
  protected_fields?: string[]
  review_rule?: string | null
}

export type MasterDataSourceConfigListPayload = {
  items: MasterDataSourceConfigRow[]
}

export type DeviceCategory = {
  id: string
  code: string
  name: string
  path: string
  parentId?: string | null
  level?: number | null
  managementClass?: string | null
  source: 'h-mdm' | string
  version?: string | null
  enabled: boolean
}

export type DeviceCategoryListPayload = {
  connected: boolean
  source: 'h-mdm' | string
  degraded: boolean
  items: DeviceCategory[]
  total: number
  page: number
  page_size: number
}

export type DeviceCategoryTreePayload = {
  connected: boolean
  source: 'h-mdm' | string
  degraded: boolean
  items: DeviceCategory[]
}

export type FetchDeviceCategoriesParams = {
  keyword?: string
  code?: string
  page?: number
  page_size?: number
}

export type CampusMaster = {
  id: string
  code: string
  name: string
  shortName?: string | null
  organizationId?: string | null
  address?: string | null
  source: 'h-mdm' | string
  version?: string | null
  enabled: boolean
  sortOrder?: number | null
}

export type DepartmentMaster = {
  id: string
  code: string
  name: string
  shortName?: string | null
  campusId?: string | null
  campusCode?: string | null
  campusName?: string | null
  parentId?: string | null
  type?: string | null
  isClinical: boolean
  isMedtech: boolean
  isNursingUnit: boolean
  isAdmin: boolean
  isLogistics: boolean
  wardFlag: boolean
  costCenterCode?: string | null
  source: 'h-mdm' | string
  version?: string | null
  enabled: boolean
  children?: DepartmentMaster[]
}

export type PersonMaster = {
  id: string
  code: string
  employeeNo?: string | null
  name: string
  departmentId?: string | null
  departmentCode?: string | null
  departmentName?: string | null
  campusId?: string | null
  campusCode?: string | null
  campusName?: string | null
  position?: string | null
  jobTitle?: string | null
  professionalTitle?: string | null
  type?: string | null
  phone?: string | null
  email?: string | null
  source: 'h-mdm' | string
  version?: string | null
  enabled: boolean
}

export type DisciplineMaster = {
  id: string
  code: string
  name: string
  shortName?: string | null
  type?: string | null
  parentId?: string | null
  level?: number | null
  isKeyDiscipline: boolean
  relatedDepartments: Record<string, unknown>[]
  source: 'h-mdm' | string
  version?: string | null
  enabled: boolean
  children?: DisciplineMaster[]
}

export type BusinessPartnerRole = {
  id: string
  roleType: string
  roleName?: string | null
  businessDomain?: string | null
  status?: string | null
  qualificationRequired: boolean
}

export type BusinessPartnerQualification = {
  id: string
  qualificationType: string
  certificateNo?: string | null
  certificateName?: string | null
  validFrom?: string | null
  validTo?: string | null
  status?: string | null
}

export type BusinessPartnerMaster = {
  id: string
  code: string
  name: string
  shortName?: string | null
  formerName?: string | null
  englishName?: string | null
  unifiedSocialCreditCode?: string | null
  orgType?: string | null
  registeredAddress?: string | null
  officeAddress?: string | null
  contactPhone?: string | null
  website?: string | null
  roles: BusinessPartnerRole[]
  qualifications: BusinessPartnerQualification[]
  externalMappings: Record<string, unknown>[]
  qualificationStatus?: string | null
  hasOriginalFactoryAuthorization: boolean
  hasMaintenanceAuthorization: boolean
  source: 'h-mdm' | string
  version?: string | null
  enabled: boolean
  confidence?: number
  matchBasis?: string[]
  hasRequiredRole?: boolean
  degraded?: boolean
}

export type MasterListPayload<T> = {
  connected: boolean
  source: 'h-mdm' | string
  degraded: boolean
  items: T[]
  total: number
  page: number
  page_size: number
}

export type MasterTreePayload<T> = {
  connected: boolean
  source: 'h-mdm' | string
  degraded: boolean
  items: T[]
}

function categoryQuery(params: FetchDeviceCategoriesParams) {
  const sp = new URLSearchParams()
  if (params.keyword?.trim()) sp.set('keyword', params.keyword.trim())
  if (params.code?.trim()) sp.set('code', params.code.trim())
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  const q = sp.toString()
  return q ? `?${q}` : ''
}

export function fetchDeviceCategories(params: FetchDeviceCategoriesParams = {}) {
  return apiRequest<DeviceCategoryListPayload>(`/api/v1/mdm/device-categories${categoryQuery(params)}`)
}

export function searchDeviceCategories(params: FetchDeviceCategoriesParams = {}) {
  return apiRequest<DeviceCategoryListPayload>(`/api/v1/mdm/device-categories/search${categoryQuery(params)}`)
}

export function fetchDeviceCategoryTree(keyword?: string) {
  const q = keyword?.trim() ? `?keyword=${encodeURIComponent(keyword.trim())}` : ''
  return apiRequest<DeviceCategoryTreePayload>(`/api/v1/mdm/device-categories/tree${q}`)
}

export function fetchDeviceCategoryDetail(categoryId: string) {
  return apiRequest<DeviceCategory>(`/api/v1/mdm/device-categories/${encodeURIComponent(categoryId)}`)
}

function orgQuery(params: {
  keyword?: string
  campus_id?: string
  department_id?: string
  department_type?: string
  person_type?: string
  role_type?: string
  page?: number
  page_size?: number
} = {}) {
  const sp = new URLSearchParams()
  if (params.keyword?.trim()) sp.set('keyword', params.keyword.trim())
  if (params.campus_id?.trim()) sp.set('campus_id', params.campus_id.trim())
  if (params.department_id?.trim()) sp.set('department_id', params.department_id.trim())
  if (params.department_type?.trim()) sp.set('department_type', params.department_type.trim())
  if (params.person_type?.trim()) sp.set('person_type', params.person_type.trim())
  if (params.role_type?.trim()) sp.set('role_type', params.role_type.trim())
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  const q = sp.toString()
  return q ? `?${q}` : ''
}

export function fetchCampuses(params: { keyword?: string; page?: number; page_size?: number } = {}) {
  return apiRequest<MasterListPayload<CampusMaster>>(`/api/v1/mdm/campuses${orgQuery(params)}`)
}

export function searchDepartments(params: { keyword?: string; campus_id?: string; department_type?: string; page?: number; page_size?: number } = {}) {
  return apiRequest<MasterListPayload<DepartmentMaster>>(`/api/v1/mdm/departments/search${orgQuery(params)}`)
}

export function fetchDepartmentTree(params: { keyword?: string; campus_id?: string } = {}) {
  return apiRequest<MasterTreePayload<DepartmentMaster>>(`/api/v1/mdm/departments/tree${orgQuery(params)}`)
}

export function searchPersons(params: { keyword?: string; department_id?: string; campus_id?: string; person_type?: string; page?: number; page_size?: number } = {}) {
  return apiRequest<MasterListPayload<PersonMaster>>(`/api/v1/mdm/persons/search${orgQuery(params)}`)
}

export function searchDisciplines(params: { keyword?: string; page?: number; page_size?: number } = {}) {
  return apiRequest<MasterListPayload<DisciplineMaster>>(`/api/v1/mdm/disciplines${orgQuery(params)}`)
}

export function fetchDisciplineTree(keyword?: string) {
  return apiRequest<MasterTreePayload<DisciplineMaster>>(`/api/v1/mdm/disciplines/tree${orgQuery({ keyword })}`)
}

export function searchBusinessPartners(params: { keyword?: string; role_type?: string; page?: number; page_size?: number } = {}) {
  return apiRequest<MasterListPayload<BusinessPartnerMaster>>(`/api/v1/mdm/business-partners/search${orgQuery(params)}`)
}

export type MdmMatchRequest = {
  keyword?: string
  deviceName?: string
  genericName?: string
  brand?: string
  model?: string
  registrationNo?: string
  manufacturer?: string
  supplier?: string
}

export type MdmMatchResponse = {
  connected: boolean
  source: 'h-mdm' | string
  degraded: boolean
  recommendation?: Record<string, unknown> | null
  candidates: Record<string, unknown>[]
  message?: string | null
}

export function matchMdmDeviceCategory(payload: MdmMatchRequest) {
  return apiRequest<MdmMatchResponse>('/api/v1/mdm/match/device-category', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function matchMdmManufacturer(payload: MdmMatchRequest) {
  return apiRequest<MdmMatchResponse>('/api/v1/mdm/match/manufacturer', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function matchMdmSupplier(payload: MdmMatchRequest) {
  return apiRequest<MdmMatchResponse>('/api/v1/mdm/match/supplier', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function matchMdmRegistrationCertificate(payload: MdmMatchRequest) {
  return apiRequest<MdmMatchResponse>('/api/v1/mdm/match/registration-certificate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchMdmModuleMeta() {
  return apiRequest<MdmModuleMeta>('/api/v1/mdm')
}

export function fetchCategoryEntries(params: {
  page?: number
  page_size?: number
  dimension_code?: string
  parent_id?: string
  roots_only?: boolean
  keyword?: string
  include_inactive?: boolean
} = {}) {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  if (params.dimension_code?.trim()) sp.set('dimension_code', params.dimension_code.trim())
  if (params.parent_id?.trim()) sp.set('parent_id', params.parent_id.trim())
  if (params.roots_only) sp.set('roots_only', 'true')
  if (params.keyword?.trim()) sp.set('keyword', params.keyword.trim())
  if (params.include_inactive) sp.set('include_inactive', 'true')
  const q = sp.toString()
  return apiRequest<CategoryEntryListPayload>(`/api/v1/mdm/category-entries${q ? `?${q}` : ''}`)
}

export function createCategoryEntry(payload: CreateCategoryEntryPayload) {
  return apiRequest<CategoryEntryRow>('/api/v1/mdm/category-entries', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchMasterDataSourceConfigs() {
  return apiRequest<MasterDataSourceConfigListPayload>('/api/v1/system/master-data-source-configs')
}
