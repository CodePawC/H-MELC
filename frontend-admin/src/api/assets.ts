import { apiRequest } from '../lib/api'

/** GET /api/v1/assets/{id} 内 asset 主体；字段对齐后端 AssetRead（JSON） */
export type AssetReadJson = {
  id: string
  asset_code: string
  asset_name: string
  category_code?: string | null
  model_id?: string | null
  manufacturer_id?: string | null
  supplier_id?: string | null
  brand?: string | null
  model?: string | null
  department_name?: string | null
  campus_id?: string | null
  campus_code?: string | null
  campus_name?: string | null
  mdm_department_id?: string | null
  department_code?: string | null
  department_source?: string | null
  department_version?: string | null
  department_synced_at?: string | null
  mdm_person_id?: string | null
  person_code?: string | null
  person_name?: string | null
  person_department_id?: string | null
  person_department_name?: string | null
  person_source?: string | null
  person_version?: string | null
  person_synced_at?: string | null
  mdm_discipline_id?: string | null
  discipline_code?: string | null
  discipline_name?: string | null
  discipline_source?: string | null
  discipline_version?: string | null
  discipline_synced_at?: string | null
  location?: string | null
  warranty_status?: string | null
  hmdm_equipment_category_code?: string | null
  hmdm_equipment_category_name?: string | null
  hmdm_equipment_name_code?: string | null
  hmdm_standard_name?: string | null
  hmdm_regulatory_major_category?: string | null
  hmdm_primary_product_category?: string | null
  hmdm_secondary_product_category?: string | null
  hmdm_management_class?: string | null
  classification_id?: string | null
  classification_code?: string | null
  classification_name?: string | null
  classification_version_id?: string | null
  management_class?: string | null
  mdm_category_id?: string | null
  mdm_category_code?: string | null
  mdm_category_name?: string | null
  mdm_category_path?: string | null
  mdm_category_version?: string | null
  mdm_source?: string | null
  mdm_synced_at?: string | null
  intake_source?: string | null
  ai_extraction_status?: string | null
  ai_extraction_confidence?: string | number | null
  ai_extraction_raw_result?: Record<string, unknown> | null
  ai_review_status?: string | null
  ai_reviewed_by?: string | null
  ai_reviewed_at?: string | null
  source_file_ids?: string[] | null
  evidence_file_ids?: string[] | null
  classification_match_status?: string | null
  classification_match_method?: string | null
  classification_match_score?: string | number | null
  classification_confirmed_by?: string | null
  classification_confirmed_at?: string | null
  classification_change_status?: string | null
  manufacturer_org_id?: string | null
  manufacturer_org_code?: string | null
  manufacturer_name?: string | null
  supplier_org_id?: string | null
  supplier_org_code?: string | null
  supplier_name?: string | null
  after_sales_org_code?: string | null
  after_sales_name?: string | null
  service_provider_org_code?: string | null
  service_provider_name?: string | null
  brand_owner_org_id?: string | null
  brand_owner_org_code?: string | null
  brand_owner_name?: string | null
  registration_holder_org_id?: string | null
  registration_holder_org_code?: string | null
  registration_holder_name?: string | null
  maintainer_org_id?: string | null
  maintainer_org_code?: string | null
  maintainer_name?: string | null
  installer_org_id?: string | null
  installer_org_code?: string | null
  installer_name?: string | null
  org_source?: string | null
  org_version?: string | null
  org_synced_at?: string | null
  serial_number?: string | null
  registration_no?: string | null
  udi_di?: string | null
  udi_pi?: string | null
  department_id?: string | null
  location_id?: string | null
  purchase_date?: string | null
  install_date?: string | null
  warranty_end?: string | null
  original_value?: string | number | null
  main_status: string
  lifecycle_phase?: string | null
  risk_level?: string | null
  regulatory_level?: string | null
  ai_health_score?: string | number | null
  usage_score?: string | number | null
  roi_score?: string | number | null
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

/** 列表单项与后端 AssetRead JSON 对齐（docs/06 §一·1） */
export type AssetRow = AssetReadJson

export type QrRow = {
  id: string
  qr_token: string
  qr_version?: number
  status?: string
  generated_at?: string
}

export type AssetDetailBundle = {
  asset: AssetReadJson
  classification_impacts?: ClassificationImpact[]
  qr_codes: QrRow[]
  lifecycle_events: unknown[]
  repairs: Record<string, unknown>[]
  pm_records: unknown[]
  calibration_records: unknown[]
  attachments: unknown[]
  ai_health: { score: number | null }
}

export type ClassificationImpact = {
  impact_id: string
  equipment_id: string
  old_classification_id?: string | null
  old_classification_code?: string | null
  new_classification_id?: string | null
  change_type: string
  impact_level: 'low' | 'medium' | 'high' | string
  impact_reason: string
  source_change_id: string
  status: 'pending' | 'confirmed' | 'adjusted' | 'ignored' | string
  created_at: string
  handled_by?: string | null
  handled_at?: string | null
}

export type JcPrinterDrawingBoard = {
  width: number
  height: number
  rotate: 0 | 90 | 180 | 270
  path: string
  verticalShift: number
  HorizontalShift: number
}

export type JcPrinterElement = {
  type: 'text' | 'qrCode' | 'barCode' | 'line' | 'graph' | 'image'
  json?: Record<string, unknown>
  payload?: Record<string, unknown>
}

export type JcPrinterPrintData = {
  InitDrawingBoardParam: JcPrinterDrawingBoard
  elements: JcPrinterElement[]
}

export type AssetPrintLabelPayload = {
  asset: {
    asset_id: string
    asset_code: string
    asset_name: string
    main_status: string
  }
  qr: {
    asset_id: string
    asset_code: string
    qr_token: string
    status: string
    version: number
  }
  sdk: {
    package_version: string
    service_ws_url: string
    service_required: boolean
    service_installer_hint: string
    integration_mode: string
  }
  template: {
    template_code: string
    template_name: string
    paper_type_code: string
    paper_type_name: string
    layout_code: string
    layout_name: string
    label_width_mm: number
    label_height_mm: number
    display_scale: number
    print_density: number
    print_label_type: number
    print_mode: number
  }
  print_data: JcPrinterPrintData
}

export type AssetLabelTemplatePreset = AssetPrintLabelPayload['template'] & {
  description: string
  is_default: boolean
}

export type AssetLabelTemplateListPayload = {
  items: AssetLabelTemplatePreset[]
  default_template_code: string
}

export type AssetListPayload = {
  items: AssetRow[]
  total: number
  page: number
  page_size: number
}

export type FetchAssetsParams = {
  page?: number
  page_size?: number
  keyword?: string
  department_id?: string
  category_code?: string
  main_status?: string
  risk_level?: string
  classification_match_status?: string
  classification_change_status?: string
}

export type CreateAssetPayload = {
  asset_code: string
  asset_name: string
  brand?: string
  model?: string
  serial_number?: string
  department_name?: string
  campus_id?: string
  campus_code?: string
  campus_name?: string
  mdm_department_id?: string
  department_code?: string
  department_source?: 'h-mdm'
  department_version?: string
  department_synced_at?: string
  mdm_person_id?: string
  person_code?: string
  person_name?: string
  person_department_id?: string
  person_department_name?: string
  person_source?: 'h-mdm'
  person_version?: string
  person_synced_at?: string
  mdm_discipline_id?: string
  discipline_code?: string
  discipline_name?: string
  discipline_source?: 'h-mdm'
  discipline_version?: string
  discipline_synced_at?: string
  location?: string
  purchase_date?: string
  warranty_end?: string
  original_value?: number
  warranty_status?: string
  main_status?: string
  hmdm_equipment_category_code?: string
  hmdm_equipment_category_name?: string
  hmdm_equipment_name_code?: string
  hmdm_standard_name?: string
  hmdm_regulatory_major_category?: string
  hmdm_primary_product_category?: string
  hmdm_secondary_product_category?: string
  hmdm_management_class?: string
  classification_id?: string
  classification_code?: string
  classification_name?: string
  classification_version_id?: string
  management_class?: string
  mdm_category_id?: string
  mdm_category_code?: string
  mdm_category_name?: string
  mdm_category_path?: string
  mdm_category_version?: string
  mdm_source?: 'h-mdm'
  mdm_synced_at?: string
  intake_source?: string
  ai_extraction_status?: string
  ai_extraction_confidence?: number
  ai_extraction_raw_result?: Record<string, unknown>
  ai_review_status?: string
  ai_reviewed_by?: string
  ai_reviewed_at?: string
  source_file_ids?: string[]
  evidence_file_ids?: string[]
  classification_match_status?: string
  classification_match_method?: string
  classification_match_score?: number
  manufacturer_org_id?: string
  manufacturer_org_code?: string
  manufacturer_name?: string
  supplier_org_id?: string
  supplier_org_code?: string
  supplier_name?: string
  after_sales_org_code?: string
  after_sales_name?: string
  service_provider_org_code?: string
  service_provider_name?: string
  brand_owner_org_id?: string
  brand_owner_org_code?: string
  brand_owner_name?: string
  registration_holder_org_id?: string
  registration_holder_org_code?: string
  registration_holder_name?: string
  maintainer_org_id?: string
  maintainer_org_code?: string
  maintainer_name?: string
  installer_org_id?: string
  installer_org_code?: string
  installer_name?: string
  org_source?: 'h-mdm'
  org_version?: string
  org_synced_at?: string
}

export function fetchAssets(params: FetchAssetsParams) {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.page_size) sp.set('page_size', String(params.page_size))
  if (params.keyword?.trim()) sp.set('keyword', params.keyword.trim())
  if (params.department_id?.trim()) sp.set('department_id', params.department_id.trim())
  if (params.category_code?.trim()) sp.set('category_code', params.category_code.trim())
  if (params.main_status?.trim()) sp.set('main_status', params.main_status.trim())
  if (params.risk_level?.trim()) sp.set('risk_level', params.risk_level.trim())
  if (params.classification_match_status?.trim()) sp.set('classification_match_status', params.classification_match_status.trim())
  if (params.classification_change_status?.trim()) sp.set('classification_change_status', params.classification_change_status.trim())
  const q = sp.toString()
  return apiRequest<AssetListPayload>(`/api/v1/assets${q ? `?${q}` : ''}`)
}

