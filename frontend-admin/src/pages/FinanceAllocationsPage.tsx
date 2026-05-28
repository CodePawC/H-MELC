import { type FormEvent, useEffect, useState } from 'react'

import { fetchPayments } from '../api/finance'
import type { PaymentRow } from '../api/finance'
import { ApiClientError } from '../lib/api'

/** docs/05 部分付款分摊：数据来自付款登记中的 allocations（GET /finance/payments） */

export function FinanceAllocationsPage() {
  const [items, setItems] = useState<PaymentRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [organizationId, setOrganizationId] = useState('')
  const [appliedOrg, setAppliedOrg] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const pageSize = 20

  useEffect(() => {
    let cancel = false
    setLoading(true)
    setErr(null)
    ;(async () => {
      try {
        const data = await fetchPayments({
          page,
          page_size: pageSize,
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
  }, [page, appliedOrg])

  function onFilter(ev: FormEvent) {
    ev.preventDefault()
    setAppliedOrg(organizationId.trim())
    setPage(1)
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>部分付款分摊</h2>
        <form className="inline-search" onSubmit={onFilter}>
          <input
            placeholder="organization_id 可选"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            style={{ minWidth: 240 }}
          />
          <button type="submit" className="btn">
            应用
          </button>
        </form>
      </div>
      <p className="muted tiny">每条付款下的 invoice / payable 分摊明细与登记接口返回一致。</p>

      {err && <div className="banner danger">{err}</div>}
      {loading ? (
        <p>加载中…</p>
      ) : (
        <>
          <p className="muted tiny">
            共 <strong>{total}</strong> 笔付款 · 第 {page} / {Math.max(1, Math.ceil(total / pageSize))} 页
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>付款</th>
                  <th>日期</th>
                  <th>分摊行</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      无数据。
                    </td>
                  </tr>
                ) : (
                  items.flatMap((row) =>
                    row.allocations?.length
                      ? row.allocations.map((a) => (
                          <tr key={`${row.id}-${a.id}`}>
                            <td>{row.payment_amount}</td>
                            <td>{row.payment_date}</td>
                            <td className="tiny">
                              {a.invoice_id ? (
                                <>发票 {a.invoice_id} → {a.allocated_amount}</>
                              ) : a.payable_id ? (
                                <>应付 {a.payable_id} → {a.allocated_amount}</>
                              ) : (
                                a.allocated_amount
                              )}
                            </td>
                          </tr>
                        ))
                      : [
                          <tr key={row.id}>
                            <td>{row.payment_amount}</td>
                            <td>{row.payment_date}</td>
                            <td className="muted">无分摊行</td>
                          </tr>,
                        ],
                  )
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
