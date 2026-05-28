import { apiRequest } from '../lib/api'
import type { Paged } from '../types/pagination'

export type SupplierPortalDashboard = {
  unpaid_amount: number
  paid_amount: number
  pending_invoice_count: number
  missing_material_count: number
  active_projects_count: number
  payment_progress_pct: number
}

export type SupplierPortalPayable = {
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

export type SupplierPortalPayment = {
  id: string
  organization_id: string
  payment_amount: number
  payment_date: string
  allocations: Array<{
    invoice_id?: string | null
    payable_id?: string | null
    allocated_amount: number
  }>
  created_at: string
}

export type SupplierPortalInvoice = {
  id: string
  organization_id: string
  object_key: string
  mime_type?: string | null
  file_size?: number | null
  ocr_review_status?: string | null
  created_at: string
}

export function fetchSupplierPortalDashboard() {
  return apiRequest<SupplierPortalDashboard>('/api/v1/supplier-portal/dashboard')
}

export function fetchSupplierPortalPayables(params: { page?: number; page_size?: number; status?: string }) {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  if (params.status?.trim()) sp.set('status', params.status.trim())
  const q = sp.toString()
  return apiRequest<Paged<SupplierPortalPayable>>(`/api/v1/supplier-portal/payables${q ? `?${q}` : ''}`)
}

export function fetchSupplierPortalPayments(params: { page?: number; page_size?: number }) {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  const q = sp.toString()
  return apiRequest<Paged<SupplierPortalPayment>>(`/api/v1/supplier-portal/payments${q ? `?${q}` : ''}`)
}

export function fetchSupplierPortalInvoices(params: { page?: number; page_size?: number }) {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  const q = sp.toString()
  return apiRequest<Paged<SupplierPortalInvoice>>(`/api/v1/supplier-portal/invoices${q ? `?${q}` : ''}`)
}
