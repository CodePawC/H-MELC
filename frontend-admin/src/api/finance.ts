/** 对齐 docs/06_接口设计/01 §五 */

import { apiRequest } from '../lib/api'
import type { Paged } from '../types/pagination'

export type InvoiceRow = {
  id: string
  organization_id: string
  object_key?: string | null
  mime_type?: string | null
  file_size?: number | null
  ocr_review_status?: string | null
  created_at: string
}

export type PayableRow = {
  id: string
  organization_id: string
  title: string
  amount_due: number
  amount_paid: number
  balance: number
  due_date?: string | null
  status: string
  created_at: string
}

export type PaymentAllocation = {
  id: string
  invoice_id?: string | null
  payable_id?: string | null
  allocated_amount: number
}

export type PaymentRow = {
  id: string
  supplier_id: string
  payment_amount: number
  payment_date: string
  recorded_by_user_id?: string | null
  allocations: PaymentAllocation[]
  created_at: string
}

export type AgingPayload = {
  as_of: string
  open_count: number
  open_total: number
  buckets: { code: string; label: string; open_count: number; amount: number }[]
}

export function fetchFinanceInvoices(params: { page?: number; page_size?: number; organization_id?: string }) {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  if (params.organization_id?.trim()) sp.set('organization_id', params.organization_id.trim())
  const q = sp.toString()
  return apiRequest<Paged<InvoiceRow>>(`/api/v1/finance/invoices${q ? `?${q}` : ''}`)
}

export function fetchPayables(params: {
  page?: number
  page_size?: number
  status?: string
  organization_id?: string
}) {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  if (params.organization_id?.trim()) sp.set('organization_id', params.organization_id.trim())
  if (params.status?.trim()) sp.set('status', params.status.trim())
  const q = sp.toString()
  return apiRequest<Paged<PayableRow>>(`/api/v1/finance/payables${q ? `?${q}` : ''}`)
}

export function fetchPayments(params: { page?: number; page_size?: number; organization_id?: string }) {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  if (params.organization_id?.trim()) sp.set('organization_id', params.organization_id.trim())
  const q = sp.toString()
  return apiRequest<Paged<PaymentRow>>(`/api/v1/finance/payments${q ? `?${q}` : ''}`)
}

export function fetchAgingAnalysis(organization_id?: string) {
  const sp = new URLSearchParams()
  if (organization_id?.trim()) sp.set('organization_id', organization_id.trim())
  const q = sp.toString()
  return apiRequest<AgingPayload>(`/api/v1/finance/aging-analysis${q ? `?${q}` : ''}`)
}

export function postPaymentPriorityAi(body?: { supplier_id?: string }) {
  return apiRequest<{ task: Record<string, unknown>; result: Record<string, unknown> }>(
    '/api/v1/finance/payment-priority/ai-analyze',
    { method: 'POST', body: JSON.stringify(body ?? {}) },
  )
}
