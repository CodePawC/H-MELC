/** 对齐 docs/06_接口设计/01 §八 */

import { apiRequest } from '../lib/api'
import type { Paged } from '../types/pagination'

export type WorkflowModuleMeta = {
  module: string
  name: string
  paths: Record<string, string>
}

export type WfTaskRow = {
  id: string
  instance_id: string
  assignee_user_id: string
  status: string
  summary?: string | null
  outcome_comment?: string | null
  payload: Record<string, unknown>
  created_at: string
  completed_at?: string | null
}

export function fetchWorkflowModuleMeta() {
  return apiRequest<WorkflowModuleMeta>('/api/v1/workflows')
}

export function fetchMyWorkflowTasks(params?: { page?: number; page_size?: number }) {
  const sp = new URLSearchParams()
  if (params?.page) sp.set('page', String(params.page))
  if (params?.page_size) sp.set('page_size', String(params.page_size))
  const q = sp.toString()
  return apiRequest<Paged<WfTaskRow>>(`/api/v1/workflows/tasks/my${q ? `?${q}` : ''}`)
}

export function startWorkflow(body: {
  process_key: string
  title: string
  payload?: Record<string, unknown>
  first_assignee_user_id?: string | null
}) {
  return apiRequest<{ instance: Record<string, unknown>; initial_task: Record<string, unknown> }>(
    '/api/v1/workflows/start',
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export function approveWorkflowTask(taskId: string, comment?: string | null) {
  return apiRequest<{ task: Record<string, unknown>; instance: Record<string, unknown> }>(
    `/api/v1/workflows/tasks/${encodeURIComponent(taskId)}/approve`,
    { method: 'POST', body: JSON.stringify({ comment: comment ?? null }) },
  )
}

export function rejectWorkflowTask(taskId: string, comment?: string | null) {
  return apiRequest<{ task: Record<string, unknown>; instance: Record<string, unknown> }>(
    `/api/v1/workflows/tasks/${encodeURIComponent(taskId)}/reject`,
    { method: 'POST', body: JSON.stringify({ comment: comment ?? null }) },
  )
}
