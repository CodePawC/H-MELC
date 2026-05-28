/** `/api/v1/suppliers` 院内导航信息与相关列表 */

import { apiRequest } from '../lib/api'
import type { Paged } from '../types/pagination'

export type SupplierModuleInfo = {
  module: string
  name: string
  portal_api_base: string
  procurement_admin_api_base: string
  qualifications_admin_api_base: string
  finance_admin_api_base: string
  portal_finance: Record<string, string>
  note: string
}

export function fetchSupplierModuleInfo() {
  return apiRequest<SupplierModuleInfo>('/api/v1/suppliers')
}

export type QualificationRow = {
  id: string
  organization_id: string
  organization_legal_name?: string | null
  title: string
  credential_type?: string | null
  review_status: string
  created_at: string
}

export function fetchQualifications(params: {
  page?: number
  page_size?: number
  review_status?: string
  organization_id?: string
}) {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  if (params.review_status?.trim()) sp.set('review_status', params.review_status.trim())
  if (params.organization_id?.trim()) sp.set('organization_id', params.organization_id.trim())
  const q = sp.toString()
  return apiRequest<Paged<QualificationRow>>(`/api/v1/suppliers/qualifications${q ? `?${q}` : ''}`)
}

export type ProcurementProjectRow = {
  id: string
  title: string
  summary?: string | null
  repair_order_id?: string | null
  status: string
  publisher_user_id?: string
  bid_deadline?: string | null
  review_remark?: string | null
  reviewed_at?: string | null
  reviewer_user_id?: string | null
  winning_bid_id?: string | null
  created_at: string
}

export function fetchProcurementProjects(params: { page?: number; page_size?: number; status?: string }) {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  if (params.status?.trim()) sp.set('status', params.status.trim())
  const q = sp.toString()
  return apiRequest<Paged<ProcurementProjectRow>>(`/api/v1/supplier-projects${q ? `?${q}` : ''}`)
}

export type ProcurementBidRow = {
  id: string
  project_id: string
  organization_id: string
  organization_legal_name: string
  portal_account_id: string
  quoted_amount: number | string
  currency: string
  remark?: string | null
  selected?: boolean
  created_at: string
}

export function createProcurementProject(body: {
  title: string
  summary?: string | null
  repair_order_id?: string | null
  bid_deadline?: string | null
}) {
  return apiRequest<ProcurementProjectRow>('/api/v1/supplier-projects', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function fetchProcurementProjectBids(projectId: string) {
  return apiRequest<{ items: ProcurementBidRow[]; total: number }>(
    `/api/v1/supplier-projects/${encodeURIComponent(projectId)}/bids`,
  )
}

export function reviewProcurementProject(
  projectId: string,
  body: { decision: 'CLOSED' | 'CANCELLED'; remark?: string | null; winning_bid_id?: string | null },
) {
  return apiRequest<ProcurementProjectRow>(
    `/api/v1/supplier-projects/${encodeURIComponent(projectId)}/review`,
    { method: 'POST', body: JSON.stringify(body) },
  )
}
