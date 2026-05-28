import { type FormEvent, useEffect, useState } from 'react'
import { Alert, Button, Input } from 'antd'

import { fetchPmInspectionTasks, submitPmInspectionRecord, type PmInspectionTaskRow } from '../../api/pm'
import { PageScaffold } from '../../components/hospital/PageScaffold'
import { IS_AUTH_MOCK } from '../../config/authMode'
import { ApiClientError } from '../../lib/api'

/** docs/06 · 十 · 巡检任务列表与提交记录（一期最小表单） */
export function PmInspectionPage() {
  const [items, setItems] = useState<PmInspectionTaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [taskId, setTaskId] = useState('')
  const [checklistJson, setChecklistJson] = useState('{\n  "passed": true\n}')
  const [remark, setRemark] = useState('')
  const [busy, setBusy] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)

  function reload() {
    if (IS_AUTH_MOCK) {
      setLoading(false)
      return
    }
    setLoading(true)
    setErr(null)
    void (async () => {
      try {
        const data = await fetchPmInspectionTasks({ page: 1, page_size: 50 })
        setItems(data.items)
      } catch (e) {
        setErr(e instanceof ApiClientError ? e.message : String(e))
        setItems([])
      } finally {
        setLoading(false)
      }
    })()
  }

  useEffect(() => {
    if (IS_AUTH_MOCK) {
      setLoading(false)
      return
    }
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅挂载拉取
  }, [])

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault()
    setFlash(null)
    const id = taskId.trim()
    if (!id) return
    let checklist: Record<string, unknown>
    try {
      checklist = JSON.parse(checklistJson) as Record<string, unknown>
      if (!checklist || typeof checklist !== 'object' || Array.isArray(checklist)) throw new Error('JSON 须为对象')
    } catch (e) {
      setFlash(e instanceof Error ? e.message : 'JSON 无效')
      return
    }
    setBusy(true)
    try {
      await submitPmInspectionRecord(id, { checklist_result: checklist, remark: remark.trim() || null })
      setFlash('已提交')
      setTaskId('')
      reload()
    } catch (e) {
      setFlash(e instanceof ApiClientError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <PageScaffold title="巡检记录" description="GET /api/v1/pm/inspection-tasks · POST .../records">
      {IS_AUTH_MOCK ? (
        <Alert type="info" showIcon style={{ marginBottom: 16 }} message="演示模式" description="关闭 Mock 后可提交后端巡检记录（需库内已有巡检任务）。" />
      ) : null}
      {!IS_AUTH_MOCK && err ? <Alert type="warning" showIcon style={{ marginBottom: 16 }} description={err} /> : null}

      {loading ? (
        <p>加载中…</p>
      ) : !IS_AUTH_MOCK ? (
        <>
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>类型</th>
                  <th>到期</th>
                  <th>状态</th>
                  <th>ID</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td>{r.inspection_type}</td>
                    <td>{r.due_date}</td>
                    <td>{r.task_status}</td>
                    <td style={{ fontSize: 10 }}>{r.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 style={{ marginBottom: 8 }}>提交巡检结果</h4>
          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 560 }}>
            <Input placeholder="inspection_task_id（UUID）" value={taskId} onChange={(e) => setTaskId(e.target.value)} />
            <Input.TextArea rows={6} value={checklistJson} onChange={(e) => setChecklistJson(e.target.value)} />
            <Input placeholder="备注（可选）" value={remark} onChange={(e) => setRemark(e.target.value)} />
            <Button type="primary" htmlType="submit" loading={busy}>
              提交
            </Button>
            {flash ? <span className="muted tiny">{flash}</span> : null}
          </form>
        </>
      ) : (
        <p className="muted tiny">演示环境下无后端巡检任务。</p>
      )}
    </PageScaffold>
  )
}
