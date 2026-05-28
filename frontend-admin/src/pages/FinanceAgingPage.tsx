import { type FormEvent, useEffect, useState } from 'react'

import { fetchAgingAnalysis } from '../api/finance'
import type { AgingPayload } from '../api/finance'
import { ApiClientError } from '../lib/api'

/** docs/05 账龄分析 · GET /api/v1/finance/aging-analysis */

export function FinanceAgingPage() {
  const [organizationId, setOrganizationId] = useState('')
  const [appliedOrg, setAppliedOrg] = useState('')
  const [data, setData] = useState<AgingPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    setLoading(true)
    setErr(null)
    ;(async () => {
      try {
        const res = await fetchAgingAnalysis(appliedOrg.trim() || undefined)
        if (!cancel) setData(res)
      } catch (e) {
        if (!cancel) {
          setErr(e instanceof ApiClientError ? e.message : String(e))
          setData(null)
        }
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [appliedOrg])

  function apply(ev: FormEvent) {
    ev.preventDefault()
    setAppliedOrg(organizationId.trim())
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>账龄分析</h2>
        <form className="inline-search" onSubmit={apply}>
          <input
            placeholder="按供应商 organization_id 过滤（可选）"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            style={{ minWidth: 280 }}
          />
          <button type="submit" className="btn">
            查询
          </button>
        </form>
      </div>

      {err && <div className="banner danger">{err}</div>}
      {loading ? (
        <p>加载中…</p>
      ) : data ? (
        <>
          <p className="muted tiny">
            截止 <strong>{data.as_of}</strong> · 未结清笔数 {data.open_count} · 敞口合计 {data.open_total}
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>区间</th>
                  <th>笔数</th>
                  <th>金额</th>
                </tr>
              </thead>
              <tbody>
                {data.buckets.map((b) => (
                  <tr key={b.code}>
                    <td>{b.label}</td>
                    <td>{b.open_count}</td>
                    <td>{b.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
