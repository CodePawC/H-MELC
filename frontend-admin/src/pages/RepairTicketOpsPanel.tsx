import { type FormEvent, useEffect, useState } from 'react'

import { fetchMe } from '../api/auth'
import {
  addRepairRecord,
  assignRepair,
  claimRepair,
  completeRepair,
  confirmRepair,
  markRepairOutsourcing,
  markRepairReturnFactory,
} from '../api/repairs'
import type { RepairDetailOrder } from '../api/repairs'
import { ApiClientError } from '../lib/api'

/** 对齐 docs/06_接口设计/01 §二·4～8 §三·1～2；RBAC 以后端为准 */

const PENDING_DISPATCH = 'PENDING_DISPATCH'
const ASSIGNED = 'ASSIGNED'
const IN_PROGRESS = 'IN_PROGRESS'
const AWAIT_CONFIRM = 'AWAIT_CONFIRM'
const CLOSED = 'CLOSED'

type Props = {
  repairOrderId: string
  order: RepairDetailOrder
  onDone: () => Promise<void>
}

export function RepairTicketOpsPanel({ repairOrderId, order, onDone }: Props) {
  const st = order.order_status

  const [meId, setMeId] = useState('')
  const [engineerId, setEngineerId] = useState('')
  useEffect(() => {
    let c = false
    fetchMe()
      .then((m) => {
        if (!c && m.id) {
          setMeId(m.id)
          setEngineerId((prev) => (prev.trim() ? prev : m.id))
        }
      })
      .catch(() => {})
    return () => {
      c = true
    }
  }, [])

  const [assignReason, setAssignReason] = useState('')
  const [recType, setRecType] = useState('NOTE')
  const [recContent, setRecContent] = useState('')
  const [recName, setRecName] = useState('')

  const [faultCause, setFaultCause] = useState('')
  const [repairMethod, setRepairMethod] = useState('')
  const [replacedParts, setReplacedParts] = useState('')
  const [testResult, setTestResult] = useState('')
  const [conclusion, setConclusion] = useState('')
  const [actualCost, setActualCost] = useState('')

  const [confirmStatus, setConfirmStatus] = useState<'ACCEPTED' | 'REJECTED'>('ACCEPTED')
  const [confirmComment, setConfirmComment] = useState('')

  const [busy, setBusy] = useState(false)
  const [panelErr, setPanelErr] = useState<string | null>(null)
  const [panelOk, setPanelOk] = useState<string | null>(null)

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true)
    setPanelErr(null)
    setPanelOk(null)
    try {
      await fn()
      setPanelOk(`${label} 成功`)
      await onDone()
    } catch (e: unknown) {
      setPanelErr(e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function engineerOrThrow(): string {
    const id = engineerId.trim()
    if (!id) throw new Error('请填写工程师用户 ID（可填顶部登录账号对应 ID，取自 /auth/me）。')
    return id
  }

  async function onClaim(ev: FormEvent) {
    ev.preventDefault()
    let id: string
    try {
      id = engineerOrThrow()
    } catch (e) {
      setPanelErr(e instanceof Error ? e.message : String(e))
      return
    }
    await run('抢单', () => claimRepair(repairOrderId, { engineer_id: id }))
  }

  async function onAssign(ev: FormEvent) {
    ev.preventDefault()
    let id: string
    try {
      id = engineerOrThrow()
    } catch (e) {
      setPanelErr(e instanceof Error ? e.message : String(e))
      return
    }
    const reason = assignReason.trim() || undefined
    await run('派单', () => assignRepair(repairOrderId, { engineer_id: id, reason }))
  }

  async function onRecord(ev: FormEvent) {
    ev.preventDefault()
    await run('登记过程', () =>
      addRepairRecord(repairOrderId, {
        record_type: recType.trim() || 'NOTE',
        content: recContent.trim() || null,
        engineer_id: engineerId.trim() || null,
        engineer_name: recName.trim() || null,
      }),
    )
  }

  async function onComplete(ev: FormEvent) {
    ev.preventDefault()
    let cost: number | undefined
    const raw = actualCost.trim()
    if (raw) {
      const n = Number(raw)
      if (Number.isNaN(n)) {
        setPanelErr('实际费用请输入数字')
        return
      }
      cost = n
    }
    await run('完成维修', () =>
      completeRepair(repairOrderId, {
        fault_cause: faultCause.trim() || null,
        repair_method: repairMethod.trim() || null,
        replaced_parts: replacedParts.trim() || null,
        test_result: testResult.trim() || null,
        conclusion: conclusion.trim() || null,
        ...(cost !== undefined ? { actual_cost: cost } : {}),
      }),
    )
  }

  async function onConfirm(ev: FormEvent) {
    ev.preventDefault()
    await run('科室确认', () =>
      confirmRepair(repairOrderId, {
        confirm_status: confirmStatus,
        department_confirm_by: meId.trim() || null,
        comment: confirmComment.trim() || null,
      }),
    )
  }

  if (st === CLOSED) {
    return (
      <div className="detail-pane">
        <p className="muted">工单已关闭，仅可查看历史数据。</p>
      </div>
    )
  }

  return (
    <div className="detail-pane repair-ops">
      <p className="muted tiny">
        各动作对应后端 RBAC（工程师操作、派单、科室确认、扩展外修标记等）；状态不符或权限不足时接口返回{' '}
        <strong>409 / 403</strong>，以下文案会展示报错信息。
      </p>
      <p className="tiny" style={{ marginBottom: '1rem' }}>
        当前用户 ID（<code>/auth/me</code>）：<span className="mono tiny">{meId || '—'}</span>
      </p>

      {panelErr && <div className="banner danger">{panelErr}</div>}
      {panelOk && <div className="banner success">{panelOk}</div>}

      <section className="wf-panel">
        <h4>工程师 ID</h4>
        <p className="muted tiny">用于抢单 / 强制派单；登记过程时可留空或由后端推导。</p>
        <input
          className="full-width-ish"
          value={engineerId}
          onChange={(e) => setEngineerId(e.target.value)}
          placeholder="UUID"
          style={{ maxWidth: 420 }}
        />
      </section>

      {st === PENDING_DISPATCH && (
        <section className="wf-panel">
          <h4>待派工时</h4>
          <form className="stack-form tiny" onSubmit={onClaim}>
            <button type="submit" className="btn primary" disabled={busy}>
              抢单
            </button>
          </form>
          <form className="stack-form tiny" onSubmit={onAssign} style={{ marginTop: '0.75rem' }}>
            <label>
              派单原因（可选）
              <input value={assignReason} onChange={(e) => setAssignReason(e.target.value)} placeholder="可选" />
            </label>
            <button type="submit" className="btn" disabled={busy}>
              强制派单
            </button>
          </form>
        </section>
      )}

      {st === ASSIGNED && (
        <section className="wf-panel">
          <h4>改派</h4>
          <p className="muted tiny">已指派状态下可再次指派其他工程师。</p>
          <form className="stack-form tiny" onSubmit={onAssign}>
            <label>
              原因（可选）
              <input value={assignReason} onChange={(e) => setAssignReason(e.target.value)} />
            </label>
            <button type="submit" className="btn" disabled={busy}>
              改派
            </button>
          </form>
        </section>
      )}

      {(st === ASSIGNED || st === IN_PROGRESS) && (
        <>
          <section className="wf-panel">
            <h4>登记维修过程</h4>
            <form className="stack-form tiny" onSubmit={onRecord}>
              <label>
                记录类型
                <input value={recType} onChange={(e) => setRecType(e.target.value)} />
              </label>
              <label>
                内容
                <textarea rows={3} value={recContent} onChange={(e) => setRecContent(e.target.value)} />
              </label>
              <label>
                工程师姓名（可选）
                <input value={recName} onChange={(e) => setRecName(e.target.value)} />
              </label>
              <button type="submit" className="btn" disabled={busy}>
                提交记录
              </button>
            </form>
          </section>

          <section className="wf-panel">
            <h4>完成维修 · 写入报告概要</h4>
            <form className="stack-form tiny" onSubmit={onComplete}>
              <label>
                故障原因
                <input value={faultCause} onChange={(e) => setFaultCause(e.target.value)} />
              </label>
              <label>
                维修方法
                <input value={repairMethod} onChange={(e) => setRepairMethod(e.target.value)} />
              </label>
              <label>
                更换部件
                <input value={replacedParts} onChange={(e) => setReplacedParts(e.target.value)} />
              </label>
              <label>
                测试结果
                <input value={testResult} onChange={(e) => setTestResult(e.target.value)} />
              </label>
              <label>
                结论
                <textarea rows={2} value={conclusion} onChange={(e) => setConclusion(e.target.value)} />
              </label>
              <label>
                实际费用（可选）
                <input value={actualCost} onChange={(e) => setActualCost(e.target.value)} placeholder="数字" />
              </label>
              <button type="submit" className="btn primary" disabled={busy}>
                结案并等待科室确认
              </button>
            </form>
          </section>
        </>
      )}

      {st === AWAIT_CONFIRM && (
        <section className="wf-panel">
          <h4>科室确认</h4>
          <form className="stack-form tiny" onSubmit={onConfirm}>
            <div className="radio-row tiny">
              <label>
                <input
                  type="radio"
                  name="confirm"
                  checked={confirmStatus === 'ACCEPTED'}
                  onChange={() => setConfirmStatus('ACCEPTED')}
                />{' '}
                验收通过 ACCEPTED
              </label>
              <label>
                <input
                  type="radio"
                  name="confirm"
                  checked={confirmStatus === 'REJECTED'}
                  onChange={() => setConfirmStatus('REJECTED')}
                />{' '}
                退回 REJECTED
              </label>
            </div>
            <label>
              意见（可选）
              <textarea rows={2} value={confirmComment} onChange={(e) => setConfirmComment(e.target.value)} />
            </label>
            <button type="submit" className="btn primary" disabled={busy}>
              提交确认
            </button>
          </form>
        </section>
      )}

      <section className="wf-panel">
        <h4>外修 / 返厂标记</h4>
        <p className="muted tiny">仅置位标志位；需 RBAC_REPAIR_EXTENDED_WORK。</p>
        <div className="btn-row" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => run('外修标记', () => markRepairOutsourcing(repairOrderId))}
          >
            标记外修
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() => run('返厂标记', () => markRepairReturnFactory(repairOrderId))}
          >
            标记返厂
          </button>
        </div>
      </section>
    </div>
  )
}
