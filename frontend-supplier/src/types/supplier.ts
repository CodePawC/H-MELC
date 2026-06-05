export type SupplierLoginRequest = {
  username: string
  password: string
}

export type SupplierUserPublic = {
  id: string
  username: string
  organization_id: string
  legal_name: string
  roles: string[]
}

export type SupplierLoginResult = {
  access_token: string
  token_type: string
  expires_in: number
  user: SupplierUserPublic
}

export type DashboardData = {
  unpaid_amount: number
  paid_amount: number
  payment_progress_pct: number
  pending_invoice_count: number
  missing_material_count: number
  active_projects_count: number
}

export type ProjectItem = {
  id: string
  title: string
  summary?: string | null
  status: string
  bid_deadline?: string | null
  created_at: string
}

export type ProjectBid = {
  id: string
  project_id: string
  organization_id: string
  quoted_amount: number
  currency: string
  remark?: string | null
  is_winning: boolean
  created_at: string
}

export type InvoiceItem = {
  id: string
  organization_id: string
  object_key: string
  mime_type?: string | null
  file_size?: number | null
  ocr_review_status?: string | null
  created_at: string
}

export type PayableItem = {
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

export type PaymentItem = {
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

export type QualificationItem = {
  id: string
  organization_id: string
  title: string
  credential_type?: string | null
  review_status: string
  created_at: string
}
