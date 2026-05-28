import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { fetchRepairDetail } from '../api/repairs'
import type {
  RepairAttachmentRow,
  RepairDetailBundlePayload,
  RepairDetailOrder,
  RepairRecordRow,
  RepairReportRow,
} from '../api/repairs'
import { ApiClientError } from '../lib/api'
import { RepairTicketOpsPanel } from './RepairTicketOpsPanel'

/** 对齐 docs/05 §维修管理 工单详情；接口 docs/06 §二·3 */

function ts(s: string | undefined | null) {
  if (!s) return '—'
  return String(s).replace('T', ' ').slice(0, 19)
}

function DetailField({ label, value }: { label: string; value: unknown }) {
  const v = value === null || value === undefined || value === '' ? '—' : String(value)
  return (
    <div className="detail-field">
      <span>{label}</span>
      <strong>{v}</strong>
    </div>
  )
}

function OrderOverview({ o }: { o: RepairDetailOrder }) {
  return (
    <div className="detail-pane">
      <section className="detail-section">
        <h4>工单与设备</h4>
        <div className="detail-grid">
          <DetailField label="工单号" value={o.order_code} />
          <DetailField label="状态" value={o.order_status} />
          <DetailField label="优先级" value={o.priority} />
          <DetailField label="资产 ID" value={o.asset_id} />
          <DetailField label="指派工程师" value={o.assigned_engineer_id ?? '—'} />
          <DetailField label="故障描述" value={o.fault_description ?? '—'} />
          <DetailField label="故障类型" value={o.fault_type ?? '—'} />
          <DetailField label="报修人" value={o.reporter_name ?? '—'} />
          <DetailField label="联系电话" value={o.reporter_phone ?? '—'} />
        </div>
        <p className="tiny" style={{ marginTop: '0.5rem' }}>
          <Link className="link-inline" to={`/lifecycle/assets/${o.asset_id}`}>
            打开设备详情
          </Link>
        </p>
      </section>
      <section className="detail-section">
        <h4>时间与费用</h4>
        <div className="detail-grid">
          <DetailField label="创建" value={ts(o.created_at)} />
          <DetailField label="接单" value={ts(o.accepted_at)} />
          <DetailField label="完成" value={ts(o.completed_at)} />
          <DetailField label="科室确认" value={ts(o.confirmed_at)} />
          <DetailField label="预估费用" value={o.estimated_cost ?? '—'} />
          <DetailField label="实际费用" value={o.actual_cost ?? '—'} />
          <DetailField label="外修" value={o.is_outsourced ? '是' : '否'} />
          <DetailField label="返厂" value={o.is_return_factory ? '是' : '否'} />
        </div>
      </section>
    </div>
  )
}

function AttachmentsTable({ rows }: { rows: RepairAttachmentRow[] }) {
  if (!rows.length) return <p className="muted">无附件记录。</p>
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>类型</th>
            <th>file_id</th>
            <th>说明</th>
            <th>上传时间</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>{a.file_type ?? '—'}</td>
              <td className="tiny mono">{a.file_id}</td>
              <td>{a.description ?? '—'}</td>
              <td className="tiny">{ts(a.uploaded_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RecordsTable({ rows }: { rows: RepairRecordRow[] }) {
  if (!rows.length) return <p className="muted">无过程记录。</p>
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>类型</th>
            <th>内容</th>
            <th>工程师</th>
            <th>时间</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.record_type ?? '—'}</td>
              <td className="tiny">{r.content ?? '—'}</td>
              <td>{r.engineer_name ?? r.engineer_id ?? '—'}</td>
              <td className="tiny">{ts(r.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReportBlock({ rep }: { rep: RepairReportRow }) {
  return (
    <dl className="meta-dl" style={{ maxWidth: '40rem' }}>
      <dt>故障原因</dt>
      <dd>{rep.fault_cause ?? '—'}</dd>
      <dt>维修方法</dt>
      <dd>{rep.repair_method ?? '—'}</dd>
      <dt>更换部件</dt>
      <dd>{rep.replaced_parts ?? '—'}</dd>
      <dt>测试结果</dt>
      <dd>{rep.test_result ?? '—'}</dd>
      <dt>结论</dt>
      <dd>{rep.conclusion ?? '—'}</dd>
      <dt>科室确认</dt>
      <dd>{rep.department_confirm_status ?? '—'}</dd>
    </dl>
  )
}

type TabId = 'overview' | 'attachments' | 'records' | 'report' | 'ops'

export function RepairTicketDetailPage() {
  const { repairOrderId } = useParams<{ repairOrderId: string }>()
  const nav = useNavigate()
  const [tab, setTab] = useState<TabId>('overview')
  const [data, setData] = useState<RepairDetailBundlePayload | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadDetail = useCallback(async () => {
    if (!repairOrderId) return
    setLoading(true)
    setErr(null)
    try {
      const bundle = await fetchRepairDetail(repairOrderId)
      setData(bundle)
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : String(e))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [repairOrderId])

  useEffect(() => {
    void loadDetail()
  }, [loadDetail])

  const order = data?.order
  const title = useMemo(() => order?.order_code ?? '工单详情', [order])

  if (!repairOrderId) {
    return (
      <div className="page">
        <p className="muted">缺少工单 ID。</p>
        <button type="button" className="btn" onClick={() => nav('/maintenance/tickets')}>
          返回列表
        </button>
      </div>
    )
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: '工单概览' },
    { id: 'attachments', label: '附件' },
    { id: 'records', label: '维修过程' },
    { id: 'report', label: '维修报告' },
    { id: 'ops', label: '运维动作' },
  ]

  return (
    <div className="page repair-detail-page">
      <div className="page-head">
        <div>
          <nav className="breadcrumb tiny muted">
            <Link to="/maintenance/tickets">报修工单</Link>
            <span> / </span>
            <span>详情</span>
          </nav>
          <h2>{title}</h2>
          {order && (
            <p className="muted tiny">
              状态 <strong>{order.order_status}</strong> · ID {order.id.slice(0, 8)}…
            </p>
          )}
        </div>
        <button type="button" className="btn ghost" onClick={() => nav('/maintenance/tickets')}>
          返回列表
        </button>
      </div>

      {err && <div className="banner danger">{err}</div>}

      {loading ? (
        <p>加载中…</p>
      ) : data && order ? (
        <>
          <div className="tab-bar" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`tab-btn${tab === t.id ? ' active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === 'overview' && <OrderOverview o={order} />}
          {tab === 'attachments' && <AttachmentsTable rows={data.attachments} />}
          {tab === 'records' && <RecordsTable rows={data.records} />}
          {tab === 'report' &&
            (data.report ? <ReportBlock rep={data.report} /> : <p className="muted">暂无报告记录。</p>)}
          {tab === 'ops' && (
            <RepairTicketOpsPanel repairOrderId={repairOrderId} order={order} onDone={loadDetail} />
          )}
        </>
      ) : null}
    </div>
  )
}
