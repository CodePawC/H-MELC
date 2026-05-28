import { useEffect, useState } from 'react'
import { Alert } from 'antd'

import { fetchPmOverdueAlerts, type PmOverdueAlert } from '../../api/pm'
import { PageScaffold } from '../../components/hospital/PageScaffold'
import { IS_AUTH_MOCK } from '../../config/authMode'
import { ApiClientError } from '../../lib/api'
import { MOCK_PM } from '../../mock/hospital/tables'

/** docs/06 · 十 · GET /api/v1/pm/alerts/overdue */
export function PmAlertsPage() {
  const [items, setItems] = useState<PmOverdueAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (IS_AUTH_MOCK) {
      setLoading(false)
      return
    }
    let c = false
    setLoading(true)
    setErr(null)
    ;(async () => {
      try {
        const data = await fetchPmOverdueAlerts(200)
        if (!c) setItems(data.items)
      } catch (e) {
        if (!c) {
          setErr(e instanceof ApiClientError ? e.message : String(e))
          setItems([])
        }
      } finally {
        if (!c) setLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [])

  return (
    <PageScaffold title="逾期提醒" description="PM 保养任务与巡检任务中超期未完成的摘要列表。">
      {IS_AUTH_MOCK ? (
        <Alert type="info" showIcon style={{ marginBottom: 16 }} message="演示模式" description="以下为演示保养数据中含逾期标记的行。" />
      ) : null}
      {!IS_AUTH_MOCK && err ? <Alert type="warning" showIcon style={{ marginBottom: 16 }} description={err} /> : null}

      {loading ? (
        <p>加载中…</p>
      ) : IS_AUTH_MOCK ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>计划</th>
                <th>逾期(天)</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_PM.filter((r) => r.overdueDays > 0).map((r) => (
                <tr key={r.id}>
                  <td>{r.planName}</td>
                  <td>{r.overdueDays}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>类型</th>
                <th>task_id</th>
                <th>due_date</th>
                <th>asset_id</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={`${r.type}-${r.task_id}`}>
                  <td>{r.type}</td>
                  <td style={{ fontSize: 11 }}>{r.task_id}</td>
                  <td>{r.due_date}</td>
                  <td style={{ fontSize: 11 }}>{r.asset_id ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageScaffold>
  )
}
