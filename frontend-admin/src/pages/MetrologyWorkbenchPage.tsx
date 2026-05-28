import { useMemo, useState } from 'react'
import { Alert, Button, Drawer, Input, Progress, Segmented, Space, Statistic, Tag, Typography } from 'antd'
import type { ProColumns, ProTableProps } from '@ant-design/pro-components'
import { ProCard, ProTable } from '@ant-design/pro-components'
import { BellOutlined, FileProtectOutlined, SafetyCertificateOutlined, ScheduleOutlined } from '@ant-design/icons'

import {
  fetchCalibrationPlans,
  fetchMetrologyCertificates,
  fetchMetrologyDevices,
  fetchMetrologyExpiryAlerts,
} from '../api/metrology'
import type { CalibrationPlanRow, MetrologyAlertRow, MetrologyCertificateRow, MetrologyDeviceRow } from '../api/metrology'
import type { DepartmentMaster, PersonMaster } from '../api/mdm'
import { OrgMasterSelector } from '../components/OrgMasterSelector'
import { METER_STATUS, StatusTag } from '../constants/hospitalStatus'
import { ApiClientError } from '../lib/api'
import { MOCK_METER } from '../mock/hospital/tables'
import { PageScaffold } from '../components/hospital/PageScaffold'

type MeterView = 'ledger' | 'plans' | 'records' | 'certificates' | 'alerts'
type Row = {
  id: string
  asset_id: string
  asset_label: string
  device_name: string
  meter_type: string
  status: string
  cycle_months?: number
  last_date?: string | null
  next_due?: string | null
  cert_no?: string | null
  org?: string | null
  remark?: string | null
}

const viewOptions: { label: string; value: MeterView }[] = [
  { label: '台账', value: 'ledger' },
  { label: '计划', value: 'plans' },
  { label: '记录', value: 'records' },
  { label: '证书', value: 'certificates' },
  { label: '预警', value: 'alerts' },
]

function daysUntil(dateText?: string | null) {
  if (!dateText) return 9999
  const due = new Date(`${dateText.slice(0, 10)}T00:00:00`).getTime()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((due - today.getTime()) / 86400000)
}

function riskTag(row: Row) {
  const days = daysUntil(row.next_due)
  if (row.status === 'EXPIRED' || days < 0) return <Tag color="red">已逾期 {Math.abs(days)} 天</Tag>
  if (row.status === 'SOON' || days <= 30) return <Tag color="orange">30日内到期</Tag>
  return <Tag color="green">有效</Tag>
}

function complianceScore(rows: Row[]) {
  if (!rows.length) return 100
  const bad = rows.filter((x) => x.status === 'EXPIRED').length
  const soon = rows.filter((x) => x.status === 'SOON').length
  return Math.max(0, Math.round(100 - (bad / rows.length) * 35 - (soon / rows.length) * 12))
}

function deviceRow(x: MetrologyDeviceRow): Row {
  return {
    id: x.id,
    asset_id: x.asset_id,
    asset_label: `${x.asset_id.slice(0, 8)}...`,
    device_name: `设备 ${x.asset_id.slice(0, 8)}`,
    meter_type: x.meter_type || x.regulatory_class,
    status: x.calibration_status,
    cycle_months: x.cycle_months,
    last_date: x.last_calibrated_at,
    next_due: x.next_due_date,
    org: x.issuing_body,
    remark: x.remark,
  }
}

function planRow(x: CalibrationPlanRow): Row {
  return {
    id: x.id,
    asset_id: x.asset_id,
    asset_label: `${x.asset_id.slice(0, 8)}...`,
    device_name: x.title,
    meter_type: '检定计划',
    status: x.plan_status,
    next_due: x.planned_date,
    org: x.assigned_org,
    remark: x.remark,
  }
}

function certRow(x: MetrologyCertificateRow): Row {
  return {
    id: x.id,
    asset_id: x.asset_id,
    asset_label: `${x.asset_id.slice(0, 8)}...`,
    device_name: `证书 ${x.certificate_no}`,
    meter_type: '证书',
    status: x.conclusion === 'PASS' ? 'COMPLETED' : 'EXPIRED',
    last_date: x.issued_at,
    next_due: x.valid_to,
    cert_no: x.certificate_no,
    org: x.issuing_body,
  }
}

function alertRow(x: MetrologyAlertRow): Row {
  return {
    id: `${x.alert_type}-${x.asset_id}-${x.due_date}`,
    asset_id: x.asset_id,
    asset_label: `${x.asset_id.slice(0, 8)}...`,
    device_name: x.alert_type === 'CERTIFICATE_EXPIRY' ? '证书到期预警' : '检定到期预警',
    meter_type: x.alert_type,
    status: x.severity === 'HIGH' ? 'EXPIRED' : 'SOON',
    next_due: x.due_date,
    cert_no: x.certificate_id,
  }
}

