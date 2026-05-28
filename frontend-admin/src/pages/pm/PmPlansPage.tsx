import { type FormEvent, useEffect, useState } from 'react'
import { Alert, Button, Input } from 'antd'

import { createPmPlan, fetchPmPlans, type PmPlanRow } from '../../api/pm'
import type { DepartmentMaster } from '../../api/mdm'
import { OrgMasterSelector } from '../../components/OrgMasterSelector'
import { PageScaffold } from '../../components/hospital/PageScaffold'
import { IS_AUTH_MOCK } from '../../config/authMode'
import { ApiClientError } from '../../lib/api'
import { MOCK_PM } from '../../mock/hospital/tables'

/** docs/06 · 十 · PM 计划；Mock 下展示演示行 */
export function PmPlansPage() {
  const [items, setItems] = useState<PmPlanRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [kw, setKw] = useState('')
  const [appliedKw, setAppliedKw] = useState('')
  const pageSize = 20

  const [title, setTitle] = useState('')
  const [assetId, setAssetId] = useState('')
  const [freq, setFreq] = useState<'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'YEARLY'>('QUARTERLY')
  const [nextDue, setNextDue] = useState(() => new Date().toISOString().slice(0, 10))
  const [createBusy, setCreateBusy] = useState(false)
  const [createMsg, setCreateMsg] = useState<string | null>(null)
  const [departmentSelectorOpen, setDepartmentSelectorOpen] = useState(false)
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentMaster | null>(null)

  useEffect(() => {
    if (IS_AUTH_MOCK) {
      setLoading(false)
      setErr(null)
      setItems([])
      setTotal(0)
      return
    }
    let c = false
    setLoading(true)
    setErr(null)
    ;(async () => {
      try {
        const data = await fetchPmPlans({ page, page_size: pageSize, keyword: appliedKw || undefined })
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
  }, [page, appliedKw])

  function onFilter(ev: FormEvent) {
    ev.preventDefault()
    setAppliedKw(kw.trim())
    setPage(1)
  }

  async function onCreate(ev: FormEvent) {
    ev.preventDefault()
    setCreateMsg(null)
    if (!title.trim() || !assetId.trim()) {
      setCreateMsg('请填写计划标题与 asset_id（台账 UUID）')
      return
    }
    setCreateBusy(true)
    try {
      await createPmPlan({
        title: title.trim(),
        asset_id: assetId.trim(),
        frequency: freq,
        next_due_date: nextDue,
        plan_status: 'ACTIVE',
        mdm_department_id: selectedDepartment?.id ?? undefined,
        department_code: selectedDepartment?.code ?? undefined,
        department_name: selectedDepartment?.name ?? undefined,
        department_source: selectedDepartment ? 'h-mdm' : undefined,
        department_version: selectedDepartment?.version ?? undefined,
      })
      setCreateMsg('已创建')
      setTitle('')
      setPage(1)
      const data = await fetchPmPlans({ page: 1, page_size: pageSize, keyword: appliedKw || undefined })
      setItems(data.items)
      setTotal(data.total)
    } catch (e) {
      setCreateMsg(e instanceof ApiClientError ? e.message : String(e))
    } finally {
      setCreateBusy(false)
    }
  }

  return (
    <PageScaffold
      title="保养计划"
      description="GET/POST /api/v1/pm/plans。新建计划需绑定已在库的台账 asset_id。"
    >
      {IS_AUTH_MOCK ? (
        <Alert type="info" showIcon style={{ marginBottom: 16 }} message="演示模式" description="关闭 Mock 登录后可对接后端 PM 接口。" />
      ) : null}
      {!IS_AUTH_MOCK && err ? (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }} message="接口提示" description={err} />
      ) : null}

      <form className="inline-search" onSubmit={onFilter} style={{ marginBottom: 16, flexWrap: 'wrap', display: 'flex', gap: 8 }}>
        <Input placeholder="名称/编码关键字" value={kw} onChange={(e) => setKw(e.target.value)} style={{ maxWidth: 260 }} />
        <Button htmlType="submit">筛选</Button>
      </form>

      {loading ? (
        <p>加载中…</p>
      ) : IS_AUTH_MOCK ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>计划</th>
                <th>科室</th>
                <th>周期</th>
                <th>下次</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_PM.map((r) => (
                <tr key={r.id}>
                  <td>{r.planName}</td>
                  <td>{r.dept}</td>
                  <td>{r.cycle}</td>
                  <td>{r.nextDate}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <p className="muted tiny">
            共 <strong>{total}</strong> 条 · 第 {page} 页
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>asset_id</th>
                  <th>责任科室</th>
                  <th>周期</th>
                  <th>下次到期</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id}>
                    <td>{r.title}</td>
                    <td style={{ fontSize: 12 }}>{r.asset_id}</td>
                    <td>{r.department_name || r.owner_department_id || '—'}</td>
                    <td>{r.frequency}</td>
                    <td>{r.next_due_date}</td>
                    <td>{r.plan_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <Button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              上一页
            </Button>
            <Button disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>
              下一页
            </Button>
          </div>
        </>
      )}

      {!IS_AUTH_MOCK ? (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
          <h4 style={{ marginBottom: 12 }}>新建计划</h4>
          <form onSubmit={onCreate} style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 480 }}>
            <Input placeholder="计划标题" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder="台账 asset_id（UUID）" value={assetId} onChange={(e) => setAssetId(e.target.value)} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Input readOnly placeholder="责任科室来自 H-UMDG" value={selectedDepartment ? `${selectedDepartment.name}（${selectedDepartment.code}）` : ''} />
              <Button onClick={() => setDepartmentSelectorOpen(true)}>选择科室</Button>
            </div>
            <select value={freq} onChange={(e) => setFreq(e.target.value as typeof freq)}>
              <option value="MONTHLY">MONTHLY</option>
              <option value="QUARTERLY">QUARTERLY</option>
              <option value="SEMI_ANNUAL">SEMI_ANNUAL</option>
              <option value="YEARLY">YEARLY</option>
            </select>
            <Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
            <Button type="primary" htmlType="submit" loading={createBusy}>
              提交创建
            </Button>
            {createMsg ? <span className="muted tiny">{createMsg}</span> : null}
          </form>
        </div>
      ) : null}
      <OrgMasterSelector
        open={departmentSelectorOpen}
        kind="department"
        value={selectedDepartment}
        onCancel={() => setDepartmentSelectorOpen(false)}
        onSelect={(row) => {
          setSelectedDepartment(row as DepartmentMaster)
          setDepartmentSelectorOpen(false)
        }}
      />
    </PageScaffold>
  )
}
