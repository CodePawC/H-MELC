import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Descriptions, Drawer, Empty, Space, Spin, Table, Tabs, Tag, Timeline, Typography } from 'antd'

import { fetchAssetDetail } from '../../api/assets'
import type { AssetDetailBundle } from '../../api/assets'
import { ApiClientError } from '../../lib/api'
import type { AssetArchiveDisplayRow } from './assetArchiveEnrichment'
import { enrichAssetRow, formatArchiveAssetCode } from './assetArchiveEnrichment'
import {
  mockAttachmentGallery,
  mockCalRows,
  mockContractRows,
  mockLifecycleTimeline,
  mockPmRows,
} from './assetArchiveDrawerMock'

const { Text } = Typography

const ORDER_STATUS_TAG: Record<string, string> = {
  PENDING_DISPATCH: '待派工',
  ASSIGNED: '已派工',
  IN_PROGRESS: '维修中',
  AWAIT_CONFIRM: '待确认',
  CLOSED: '已闭环',
}

function moneyCn(v: unknown): string {
  if (v == null || v === '') return '—'
  const n = Number(v)
  return Number.isFinite(n) ? `¥ ${n.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` : String(v)
}

function repairColumns() {
  return [
    {
      title: '工单编号',
      dataIndex: 'order_code',
      width: 140,
      render: (t: string) => (
        <Text copyable style={{ fontFamily: 'ui-monospace, monospace' }}>
          {t}
        </Text>
      ),
    },
    {
      title: '故障描述',
      dataIndex: 'fault_description',
      ellipsis: true,
      render: (t: string | null) => t ?? '—',
    },
    {
      title: '维修人员',
      width: 120,
      render: (_: unknown, r: Record<string, unknown>) => {
        const id = r.assigned_engineer_id as string | undefined
        return id ? `工程师 (${id.slice(0, 8)}…)` : '—'
      },
    },
    {
      title: '维修费用',
      width: 110,
      dataIndex: 'actual_cost',
      render: (_: unknown, r: Record<string, unknown>) =>
        moneyCn(r.actual_cost ?? r.estimated_cost ?? null),
    },
    {
      title: '维修日期',
      width: 120,
      dataIndex: 'completed_at',
      render: (t: string | null, r: Record<string, unknown>) =>
        (t ?? r.created_at ?? '').toString().slice(0, 10) || '—',
    },
    {
      title: '状态',
      width: 96,
      dataIndex: 'order_status',
      render: (s: string) => <Tag>{ORDER_STATUS_TAG[s] ?? s}</Tag>,
    },
    {
      title: '操作',
      width: 72,
      fixed: 'right' as const,
      render: (_: unknown, r: Record<string, unknown>) => (
        <Link to={`/maintenance/tickets/${String(r.id)}`}>详情</Link>
      ),
    },
  ]
}

type Props = {
  open: boolean
  assetId: string | null
  previewRow: AssetArchiveDisplayRow | null
  onClose: () => void
}

