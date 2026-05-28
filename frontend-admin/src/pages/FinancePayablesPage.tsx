import { type FormEvent, useEffect, useState } from 'react'

import { fetchPayables } from '../api/finance'
import type { PayableRow } from '../api/finance'
import { ApiClientError } from '../lib/api'

/** docs/05 应付款台账 · GET /api/v1/finance/payables */

export function FinancePayablesPage() {
  const [items, setItems] = useState<PayableRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [organizationId, setOrganizationId] = useState('')
  const [status, setStatus] = useState('')
  const [appliedOrg, setAppliedOrg] = useState('')
  const [appliedStatus, setAppliedStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const pageSize = 20

  useEffect(() => {
    let cancel = false
    setLoading(true)
    setErr(null)
    ;(async () => {
      try {
        const data = await fetchPayables({
          page,
          page_size: pageSize,
          organization_id: appliedOrg || undefined,
          status: appliedStatus || undefined,
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
  }, [page, appliedOrg, appliedStatus])

  function onFilter(ev: FormEvent) {
    ev.preventDefault()
    setAppliedOrg(organizationId.trim())
    setAppliedStatus(status.trim())
    setPage(1)
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>应付款台账</h2>
        <form className="inline-search" onSubmit={onFilter} style={{ flexWrap: 'wrap' }}>
          <input
            placeholder="organization_id 可选"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            style={{ minWidth: 240 }}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">全部状态</option>
            <option value="OPEN">OPEN</option>
            <option value="CLOSED">CLOSED</option>
            <option value="ALL">ALL（显式）</option>
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
                  <th>摘要</th>
                  <th>应付</th>
                  <th>已付</th>
                  <th>余额</th>
                  <th>到期日</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      无数据。
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.title}</td>
                      <td>{row.amount_due}</td>
                      <td>{row.amount_paid}</td>
                      <td>{row.balance}</td>
                      <td>{row.due_date ?? '—'}</td>
                      <td>{row.status}</td>
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
