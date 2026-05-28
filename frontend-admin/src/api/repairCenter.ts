import { apiRequest } from '../lib/api'
import type { Paged } from '../types/pagination'

export type RepairCenterStats = {
  today_repair?: number
  ai_recognized_repair?: number
  wechat_repair?: number
  feishu_repair?: number
  pending_confirm_messages?: number
  pending_dispatch_orders?: number
  in_progress_orders?: number
  emergency_device_faults?: number
  overdue_unhandled?: number
}

export type UnifiedRepairMessage = {
  id: string
  message_no: string
  source_channel: string
  source_channel_name?: string | null
  sender_id?: string | null
  sender_name?: string | null
  sender_phone?: string | null
  sender_department?: string | null
  raw_message_type: string
  raw_message_content?: string | null
  voice_file_url?: string | null
  image_file_url?: string | null
  video_file_url?: string | null
  transcribed_text?: string | null
  ai_extracted_department?: string | null
  ai_extracted_location?: string | null
  ai_extracted_device_name?: string | null
  ai_extracted_fault_description?: string | null
  ai_extracted_urgency?: string | null
  matched_device_id?: string | null
  matched_confidence?: string | number | null
  confirm_status: string
  converted_order_id?: string | null
  created_at: string
  updated_at: string
}

export type CandidateDevice = {
  device_id: string
  asset_code?: string | null
  device_name?: string | null
  department?: string | null
  location?: string | null
  confidence?: string | number | null
  display?: string | null
}

export type RepairAiExtractResult = {
  id: string
  message_id: string
  session_id?: string | null
  extracted_json?: Record<string, unknown>
  extracted_department?: string | null
  extracted_location?: string | null
  extracted_device_name?: string | null
  extracted_fault_description?: string | null
  extracted_fault_category?: string | null
  extracted_urgency?: string | null
  affects_clinical_use?: boolean | null
  suspected_emergency_device?: boolean | null
  suspected_life_support_device?: boolean | null
  matched_device_candidates?: { items?: CandidateDevice[] } | null
  matched_device_id?: string | null
  matched_confidence?: string | number | null
  confirmation_strategy?: string | null
  human_review_status?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  created_at?: string | null
}

export type RepairProgressOrder = {
  id: string
  order_code: string
  asset_id?: string | null
  status: string
  status_text?: string
  handler_id?: string | null
  current_progress?: string
  estimated_completion?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type RepairTimelineItem = {
  type: string
  title: string
  time?: string | null
  content?: string | null
  status?: string | null
  confidence?: string | number | null
}

export type RepairMessageBundle = {
  message: UnifiedRepairMessage
  latest_extract?: RepairAiExtractResult | null
  extract_results?: RepairAiExtractResult[]
  converted_order?: RepairProgressOrder | null
  timeline?: RepairTimelineItem[]
}

export type RepairCenterMessageList = Paged<UnifiedRepairMessage> & {
  stats?: RepairCenterStats
}

export type RepairCenterPendingList = Paged<RepairMessageBundle> & {
  stats?: RepairCenterStats
}

export type CreateRepairCenterMessageBody = {
  source_channel: string
  source_channel_name?: string | null
  sender_id?: string | null
  sender_name?: string | null
  sender_phone?: string | null
  sender_department?: string | null
  raw_message_type: string
  raw_message_content?: string | null
  voice_file_url?: string | null
  image_file_url?: string | null
  video_file_url?: string | null
  transcribed_text?: string | null
  asset_id?: string | null
  metadata?: Record<string, unknown> | null
}

export type ConfirmRepairMessageBody = {
  confirm_action: 'CREATE_ORDER' | 'SELECT_DEVICE' | 'NEED_MORE_INFO' | 'MANUAL_REVIEW' | 'IGNORE'
  selected_device_id?: string | null
  fault_description?: string | null
  urgency?: string | null
  affects_clinical_use?: boolean | null
  comment?: string | null
}

export type RepairChannelConfig = {
  id: string
  channel_name: string
  channel_type: string
  enabled: boolean
  robot_name?: string | null
  webhook_url?: string | null
  token_secret?: string | null
  callback_url?: string | null
  supported_message_types?: { items?: string[] } | string[] | null
  default_rule_code?: string | null
  bound_department_scope?: Record<string, unknown> | null
  bound_user_scope?: Record<string, unknown> | null
  allow_auto_create_order: boolean
  require_manual_confirm: boolean
  metadata?: Record<string, unknown> | null
  created_at?: string
  updated_at?: string
}

export type RepairRuleConfig = {
  id?: string
  rule_code?: string
  rule_name?: string
  enabled?: boolean
  allow_ai_auto_create_order?: boolean
  channel_confirm_rules?: Record<string, unknown> | null
  emergency_auto_upgrade?: boolean
  night_shift_notify?: boolean
  night_shift_time_range?: string | null
  dispatch_timeout_minutes?: number | null
  acceptance_timeout_hours?: number | null
  high_value_notify_threshold?: string | number | null
  repeat_repair_window_days?: number | null
  repeat_repair_threshold?: number | null
  life_support_spare_hint?: boolean
  allow_clinical_progress_view?: boolean
  metadata?: Record<string, unknown> | null
}

export type RepairAiSession = {
  id: string
  session_no: string
  source_channel?: string | null
  user_name?: string | null
  session_status: string
  current_intent?: string | null
  last_question?: string | null
}

function queryString(params: Record<string, string | number | boolean | null | undefined>) {
  const sp = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return
    sp.set(key, String(value))
  })
  const q = sp.toString()
  return q ? `?${q}` : ''
}