/** 设备档案详情 Drawer：宽度 960px，Tabs 覆盖全生命周期（接口未返回部分使用演示数据）。 */
export function AssetArchiveDrawer({ open, assetId, previewRow, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [bundle, setBundle] = useState<AssetDetailBundle | null>(null)

  useEffect(() => {
    if (!open || !assetId) {
      setBundle(null)
      setErr(null)
      return
    }
    let c = false
    setLoading(true)
    setErr(null)
    ;(async () => {
      try {
        const b = await fetchAssetDetail(assetId)
        if (!c) setBundle(b)
      } catch (e) {
        if (!c) {
          setBundle(null)
          setErr(e instanceof ApiClientError ? e.message : String(e))
        }
      } finally {
        if (!c) setLoading(false)
      }
    })()
    return () => {
      c = true
    }
  }, [open, assetId])

  const row: AssetArchiveDisplayRow | null = useMemo(() => {
    if (bundle?.asset) return enrichAssetRow(bundle.asset)
    return previewRow
  }, [bundle, previewRow])

  const titleName = row?.asset_name ?? '设备档案'

  const pmRows = row ? mockPmRows(row) : []
  const calRows = row ? mockCalRows(row) : []
  const contractRows = row ? mockContractRows(row) : []
  const attachments = row ? mockAttachmentGallery(row) : []
  const lifecycle = row ? mockLifecycleTimeline(row) : []

  return (
    <Drawer
      title={`设备档案详情 - ${titleName}`}
      placement="right"
      width={960}
      onClose={onClose}
      open={open}
      destroyOnClose
      styles={{ body: { paddingTop: 12 } }}
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin tip="加载档案详情…" />
        </div>
      )}
      {!loading && err && (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          showIcon
          message="详情接口暂不可用"
          description={
            previewRow ? (
              <span>
                {err} — 已使用列表快照展示下方标签页；维修记录等以后端返回为准。
              </span>
            ) : (
              err
            )
          }
        />
      )}
      {!loading && row && (
        <>
          <Space wrap size={[8, 8]} style={{ marginBottom: 16 }}>
            <Tag color={row.run_display === '在用' ? 'green' : row.run_display === '维修中' ? 'blue' : 'default'}>
              {row.run_display}
            </Tag>
            <Tag color={row.risk_display === '高风险' ? 'red' : row.risk_display === '中风险' ? 'orange' : 'green'}>
              {row.risk_display}
            </Tag>
            <Tag
              color={
                row.metrology_display === '已过期'
                  ? 'red'
                  : row.metrology_display === '即将到期'
                    ? 'orange'
                    : row.metrology_display === '不适用'
                      ? 'default'
                      : 'green'
              }
            >
              计量：{row.metrology_display}
            </Tag>
            <Tag>科室：{row.department_name}</Tag>
            <Tag>责任人：{row.owner_name}</Tag>
          </Space>

          <Tabs
            items={[
              {
                key: 'base',
                label: '基础信息',
                children: (
                  <Descriptions column={2} bordered size="small">
                    <Descriptions.Item label="资产编号">
                      <Text copyable code>
                        {formatArchiveAssetCode(row.asset_code, row.id)}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="设备名称">{row.asset_name}</Descriptions.Item>
                    <Descriptions.Item label="规格型号">{row.spec_model}</Descriptions.Item>
                    <Descriptions.Item label="品牌厂家">{row.brand_vendor}</Descriptions.Item>
                    <Descriptions.Item label="生产厂家">{row.manufacturer_full}</Descriptions.Item>
                    <Descriptions.Item label="序列号">{row.serial_number ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="注册证号">{row.registration_no ?? '—'}</Descriptions.Item>
                    <Descriptions.Item label="设备分类">{row.category_label}</Descriptions.Item>
                    <Descriptions.Item label="管理类别">{row.management_class}</Descriptions.Item>
                    <Descriptions.Item label="原值">{moneyCn(row.original_value)}</Descriptions.Item>
                    <Descriptions.Item label="购置日期">{row.purchase_display}</Descriptions.Item>
                    <Descriptions.Item label="启用日期">{row.install_display}</Descriptions.Item>
                    <Descriptions.Item label="使用年限">{row.service_years} 年（演示）</Descriptions.Item>
                  </Descriptions>
                ),
              },
              {
                key: 'usage',
                label: '使用信息',
                children: (
                  <Descriptions column={2} bordered size="small">
                    <Descriptions.Item label="使用科室">{row.department_name}</Descriptions.Item>
                    <Descriptions.Item label="存放地点">{row.location_text}</Descriptions.Item>
                    <Descriptions.Item label="责任人">{row.owner_name}</Descriptions.Item>
                    <Descriptions.Item label="使用状态">{row.run_display}</Descriptions.Item>
                    <Descriptions.Item label="急救生命支持类">{row.is_critical_care ? '是' : '否'}</Descriptions.Item>
                    <Descriptions.Item label="大型设备">{row.is_large_equipment ? '是' : '否'}</Descriptions.Item>
                    <Descriptions.Item label="计量设备">{row.is_metrology_device ? '是' : '否'}</Descriptions.Item>
                    <Descriptions.Item label="强检设备">{row.is_mandatory_inspection ? '是' : '否'}</Descriptions.Item>
                  </Descriptions>
                ),
              },
              {
                key: 'repairs',
                label: '维修记录',
                children:
                  bundle?.repairs?.length ? (
                    <Table
                      size="small"
                      rowKey={(r) => String((r as Record<string, unknown>).id)}
                      dataSource={bundle.repairs as Record<string, unknown>[]}
                      columns={repairColumns()}
                      pagination={false}
                      scroll={{ x: 900 }}
                    />
                  ) : (
                    <Empty description="暂无维修工单或未接入 repair 汇总" />
                  ),
              },
              {
                key: 'pm',
                label: '保养记录',
                children: (
                  <Table
                    size="small"
                    rowKey={(r) => `${r.plan}-${r.done_at}`}
                    dataSource={pmRows}
                    pagination={false}
                    columns={[
                      { title: '保养计划', dataIndex: 'plan' },
                      { title: '保养项目', dataIndex: 'item' },
                      { title: '执行人', dataIndex: 'executor', width: 160 },
                      { title: '执行日期', dataIndex: 'done_at', width: 110 },
                      { title: '结果', dataIndex: 'result', width: 80 },
                    ]}
                  />
                ),
              },
              {
                key: 'cal',
                label: '计量记录',
                children:
                  calRows.length > 0 ? (
                    <Table
                      size="small"
                      rowKey={(r) => r.cert_no}
                      dataSource={calRows}
                      pagination={false}
                      columns={[
                        { title: '检定日期', dataIndex: 'cal_date', width: 110 },
                        { title: '到期日期', dataIndex: 'due_date', width: 110 },
                        { title: '检定机构', dataIndex: 'org' },
                        { title: '证书编号', dataIndex: 'cert_no' },
                        { title: '结果', dataIndex: 'result', width: 72 },
                        { title: '证书附件', dataIndex: 'attachment', ellipsis: true },
                      ]}
                    />
                  ) : (
                    <Empty description="不适用或非强检计量设备暂无记录" />
                  ),
              },
              {
                key: 'finance',
                label: '合同发票',
                children: (
                  <Table
                    size="small"
                    rowKey={(r) => r.contract_no}
                    dataSource={contractRows}
                    pagination={false}
                    columns={[
                      { title: '合同编号', dataIndex: 'contract_no' },
                      { title: '供应商', dataIndex: 'supplier' },
                      { title: '发票号', dataIndex: 'invoice_no' },
                      { title: '金额', dataIndex: 'amount' },
                      { title: '付款状态', dataIndex: 'pay_status', width: 100 },
                    ]}
                  />
                ),
              },
              {
                key: 'files',
                label: '附件资料',
                children: (
                  <Table
                    size="small"
                    rowKey={(r) => r.type}
                    dataSource={attachments}
                    pagination={false}
                    columns={[
                      { title: '类型', dataIndex: 'type', width: 120 },
                      { title: '文件名', dataIndex: 'name', ellipsis: true },
                      { title: '状态', dataIndex: 'status', width: 120 },
                    ]}
                  />
                ),
              },
              {
                key: 'log',
                label: '操作日志',
                children: (
                  <Timeline
                    items={lifecycle.map((item) => ({
                      children: (
                        <div>
                          <Text strong>{item.title}</Text>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {item.time}
                          </div>
                          <div style={{ marginTop: 4 }}>{item.detail}</div>
                        </div>
                      ),
                    }))}
                  />
                ),
              },
            ]}
          />
        </>
      )}
      {!loading && !row && !err ? <Empty description="未选择设备" /> : null}
    </Drawer>
  )
}
