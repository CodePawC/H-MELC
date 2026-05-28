/** docs/06 §六 */

import { apiRequest } from '../lib/api'

export type AiGatewayMeta = {
  module: string
  name: string
  paths: Record<string, string>
}

export function fetchAiGatewayMeta() {
  return apiRequest<AiGatewayMeta>('/api/v1/ai')
}

export type AiTaskType =
  | 'REPAIR_TRIAGE'
  | 'REPAIR_REPORT'
  | 'INVOICE_OCR'
  | 'DELIVERY_OCR'
  | 'PAYMENT_PRIORITY'
  | 'INCIDENT_ANALYSIS'
  | 'ROI_ANALYSIS'

export function createAiTask(body: { task_type: AiTaskType; payload?: Record<string, unknown> }) {
  return apiRequest<Record<string, unknown>>('/api/v1/ai/tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function fetchAiTask(taskId: string) {
  return apiRequest<Record<string, unknown>>(
    `/api/v1/ai/tasks/${encodeURIComponent(taskId)}`,
  )
}

export function fetchAiResult(resultId: string) {
  return apiRequest<Record<string, unknown>>(
    `/api/v1/ai/results/${encodeURIComponent(resultId)}`,
  )
}