export function fetchRepairCenterWorkbench() {
  return apiRequest<{ stats: RepairCenterStats }>('/api/v1/repair-center/workbench')
}

export function fetchRepairCenterMessages(params: {
  page?: number
  page_size?: number
  source_channel?: string
  raw_message_type?: string
  sender_department?: string
  confirm_status?: string
  keyword?: string
  date_from?: string
  date_to?: string
} = {}) {
  return apiRequest<RepairCenterMessageList>(`/api/v1/repair-center/messages${queryString(params)}`)
}

export function createRepairCenterMessage(body: CreateRepairCenterMessageBody) {
  return apiRequest<RepairMessageBundle>('/api/v1/repair-center/messages', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function fetchRepairCenterMessageDetail(messageId: string) {
  return apiRequest<RepairMessageBundle>(`/api/v1/repair-center/messages/${encodeURIComponent(messageId)}`)
}

export function extractRepairMessage(messageId: string) {
  return apiRequest<RepairMessageBundle>(`/api/v1/repair-center/messages/${encodeURIComponent(messageId)}/ai-extract`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export function confirmRepairCenterMessage(messageId: string, body: ConfirmRepairMessageBody) {
  return apiRequest<{ message: UnifiedRepairMessage; converted_order?: RepairProgressOrder | null }>(
    `/api/v1/repair-center/messages/${encodeURIComponent(messageId)}/confirm`,
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export function assignRepairCenterReviewer(messageId: string, body: { reviewer_id: string; comment?: string | null }) {
  return apiRequest<UnifiedRepairMessage>(
    `/api/v1/repair-center/messages/${encodeURIComponent(messageId)}/assign-reviewer`,
    { method: 'POST', body: JSON.stringify(body) },
  )
}

export function fetchPendingRepairMessages(params: {
  page?: number
  page_size?: number
  source_channel?: string
  keyword?: string
} = {}) {
  return apiRequest<RepairCenterPendingList>(`/api/v1/repair-center/pending-confirmations${queryString(params)}`)
}

export function createRepairAiSession(body: { source_channel?: string; user_name?: string | null; current_intent?: string | null }) {
  return apiRequest<RepairAiSession>('/api/v1/repair-center/ai-sessions', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function appendRepairAiSessionMessage(
  sessionId: string,
  body: { raw_message_type?: string; content?: string | null; voice_file_url?: string | null; image_file_url?: string | null; action?: string | null },
) {
  return apiRequest<{
    session: RepairAiSession
    message: UnifiedRepairMessage
    latest_extract?: RepairAiExtractResult | null
    assistant_reply: string
    actions: string[]
  }>(`/api/v1/repair-center/ai-sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function fetchRepairProgress(params: { sender_id?: string; sender_phone?: string; order_code?: string; limit?: number }) {
  return apiRequest<{ items: RepairProgressOrder[]; total: number }>(`/api/v1/repair-center/progress${queryString(params)}`)
}

export function fetchRepairChannelConfigs(params: { channel_type?: string } = {}) {
  return apiRequest<{ items: RepairChannelConfig[]; total: number }>(
    `/api/v1/repair-center/channel-configs${queryString(params)}`,
  )
}

export function createRepairChannelConfig(body: Partial<RepairChannelConfig> & { channel_name: string; channel_type: string }) {
  return apiRequest<RepairChannelConfig>('/api/v1/repair-center/channel-configs', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function patchRepairChannelConfig(id: string, body: Partial<RepairChannelConfig>) {
  return apiRequest<RepairChannelConfig>(`/api/v1/repair-center/channel-configs/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export function fetchRepairRuleConfig() {
  return apiRequest<RepairRuleConfig>('/api/v1/repair-center/rule-config')
}

export function patchRepairRuleConfig(body: Partial<RepairRuleConfig>) {
  return apiRequest<RepairRuleConfig>('/api/v1/repair-center/rule-config', {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}
