import { type FormEvent, useEffect, useState } from 'react'

import { fetchQualifications } from '../api/suppliers'
import type { QualificationRow } from '../api/suppliers'
import { ApiClientError } from '../lib/api'

/** docs/05 · GET /api/v1/suppliers/qualifications（§三·7） */

export function SupplierQualificationsPage() {
  const [items, setItems] = useState<QualificationRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [reviewStatus, setReviewStatus] = useState('')
  const [organizationId, setOrganizationId] = useState('')
  const [appliedOrg, setAppliedOrg] = useState('')
  const [appliedReview, setAppliedReview] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const pageSize = 20

  useEffect(() => {
    let cancel = false
    setLoading(true)
    setErr(null)
    ;(async () => {
      try {
        const data = await fetchQualifications({
          page,
          page_size: pageSize,
          review_status: appliedReview || undefined,
          organization_id: appliedOrg || undefined,
        })
        if (!cancel) {
          setItems(data.items)
          setTotal(data.total)
        }
      } catch (e) {
        if (!cancel) {
          setErr(e instanceof ApiClientError ? e.message : String(e))
          setItems([])
          setTotal(0)
        }
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [page, appliedOrg, appliedReview])

  function onFilter(ev: FormEvent) {
    ev.preventDefault()
    setAppliedOrg(organizationId.trim())
    setAppliedReview(reviewStatus.trim())
    setPage(1)
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>供应商资质</h2>
        <form className="inline-search" onSubmit={onFilter} style={{ flexWrap: 'wrap' }}>
          <input
            placeholder="organization_id 可选"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            style={{ minWidth: 260 }}
          />
          <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
            <option value="">审核状态不限</option>
            <option value="PENDING">PENDING</option>
            <option value="ACCEPTED">ACCEPTED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="ALL">ALL</option>
          </select>
          <button type="submit" className="btn">
            应用
          </button>
        </form>
      </div>

      {err && <div className="banner danger">{err}</div>}
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
                  <th>供应商名称</th>
                  <th>资质标题</th>
                  <th>类型</th>
                  <th>审核</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      无数据或未迁 supplier 资质。
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.organization_legal_name ?? row.organization_id.slice(0, 8)}</td>
                      <td>{row.title}</td>
                      <td className="tiny">{row.credential_type ?? '—'}</td>
                      <td>{row.review_status}</td>
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
