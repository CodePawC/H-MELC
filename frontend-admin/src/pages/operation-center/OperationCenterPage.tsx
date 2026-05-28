import { useEffect, useRef, useState } from 'react'
import { Button, Form, Input, InputNumber, Modal, Select, Space, Statistic, Switch, Tag, Typography, message } from 'antd'
import type { ActionType, ProColumns, ProTableProps } from '@ant-design/pro-components'
import { ProCard, ProTable } from '@ant-design/pro-components'
import {
  ApiOutlined,
  EditOutlined,
  ExportOutlined,
  EyeOutlined,
  FullscreenOutlined,
  KeyOutlined,
  MonitorOutlined,
  PlayCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'

import {
  createScreenAccessKey,
  createScreenTerminal,
  fetchOperationScreens,
  fetchScreenAccessKeys,
  fetchScreenAccessLogs,
  fetchScreenTerminals,
  patchScreenAccessKey,
  patchScreenTerminal,
} from '../../api/operationCenter'
import type { ScreenAccessKeyRow, ScreenAccessLogRow, ScreenDef, ScreenTerminalRow } from '../../api/operationCenter'
import { PageScaffold } from '../../components/hospital/PageScaffold'

type Mode = 'overview' | 'screen' | 'carousel' | 'publish' | 'accessKeys' | 'terminals' | 'logs'

const screenOptions: ScreenDef[] = [
  { code: 'equipment-overview', name: '医学装备总览大屏' },
  { code: 'equipment-status', name: '设备运行态势大屏' },
  { code: 'repair-dispatch', name: '维修工单调度大屏' },
  { code: 'pm-loop', name: 'PM闭环大屏' },
  { code: 'qc-meter', name: '计量质控大屏' },
  { code: 'qc-meter-alert', name: '计量质控预警大屏' },
  { code: 'gas', name: '医用气体大屏' },
  { code: 'medical-gas', name: '医用气体监控大屏' },
  { code: 'spd', name: 'SPD运营大屏' },
  { code: 'spd-consumables', name: 'SPD耗材运营大屏' },
  { code: 'finance', name: '财务态势大屏' },
  { code: 'finance-overview', name: '财务态势大屏' },
  { code: 'risk', name: '风险态势大屏' },
  { code: 'emergency', name: '应急战备大屏' },
  { code: 'emergency-war-room', name: '应急战备大屏' },
  { code: 'radiation', name: '辐射安全大屏' },
  { code: 'radiation-safety', name: '辐射安全大屏' },
  { code: 'payment', name: '供应商付款态势大屏' },
  { code: 'supplier-payment', name: '供应商付款态势大屏' },
  { code: 'ai', name: 'AI运营决策大屏' },
  { code: 'carousel', name: '大屏轮播' },
]

function screenName(code?: string) {
  return screenOptions.find((x) => x.code === code)?.name ?? code ?? '-'
}

function publicRoute(code: string, accessKey = ':accessKey') {
  return `/public-screen/${code}/${accessKey}`
}

function PublicRouteList() {
  return (
    <ProTable
      rowKey="code"
      search={false}
      pagination={false}
      options={false}
      dataSource={screenOptions}
      columns={[
        { title: '大屏页面', dataIndex: 'name' },
        { title: '绑定编码', dataIndex: 'code', copyable: true, width: 220 },
        { title: '外部访问路由', render: (_, row) => <Typography.Text copyable>{publicRoute(row.code)}</Typography.Text> },
        { title: '聚合接口', render: (_, row) => <Typography.Text code>{`/screen-api/${row.code}`}</Typography.Text>, width: 240 },
      ]}
    />
  )
}

function DarkPreview({ code }: { code?: string }) {
  const kpis = ['设备总量', '在用率', '未闭环工单', '30日预警']
  return (
    <div className="oc-preview">
      <div className="oc-preview__top">
        <span>{screenName(code)}</span>
        <small>1920 x 1080 · 自动刷新 · 水印 · 只读展示</small>
      </div>
      <div className="oc-preview__kpis">
        {kpis.map((x, idx) => (
          <div key={x} className="oc-preview__kpi">
            <small>{x}</small>
            <strong>{idx === 1 ? '98.6%' : 1280 + idx * 17}</strong>
          </div>
        ))}
      </div>
      <div className="oc-preview__grid">
        <div />
        <div />
        <div />
      </div>
      <div className="oc-preview__watermark">数字运营中心 · 访问密钥水印</div>
    </div>
  )
}

function ScreenPreviewWorkspace({
  screens,
  defaultCode,
  mode,
}: {
  screens: ScreenDef[]
  defaultCode: string
  mode: Mode
}) {
  const [previewCode, setPreviewCode] = useState(defaultCode)

  useEffect(() => {
    setPreviewCode(defaultCode)
  }, [defaultCode])

  const current = screens.find((x) => x.code === previewCode) ?? screens[0] ?? screenOptions[0]
  const previewUrl = publicRoute(current.code, 'preview-demo')

  return (
    <div className="oc-admin-preview">
      <div className="oc-admin-preview__head">
        <div>
          <span>{mode === 'carousel' ? 'Carousel Preview' : 'IOC Screen Preview'}</span>
          <h2>{mode === 'carousel' ? '大屏轮播预览' : '大屏实时预览'}</h2>
          <p>按 16:9 指挥中心比例呈现，可在新窗口打开完整 IOC 大屏。</p>
        </div>
        <Space wrap>
          <Button icon={<FullscreenOutlined />} href={previewUrl} target="_blank" type="primary">
            全屏预览
          </Button>
          <Button icon={<ExportOutlined />} href="/ioc/access-keys">
            发布密钥
          </Button>
        </Space>
      </div>

      <div className="oc-admin-preview__body">
        <aside className="oc-admin-preview__nav">
          {screens.map((screen) => (
            <button
              key={screen.code}
              type="button"
              data-active={screen.code === current.code ? 'true' : 'false'}
              onClick={() => setPreviewCode(screen.code)}
            >
              <strong>{screen.name}</strong>
              <span>{screen.code}</span>
            </button>
          ))}
        </aside>

        <section className="oc-admin-preview__stage">
          <div className="oc-admin-preview__toolbar">
            <span>
              <i />
              {current.name}
            </span>
            <Typography.Text copyable>{previewUrl}</Typography.Text>
          </div>
          <div className="oc-admin-preview__frame">
            <iframe title={`${current.name}预览`} src={previewUrl} />
          </div>
        </section>
      </div>
    </div>
  )
}

function AccessKeysPanel() {
  const actionRef = useRef<ActionType>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ScreenAccessKeyRow | null>(null)
  const [form] = Form.useForm()

  const columns: ProColumns<ScreenAccessKeyRow>[] = [
    { title: '密钥名称', dataIndex: 'key_name', ellipsis: true },
    {
      title: '绑定大屏',
      dataIndex: 'screen_code',
      width: 180,
      valueEnum: Object.fromEntries(screenOptions.map((x) => [x.code, { text: x.name }])),
      render: (_, row) => screenName(row.screen_code),
    },
    { title: '密钥值', dataIndex: 'access_key', ellipsis: true, copyable: true },
    { title: '启用', dataIndex: 'is_enabled', width: 90, render: (_, row) => <Switch checked={row.is_enabled} onChange={async (v) => { await patchScreenAccessKey(row.id, { is_enabled: v }); actionRef.current?.reload() }} /> },
    { title: '脱敏', dataIndex: 'desensitized', width: 80, render: (_, row) => (row.desensitized ? <Tag color="blue">脱敏</Tag> : <Tag>原始</Tag>) },
    { title: '刷新', dataIndex: 'refresh_interval_seconds', width: 90, renderText: (v) => `${v}s` },
    { title: '轮播', dataIndex: 'carousel_interval_seconds', width: 90, renderText: (v) => `${v}s` },
    { title: '访问次数', dataIndex: 'access_count', width: 110 },
    { title: '最后访问', dataIndex: 'last_access_at', width: 180 },
    { title: '创建人', dataIndex: 'created_by_username', width: 120 },
    { title: '创建时间', dataIndex: 'created_at', width: 180 },
    {
      title: '操作',
      width: 190,
      fixed: 'right',
      search: false,
      render: (_, row) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditing(row)
              form.setFieldsValue(row)
              setOpen(true)
            }}
          >
            编辑
          </Button>
          <Button size="small" icon={<EyeOutlined />} href={publicRoute(row.screen_code, row.access_key)} target="_blank">预览</Button>
        </Space>
      ),
    },
  ]

  const request: ProTableProps<ScreenAccessKeyRow, Record<string, unknown>>['request'] = async (params) => {
    const data = await fetchScreenAccessKeys({ page: params.current, page_size: params.pageSize, screen_code: params.screen_code as string | undefined })
    return { data: data.items, total: data.total, success: true }
  }

  return (
    <>
      <ProTable<ScreenAccessKeyRow>
        actionRef={actionRef}
        rowKey="id"
        headerTitle="访问密钥管理"
        columns={columns}
        request={request}
        scroll={{ x: 1500 }}
        toolBarRender={() => [
          <Button
            key="new"
            type="primary"
            icon={<KeyOutlined />}
            onClick={() => {
              setEditing(null)
              form.resetFields()
              setOpen(true)
            }}
          >
            新增密钥
          </Button>,
        ]}
        search={{ labelWidth: 'auto' }}
      />
      <Modal
        title={editing ? '编辑访问密钥' : '新增访问密钥'}
        open={open}
        onCancel={() => {
          setOpen(false)
          setEditing(null)
        }}
        onOk={async () => {
          const values = await form.validateFields()
          if (editing) {
            await patchScreenAccessKey(editing.id, values)
            message.success('访问密钥已更新')
          } else {
            await createScreenAccessKey(values)
            message.success('访问密钥已创建')
          }
          setOpen(false)
          setEditing(null)
          form.resetFields()
          actionRef.current?.reload()
        }}
      >
        <Form form={form} layout="vertical" initialValues={{ screen_code: 'equipment-overview', is_enabled: true, desensitized: true, refresh_interval_seconds: 60, carousel_interval_seconds: 15 }}>
          <Form.Item name="key_name" label="密钥名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="screen_code" label="绑定大屏" rules={[{ required: true }]}><Select options={screenOptions.map((x) => ({ label: x.name, value: x.code }))} /></Form.Item>
          <Form.Item name="access_key" label="密钥值"><Input placeholder="留空由后端生成" /></Form.Item>
          <Form.Item name="allowed_ips" label="允许访问IP"><Input placeholder="多个 IP 用逗号分隔，留空不限" /></Form.Item>
          <Space>
            <Form.Item name="refresh_interval_seconds" label="刷新频率(秒)"><InputNumber min={10} max={3600} /></Form.Item>
            <Form.Item name="carousel_interval_seconds" label="轮播间隔(秒)"><InputNumber min={5} max={600} /></Form.Item>
          </Space>
          <Space>
            <Form.Item name="is_enabled" label="启用" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item name="desensitized" label="数据脱敏" valuePropName="checked"><Switch /></Form.Item>
          </Space>
        </Form>
      </Modal>
    </>
  )
}

