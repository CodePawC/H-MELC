/** docs/06 §七 · /knowledge/documents · /chat */

import { apiRequest } from '../lib/api'
import type { Paged } from '../types/pagination'

export type KnowledgeRootMeta = { module: string; name: string }

export type KbDocumentRow = {
  id: string
  title: string
  source_type: string
  object_key?: string | null
  mime_type?: string | null
  file_size?: number | null
  created_by_user_id?: string | null
  created_at: string
}

export function fetchKnowledgeRootMeta() {
  return apiRequest<KnowledgeRootMeta>('/api/v1/knowledge')
}

export function fetchKbDocuments(params?: { page?: number; page_size?: number; keyword?: string }) {
  const sp = new URLSearchParams()
  if (params?.page) sp.set('page', String(params.page))
  if (params?.page_size) sp.set('page_size', String(params.page_size))
  if (params?.keyword?.trim()) sp.set('keyword', params.keyword.trim())
  const q = sp.toString()
  return apiRequest<Paged<KbDocumentRow>>(`/api/v1/knowledge/documents${q ? `?${q}` : ''}`)
}

export function fetchKbDocument(documentId: string) {
  return apiRequest<KbDocumentRow>(`/api/v1/knowledge/documents/${encodeURIComponent(documentId)}`)
}

/** §七·1：multipart；需 RBAC_KNOWLEDGE_WRITE；文件可选 */
export function uploadKbDocument(params: {
  title: string
  source_type?: string
  file?: File | null
}) {
  const fd = new FormData()
  fd.set('title', params.title.trim())
  fd.set('source_type', (params.source_type ?? 'UPLOAD').trim() || 'UPLOAD')
  if (params.file && params.file.size > 0) {
    fd.set('file', params.file)
  }
  return apiRequest<KbDocumentRow>('/api/v1/knowledge/documents', {
    method: 'POST',
    body: fd,
  })
}

export type KnowledgeChatReply = {
  stub: boolean
  interaction_id: string
  question: string
  scope: string
  answer: string
  references: { id?: string; title?: string }[]
  reference_search_degraded?: boolean
  note: string
}

export function knowledgeChat(question: string, scope = 'repair') {
  return apiRequest<KnowledgeChatReply>('/api/v1/knowledge/chat', {
    method: 'POST',
    body: JSON.stringify({ question, scope }),
  })
}
