import { type FormEvent, useEffect, useState } from 'react'

import { fetchAuditLogs } from '../api/audit'
import type { AuditLogRow } from '../api/audit'
import { ApiClientError } from '../lib/api'

/** docs/05 审计日志 · GET /api/v1/audit/logs（§九，需 AUDIT_ADMIN 或 SYS_ADMIN） */

export function AuditLogsPage() {
  const [items, setItems] = useState<AuditLogRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [actionInput, setActionInput] = useState('')
  const [usernameInput, setUsernameInput] = useState('')
  const [appliedAction, setAppliedAction] = useState('')
  const [appliedUsername, setAppliedUsername] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const pageSize = 20

  useEffect(() => {
    let cancel = false
    setLoading(true)
    setErr(null)
    ;(async () => {
      try {
        const data = await fetchAuditLogs({
          page,
          page_size: pageSize,
          action: appliedAction || undefined,
          username: appliedUsername || undefined,
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
  }, [page, appliedAction, appliedUsername])

  function onSearch(ev: FormEvent) {
    ev.preventDefault()
    setAppliedAction(actionInput.trim())
    setAppliedUsername(usernameInput.trim())
    setPage(1)
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>审计日志</h2>
        <form className="inline-search" onSubmit={onSearch}>
          <input placeholder="用户名 模糊" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} />
          <input placeholder="action 模糊" value={actionInput} onChange={(e) => setActionInput(e.target.value)} />
          <button type="submit" className="btn">
            检索
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
                  <th>时间</th>
                  <th>用户</th>
                  <th>角色</th>
                  <th>动作</th>
                  <th>对象</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      无数据、无权限或未迁 e004_audit。
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id}>
                      <td className="tiny">{row.created_at.replace('T', ' ').slice(0, 19)}</td>
                      <td>{row.username ?? '—'}</td>
                      <td className="tiny">{row.role_code ?? '—'}</td>
                      <td>{row.action}</td>
                      <td className="tiny muted">
                        {(row.object_type ?? '—') + (row.object_id ? ` ${row.object_id.slice(0, 8)}…` : '')}
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
    </div>
  )
}