function TerminalsPanel() {
  const actionRef = useRef<ActionType>(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ScreenTerminalRow | null>(null)
  const [keys, setKeys] = useState<ScreenAccessKeyRow[]>([])
  const [form] = Form.useForm()

  useEffect(() => {
    fetchScreenAccessKeys({ page_size: 100 }).then((r) => setKeys(r.items)).catch(() => undefined)
  }, [])

  const columns: ProColumns<ScreenTerminalRow>[] = [
    { title: '终端名称', dataIndex: 'terminal_name' },
    { title: '安装位置', dataIndex: 'location' },
    {
      title: '绑定大屏',
      dataIndex: 'screen_code',
      valueEnum: Object.fromEntries(screenOptions.map((x) => [x.code, { text: x.name }])),
      render: (_, row) => screenName(row.screen_code),
    },
    { title: '访问密钥', dataIndex: 'access_key_name' },
    { title: '分辨率', dataIndex: 'resolution', width: 120 },
    {
      title: '在线状态',
      dataIndex: 'online_status',
      width: 120,
      valueEnum: { ONLINE: { text: 'ONLINE' }, OFFLINE: { text: 'OFFLINE' }, MAINTENANCE: { text: 'MAINTENANCE' } },
      render: (_, row) => <Tag color={row.online_status === 'ONLINE' ? 'green' : row.online_status === 'MAINTENANCE' ? 'orange' : 'default'}>{row.online_status}</Tag>,
    },
    { title: '最近心跳', dataIndex: 'last_heartbeat_at', width: 180 },
    { title: '备注', dataIndex: 'remark', ellipsis: true },
    {
      title: '操作',
      width: 100,
      fixed: 'right',
      search: false,
      render: (_, row) => (
        <Button
          size="small"
          icon={<EditOutlined />}
          onClick={() => {
            setEditing(row)
            form.setFieldsValue(row)
            setOpen(true)
          }}
        >
          编辑
        </Button>
      ),
    },
  ]
  return (
    <>
      <ProTable<ScreenTerminalRow>
        actionRef={actionRef}
        rowKey="id"
        headerTitle="大屏终端管理"
        columns={columns}
        request={async (params) => {
          const data = await fetchScreenTerminals({ page: params.current, page_size: params.pageSize, screen_code: params.screen_code as string | undefined })
          return { data: data.items, total: data.total, success: true }
        }}
        scroll={{ x: 1100 }}
        toolBarRender={() => [
          <Button
            key="new"
            type="primary"
            icon={<MonitorOutlined />}
            onClick={() => {
              setEditing(null)
              form.resetFields()
              setOpen(true)
            }}
          >
            新增终端
          </Button>,
        ]}
      />
      <Modal
        title={editing ? '编辑大屏终端' : '新增大屏终端'}
        open={open}
        onCancel={() => {
          setOpen(false)
          setEditing(null)
        }}
        onOk={async () => {
          const values = await form.validateFields()
          if (editing) {
            await patchScreenTerminal(editing.id, values)
            message.success('大屏终端已更新')
          } else {
            await createScreenTerminal(values)
            message.success('大屏终端已创建')
          }
          setOpen(false)
          setEditing(null)
          form.resetFields()
          actionRef.current?.reload()
        }}
      >
        <Form form={form} layout="vertical" initialValues={{ screen_code: 'equipment-overview', resolution: '1920x1080', online_status: 'OFFLINE' }}>
          <Form.Item name="terminal_name" label="终端名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="location" label="安装位置"><Input /></Form.Item>
          <Form.Item name="screen_code" label="绑定大屏" rules={[{ required: true }]}><Select options={screenOptions.map((x) => ({ label: x.name, value: x.code }))} /></Form.Item>
          <Form.Item name="access_key_id" label="绑定访问密钥">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={keys.map((x) => ({ label: `${x.key_name} · ${screenName(x.screen_code)}`, value: x.id }))}
              placeholder="可留空，后续再绑定"
            />
          </Form.Item>
          <Form.Item name="resolution" label="分辨率"><Input /></Form.Item>
          <Form.Item name="online_status" label="在线状态">
            <Select options={[
              { label: 'ONLINE', value: 'ONLINE' },
              { label: 'OFFLINE', value: 'OFFLINE' },
              { label: 'MAINTENANCE', value: 'MAINTENANCE' },
            ]} />
          </Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </>
  )
}

function LogsPanel() {
  const columns: ProColumns<ScreenAccessLogRow>[] = [
    { title: '访问时间', dataIndex: 'access_time', width: 180 },
    { title: '访问IP', dataIndex: 'access_ip', width: 140 },
    { title: '访问页面', dataIndex: 'screen_name', render: (_, row) => screenName(row.screen_code) },
    { title: '使用密钥', dataIndex: 'access_key', ellipsis: true, copyable: true },
    { title: '终端名称', dataIndex: 'terminal_name', width: 140 },
    { title: '浏览器信息', dataIndex: 'user_agent', ellipsis: true },
    { title: '结果', dataIndex: 'success', width: 100, render: (_, row) => row.success ? <Tag color="green">成功</Tag> : <Tag color="red">失败</Tag> },
    { title: '失败原因', dataIndex: 'failure_reason', ellipsis: true },
  ]
  return (
    <ProTable<ScreenAccessLogRow>
      rowKey="id"
      headerTitle="访问日志"
      columns={columns}
      request={async (params) => {
        const data = await fetchScreenAccessLogs({ page: params.current, page_size: params.pageSize })
        return { data: data.items, total: data.total, success: true }
      }}
      scroll={{ x: 1300 }}
    />
  )
}

export function OperationCenterPage({ mode, screenCode }: { mode: Mode; screenCode?: string }) {
  const [screens, setScreens] = useState<ScreenDef[]>(screenOptions)
  useEffect(() => {
    fetchOperationScreens().then((r) => setScreens(r.items)).catch(() => undefined)
  }, [])

  if (mode === 'accessKeys') {
    return <PageScaffold title="访问密钥管理" description="管理外部大屏的访问密钥、有效期、IP 白名单、脱敏与刷新策略。"><AccessKeysPanel /></PageScaffold>
  }
  if (mode === 'terminals') {
    return <PageScaffold title="大屏终端管理" description="维护医院大厅、会议室、值班区等展示终端的绑定关系与在线状态。"><TerminalsPanel /></PageScaffold>
  }
  if (mode === 'logs') {
    return <PageScaffold title="访问日志" description="审计每次外部大屏访问的时间、IP、密钥、终端与失败原因。"><LogsPanel /></PageScaffold>
  }

  const activeScreens = mode === 'screen' && screenCode ? screens.filter((x) => x.code === screenCode) : screens
  const title = mode === 'overview' ? '运营中心总览' : mode === 'carousel' ? '大屏轮播配置' : mode === 'publish' ? '发布与访问控制' : screenName(screenCode)
  const previewScreens = activeScreens.length ? activeScreens : screenOptions
  const defaultPreviewCode = screenCode ?? previewScreens[0]?.code ?? 'equipment-overview'

  return (
    <PageScaffold title={title} description="面向医院医学装备数字运营驾驶舱，统一管理大屏模板、聚合数据、密钥发布和外部展示。">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <ProCard gutter={12} ghost>
          <ProCard bordered size="small"><Statistic title="可发布大屏" value={screens.length} prefix={<PlayCircleOutlined />} /></ProCard>
          <ProCard bordered size="small"><Statistic title="公开接口前缀" value="/screen-api" prefix={<ApiOutlined />} /></ProCard>
          <ProCard bordered size="small"><Statistic title="访问方式" value="accessKey" prefix={<KeyOutlined />} /></ProCard>
          <ProCard bordered size="small"><Statistic title="展示比例" value="16:9" prefix={<SafetyCertificateOutlined />} /></ProCard>
        </ProCard>

        {mode === 'publish' || mode === 'overview' ? <PublicRouteList /> : null}

        {mode !== 'publish' ? (
          <ScreenPreviewWorkspace screens={previewScreens} defaultCode={defaultPreviewCode} mode={mode} />
        ) : null}

        <ProCard title={mode === 'carousel' ? '轮播编排' : '大屏模板预览'} bordered>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <ProCard gutter={12} ghost>
              {activeScreens.map((x) => (
                <ProCard key={x.code} bordered size="small" title={x.name} extra={<Typography.Text code>{x.code}</Typography.Text>}>
                  <Typography.Paragraph type="secondary">
                    聚合接口 `/screen-api/{x.code}`，外部路由 `{publicRoute(x.code)}`。后台页面仅配置发布策略，外部页面只读展示。
                  </Typography.Paragraph>
                </ProCard>
              ))}
            </ProCard>
            <DarkPreview code={screenCode ?? 'equipment-overview'} />
          </Space>
        </ProCard>
      </Space>
    </PageScaffold>
  )
}
