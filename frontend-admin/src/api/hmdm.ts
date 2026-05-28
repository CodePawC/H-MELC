import { apiRequest } from '../lib/api'

export type HmdmStatusPayload = {
  hmdm_base_url: string
  connected: boolean
  last_success_at?: string | null
  last_failure_reason?: string | null
  api_key_configured: boolean
  cache_enabled: boolean
  cache_status: Record<string, unknown>
}

export type HmdmCacheStatusPayload = {
  cache_enabled: boolean
  fallback_to_cache: boolean
  ttl_seconds: number
  counts: Record<string, number>
  latest_synced_at?: string | null
  expired_count: number
}

export type HmdmProxyPayload = {
  payload: unknown
  degraded: boolean
  from_cache: boolean
  error?: string | null
}

export type DeviceClassificationCandidate = {
  classificationId: string
  classificationCode: string
  catalogItem: string
  managementClass?: string | null
  matchScore: number
  matchReason: string
  versionId?: string | null
  productDescription?: string | null
  intendedUse?: string | null
  examples?: string[]
}

export type DeviceClassificationMatchPayload = {
  candidates: DeviceClassificationCandidate[]
  source: string
  degraded: boolean
}

export type DeviceClassificationChange = {
  changeId: string
  classificationId?: string | null
  classificationCode?: string | null
  classificationName?: string | null
  versionId?: string | null
  changeType: string
  changeReason?: string | null
  oldPayload?: Record<string, unknown> | null
  newPayload?: Record<string, unknown> | null
  targetClassificationId?: string | null
  targetClassificationCode?: string | null
  occurredAt: string
}

export function fetchHmdmStatus() {
  return apiRequest<HmdmStatusPayload>('/api/v1/hmdm/status')
}

export function fetchHmdmCacheStatus() {
  return apiRequest<HmdmCacheStatusPayload>('/api/v1/hmdm/cache/status')
}

export function refreshHmdmCache() {
  return apiRequest<{ refreshed: Record<string, number>; cache_status: HmdmCacheStatusPayload }>('/api/v1/hmdm/cache/refresh', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function fetchHmdmEquipmentCategories() {
  return apiRequest<HmdmProxyPayload>('/api/v1/hmdm/equipment-categories/tree')
}

export function searchHmdmEquipmentNames(keyword: string, categoryId?: string) {
  const sp = new URLSearchParams()
  if (keyword.trim()) sp.set('keyword', keyword.trim())
  if (categoryId?.trim()) sp.set('category_id', categoryId.trim())
  const q = sp.toString()
  return apiRequest<HmdmProxyPayload>(`/api/v1/hmdm/equipment-standard-names${q ? `?${q}` : ''}`)
}

export function searchHmdmManufacturerVendors(keyword: string, roleType?: string) {
  const sp = new URLSearchParams()
  if (keyword.trim()) sp.set('keyword', keyword.trim())
  if (roleType?.trim()) sp.set('role_type', roleType.trim())
  const q = sp.toString()
  return apiRequest<HmdmProxyPayload>(`/api/v1/hmdm/manufacturer-vendors${q ? `?${q}` : ''}`)
}

export function createEquipmentNameRequest(payload: {
  proposed_name: string
  alias_names?: string[]
  suggested_category?: string
  reason: string
}) {
  return apiRequest<Record<string, unknown>>('/api/v1/hmdm/equipment-standard-name-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function createManufacturerVendorRequest(payload: {
  proposed_standard_name: string
  english_name?: string
  short_name?: string
  alias_names?: string[]
  unified_social_credit_code?: string
  suggested_role_type?: string
  business_domain?: string
  contact_info?: Record<string, unknown>
  reason: string
}) {
  return apiRequest<Record<string, unknown>>('/api/v1/hmdm/manufacturer-vendor-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function matchDeviceClassification(payload: {
  deviceName: string
  brand?: string
  model?: string
  registrationName?: string
  registrationCertificateNo?: string
  managementClass?: string
  department?: string
  intendedUse?: string
  originalCategory?: string
}) {
  return apiRequest<DeviceClassificationMatchPayload>('/api/v1/master-data/device-classification/match', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchDeviceClassificationChanges(since?: string) {
  const sp = new URLSearchParams()
  if (since) sp.set('since', since)
  const q = sp.toString()
  return apiRequest<{ changes: DeviceClassificationChange[] }>(`/api/v1/master-data/device-classification/changes${q ? `?${q}` : ''}`)
}
