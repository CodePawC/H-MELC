import { apiRequest } from '../lib/api'



/** 对齐 docs/06_接口设计/01 · GET /dashboard/hospital-summary */

export type HospitalDashboardSummary = {

  generated_at: string

  assets: {

    total: number

    active_count: number

    by_main_status: { code: string; label: string; count: number }[]

    top_categories: { category_code: string; count: number }[]

  }

  repairs: {

    today_created: number

    open_orders: number

    by_order_status: { status: string; label: string; count: number }[]

  }

}



/** 对齐 docs/06 · GET /dashboard/repair-trend */

export type DashboardRepairTrend = {

  generated_at: string

  days: number

  labels: string[]

  reported: number[]

  completed: number[]

}



/** 对齐 docs/06 · GET /dashboard/finance-payment-summary */

export type DashboardFinancePaymentSummary = {

  generated_at: string

  window_days: number

  amount_unit: string

  bars: { key: string; name: string; value: number }[]

}



/** 对齐 docs/06 · GET /dashboard/workspace-tasks */

export type DashboardWorkspaceTasks = {

  generated_at: string

  workflow: {

    total: number

    items: {

      task_id: string

      instance_id: string

      summary: string | null

      process_key: string | null

      instance_title: string | null

      created_at: string | null

    }[]

  }

  repairs_preview: {

    id: string

    order_code: string

    status: string

    fault_preview: string

    created_at: string | null

  }[]

}



export function fetchHospitalDashboardSummary(): Promise<HospitalDashboardSummary> {

  return apiRequest<HospitalDashboardSummary>('/api/v1/dashboard/hospital-summary', { method: 'GET' })

}



export function fetchDashboardRepairTrend(days: number): Promise<DashboardRepairTrend> {

  const q = new URLSearchParams({ days: String(days) })

  return apiRequest<DashboardRepairTrend>(`/api/v1/dashboard/repair-trend?${q}`, { method: 'GET' })

}



export function fetchDashboardFinancePaymentSummary(days: number): Promise<DashboardFinancePaymentSummary> {

  const q = new URLSearchParams({ days: String(days) })

  return apiRequest<DashboardFinancePaymentSummary>(`/api/v1/dashboard/finance-payment-summary?${q}`, {

    method: 'GET',

  })

}



export function fetchDashboardWorkspaceTasks(taskLimit: number): Promise<DashboardWorkspaceTasks> {

  const q = new URLSearchParams({ task_limit: String(taskLimit) })

  return apiRequest<DashboardWorkspaceTasks>(`/api/v1/dashboard/workspace-tasks?${q}`, { method: 'GET' })

}

