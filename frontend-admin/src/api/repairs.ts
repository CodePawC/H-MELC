/** 对齐 docs/06_接口设计/01 §二·2 */

import { apiRequest } from '../lib/api'
import type { Paged } from '../types/pagination'

export type RepairRow = {
  id: string
  order_code: string
  asset_id: string
  fault_description?: string | null
  priority?: string | null
  order_status: string
  assigned_engineer_id?: string | null
  created_at: string
}

/** GET /repairs/{id} bundle.order（节选 + 兼容列表字段） */
export type RepairDetailOrder = RepairRow & {
  report_department_id?: string | null
  reporter_id?: string | null
  reporter_name?: string | null
  reporter_phone?: string | null
  fault_type?: string | null
  fault_level?: string | null
  accepted_at?: string | null
  completed_at?: string | null
  confirmed_at?: string | null
  is_outsourced?: boolean
  is_return_factory?: boolean
  is_chargeable?: boolean
  estimated_cost?: string | number | null
  actual_cost?: string | number | null
  ai_risk_level?: string | null
  ai_incident_suggestion?: boolean
  updated_at?: string
}

export type RepairAttachmentRow = {
  id: string
  repair_order_id: string
  file_id: string
  file_type?: string | null
  description?: string | null
  uploaded_by?: string | null
  uploaded_at: string
}

export type RepairRecordRow = {
  id: string
  repair_order_id: string
  record_type?: string | null
  content?: string | null
  engineer_id?: string | null
  engineer_name?: string | null
  ai_assisted?: boolean
  ai_result_id?: string | null
  created_at: string
  metadata?: Record<string, unknown> | null
}

export type RepairReportRow = {
  id: string
  repair_order_id: string
  fault_cause?: string | null
  repair_method?: string | null
  replaced_parts?: string | null
  test_result?: string | null
  conclusion?: string | null
  ai_generated?: boolean
  ai_result_id?: string | null
  department_confirm_status?: string | null
  department_confirm_by?: string | null
  department_confirm_at?: string | null
  created_at: string
}

export type RepairDetailBundlePayload = {
  order: RepairDetailOrder
  attachments: RepairAttachmentRow[]
  records: RepairRecordRow[]
  report: RepairReportRow | null
}

export type RepairListPayload = Paged<RepairRow>

/** docs/06 §二·2 列表查询参数（与后端 Query 对齐） */
export type RepairListQueryParams = {
  page?: number
  page_size?: number
  order_status?: string
  asset_id?: string
  department_id?: string
  assigned_engineer_id?: string
  priority?: string
  /** YYYY-MM-DD */
  date_from?: string
  /** YYYY-MM-DD */
  date_to?: string
}

export function fetchRepairs(params: RepairListQueryParams) {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  if (params.order_status?.trim()) sp.set('order_status', params.order_status.trim())
  if (params.asset_id?.trim()) sp.set('asset_id', params.asset_id.trim())
  if (params.department_id?.trim()) sp.set('department_id', params.department_id.trim())
  if (params.assigned_engineer_id?.trim())
    sp.set('assigned_engineer_id', params.assigned_engineer_id.trim())
  if (params.priority?.trim()) sp.set('priority', params.priority.trim())
  if (params.date_from?.trim()) sp.set('date_from', params.date_from.trim())
  if (params.date_to?.trim()) sp.set('date_to', params.date_to.trim())
  const q = sp.toString()
  return apiRequest<RepairListPayload>(`/api/v1/repairs${q ? `?${q}` : ''}`)
}

/** §二·3 工单 + 附件 + 过程记录 + 报告摘要 */
export function fetchRepairDetail(repairOrderId: string) {
  return apiRequest<RepairDetailBundlePayload>(
    `/api/v1/repairs/${encodeURIComponent(repairOrderId)}`,
  )
}

/** §二·4 抢单 · RBAC_REPAIR_ENGINEER_OPS */
export function claimRepair(repairOrderId: string, body: { engineer_id: string }) {
  return apiRequest<RepairDetailOrder>(
    `/api/v1/repairs/${encodeURIComponent(repairOrderId)}/claim`,
    { method: 'POST', body: JSON.stringify(body) },
  )
}

/** §二·5 强制派单 · RBAC_REPAIR_ASSIGN */
export function assignRepair(repairOrderId: string, body: { engineer_id: string; reason?: string | null }) {
  return apiRequest<RepairDetailOrder>(
    `/api/v1/repairs/${encodeURIComponent(repairOrderId)}/assign`,
    { method: 'POST', body: JSON.stringify(body) },
  )
}

/** §二·6 过程记录 · RBAC_REPAIR_ENGINEER_OPS */
export function addRepairRecord(
  repairOrderId: string,
  body: {
    record_type?: string | null
    content?: string | null
    engineer_id?: string | null
    engineer_name?: string | null
  },
) {
  return apiRequest<RepairRecordRow>(
    `/api/v1/repairs/${encodeURIComponent(repairOrderId)}/records`,
    { method: 'POST', body: JSON.stringify(body) },
  )
}

/** §二·7 完成维修 · RBAC_REPAIR_ENGINEER_OPS */
export function completeRepair(
  repairOrderId: string,
  body: {
    fault_cause?: string | null
    repair_method?: string | null
    replaced_parts?: string | null
    test_result?: string | null
    conclusion?: string | null
    actual_cost?: string | number | null
  },
) {
  return apiRequest<RepairDetailOrder>(
    `/api/v1/repairs/${encodeURIComponent(repairOrderId)}/complete`,
    { method: 'POST', body: JSON.stringify(body) },
  )
}

/** §二·8 科室确认 · RBAC_REPAIR_CONFIRM */
export function confirmRepair(
  repairOrderId: string,
  body: {
    confirm_status: 'ACCEPTED' | 'REJECTED'
    department_confirm_by?: string | null
    comment?: string | null
  },
) {
  return apiRequest<RepairDetailOrder>(
    `/api/v1/repairs/${encodeURIComponent(repairOrderId)}/confirm`,
    { method: 'POST', body: JSON.stringify(body) },
  )
}

/** §三·1 外修标记 · RBAC_REPAIR_EXTENDED_WORK */
export function markRepairOutsourcing(repairOrderId: string) {
  return apiRequest<RepairDetailOrder>(
    `/api/v1/repairs/${encodeURIComponent(repairOrderId)}/outsourcing`,
    { method: 'POST', body: JSON.stringify({}) },
  )
}

/** §三·2 返厂标记 · RBAC_REPAIR_EXTENDED_WORK */
export function markRepairReturnFactory(repairOrderId: string) {
  return apiRequest<RepairDetailOrder>(
    `/api/v1/repairs/${encodeURIComponent(repairOrderId)}/return-factory`,
    { method: 'POST', body: JSON.stringify({}) },
  )
}
