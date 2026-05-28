import { type FormEvent, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { fetchRepairs } from '../api/repairs'
import type { RepairListQueryParams, RepairRow } from '../api/repairs'
import type { DepartmentMaster, PersonMaster } from '../api/mdm'
import { OrgMasterSelector } from '../components/OrgMasterSelector'
import { ApiClientError } from '../lib/api'
import {
  DISPATCH_STATUS_ALL,
  dispatchFiltersFromSearchParams,
  searchParamsFromDispatchFilters,
} from '../lib/repairListUrlSync'

/** docs/05 维修管理 · 工程师派单；列表 docs/06 §二·2，派单动作 §二·4～5 在工单详情 */

function shorten(s: string) {
  return s.length > 48 ? `${s.slice(0, 45)}…` : s
}

const DISPATCH_STATUS_OPTIONS = [
  'PENDING_DISPATCH',
  'ASSIGNED',
  'IN_PROGRESS',
  'AWAIT_CONFIRM',
  'CLOSED',
] as const

function listQueryFromActive(
  active: Omit<RepairListQueryParams, 'page' | 'page_size'>,
  page: number,
  pageSize: number,
): RepairListQueryParams {
  const q: RepairListQueryParams = {
    page,
    page_size: pageSize,
    ...(active.order_status && active.order_status !== DISPATCH_STATUS_ALL
      ? { order_status: active.order_status }
      : {}),
    ...(active.asset_id?.trim() ? { asset_id: active.asset_id.trim() } : {}),
    ...(active.department_id?.trim() ? { department_id: active.department_id.trim() } : {}),
    ...(active.assigned_engineer_id?.trim()
      ? { assigned_engineer_id: active.assigned_engineer_id.trim() }
      : {}),
    ...(active.priority?.trim() ? { priority: active.priority.trim() } : {}),
    ...(active.date_from?.trim() ? { date_from: active.date_from.trim() } : {}),
    ...(active.date_to?.trim() ? { date_to: active.date_to.trim() } : {}),
  }
  return q
}

export function RepairDispatchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState<RepairRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  const [form, setForm] = useState(() => dispatchFiltersFromSearchParams(searchParams))
  const [active, setActive] = useState(() => dispatchFiltersFromSearchParams(searchParams))

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [orgSelector, setOrgSelector] = useState<'department' | 'engineer' | null>(null)
  const [departmentLabel, setDepartmentLabel] = useState('')
  const [engineerLabel, setEngineerLabel] = useState('')

  const pageSize = 20

  useEffect(() => {
    const fromUrl = dispatchFiltersFromSearchParams(searchParams)
    setForm(fromUrl)
    setActive(fromUrl)
    setPage(1)
  }, [searchParams])

  useEffect(() => {
    let cancel = false
    setLoading(true)
    setErr(null)
    const q = listQueryFromActive(active, page, pageSize)
    ;(async () => {
      try {
        const data = await fetchRepairs(q)
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
  }, [
    page,
    active.order_status,
    active.asset_id,
    active.department_id,
    active.assigned_engineer_id,
    active.priority,
    active.date_from,
    active.date_to,
  ])

  function filterSubmit(ev: FormEvent) {
    ev.preventDefault()
    setSearchParams(searchParamsFromDispatchFilters(form), { replace: true })
  }

  function resetFilters() {
    setSearchParams({}, { replace: true })
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>工程师派单</h2>
      </div>
      <p className="muted tiny">
        默认展示 <strong>待派单</strong>（<code>PENDING_DISPATCH</code>）；抢单与强制派单在工单详情（
        <code>{'POST /repairs/{id}/claim'}</code>、<code>{'POST /repairs/{id}/assign'}</code>
        ）。筛选与地址栏同步规则同报修工单列表。
      </p>

      <section className="wf-panel repair-filter-panel">
        <h3 className="tiny">筛选</h3>
        <form className="repair-filter-form" onSubmit={filterSubmit}>
          <label className="tiny">
            工单状态
            <select
              value={
                form.order_status === DISPATCH_STATUS_ALL
                  ? DISPATCH_STATUS_ALL
                  : (form.order_status?.trim() || 'PENDING_DISPATCH')
              }
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  order_status: e.target.value,
                }))
              }
            >
              <option value="PENDING_DISPATCH">待派单 PENDING_DISPATCH</option>
              <option value="ASSIGNED">已指派 ASSIGNED</option>
              <option value="IN_PROGRESS">进行中 IN_PROGRESS</option>
              <option value="AWAIT_CONFIRM">待科室确认 AWAIT_CONFIRM</option>
              <option value="CLOSED">已关闭 CLOSED</option>
              <option value={DISPATCH_STATUS_ALL}>不限状态</option>
              {form.order_status &&
              form.order_status !== DISPATCH_STATUS_ALL &&
              !(DISPATCH_STATUS_OPTIONS as readonly string[]).includes(form.order_status) ? (
                <option value={form.order_status}>{form.order_status}（来自 URL）</option>
              ) : null}
            </select>
          </label>
          <label className="tiny">
            设备 asset_id
            <input
              placeholder="UUID"
              value={form.asset_id ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, asset_id: e.target.value }))}
            />
          </label>
          <label className="tiny">
            当前所在科室（H-UMDG）
            <div style={{ display: 'flex', gap: 6 }}>
              <input readOnly placeholder="从 H-UMDG 选择科室" value={departmentLabel || form.department_id || ''} />
              <button type="button" className="btn ghost" onClick={() => setOrgSelector('department')}>选择</button>
            </div>
          </label>
          <label className="tiny">
            维修工程师（H-UMDG）
            <div style={{ display: 'flex', gap: 6 }}>
              <input readOnly placeholder="从 H-UMDG 选择设备工程师" value={engineerLabel || form.assigned_engineer_id || ''} />
              <button type="button" className="btn ghost" onClick={() => setOrgSelector('engineer')}>选择</button>
            </div>
          </label>
          <label className="tiny">
            优先级
            <input
              placeholder="优先级"
              value={form.priority ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
            />
          </label>
          <label className="tiny">
            创建日起
            <input
              type="date"
              value={form.date_from ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, date_from: e.target.value }))}
            />
          </label>
          <label className="tiny">
            创建日止
            <input
              type="date"
              value={form.date_to ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, date_to: e.target.value }))}
            />
          </label>
          <div className="repair-filter-actions">
            <button type="submit" className="btn">
              应用筛选
            </button>
            <button type="button" className="btn ghost" onClick={resetFilters}>
              重置为待派单
            </button>
          </div>
        </form>
      </section>

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
                  <th>工单号</th>
                  <th>状态</th>
                  <th>指派工程师</th>
                  <th>优先级</th>
                  <th>设备</th>
                  <th>故障描述</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      无数据或未迁库（e003 repair）。
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <Link className="link-inline" to={`/maintenance/tickets/${row.id}`}>
                          {row.order_code}
                        </Link>
                      </td>
                      <td>{row.order_status}</td>
                      <td className="muted tiny" title={row.assigned_engineer_id ?? ''}>
                        {row.assigned_engineer_id
                          ? `${row.assigned_engineer_id.slice(0, 8)}…`
                          : '—'}
                      </td>
                      <td>{row.priority ?? '—'}</td>
                      <td className="muted tiny">
                        <Link className="link-inline" title={row.asset_id} to={`/lifecycle/assets/${row.asset_id}`}>
                          {row.asset_id.slice(0, 8)}…
                        </Link>
                      </td>
                      <td title={row.fault_description ?? ''}>{shorten(row.fault_description ?? '—')}</td>
                      <td className="tiny">{row.created_at.replace('T', ' ').slice(0, 19)}</td>
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
      <OrgMasterSelector
        open={orgSelector === 'department'}
        kind="department"
        onCancel={() => setOrgSelector(null)}
        onSelect={(row) => {
          const dept = row as DepartmentMaster
          setForm((f) => ({ ...f, department_id: dept.id }))
          setDepartmentLabel(`${dept.name}（${dept.code}）`)
          setOrgSelector(null)
        }}
      />
      <OrgMasterSelector
        open={orgSelector === 'engineer'}
        kind="person"
        personType="设备工程师"
        onCancel={() => setOrgSelector(null)}
        onSelect={(row) => {
          const person = row as PersonMaster
          setForm((f) => ({ ...f, assigned_engineer_id: person.id }))
          setEngineerLabel(`${person.name}（${person.employeeNo || person.code}）`)
          setOrgSelector(null)
        }}
      />
    </div>
  )
}
