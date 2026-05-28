import { type FormEvent, useCallback, useEffect, useState } from 'react'

import type { WorkflowModuleMeta, WfTaskRow } from '../api/workflows'
import {
  approveWorkflowTask,
  fetchMyWorkflowTasks,
  fetchWorkflowModuleMeta,
  rejectWorkflowTask,
  startWorkflow,
} from '../api/workflows'
import { ApiClientError } from '../lib/api'

/** 对齐 docs/05 系统管理·工作流 & docs/06 §八（待发流程、我的待办、审批） */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isoShort(s: string) {
  return s.replace('T', ' ').slice(0, 19)
}

export function WorkflowConsolePage() {
  const [meta, setMeta] = useState<WorkflowModuleMeta | null>(null)
  const [tasks, setTasks] = useState<WfTaskRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 15

  const [listErr, setListErr] = useState<string | null>(null)
  const [listLoading, setListLoading] = useState(true)
  const [flashOk, setFlashOk] = useState<string | null>(null)
  const [flashErr, setFlashErr] = useState<string | null>(null)

  const [actingId, setActingId] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, string>>({})

  const [pk, setPk] = useState('simple_approve_v1')
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState('')
  const [payloadText, setPayloadText] = useState('{}\n')
  const [startBusy, setStartBusy] = useState(false)
  const [startErr, setStartErr] = useState<string | null>(null)

  const loadTasks = useCallback(async () => {
    setListLoading(true)
    setListErr(null)
    try {
      const data = await fetchMyWorkflowTasks({ page, page_size: pageSize })
      setTasks(data.items)
      setTotal(data.total)
    } catch (e) {
      setListErr(e instanceof ApiClientError ? e.message : String(e))
      setTasks([])
      setTotal(0)
    } finally {
      setListLoading(false)
    }
  }, [page])

  useEffect(() => {
    let cancel = false
    fetchWorkflowModuleMeta()
      .then((m) => {
        if (!cancel) setMeta(m)
      })
      .catch(() => {})
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  function setComment(id: string, v: string) {
    setComments((c) => ({ ...c, [id]: v }))
  }

  async function onApprove(taskId: string) {
    setActingId(taskId)
    setFlashOk(null)
    setFlashErr(null)
    try {
      await approveWorkflowTask(taskId, comments[taskId]?.trim() || null)
      setFlashOk('已同意，流程已按 Phase 0 规则结单。')
      await loadTasks()
    } catch (e) {
      setFlashErr(e instanceof ApiClientError ? e.message : String(e))
    } finally {
      setActingId(null)
    }
  }

  async function onReject(taskId: string) {
    setActingId(taskId)
    setFlashOk(null)
    setFlashErr(null)
    try {
      await rejectWorkflowTask(taskId, comments[taskId]?.trim() || null)
      setFlashOk('已驳回，流程实例已标记取消。')
      await loadTasks()
    } catch (e) {
      setFlashErr(e instanceof ApiClientError ? e.message : String(e))
    } finally {
      setActingId(null)
    }
  }

  async function onStart(ev: FormEvent) {
    ev.preventDefault()
    setStartErr(null)
    setFlashOk(null)
    setFlashErr(null)
    let payload: Record<string, unknown> = {}
    const raw = payloadText.trim()
    if (raw) {
      try {
        payload = JSON.parse(raw) as Record<string, unknown>
        if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
          throw new Error('payload 须为 JSON 对象')
        }
      } catch (err) {
        setStartErr(err instanceof Error ? err.message : 'payload JSON 无效')
        return
      }
    }

    const a = assignee.trim()
    if (a && !UUID_RE.test(a)) {
      setStartErr('首任务处理人须为合法 UUID，或留空默认本人')
      return
    }

    setStartBusy(true)
    try {
      await startWorkflow({
        process_key: pk.trim(),
        title: title.trim(),
        payload,
        first_assignee_user_id: a && UUID_RE.test(a) ? a : undefined,
      })
      setFlashOk('流程已发起。')
      setTitle('')
      await loadTasks()
    } catch (e) {
      setStartErr(e instanceof ApiClientError ? e.message : String(e))
    } finally {
      setStartBusy(false)
    }
  }

  return (
    <div className="page workflow-console">
      <h2>工作流</h2>
      <p className="muted tiny">
        Phase 0 单笔待办完结即结单。接口见 <code>docs/06_接口设计/01_API接口设计.md</code> 第八节；迁移{' '}
        <code>e008_workflow_core</code>。
      </p>

      {meta?.paths && (
        <details className="wf-meta-details tiny muted">
          <summary>API 路径摘要</summary>
          <ul className="bullet">
            {Object.entries(meta.paths).map(([k, v]) => (
              <li key={k}>
                <code>{v}</code>
              </li>
            ))}
          </ul>
        </details>
      )}

      {flashOk && <div className="banner ok wf-flash">{flashOk}</div>}
      {flashErr && <div className="banner danger wf-flash">{flashErr}</div>}

      <section className="wf-panel">
        <h3>发起流程</h3>
        <p className="muted tiny">
          需角色含 <code>RBAC_WORKFLOW_START</code>（如 SYS_ADMIN、DEVICE_ADMIN、DEPT_USER）。首任务默认为本人。
        </p>
        {startErr && <div className="banner danger">{startErr}</div>}
        <form className="wf-start-form card-like" onSubmit={onStart}>
          <label>
            process_key
            <input value={pk} onChange={(e) => setPk(e.target.value)} required minLength={1} />
          </label>
          <label>
            标题 title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={1} />
          </label>
          <label>
            首任务处理人 UUID（可选）
            <input
              placeholder="留空则用当前登录用户 ID"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            />
          </label>
          <label>
            payload JSON
            <textarea rows={5} value={payloadText} onChange={(e) => setPayloadText(e.target.value)} />
          </label>
          <button type="submit" className="btn primary" disabled={startBusy}>
            {startBusy ? '提交中…' : '发起'}
          </button>
        </form>
      </section>

      <section className="wf-panel">
        <h3>我的待办</h3>
        <p className="muted tiny">需 <code>RBAC_WORKFLOW_TASK_READ</code>（与资产只读对齐）。DEVICE_ADMIN/SYS_ADMIN 可代审批。</p>
        {listErr && <div className="banner danger">{listErr}</div>}
        {listLoading ? (
          <p>加载中…</p>
        ) : (
          <>
            <p className="muted tiny">
              共 <strong>{total}</strong> 条 · 第 {page} / {Math.max(1, Math.ceil(total / pageSize))} 页
            </p>
            <div className="table-wrap">
              <table className="data-table wf-task-table">
                <thead>
                  <tr>
                    <th>摘要</th>
                    <th>实例</th>
                    <th>指派</th>
                    <th>创建时间</th>
                    <th>意见 / 操作</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted">
                        暂无待办或未迁 workflow 库。
                      </td>
                    </tr>
                  ) : (
                    tasks.map((t) => (
                      <tr key={t.id}>
                        <td>{t.summary ?? '—'}</td>
                        <td className="tiny mono">{t.instance_id.slice(0, 8)}…</td>
                        <td className="tiny mono">{t.assignee_user_id.slice(0, 8)}…</td>
                        <td className="tiny">{isoShort(String(t.created_at))}</td>
                        <td>
                          <textarea
                            className="wf-task-comment"
                            rows={2}
                            placeholder="审批意见（可选）"
                            value={comments[t.id] ?? ''}
                            onChange={(e) => setComment(t.id, e.target.value)}
                          />
                          <div className="wf-task-actions">
                            <button
                              type="button"
                              className="btn primary tiny-btn"
                              disabled={actingId === t.id}
                              onClick={() => onApprove(t.id)}
                            >
                              同意
                            </button>
                            <button
                              type="button"
                              className="btn tiny-btn"
                              disabled={actingId === t.id}
                              onClick={() => onReject(t.id)}
                            >
                              驳回
                            </button>
                          </div>
                        </td>
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
      </section>
    </div>
  )
}