function mockRows(view: MeterView): Row[] {
  const rows = MOCK_METER.map((x) => ({
    id: x.id,
    asset_id: x.assetNo,
    asset_label: x.assetNo,
    device_name: x.deviceName,
    meter_type: x.meterType,
    status: x.status,
    cycle_months: x.cycleMonth,
    last_date: x.lastDate,
    next_due: x.nextDue,
    cert_no: x.certNo,
    org: x.org,
  }))
  if (view === 'alerts') return rows.filter((x) => x.status === 'SOON' || x.status === 'EXPIRED' || daysUntil(x.next_due) <= 30)
  return rows
}

export function MetrologyWorkbenchPage() {
  const [view, setView] = useState<MeterView>('ledger')
  const [active, setActive] = useState<Row | null>(null)
  const [snapshot, setSnapshot] = useState<Row[]>([])
  const [fallback, setFallback] = useState<string | null>(null)
  const [orgSelector, setOrgSelector] = useState<'department' | 'person' | null>(null)
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentMaster | null>(null)
  const [selectedPerson, setSelectedPerson] = useState<PersonMaster | null>(null)

  const columns = useMemo<ProColumns<Row>[]>(() => {
    const base: ProColumns<Row>[] = [
      { title: '对象', dataIndex: 'device_name', ellipsis: true },
      { title: '资产', dataIndex: 'asset_label', width: 150, copyable: true },
      { title: '计量类别', dataIndex: 'meter_type', width: 120 },
      { title: '状态', dataIndex: 'status', width: 110, render: (_, row) => StatusTag(METER_STATUS, row.status) },
    ]
    if (view === 'ledger') {
      return [
        ...base,
        { title: '周期(月)', dataIndex: 'cycle_months', width: 90 },
        { title: '上次检定', dataIndex: 'last_date', width: 120 },
        { title: '下次到期', dataIndex: 'next_due', width: 120 },
        { title: '风险', width: 130, render: (_, row) => riskTag(row) },
      ]
    }
    if (view === 'plans') {
      return [
        ...base,
        { title: '计划检定日', dataIndex: 'next_due', width: 130 },
        { title: '检定机构', dataIndex: 'org', ellipsis: true },
        { title: '计划状态', dataIndex: 'status', width: 120 },
      ]
    }
    if (view === 'certificates') {
      return [
        ...base,
        { title: '证书编号', dataIndex: 'cert_no', width: 160, copyable: true },
        { title: '签发机构', dataIndex: 'org', ellipsis: true },
        { title: '有效期至', dataIndex: 'next_due', width: 120 },
      ]
    }
    return [
      ...base,
      { title: view === 'alerts' ? '到期日' : '检定日期', dataIndex: 'next_due', width: 120 },
      { title: '证书编号', dataIndex: 'cert_no', width: 160 },
      { title: '结论', width: 100, render: (_, row) => (row.status === 'EXPIRED' ? <Tag color="red">需复检</Tag> : <Tag color="green">合格</Tag>) },
    ]
  }, [view])

  const request: ProTableProps<Row, Record<string, unknown>>['request'] = async (params) => {
    setFallback(null)
    try {
      if (view === 'plans') {
        const data = await fetchCalibrationPlans({ page: params.current, page_size: params.pageSize })
        const rows = data.items.map(planRow)
        setSnapshot(rows)
        return { data: rows, total: data.total, success: true }
      }
      if (view === 'certificates' || view === 'records') {
        const data = await fetchMetrologyCertificates({ page: params.current, page_size: params.pageSize })
        const rows = data.items.map(certRow)
        setSnapshot(rows)
        return { data: rows, total: data.total, success: true }
      }
      if (view === 'alerts') {
        const data = await fetchMetrologyExpiryAlerts(30)
        const rows = data.items.map(alertRow)
        setSnapshot(rows)
        return { data: rows, total: data.total, success: true }
      }
      const data = await fetchMetrologyDevices({ page: params.current, page_size: params.pageSize })
      const rows = data.items.map(deviceRow)
      setSnapshot(rows)
      return { data: rows, total: data.total, success: true }
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : String(e)
      const rows = mockRows(view)
      setFallback(msg)
      setSnapshot(rows)
      return { data: rows, total: rows.length, success: true }
    }
  }

  const expired = snapshot.filter((x) => x.status === 'EXPIRED').length
  const soon = snapshot.filter((x) => x.status === 'SOON').length
  const sent = snapshot.filter((x) => x.status === 'SENT').length
  const score = complianceScore(snapshot)

  return (
    <PageScaffold
      title="计量与检测工作台"
      description="对接 docs/06 §十一：计量台账、检定计划、证书管理、专项合规视图与到期预警。"
      extra={<Segmented value={view} onChange={(v) => setView(v as MeterView)} options={viewOptions} />}
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        {fallback ? (
          <Alert
            showIcon
            type="warning"
            message="计量接口暂不可用，已回落到演示数据"
            description={fallback}
          />
        ) : null}

        <ProCard gutter={12} ghost>
          <ProCard bordered size="small">
            <Statistic title="计量对象" value={snapshot.length} prefix={<SafetyCertificateOutlined />} />
          </ProCard>
          <ProCard bordered size="small">
            <Statistic title="30日内到期" value={soon} prefix={<BellOutlined />} valueStyle={{ color: '#d46b08' }} />
          </ProCard>
          <ProCard bordered size="small">
            <Statistic title="已逾期" value={expired} valueStyle={{ color: '#cf1322' }} />
          </ProCard>
          <ProCard bordered size="small">
            <Statistic title="送检中" value={sent} prefix={<ScheduleOutlined />} />
          </ProCard>
        </ProCard>

        <ProCard bordered>
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }} wrap>
            <Space>
              <FileProtectOutlined style={{ color: '#1677ff' }} />
              <Typography.Text strong>合规健康度</Typography.Text>
            </Space>
            <Typography.Text type="secondary">逾期和即将到期会拉低分值</Typography.Text>
          </Space>
          <Progress percent={score} strokeColor={score >= 85 ? '#52c41a' : score >= 70 ? '#faad14' : '#cf1322'} style={{ marginTop: 12 }} />
        </ProCard>

        <ProCard bordered title="H-UMDG 送检组织与联系人">
          <Space wrap style={{ width: '100%' }}>
            <Input readOnly addonBefore="送检科室" value={selectedDepartment ? `${selectedDepartment.name}（${selectedDepartment.code}）` : ''} placeholder="从 H-UMDG 科室主数据选择" style={{ width: 360 }} />
            <Button onClick={() => setOrgSelector('department')}>选择科室</Button>
            <Input readOnly addonBefore="计量责任人" value={selectedPerson ? `${selectedPerson.name}（${selectedPerson.employeeNo || selectedPerson.code}）` : ''} placeholder="从 H-UMDG 人员主数据选择" style={{ width: 360 }} />
            <Button onClick={() => setOrgSelector('person')}>选择人员</Button>
            <Tag color="blue">source=h-mdm</Tag>
          </Space>
        </ProCard>

        <ProTable<Row>
          key={view}
          rowKey="id"
          headerTitle={viewOptions.find((x) => x.value === view)?.label}
          columns={columns}
          request={request}
          search={{ labelWidth: 'auto', span: 8 }}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          options={{ density: true, fullScreen: true, setting: true }}
          onRow={(record) => ({ onClick: () => setActive(record) })}
        />
      </Space>

      <Drawer title={active?.device_name ?? '计量档案'} open={!!active} onClose={() => setActive(null)} width={560}>
        {active ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <ProCard bordered>
              <Statistic title="证书编号" value={active.cert_no ?? '-'} prefix={<FileProtectOutlined />} />
            </ProCard>
            <ProTable
              rowKey="k"
              search={false}
              pagination={false}
              options={false}
              dataSource={[
                { k: '资产', v: active.asset_label },
                { k: '计量类别', v: active.meter_type },
                { k: '检定周期', v: active.cycle_months ? `${active.cycle_months} 月` : '-' },
                { k: '上次检定', v: active.last_date ?? '-' },
                { k: '下次到期', v: active.next_due ?? '-' },
                { k: '检定机构', v: active.org ?? '-' },
                { k: '备注', v: active.remark ?? '-' },
              ]}
              columns={[
                { title: '字段', dataIndex: 'k', width: 120 },
                { title: '内容', dataIndex: 'v' },
              ]}
            />
          </Space>
        ) : null}
      </Drawer>
      <OrgMasterSelector
        open={orgSelector === 'department'}
        kind="department"
        value={selectedDepartment}
        onCancel={() => setOrgSelector(null)}
        onSelect={(row) => {
          setSelectedDepartment(row as DepartmentMaster)
          setOrgSelector(null)
        }}
      />
      <OrgMasterSelector
        open={orgSelector === 'person'}
        kind="person"
        value={selectedPerson}
        departmentId={selectedDepartment?.id}
        onCancel={() => setOrgSelector(null)}
        onSelect={(row) => {
          setSelectedPerson(row as PersonMaster)
          setOrgSelector(null)
        }}
      />
    </PageScaffold>
  )
}
