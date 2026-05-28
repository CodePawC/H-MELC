import { apiRequest } from '../lib/api'
import type { Paged } from '../types/pagination'

export type MetrologyDeviceRow = {
  id: string
  asset_id: string
  regulatory_class: string
  calibration_status: string
  meter_type?: string | null
  cycle_months: number
  last_calibrated_at?: string | null
  next_due_date?: string | null
  issuing_body?: string | null
  remark?: string | null
  created_at: string
  updated_at: string
}

export type CalibrationPlanRow = {
  id: string
  asset_id: string
  title: string
  planned_date: string
  plan_status: string
  assigned_org?: string | null
  remark?: string | null
  created_at: string
  updated_at: string
}

export type MetrologyCertificateRow = {
  id: string
  asset_id: string
  certificate_no: string
  issued_at?: string | null
  valid_to: string
  issuing_body?: string | null
  conclusion: string
  object_key?: string | null
  mime_type?: string | null
  file_size?: number | null
  created_at: string
}

export type MetrologyAlertRow = {
  asset_id: string
  certificate_id?: string
  alert_type: string
  due_date: string
  severity: string
  calibration_status?: string
}

export function fetchMetrologyDevices(params: {
  page?: number
  page_size?: number
  regulatory_class?: string
  calibration_status?: string
}) {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  if (params.regulatory_class?.trim()) sp.set('regulatory_class', params.regulatory_class.trim())
  if (params.calibration_status?.trim()) sp.set('calibration_status', params.calibration_status.trim())
  const q = sp.toString()
  return apiRequest<Paged<MetrologyDeviceRow>>(`/api/v1/metrology/devices${q ? `?${q}` : ''}`)
}

export function fetchCalibrationPlans(params: { page?: number; page_size?: number; plan_status?: string }) {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  if (params.plan_status?.trim()) sp.set('plan_status', params.plan_status.trim())
  const q = sp.toString()
  return apiRequest<Paged<CalibrationPlanRow>>(`/api/v1/metrology/calibration-plans${q ? `?${q}` : ''}`)
}

export function fetchMetrologyCertificates(params: {
  page?: number
  page_size?: number
  keyword?: string
  valid_to_before?: string
}) {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  if (params.keyword?.trim()) sp.set('keyword', params.keyword.trim())
  if (params.valid_to_before?.trim()) sp.set('valid_to_before', params.valid_to_before.trim())
  const q = sp.toString()
  return apiRequest<Paged<MetrologyCertificateRow>>(`/api/v1/metrology/certificates${q ? `?${q}` : ''}`)
}

export function fetchMetrologyExpiryAlerts(withinDays = 30) {
  return apiRequest<{ items: MetrologyAlertRow[]; total: number; within_days: number }>(
    `/api/v1/metrology/alerts/expiry?within_days=${withinDays}`,
  )
}