export function createAsset(payload: CreateAssetPayload) {
  return apiRequest<AssetReadJson>('/api/v1/assets', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export type AssetIntakeFileJson = {
  id: string
  task_id: string
  file_name: string
  file_type: string
  mime_type?: string | null
  size_bytes?: number | null
  storage_uri?: string | null
  preview_url?: string | null
  archive_status: string
  created_at: string
}

export type AssetIntakeTaskJson = {
  id: string
  title: string
  mode: string
  intake_source: string
  status: string
  ai_extraction_status: string
  ai_extraction_confidence?: string | number | null
  ai_extraction_raw_result: Record<string, unknown>
  ai_review_status: string
  ai_reviewed_by?: string | null
  ai_reviewed_at?: string | null
  source_file_ids: string[]
  evidence_file_ids: string[]
  extracted_fields: Record<string, unknown>
  mdm_match_result: Record<string, unknown>
  component_structure: Record<string, unknown>[]
  review_payload: Record<string, unknown>
  created_asset_id?: string | null
  created_by?: string | null
  created_by_name?: string | null
  created_at: string
  updated_at: string
  files: AssetIntakeFileJson[]
}

export type CreateAssetIntakeTaskPayload = {
  title?: string
  mode?: string
  intake_source?: string
}

export type CreateAssetIntakeFilePayload = {
  file_name: string
  file_type: string
  mime_type?: string
  size_bytes?: number
  storage_uri?: string
  preview_url?: string
}

export type ReviewAssetIntakePayload = {
  review_payload: Record<string, unknown>
  selected_mdm_category?: Record<string, unknown>
  review_status?: string
}

export type CreateAssetFromIntakePayload = {
  asset_code?: string
}

export type AssetIntakeCreateAssetResult = {
  asset: AssetReadJson
  task: AssetIntakeTaskJson
}

export function createAssetIntakeTask(payload: CreateAssetIntakeTaskPayload = {}) {
  return apiRequest<AssetIntakeTaskJson>('/api/v1/assets/intake/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function fetchAssetIntakeTask(taskId: string) {
  return apiRequest<AssetIntakeTaskJson>(`/api/v1/assets/intake/tasks/${encodeURIComponent(taskId)}`)
}

export function addAssetIntakeFile(taskId: string, payload: CreateAssetIntakeFilePayload) {
  return apiRequest<AssetIntakeFileJson>(`/api/v1/assets/intake/tasks/${encodeURIComponent(taskId)}/files`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function extractAssetIntakeTask(taskId: string) {
  return apiRequest<AssetIntakeTaskJson>(`/api/v1/assets/intake/tasks/${encodeURIComponent(taskId)}/extract`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function matchAssetIntakeMdm(taskId: string) {
  return apiRequest<AssetIntakeTaskJson>(`/api/v1/assets/intake/tasks/${encodeURIComponent(taskId)}/match-mdm`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function reviewAssetIntakeTask(taskId: string, payload: ReviewAssetIntakePayload) {
  return apiRequest<AssetIntakeTaskJson>(`/api/v1/assets/intake/tasks/${encodeURIComponent(taskId)}/review`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function approveAssetIntakeTask(taskId: string, review_comment?: string) {
  return apiRequest<AssetIntakeTaskJson>(`/api/v1/assets/intake/tasks/${encodeURIComponent(taskId)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ review_comment }),
  })
}

export function createAssetFromIntake(taskId: string, payload: CreateAssetFromIntakePayload = {}) {
  return apiRequest<AssetIntakeCreateAssetResult>(
    `/api/v1/assets/intake/tasks/${encodeURIComponent(taskId)}/create-asset`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

export type UpdateAssetPayload = Partial<Omit<CreateAssetPayload, 'asset_code'>> & {
  is_active?: boolean
}

export function updateAsset(assetId: string, payload: UpdateAssetPayload) {
  return apiRequest<AssetReadJson>(`/api/v1/assets/${encodeURIComponent(assetId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

/** docs/06 §一·2：详情壳（维修摘要等随迁移逐步丰富） */
export function fetchAssetDetail(assetId: string) {
  return apiRequest<AssetDetailBundle>(`/api/v1/assets/${encodeURIComponent(assetId)}`)
}

/** docs/06 §一·7：资产标签打印载荷，供 PC 管理端精臣本机 SDK 使用。 */
export function fetchAssetPrintLabel(assetId: string, templateCode?: string) {
  const sp = new URLSearchParams()
  if (templateCode?.trim()) sp.set('template_code', templateCode.trim())
  const q = sp.toString()
  return apiRequest<AssetPrintLabelPayload>(`/api/v1/assets/${encodeURIComponent(assetId)}/print-label${q ? `?${q}` : ''}`)
}

/** docs/06 §一·7a：资产标签纸张/尺寸/版式模板预设。 */
export function fetchAssetLabelTemplates() {
  return apiRequest<AssetLabelTemplateListPayload>('/api/v1/assets/label-templates')
}

export function bindAssetClassification(assetId: string, payload: {
  classificationId: string
  classificationCode: string
  classificationName?: string
  classificationVersionId: string
  managementClass?: string
  confirmReason?: string
  matchMethod?: string
  matchScore?: number
}) {
  return apiRequest<{ asset: AssetReadJson; handled_impact?: ClassificationImpact | null }>(
    `/api/v1/equipment/assets/${encodeURIComponent(assetId)}/classification-bind`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

export function confirmClassificationImpact(impactId: string, payload?: { handleReason?: string }) {
  return apiRequest<{ asset: AssetReadJson; impact: ClassificationImpact }>(
    `/api/v1/equipment/assets/classification-impacts/${encodeURIComponent(impactId)}/confirm`,
    {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    },
  )
}

export function ignoreClassificationImpact(impactId: string, payload?: { handleReason?: string }) {
  return apiRequest<{ asset: AssetReadJson; impact: ClassificationImpact }>(
    `/api/v1/equipment/assets/classification-impacts/${encodeURIComponent(impactId)}/ignore`,
    {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    },
  )
}

export function adjustClassificationImpact(impactId: string, payload: {
  classificationId: string
  classificationCode: string
  classificationName?: string
  classificationVersionId: string
  managementClass?: string
  confirmReason?: string
  handleReason?: string
  matchMethod?: string
  matchScore?: number
}) {
  return apiRequest<{ asset: AssetReadJson; impact: ClassificationImpact }>(
    `/api/v1/equipment/assets/classification-impacts/${encodeURIComponent(impactId)}/adjust`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
}

export function recordClassificationDetailView(assetId: string) {
  return apiRequest<{
    classification_id?: string | null
    classification_code?: string | null
    classification_name?: string | null
    classification_version_id?: string | null
    management_class?: string | null
  }>(`/api/v1/equipment/assets/${encodeURIComponent(assetId)}/classification-detail-viewed`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function syncClassificationImpacts(since?: string) {
  return apiRequest<{ created_count: number; items: ClassificationImpact[] }>('/api/v1/equipment/assets/classification-impacts/sync', {
    method: 'POST',
    body: JSON.stringify(since ? { since } : {}),
  })
}
