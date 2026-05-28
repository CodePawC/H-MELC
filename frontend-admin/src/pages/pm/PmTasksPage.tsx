import { type FormEvent, useEffect, useState } from 'react'
import { Alert, Button, Input } from 'antd'

import { completePmTask, fetchPmTasks, type PmTaskRow } from '../../api/pm'
import type { PersonMaster } from '../../api/mdm'
import { OrgMasterSelector } from '../../components/OrgMasterSelector'
import { PageScaffold } from '../../components/hospital/PageScaffold'
import { IS_AUTH_MOCK } from '../../config/authMode'
import { ApiClientError } from '../../lib/api'
import { MOCK_PM } from '../../mock/hospital/tables'

/** docs/06 · 十 · PM 任务与登记完成 */
export function PmTasksPage() {
  const [items, setItems] = useState<PmTaskRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [statusF, setStatusF] = useState('')
  const [appliedSt, setAppliedSt] = useState('')
  const pageSize = 20

  const [completeId, setCompleteId] = useState('')
  const [summary, setSummary] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [personSelectorOpen, setPersonSelectorOpen] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<PersonMaster | null>(null)

  useEffect(() => {
    if (IS_AUTH_MOCK) {
      setLoading(false)
      setItems([])
      setTotal(0)
      return
    }
    let c = false
    setLoading(true)
    setErr(null)
    ;(async () => {
      try {
        const data = await fetchPmTasks({
          page,
          page_size: pageSize,
          task_status: appliedSt || undefined,
        })
        if (!c) {
          setItems(data.items)
          setTotal(data.total)
        }
      } catch (e) {
        if (!c) {
          setErr(e instanceof ApiClientError ? e.message : String(e))
          setItems([])
          setTotal(0)
        }
      } finally {
        if (!c) setLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [page, appliedSt])

  function onFilter(ev: FormEvent) {
    ev.preventDefault()
    setAppliedSt(statusF.trim())
    setPage(1)
  }

  async function doComplete(taskId: string) {
    setBusyId(taskId)
    setErr(null)
    try {
      await completePmTask(taskId, {
        result_summary: summary.trim() || null,
        mdm_person_id: selectedPerson?.id ?? undefined,
        person_code: selectedPerson?.code ?? undefined,
        person_name: selectedPerson?.name ?? undefined,
        person_source: selectedPerson ? 'h-mdm' : undefined,
        person_version: selectedPerson?.version ?? undefined,
      })
      setSummary('')
      const data = await fetchPmTasks({
        page,
        page_size: pageSize,
        task_status: appliedSt || undefined,
      })
      setItems(data.items)
      setTotal(data.total)
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  async function onCompleteManual(ev: FormEvent) {
    ev.preventDefault()
    const id = completeId.trim()
    if (!id) return
    await doComplete(id)
    setCompleteId('')
  }

  return (
    <PageScaffold title="保养任务" description="GET /api/v1/pm/tasks · POST .../complete（工程师登记执行）">
      {IS_AUTH_MOCK ? (
        <Alert type="info" showIcon style={{ marginBottom: 16 }} message="演示模式" />
      ) : null}
      {!IS_AUTH_MOCK && err ? <Alert type="warning" showIcon style={{ marginBottom: 16 }} description={err} /> : null}

      {!IS_AUTH_MOCK ? (
        <form className="inline-search" onSubmit={onFilter} style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <Input placeholder="task_status 如 PENDING、OVERDUE" value={statusF} onChange={(e) => setStatusF(e.target.value)} />
          <Button htmlType="submit">筛选</Button>
        </form>
      ) : null}

      {loading ? (
        <p>加载中…</p>
      ) : IS_AUTH_MOCK ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>计划</th>
                <th>科室</th>
                <th>下次</th>
                <th>工程师</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_PM.map((r) => (
                <tr key={r.id}>
                  <td>{r.planName}</td>
                  <td>{r.dept}</td>
                  <td>{r.nextDate}</td>
                  <td>{r.engineer}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>
            <Input.TextArea
              placeholder="完成备注（可选，批量用于下列「登记完成」）"
              rows={2}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              style={{ maxWidth: 560 }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, maxWidth: 560 }}>
              <Input readOnly placeholder="执行人来自 H-UMDG 人员主数据" value={selectedPerson ? `${selectedPerson.name}（${selectedPerson.employeeNo || selectedPerson.code}）` : ''} />
              <Button onClick={() => setPersonSelectorOpen(true)}>选择执行人</Button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>任务 ID</th>
                  <th>计划</th>
                  <th>到期日</th>
                  <th>执行人</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontSize: 11 }}>{r.id}</td>
                    <td style={{ fontSize: 11 }}>{r.plan_id}</td>
                    <td>{r.due_date}</td>
                    <td>{r.person_name || r.assigned_engineer_id || '—'}</td>
                    <td>{r.task_status}</td>
                    <td>
                      <Button
                        size="small"
                        type="primary"
                        disabled={r.task_status === 'DONE' || busyId === r.id}
                        loading={busyId === r.id}
                        onClick={() => doComplete(r.id)}
                      >
                        登记完成
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted tiny">
            共 {total} 条 · 第 {page} 页
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              上一页
            </Button>
            <Button disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>
              下一页
            </Button>
          </div>
          <form onSubmit={onCompleteManual} style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Input placeholder="按 UUID 完成任务" value={completeId} onChange={(e) => setCompleteId(e.target.value)} style={{ maxWidth: 360 }} />
            <Button htmlType="submit">按 ID 完成</Button>
          </form>
        </>
      )}
      <OrgMasterSelector
        open={personSelectorOpen}
        kind="person"
        personType="设备工程师"
        value={selectedPerson}
        onCancel={() => setPersonSelectorOpen(false)}
        onSelect={(row) => {
          setSelectedPerson(row as PersonMaster)
          setPersonSelectorOpen(false)
        }}
      />
    </PageScaffold>
  )
}
