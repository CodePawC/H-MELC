import { apiRequest } from '../lib/api'
import type {
  DashboardData,
  InvoiceItem,
  PayableItem,
  PaymentItem,
  ProjectBid,
  ProjectItem,
  QualificationItem,
  SupplierLoginResult,
} from '../types/supplier'

export async function loginSupplier(username: string, password: string): Promise<SupplierLoginResult> {
  return apiRequest<SupplierLoginResult>('/api/v1/supplier-portal/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function fetchDashboard(): Promise<DashboardData> {
  return apiRequest<DashboardData>('/api/v1/supplier-portal/dashboard')
}

export async function fetchInvoices(page = 1, pageSize = 20): Promise<{ items: InvoiceItem[]; total: number }> {
  return apiRequest<{ items: InvoiceItem[]; total: number }>(`/api/v1/supplier-portal/invoices?page=${page}&page_size=${pageSize}`)
}

export async function uploadInvoice(file: File, organizationId: string): Promise<InvoiceItem> {
  const form = new FormData()
  form.set('file', file)
  form.set('organization_id', organizationId)
  return apiRequest<InvoiceItem>('/api/v1/finance/invoices/upload', { method: 'POST', body: form })
}

export async function fetchPayables(page = 1, pageSize = 20, status?: string): Promise<{ items: PayableItem[]; total: number }> {
  const sp = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  if (status) sp.set('status', status)
  return apiRequest<{ items: PayableItem[]; total: number }>(`/api/v1/supplier-portal/payables?${sp}`)
}

export async function fetchPayments(page = 1, pageSize = 20): Promise<{ items: PaymentItem[]; total: number }> {
  return apiRequest<{ items: PaymentItem[]; total: number }>(`/api/v1/supplier-portal/payments?page=${page}&page_size=${pageSize}`)
}

export async function fetchProjects(page = 1, pageSize = 20): Promise<{ items: ProjectItem[]; total: number }> {
  return apiRequest<{ items: ProjectItem[]; total: number }>(`/api/v1/supplier-portal/projects?page=${page}&page_size=${pageSize}`)
}

export async function fetchProjectBids(projectId: string): Promise<{ items: ProjectBid[]; total: number }> {
  return apiRequest<{ items: ProjectBid[]; total: number }>(`/api/v1/supplier-portal/projects/${projectId}/bids`)
}

export async function submitBid(projectId: string, quotedAmount: number, remark?: string): Promise<ProjectBid> {
  return apiRequest<ProjectBid>(`/api/v1/supplier-portal/projects/${projectId}/bids`, {
    method: 'POST',
    body: JSON.stringify({ quoted_amount: quotedAmount, remark: remark || '' }),
  })
}

export async function fetchQualifications(page = 1, pageSize = 20): Promise<{ items: QualificationItem[]; total: number }> {
  return apiRequest<{ items: QualificationItem[]; total: number }>(`/api/v1/supplier-portal/qualifications?page=${page}&page_size=${pageSize}`)
}

export async function uploadQualification(title: string, credentialType: string, file?: File): Promise<QualificationItem> {
  if (file) {
    const form = new FormData()
    form.set('title', title)
    form.set('credential_type', credentialType)
    form.set('file', file)
    return apiRequest<QualificationItem>('/api/v1/supplier-portal/qualifications', { method: 'POST', body: form })
  }
  return apiRequest<QualificationItem>('/api/v1/supplier-portal/qualifications', {
    method: 'POST',
    body: JSON.stringify({ title, credential_type: credentialType }),
    headers: { 'Content-Type': 'application/json' },
  })
}
