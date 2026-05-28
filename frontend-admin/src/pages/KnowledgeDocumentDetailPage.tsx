import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { fetchKbDocument } from '../api/knowledge'
import type { KbDocumentRow } from '../api/knowledge'
import { ApiClientError } from '../lib/api'

/** GET /api/v1/knowledge/documents/{id} §七·4 */

export function KnowledgeDocumentDetailPage() {
  const { documentId } = useParams<{ documentId: string }>()
  const nav = useNavigate()
  const [row, setRow] = useState<KbDocumentRow | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!documentId) return
    let c = false
    setLoading(true)
    setErr(null)
    setRow(null)
    ;(async () => {
      try {
        const d = await fetchKbDocument(documentId)
        if (!c) setRow(d)
      } catch (e) {
        if (!c) setErr(e instanceof ApiClientError ? e.message : String(e))
      } finally {
        if (!c) setLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [documentId])

  if (!documentId) {
    return (
      <div className="page">
        <p className="muted">缺少文档 ID。</p>
        <button type="button" className="btn" onClick={() => nav('/knowledge/repair-cases')}>
          返回列表
        </button>
      </div>
    )
  }

  return (
    <div className="page knowledge-detail">
      <div className="page-head">
        <nav className="breadcrumb tiny muted">
          <Link to="/knowledge/repair-cases">知识中心</Link>
          <span> / </span>
          <span>文档</span>
        </nav>
        <button type="button" className="btn ghost" onClick={() => nav(-1)}>
          返回
        </button>
      </div>
      <h2>{row?.title ?? '知识文档'}</h2>
      {err && <div className="banner danger">{err}</div>}
      {loading ? (
        <p>加载中…</p>
      ) : row ? (
        <dl className="meta-dl" style={{ maxWidth: '36rem' }}>
          <dt>ID</dt>
          <dd className="tiny mono">{row.id}</dd>
          <dt>来源类型</dt>
          <dd>{row.source_type}</dd>
          <dt>对象键</dt>
          <dd className="tiny muted">{row.object_key ?? '—'}</dd>
          <dt>MIME</dt>
          <dd>{row.mime_type ?? '—'}</dd>
          <dt>大小</dt>
          <dd>{row.file_size ?? '—'}</dd>
          <dt>上传人</dt>
          <dd className="tiny">{row.created_by_user_id ?? '—'}</dd>
          <dt>创建时间</dt>
          <dd>{String(row.created_at).replace('T', ' ').slice(0, 19)}</dd>
        </dl>
      ) : null}
    </div>
  )
}
