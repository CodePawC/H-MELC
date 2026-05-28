import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import {
  fetchKbDocuments,
  fetchKnowledgeRootMeta,
  knowledgeChat,
  uploadKbDocument,
} from '../api/knowledge'
import type { KbDocumentRow, KnowledgeChatReply, KnowledgeRootMeta } from '../api/knowledge'
import { KNOWLEDGE_ROUTE_TITLE } from '../navigation/knowledge'
import { ApiClientError } from '../lib/api'

/** docs/05 知识中心各菜单共用文档列表 §七；`/knowledge/qa` 附带占位问答表单 */

export function KnowledgeDocumentsPage() {
  const { pathname } = useLocation()
  const title = KNOWLEDGE_ROUTE_TITLE[pathname] ?? '知识中心文档'

  const [meta, setMeta] = useState<KnowledgeRootMeta | null>(null)
  const [items, setItems] = useState<KbDocumentRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 20

  const [keyword, setKeyword] = useState('')
  const [appliedKw, setAppliedKw] = useState('')

  const [listErr, setListErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [qa, setQa] = useState('')
  const [qaBusy, setQaBusy] = useState(false)
  const [qaErr, setQaErr] = useState<string | null>(null)
  const [qaReply, setQaReply] = useState<KnowledgeChatReply | null>(null)

  const [upTitle, setUpTitle] = useState('')
  const [upSourceType, setUpSourceType] = useState('UPLOAD')
  const [upFile, setUpFile] = useState<File | null>(null)
  const [upBusy, setUpBusy] = useState(false)
  const [upErr, setUpErr] = useState<string | null>(null)
  const [upCreatedId, setUpCreatedId] = useState<string | null>(null)
  const [upFileInputKey, setUpFileInputKey] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setListErr(null)
    try {
      const data = await fetchKbDocuments({
        page,
        page_size: pageSize,
        keyword: appliedKw.trim() || undefined,
      })
      setItems(data.items)
      setTotal(data.total)
    } catch (e) {
      setListErr(e instanceof ApiClientError ? e.message : String(e))
      setItems([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, appliedKw])

  useEffect(() => {
    let c = false
    fetchKnowledgeRootMeta()
      .then((m) => {
        if (!c) setMeta(m)
      })
      .catch(() => {})
    return () => {
      c = true
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function onSearch(ev: FormEvent) {
    ev.preventDefault()
    setAppliedKw(keyword.trim())
    setPage(1)
  }

  const showQaPanel = pathname === '/knowledge/qa'
  const lead = useMemo(
    () =>
      meta
        ? `模块 ${meta.name}。当前菜单「${title}」与文档类目尚未在后端一一映射，列表为全库分页检索（keyword）。`
        : null,
    [meta, title],
  )

  async function askQuestion(ev: FormEvent) {
    ev.preventDefault()
    const q = qa.trim()
    if (!q) return
    setQaBusy(true)
    setQaErr(null)
    setQaReply(null)
    try {
      const r = await knowledgeChat(q)
      setQaReply(r)
    } catch (e) {
      setQaErr(e instanceof ApiClientError ? e.message : String(e))
    } finally {
      setQaBusy(false)
    }
  }

  /** §七·POST /knowledge/documents multipart；RBAC_KNOWLEDGE_WRITE */
  async function submitUpload(ev: FormEvent) {
    ev.preventDefault()
    const title = upTitle.trim()
    if (!title) {
      setUpErr('请填写题名。')
      return
    }
    setUpBusy(true)
    setUpErr(null)
    setUpCreatedId(null)
    try {
      const row = await uploadKbDocument({
        title,
        source_type: upSourceType.trim() || 'UPLOAD',
        file: upFile,
      })
      setUpCreatedId(row.id)
      setUpTitle('')
      setUpSourceType('UPLOAD')
      setUpFile(null)
      setUpFileInputKey((k) => k + 1)
      await load()
    } catch (e) {
      setUpErr(e instanceof ApiClientError ? e.message : String(e))
    } finally {
      setUpBusy(false)
    }
  }

  return (
    <div className="page knowledge-page">
      <h2>{title}</h2>
      {lead && <p className="muted tiny">{lead}</p>}

      {showQaPanel && (
        <section className="wf-panel">
          <h3>占位智能问答 · POST /knowledge/chat</h3>
          <p className="muted tiny">真 RAG 由 ai-service 承接；以下为文档题名关键词占位参考。</p>
          {qaErr && <div className="banner danger">{qaErr}</div>}
          <form className="kb-qa-form" onSubmit={askQuestion}>
            <textarea rows={4} placeholder="输入问题…" value={qa} onChange={(e) => setQa(e.target.value)} />
            <button type="submit" className="btn primary" disabled={qaBusy}>
              {qaBusy ? '请求中…' : '提问'}
            </button>
          </form>
          {qaReply && (
            <div className="kb-qa-reply card-like">
              <p>{qaReply.answer}</p>
              {qaReply.references?.length > 0 && (
                <>
                  <h4 className="tiny">参考文献</h4>
                  <ul className="bullet tiny">
                    {qaReply.references.map((ref, i) => (
                      <li key={String(ref.id ?? `${ref.title ?? ''}-${i}`)}>
                        {ref.id ? (
                          <Link to={`/knowledge/documents/${String(ref.id)}`}>
                            {ref.title ?? String(ref.id)}
                          </Link>
                        ) : (
                          (ref.title ?? '条目')
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className="muted tiny">{qaReply.note}</p>
            </div>
          )}
        </section>
      )}

      <section className="wf-panel kb-upload-panel">
        <h3>上传文档</h3>
        <p className="muted tiny">需 RBAC_KNOWLEDGE_WRITE；文件可选（≤25MB，见后端校验）。PostgreSQL + e007 知识中心迁库未就绪时将返回错误。</p>
        {upErr && <div className="banner danger">{upErr}</div>}
        {upCreatedId && (
          <div className="banner success tiny">
            已创建。
            <Link className="link-inline" style={{ marginLeft: 8 }} to={`/knowledge/documents/${upCreatedId}`}>
              打开详情
            </Link>
          </div>
        )}
        <form className="kb-upload-form inline-search" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: '0.75rem' }} onSubmit={submitUpload}>
          <label className="tiny" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            题名
            <input value={upTitle} onChange={(e) => setUpTitle(e.target.value)} placeholder="题名" style={{ minWidth: 220 }} />
          </label>
          <label className="tiny" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            来源类型
            <input
              value={upSourceType}
              onChange={(e) => setUpSourceType(e.target.value)}
              placeholder="UPLOAD"
              style={{ width: 120 }}
            />
          </label>
          <label className="tiny" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            附件
            <input
              key={upFileInputKey}
              type="file"
              onChange={(e) => {
                const f = e.target.files?.[0]
                setUpFile(f ?? null)
              }}
            />
          </label>
          <button type="submit" className="btn primary" disabled={upBusy}>
            {upBusy ? '上传中…' : '提交'}
          </button>
        </form>
      </section>

      <div className="page-head">
        <h3 className="knowledge-doc-list-title">文档列表</h3>
        <form className="inline-search" onSubmit={onSearch}>
          <input
            placeholder="题名/关键词"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          <button type="submit" className="btn">
            检索
          </button>
        </form>
      </div>

      {listErr && <div className="banner danger">{listErr}</div>}

      {loading ? (
        <p>加载中…</p>
      ) : (
        <>
          <p className="muted tiny">
            共 <strong>{total}</strong> 条 · 第 {page} / {Math.max(1, Math.ceil(total / pageSize))} 页
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>来源类型</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      无数据、无 RBAC_KNOWLEDGE_READ 或未迁 e007。
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link className="link-inline" to={`/knowledge/documents/${row.id}`}>
                          {row.title}
                        </Link>
                      </td>
                      <td>{row.source_type}</td>
                      <td className="tiny">{String(row.created_at).replace('T', ' ').slice(0, 19)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              上一页
            </button>
            <button
              type="button"
              className="btn"
              disabled={page * pageSize >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </button>
          </div>
        </>
      )}
    </div>
  )
}
