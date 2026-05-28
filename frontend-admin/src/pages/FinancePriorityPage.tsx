import { useState } from 'react'

import { postPaymentPriorityAi } from '../api/finance'
import { ApiClientError } from '../lib/api'

/** docs/05 付款优先级 · POST /api/v1/finance/payment-priority/ai-analyze（§五·8 占位 AI） */

export function FinancePriorityPage() {
  const [supplierId, setSupplierId] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [json, setJson] = useState<string | null>(null)

  async function run() {
    setErr(null)
    setJson(null)
    setBusy(true)
    try {
      const sid = supplierId.trim()
      const uuidOk =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sid)
      const data = await postPaymentPriorityAi(uuidOk ? { supplier_id: sid } : {})
      setJson(JSON.stringify(data, null, 2))
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <h2>付款优先级</h2>
      <p className="muted tiny">调用院内占位 AI 任务，返回 task / result 信封内结构（需 RBAC 财务可读）。</p>

      <div className="page-head" style={{ marginTop: '1rem' }}>
        <div className="inline-search" style={{ flexWrap: 'wrap' }}>
          <input
            placeholder="supplier.organization_id（可选，过滤待发队列）"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            style={{ minWidth: 320 }}
          />
          <button type="button" className="btn primary" disabled={busy} onClick={run}>
            {busy ? '分析中…' : '运行 AI 分析'}
          </button>
        </div>
      </div>

      {err && <div className="banner danger">{err}</div>}
      {json && (
        <pre
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: '#fff',
            border: '1px solid #e8eaef',
            borderRadius: 8,
            fontSize: '0.82rem',
            overflow: 'auto',
          }}
        >
          {json}
        </pre>
      )}
      <p className="muted tiny" style={{ marginTop: '1rem' }}>
        AI 产出仅供参考；最终付款决策以院内制度为准。
      </p>
    </div>
  )
}
