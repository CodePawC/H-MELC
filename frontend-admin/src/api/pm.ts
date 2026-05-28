/** 对齐 docs/06 · 十（预防性维护 PM） */

import { apiRequest } from '../lib/api'
import type { Paged } from '../types/pagination'

export type PmPlanRow = {
  id: string
  title: string
  code: string | null
  asset_id: string
  frequency: string
  next_due_date: string
  owner_department_id: string | null
  mdm_department_id?: string | null
  department_code?: string | null
  department_name?: string | null
  department_source?: string | null
  department_version?: string | null
  department_synced_at?: string | null
  description: string | null
  plan_status: string
  created_at: string
  updated_at: string
}

export type PmTaskRow = {
  id: string
  plan_id: string
  asset_id: string
  due_date: string
  task_status: string
  assigned_engineer_id: string | null
  mdm_person_id?: string | null
  person_code?: string | null
  person_name?: string | null
  person_source?: string | null
  person_version?: string | null
  person_synced_at?: string | null
  result_summary: string | null
  executed_at: string | null
  created_at: string
  updated_at: string
}

export type PmInspectionTaskRow = {
  id: string
  title: string
  inspection_type: string
  department_id: string | null
  mdm_department_id?: string | null
  department_code?: string | null
  department_name?: string | null
  department_source?: string | null
  department_version?: string | null
  department_synced_at?: string | null
  asset_id: string | null
  due_date: string
  task_status: string
  checklist_result: Record<string, unknown> | null
  remark: string | null
  inspector_id: string | null
  mdm_person_id?: string | null
  person_code?: string | null
  person_name?: string | null
  person_source?: string | null
  person_version?: string | null
  person_synced_at?: string | null
  inspected_at: string | null
  created_at: string
  updated_at: string
}

export type PmModuleMeta = {
  module: string
  name: string
  paths: Record<string, string>
}

export type PmOverdueAlert = {
  task_id: string
  type: 'PM' | 'INSPECTION'
  due_date: string
  asset_id: string | null
  plan_id?: string
  inspection_type?: string
  task_status?: string
}

export function fetchPmModuleMeta(): Promise<PmModuleMeta> {
  return apiRequest<PmModuleMeta>('/api/v1/pm', { method: 'GET' })
}

export function fetchPmPlans(params: {
  page?: number
  page_size?: number
  keyword?: string
  asset_id?: string
  plan_status?: string
}): Promise<Paged<PmPlanRow>> {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  if (params.keyword?.trim()) sp.set('keyword', params.keyword.trim())
  if (params.asset_id?.trim()) sp.set('asset_id', params.asset_id.trim())
  if (params.plan_status?.trim()) sp.set('plan_status', params.plan_status.trim())
  const q = sp.toString()
  return apiRequest<Paged<PmPlanRow>>(`/api/v1/pm/plans${q ? `?${q}` : ''}`)
}

export function createPmPlan(body: {
  title: string
  code?: string | null
  asset_id: string
  frequency: 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'YEARLY'
  next_due_date: string
  owner_department_id?: string | null
  mdm_department_id?: string | null
  department_code?: string | null
  department_name?: string | null
  department_source?: 'h-mdm'
  department_version?: string | null
  department_synced_at?: string | null
  description?: string | null
  plan_status?: 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'ENDED'
}): Promise<{ plan: PmPlanRow }> {
  return apiRequest<{ plan: PmPlanRow }>('/api/v1/pm/plans', { method: 'POST', body: JSON.stringify(body) })
}

export function fetchPmTasks(params: {
  page?: number
  page_size?: number
  plan_id?: string
  asset_id?: string
  task_status?: string
  assigned_engineer_id?: string
  date_from?: string
  date_to?: string
}): Promise<Paged<PmTaskRow>> {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  if (params.plan_id?.trim()) sp.set('plan_id', params.plan_id.trim())
  if (params.asset_id?.trim()) sp.set('asset_id', params.asset_id.trim())
  if (params.task_status?.trim()) sp.set('task_status', params.task_status.trim())
  if (params.assigned_engineer_id?.trim()) sp.set('assigned_engineer_id', params.assigned_engineer_id.trim())
  if (params.date_from?.trim()) sp.set('date_from', params.date_from.trim())
  if (params.date_to?.trim()) sp.set('date_to', params.date_to.trim())
  const q = sp.toString()
  return apiRequest<Paged<PmTaskRow>>(`/api/v1/pm/tasks${q ? `?${q}` : ''}`)
}

export function completePmTask(
  taskId: string,
  body?: {
    result_summary?: string | null
    engineer_id?: string | null
    mdm_person_id?: string | null
    person_code?: string | null
    person_name?: string | null
    person_source?: 'h-mdm'
    person_version?: string | null
    person_synced_at?: string | null
  },
): Promise<{ task: PmTaskRow }> {
  return apiRequest<{ task: PmTaskRow }>(
    `/api/v1/pm/tasks/${encodeURIComponent(taskId)}/complete`,
    { method: 'POST', body: JSON.stringify(body ?? {}) },
  )
}

export function fetchPmInspectionTasks(params: {
  page?: number
  page_size?: number
  task_status?: string
  inspection_type?: string
  department_id?: string
  date_from?: string
  date_to?: string
}): Promise<Paged<PmInspectionTaskRow>> {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  if (params.task_status?.trim()) sp.set('task_status', params.task_status.trim())
  if (params.inspection_type?.trim()) sp.set('inspection_type', params.inspection_type.trim())
  if (params.department_id?.trim()) sp.set('department_id', params.department_id.trim())
  if (params.date_from?.trim()) sp.set('date_from', params.date_from.trim())
  if (params.date_to?.trim()) sp.set('date_to', params.date_to.trim())
  const q = sp.toString()
  return apiRequest<Paged<PmInspectionTaskRow>>(`/api/v1/pm/inspection-tasks${q ? `?${q}` : ''}`)
}

export function submitPmInspectionRecord(
  inspectionTaskId: string,
  body: { checklist_result: Record<string, unknown>; remark?: string | null },
): Promise<{ task: PmInspectionTaskRow }> {
  return apiRequest<{ task: PmInspectionTaskRow }>(
    `/api/v1/pm/inspection-tasks/${encodeURIComponent(inspectionTaskId)}/records`,
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export function fetchPmOverdueAlerts(limit?: number): Promise<{ items: PmOverdueAlert[] }> {
  const sp = new URLSearchParams()
  if (limit) sp.set('limit', String(limit))
  const q = sp.toString()
  return apiRequest<{ items: PmOverdueAlert[] }>(`/api/v1/pm/alerts/overdue${q ? `?${q}` : ''}`)
}
