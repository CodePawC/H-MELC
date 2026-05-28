import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Steps,
  Switch,
  Tag,
  Timeline,
  Typography,
  Upload,
  message as antdMessage,
} from 'antd'
import type { ActionType, ProColumns, ProTableProps } from '@ant-design/pro-components'
import { ProCard, ProTable } from '@ant-design/pro-components'
import {
  ApiOutlined,
  AudioOutlined,
  BellOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudUploadOutlined,
  EyeOutlined,
  FileTextOutlined,
  MessageOutlined,
  PictureOutlined,
  PlusOutlined,
  QrcodeOutlined,
  RobotOutlined,
  SaveOutlined,
  SendOutlined,
  ThunderboltOutlined,
  ToolOutlined,
  UserSwitchOutlined,
  WarningOutlined,
  WechatOutlined,
} from '@ant-design/icons'

import {
  appendRepairAiSessionMessage,
  confirmRepairCenterMessage,
  createRepairAiSession,
  createRepairCenterMessage,
  createRepairChannelConfig,
  extractRepairMessage,
  fetchPendingRepairMessages,
  fetchRepairCenterMessageDetail,
  fetchRepairCenterMessages,
  fetchRepairCenterWorkbench,
  fetchRepairChannelConfigs,
  fetchRepairProgress,
  fetchRepairRuleConfig,
  patchRepairChannelConfig,
  patchRepairRuleConfig,
} from '../api/repairCenter'
import type {
  CandidateDevice,
  RepairAiSession,
  RepairCenterStats,
  RepairChannelConfig,
  RepairMessageBundle,
  RepairRuleConfig,
  UnifiedRepairMessage,
} from '../api/repairCenter'
import { ApiClientError } from '../lib/api'

const { Paragraph, Text, Title } = Typography

export type UnifiedRepairMode =
  | 'workbench'
  | 'new'
  | 'assistant'
  | 'channels'
  | 'pending'
  | 'rules'

type MessageQuery = {
  keyword?: string
  sender_department?: string
  raw_message_type?: string
  confirm_status?: string
}

type PendingQuery = {
  keyword?: string
  source_channel?: string
}

const CHANNEL_OPTIONS = [
  { label: '全部', value: 'ALL' },
  { label: 'AI聊天框', value: 'AI_CHAT' },
  { label: '设备二维码', value: 'DEVICE_QR' },
  { label: '微信公众号', value: 'WECHAT' },
  { label: '企业微信', value: 'WEWORK' },
  { label: '飞书机器人', value: 'FEISHU' },
  { label: '钉钉机器人', value: 'DINGTALK' },
  { label: '系统预警', value: 'SYSTEM_ALERT' },
]

const CHANNEL_LABEL: Record<string, string> = {
  AI_CHAT: 'AI聊天框',
  DEVICE_QR: '设备二维码',
  WECHAT: '微信公众号',
  WECHAT_MP: '微信公众号',
  WEWORK: '企业微信',
  FEISHU: '飞书机器人',
  DINGTALK: '钉钉机器人',
  SMS: '短信入口',
  INTERNAL: '内部系统消息',
  MOBILE: 'App / H5移动端',
  PC_ADMIN: '电脑端后台',
  MANUAL_ENTRY: '设备科人工代录',
  SYSTEM_ALERT: '系统预警',
}

const STATUS_META: Record<string, { text: string; color: string }> = {
  PENDING: { text: '待识别', color: 'default' },
  WAIT_USER_CONFIRM: { text: '待用户确认', color: 'blue' },
  WAIT_USER_SELECT: { text: '待选择设备', color: 'gold' },
  PENDING_MANUAL_CONFIRM: { text: '待人工确认', color: 'orange' },
  PENDING_EMERGENCY_REVIEW: { text: '急救优先确认', color: 'red' },
  NEED_MORE_INFO: { text: '待补充信息', color: 'purple' },
  USER_CONFIRMED: { text: '用户已确认', color: 'cyan' },
  STAFF_CONFIRMED: { text: '设备科已确认', color: 'cyan' },
  CONVERTED: { text: '已生成工单', color: 'green' },
  IGNORED: { text: '已忽略', color: 'default' },
}

function apiError(e: unknown) {
  return e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : String(e)
}

function fmtDate(value?: string | null) {
  return value ? value.replace('T', ' ').slice(0, 19) : '-'
}

function confidence(value?: string | number | null) {
  if (value == null || value === '') return 0
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n <= 1 ? n * 100 : n)
}

function channelName(row?: UnifiedRepairMessage | null) {
  if (!row) return '-'
  return row.source_channel_name || CHANNEL_LABEL[row.source_channel] || row.source_channel
}

function messageText(row?: UnifiedRepairMessage | null) {
  if (!row) return '-'
  return row.transcribed_text || row.raw_message_content || row.raw_message_type
}

function statusTag(status?: string | null) {
  const meta = STATUS_META[status || 'PENDING'] ?? { text: status || '-', color: 'default' }
  return <Tag color={meta.color}>{meta.text}</Tag>
}

function urgencyTag(urgency?: string | null) {
  if (!urgency) return <Tag>-</Tag>
  if (['危急', 'CRITICAL', 'EMERGENCY'].includes(urgency)) return <Tag color="red">危急</Tag>
  if (['较急', 'HIGH', 'URGENT'].includes(urgency)) return <Tag color="orange">较急</Tag>
  return <Tag>{urgency}</Tag>
}

function isEmergency(bundle?: RepairMessageBundle | null) {
  const ext = bundle?.latest_extract
  const urgency = ext?.extracted_urgency || bundle?.message.ai_extracted_urgency
  return Boolean(
    ext?.suspected_emergency_device ||
      ext?.suspected_life_support_device ||
      ['危急', 'CRITICAL', 'EMERGENCY'].includes(urgency || ''),
  )
}

function candidateDevices(bundle?: RepairMessageBundle | null): CandidateDevice[] {
  return bundle?.latest_extract?.matched_device_candidates?.items ?? []
}

function extractedDevice(bundle?: RepairMessageBundle | null) {
  return (
    bundle?.latest_extract?.extracted_device_name ||
    bundle?.message.ai_extracted_device_name ||
    '待确认设备'
  )
}

function extractedFault(bundle?: RepairMessageBundle | null) {
  return (
    bundle?.latest_extract?.extracted_fault_description ||
    bundle?.message.ai_extracted_fault_description ||
    messageText(bundle?.message)
  )
}

function extractedDepartment(bundle?: RepairMessageBundle | null) {
  return bundle?.latest_extract?.extracted_department || bundle?.message.ai_extracted_department || bundle?.message.sender_department || '-'
}

function extractedLocation(bundle?: RepairMessageBundle | null) {
  return bundle?.latest_extract?.extracted_location || bundle?.message.ai_extracted_location || '-'
}

function matchedConfidence(bundle?: RepairMessageBundle | null) {
  return confidence(bundle?.latest_extract?.matched_confidence ?? bundle?.message.matched_confidence)
}

function PageHead({ title, description }: { title: string; description: string }) {
  return (
    <div className="unified-repair-head">
      <div>
        <Title level={4}>{title}</Title>
        <Paragraph>{description}</Paragraph>
      </div>
      <Space wrap>
        <Button icon={<BellOutlined />}>值班通知</Button>
        <Link to="/repair/new">
          <Button type="primary" icon={<PlusOutlined />}>
            快速报修
          </Button>
        </Link>
      </Space>
    </div>
  )
}

function BundleTimeline({ bundle }: { bundle?: RepairMessageBundle | null }) {
  const items =
    bundle?.timeline?.map((item) => ({
      color:
        item.type === 'ORDER_CREATED'
          ? 'green'
          : item.type === 'AI_EXTRACTED'
            ? 'purple'
            : item.type === 'NOTIFICATION'
              ? 'red'
              : 'blue',
      children: (
        <Space direction="vertical" size={0}>
          <Text strong>{item.title}</Text>
          <Text type="secondary">{fmtDate(item.time)}</Text>
          {item.content ? <Text>{item.content}</Text> : null}
        </Space>
      ),
    })) ?? []

  if (!items.length && bundle?.message) {
    items.push(
      { color: 'blue', children: <Text>{`${fmtDate(bundle.message.created_at)} 接收：${messageText(bundle.message)}`}</Text> },
      { color: 'purple', children: <Text>{`AI识别：${extractedDepartment(bundle)} / ${extractedLocation(bundle)} / ${extractedDevice(bundle)}`}</Text> },
      { color: bundle.message.converted_order_id ? 'green' : 'gold', children: <Text>{bundle.message.converted_order_id ? '已生成标准报修工单' : '等待确认后生成工单'}</Text> },
    )
  }
  return <Timeline items={items} />
}

function WorkbenchView() {
  const actionRef = useRef<ActionType>(null)
  const [selectedChannel, setSelectedChannel] = useState('ALL')
  const [stats, setStats] = useState<RepairCenterStats>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedBundle, setSelectedBundle] = useState<RepairMessageBundle | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [loadingBundle, setLoadingBundle] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchRepairCenterWorkbench()
        if (!cancelled) setStats(data.stats ?? {})
      } catch (e) {
        if (!cancelled) setError(apiError(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setSelectedBundle(null)
      return
    }
    let cancelled = false
    setLoadingBundle(true)
    ;(async () => {
      try {
        const bundle = await fetchRepairCenterMessageDetail(selectedId)
        if (!cancelled) setSelectedBundle(bundle)
      } catch (e) {
        if (!cancelled) antdMessage.error(apiError(e))
      } finally {
        if (!cancelled) setLoadingBundle(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const reload = () => {
    actionRef.current?.reload()
    if (selectedId) {
      fetchRepairCenterMessageDetail(selectedId).then(setSelectedBundle).catch((e) => antdMessage.error(apiError(e)))
    }
  }

  const handleConfirm = async (action: 'CREATE_ORDER' | 'NEED_MORE_INFO' | 'MANUAL_REVIEW' | 'IGNORE', candidate?: CandidateDevice) => {
    if (!selectedBundle) return
    try {
      const res = await confirmRepairCenterMessage(selectedBundle.message.id, {
        confirm_action: action,
        selected_device_id: candidate?.device_id ?? selectedBundle.message.matched_device_id ?? selectedBundle.latest_extract?.matched_device_id ?? undefined,
        fault_description: extractedFault(selectedBundle),
        urgency: selectedBundle.latest_extract?.extracted_urgency || selectedBundle.message.ai_extracted_urgency,
        comment: action === 'NEED_MORE_INFO' ? '请补充报警代码、现场照片或设备位置。' : undefined,
      })
      antdMessage.success(res.converted_order ? `已生成工单 ${res.converted_order.order_code}` : '处理状态已更新')
      reload()
    } catch (e) {
      antdMessage.error(apiError(e))
    }
  }

  const handleExtract = async () => {
    if (!selectedBundle) return
    try {
      const bundle = await extractRepairMessage(selectedBundle.message.id)
      setSelectedBundle(bundle)
      actionRef.current?.reload()
      antdMessage.success('AI识别结果已刷新')
    } catch (e) {
      antdMessage.error(apiError(e))
    }
  }

  const statCards = [
    { title: '今日报修', value: stats.today_repair ?? 0, icon: <MessageOutlined />, color: '#155eef' },
    { title: 'AI识别报修', value: stats.ai_recognized_repair ?? 0, icon: <RobotOutlined />, color: '#0f766e' },
    { title: '微信报修', value: stats.wechat_repair ?? 0, icon: <WechatOutlined />, color: '#16a34a' },
    { title: '飞书报修', value: stats.feishu_repair ?? 0, icon: <MessageOutlined />, color: '#7c3aed' },
    { title: '待确认消息', value: stats.pending_confirm_messages ?? 0, icon: <ClockCircleOutlined />, color: '#d97706' },
    { title: '待派工工单', value: stats.pending_dispatch_orders ?? 0, icon: <UserSwitchOutlined />, color: '#0369a1' },
    { title: '维修中工单', value: stats.in_progress_orders ?? 0, icon: <ToolOutlined />, color: '#0f766e' },
    { title: '急救设备故障', value: stats.emergency_device_faults ?? 0, icon: <ThunderboltOutlined />, color: '#dc2626' },
    { title: '超时未处理', value: stats.overdue_unhandled ?? 0, icon: <WarningOutlined />, color: '#b91c1c' },
  ]

  const columns: ProColumns<UnifiedRepairMessage>[] = [
    {
      title: '消息编号',
      dataIndex: 'message_no',
      width: 160,
      copyable: true,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Button
            type="link"
            className="unified-repair-link-button"
            onClick={() => {
              setSelectedId(row.id)
              setDrawerOpen(true)
            }}
          >
            {row.message_no}
          </Button>
          <Text type="secondary">{channelName(row)}</Text>
        </Space>
      ),
    },
    {
      title: '发送人',
      dataIndex: 'sender_name',
      width: 140,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.sender_name || '-'}</Text>
          <Text type="secondary">{row.sender_department || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'AI识别',
      dataIndex: 'keyword',
      ellipsis: true,
      render: (_, row) => (
        <Space direction="vertical" size={2}>
          <Text>{row.ai_extracted_device_name || '待识别设备'}</Text>
          <Text type="secondary">{`${row.ai_extracted_department || row.sender_department || '-'} ${row.ai_extracted_location || ''} · ${row.ai_extracted_fault_description || messageText(row)}`}</Text>
        </Space>
      ),
    },
    {
      title: '匹配度',
      dataIndex: 'matched_confidence',
      width: 130,
      search: false,
      render: (_, row) => <Progress percent={confidence(row.matched_confidence)} size="small" status={confidence(row.matched_confidence) < 60 ? 'exception' : 'active'} />,
    },
    {
      title: '紧急程度',
      dataIndex: 'ai_extracted_urgency',
      width: 100,
      search: false,
      render: (_, row) => urgencyTag(row.ai_extracted_urgency),
    },
    {
      title: '状态',
      dataIndex: 'confirm_status',
      width: 130,
      valueType: 'select',
      fieldProps: {
        options: Object.entries(STATUS_META).map(([value, meta]) => ({ value, label: meta.text })),
      },
      render: (_, row) => statusTag(row.confirm_status),
    },
    {
      title: '科室',
      dataIndex: 'sender_department',
      hideInTable: true,
    },
    {
      title: '消息类型',
      dataIndex: 'raw_message_type',
      hideInTable: true,
      valueType: 'select',
      fieldProps: { options: ['TEXT', 'VOICE', 'IMAGE', 'VIDEO', 'ALERT'].map((x) => ({ label: x, value: x })) },
    },
    {
      title: '操作',
      valueType: 'option',
      width: 190,
      render: (_, row) => [
        <Button
          key="detail"
          type="link"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedId(row.id)
            setDrawerOpen(true)
          }}
        >
          详情
        </Button>,
        row.converted_order_id ? (
          <Link key="order" to={`/repair/tickets/${row.converted_order_id}`}>
            工单
          </Link>
        ) : (
          <a
            key="confirm"
            onClick={() => {
              setSelectedId(row.id)
              setDrawerOpen(true)
            }}
          >
            确认
          </a>
        ),
      ],
    },
  ]

  const request: ProTableProps<UnifiedRepairMessage, MessageQuery>['request'] = async (params) => {
    setError(null)
    try {
      const payload = await fetchRepairCenterMessages({
        page: params.current ?? 1,
        page_size: params.pageSize ?? 20,
        source_channel: selectedChannel === 'ALL' ? undefined : selectedChannel,
        keyword: params.keyword,
        sender_department: params.sender_department,
        raw_message_type: params.raw_message_type,
        confirm_status: params.confirm_status,
      })
      setStats(payload.stats ?? {})
      if (!selectedId && payload.items[0]) setSelectedId(payload.items[0].id)
      return { data: payload.items, success: true, total: payload.total }
    } catch (e) {
      setError(apiError(e))
      return { data: [], success: false, total: 0 }
    }
  }

  const candidates = candidateDevices(selectedBundle)

  return (
    <div className="unified-repair-page">
      <PageHead
        title="统一报修中心"
        description="多渠道报修消息先进入中枢，经AI识别、设备匹配和人工确认后，再生成标准报修工单并进入闭环。"
      />

      {error ? <Alert className="unified-repair-page-alert" showIcon type="error" message="统一报修中心接口暂不可用" description={error} /> : null}

      <div className="unified-repair-stats">
        {statCards.map((item) => (
          <ProCard key={item.title} bordered className="unified-repair-stat-card">
            <Statistic title={item.title} value={item.value} prefix={item.icon} valueStyle={{ color: item.color }} />
          </ProCard>
        ))}
      </div>

      <div className="unified-repair-workbench">
        <aside className="unified-repair-channel-rail">
          <Text strong>渠道筛选</Text>
          <Segmented
            vertical
            block
            value={selectedChannel}
            options={CHANNEL_OPTIONS}
            onChange={(value) => {
              setSelectedChannel(String(value))
              actionRef.current?.reload()
            }}
          />
          <Alert showIcon type="warning" message="急救设备优先" description="生命支持、急救设备即使识别不完整，也会先推送值班人员。" />
        </aside>

        <main className="unified-repair-list">
          <ProTable<UnifiedRepairMessage, MessageQuery, 'text'>
            actionRef={actionRef}
            rowKey="id"
            columns={columns}
            request={request}
            search={{ labelWidth: 'auto', defaultCollapsed: true }}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            options={{ density: true, fullScreen: true, reload: true, setting: true }}
            onRow={(record) => ({
              onClick: () => setSelectedId(record.id),
            })}
          />
        </main>

        <aside className="unified-repair-side">
          {loadingBundle ? (
            <Spin />
          ) : selectedBundle ? (
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Badge status={isEmergency(selectedBundle) ? 'error' : 'processing'} text={isEmergency(selectedBundle) ? '急救/生命支持优先' : '常规报修'} />
              <Title level={5}>{extractedDevice(selectedBundle)}</Title>
              <Text>{extractedFault(selectedBundle)}</Text>
              <Text type="secondary">{`${extractedDepartment(selectedBundle)} · ${extractedLocation(selectedBundle)}`}</Text>
              <Progress percent={matchedConfidence(selectedBundle)} />
              <Space wrap>
                {statusTag(selectedBundle.message.confirm_status)}
                {urgencyTag(selectedBundle.latest_extract?.extracted_urgency || selectedBundle.message.ai_extracted_urgency)}
                <Tag>{selectedBundle.message.raw_message_type}</Tag>
              </Space>
              <div className="unified-repair-actions">
                <Button type="primary" disabled={selectedBundle.message.confirm_status === 'CONVERTED'} onClick={() => handleConfirm('CREATE_ORDER')}>
                  确认并生成工单
                </Button>
                <Button onClick={() => setDrawerOpen(true)}>重新选择设备</Button>
                <Button onClick={() => handleConfirm('NEED_MORE_INFO')}>补充描述</Button>
                <Button danger onClick={() => handleConfirm('MANUAL_REVIEW')}>转人工确认</Button>
              </div>
            </Space>
          ) : (
            <Text type="secondary">请选择一条报修消息</Text>
          )}
        </aside>
      </div>

      <section className="unified-repair-timeline">
        <Title level={5}>消息时间线</Title>
        <BundleTimeline bundle={selectedBundle} />
      </section>

      <Drawer
        title={`报修消息 ${selectedBundle?.message.message_no ?? ''}`}
        width={680}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={<Button icon={<RobotOutlined />} onClick={handleExtract}>重新识别</Button>}
      >
        {selectedBundle ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              type={matchedConfidence(selectedBundle) >= 85 ? 'success' : matchedConfidence(selectedBundle) >= 60 ? 'warning' : 'error'}
              showIcon
              message={`AI匹配度 ${matchedConfidence(selectedBundle)}%`}
              description={selectedBundle.message.matched_device_id ? `已匹配设备 ${selectedBundle.message.matched_device_id}` : '未达到自动匹配阈值，需要设备科确认设备身份。'}
            />
            <BundleTimeline bundle={selectedBundle} />
            <ProTable<CandidateDevice>
              rowKey={(row) => row.device_id || row.asset_code || row.display || Math.random().toString()}
              size="small"
              search={false}
              pagination={false}
              dataSource={candidates}
              columns={[
                { title: '疑似设备', dataIndex: 'display', ellipsis: true, render: (_, row) => row.display || row.device_name || '-' },
                { title: '资产编号', dataIndex: 'asset_code', width: 150 },
                { title: '匹配度', dataIndex: 'confidence', width: 100, render: (_, row) => `${confidence(row.confidence)}%` },
                {
                  title: '操作',
                  valueType: 'option',
                  width: 130,
                  render: (_, row) => <a onClick={() => handleConfirm('CREATE_ORDER', row)}>选择并生成</a>,
                },
              ]}
            />
            <Space wrap>
              <Button type="primary" onClick={() => handleConfirm('CREATE_ORDER')}>确认并生成工单</Button>
              <Button onClick={() => handleConfirm('NEED_MORE_INFO')}>退回用户补充</Button>
              <Button onClick={() => handleConfirm('MANUAL_REVIEW')}>转人工确认</Button>
              <Button danger onClick={() => handleConfirm('IGNORE')}>忽略</Button>
            </Space>
          </Space>
        ) : (
          <Spin />
        )}
      </Drawer>
    </div>
  )
}

function NewRepairView() {
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<RepairMessageBundle | null>(null)

  const submit = async (values: Record<string, string>) => {
    setSubmitting(true)
    try {
      const bundle = await createRepairCenterMessage({
        source_channel: values.source_channel,
        source_channel_name: CHANNEL_LABEL[values.source_channel] || values.source_channel,
        sender_name: values.sender_name,
        sender_phone: values.sender_phone,
        sender_department: values.sender_department,
        raw_message_type: values.raw_message_type,
        raw_message_content: values.raw_message_content,
        transcribed_text: values.raw_message_type === 'VOICE' ? values.raw_message_content : undefined,
        asset_id: values.asset_id || undefined,
        metadata: { entry: 'admin_form' },
      })
      setResult(bundle)
      antdMessage.success('已进入统一报修消息中枢')
    } catch (e) {
      antdMessage.error(apiError(e))
    } finally {
      setSubmitting(false)
    }
  }

  const confirmResult = async () => {
    if (!result) return
    try {
      const res = await confirmRepairCenterMessage(result.message.id, {
        confirm_action: 'CREATE_ORDER',
        selected_device_id: result.latest_extract?.matched_device_id || result.message.matched_device_id,
        fault_description: extractedFault(result),
        urgency: result.latest_extract?.extracted_urgency || result.message.ai_extracted_urgency,
      })
      antdMessage.success(res.converted_order ? `已生成工单 ${res.converted_order.order_code}` : '已提交确认')
    } catch (e) {
      antdMessage.error(apiError(e))
    }
  }

  return (
    <div className="unified-repair-page">
      <PageHead title="新建报修" description="电脑端后台报修、设备科人工代录和二维码入口补充，统一先形成报修消息，再按规则确认转工单。" />
      <div className="unified-repair-form-grid">
        <Form form={form} layout="vertical" className="unified-repair-form" onFinish={submit} initialValues={{ source_channel: 'PC_ADMIN', raw_message_type: 'TEXT' }}>
          <Form.Item label="报修来源" name="source_channel" rules={[{ required: true }]}>
            <Select options={CHANNEL_OPTIONS.filter((x) => x.value !== 'ALL').concat([{ label: '电脑端后台', value: 'PC_ADMIN' }, { label: '设备科人工代录', value: 'MANUAL_ENTRY' }])} />
          </Form.Item>
          <Form.Item label="报修人" name="sender_name">
            <Input placeholder="如 王护士、李医生、设备科代录" />
          </Form.Item>
          <Form.Item label="联系电话" name="sender_phone">
            <Input placeholder="手机号或院内短号" />
          </Form.Item>
          <Form.Item label="科室与位置" name="sender_department">
            <Input placeholder="如 ICU、急诊科、内镜中心" />
          </Form.Item>
          <Form.Item label="设备ID（二维码扫码或已知设备时填写）" name="asset_id">
            <Input placeholder="设备 UUID，可由资产中心二维码详情页带入" prefix={<QrcodeOutlined />} />
          </Form.Item>
          <Form.Item label="消息类型" name="raw_message_type" rules={[{ required: true }]}>
            <Select options={['TEXT', 'VOICE', 'IMAGE', 'VIDEO', 'ALERT'].map((x) => ({ label: x, value: x }))} />
          </Form.Item>
          <Form.Item label="故障描述" name="raw_message_content" rules={[{ required: true, message: '请描述故障现象' }]}>
            <Input.TextArea rows={4} placeholder="如 ICU 5床监护仪血压打不上去，一直报警。" />
          </Form.Item>
          <Space wrap>
            <Upload beforeUpload={() => { antdMessage.info('语音文件接入对象存储后会写入 voice_file_url'); return false }}>
              <Button icon={<AudioOutlined />}>上传语音</Button>
            </Upload>
            <Upload beforeUpload={() => { antdMessage.info('图片文件接入对象存储后会写入 image_file_url'); return false }}>
              <Button icon={<PictureOutlined />}>上传图片</Button>
            </Upload>
            <Upload beforeUpload={() => { antdMessage.info('视频文件接入对象存储后会写入 video_file_url'); return false }}>
              <Button icon={<CloudUploadOutlined />}>上传视频</Button>
            </Upload>
          </Space>
          <Space wrap className="unified-repair-submit-row">
            <Button loading={submitting} htmlType="submit" type="primary" icon={<RobotOutlined />}>AI识别并确认</Button>
            <Link to="/repair/pending-confirmations"><Button>查看待确认池</Button></Link>
          </Space>
        </Form>

        <section className="unified-repair-ai-preview">
          <Tag color="blue">AI识别预览</Tag>
          {result ? (
            <>
              <Title level={5}>{extractedDevice(result)}</Title>
              <Paragraph>{extractedFault(result)}</Paragraph>
              <Space wrap>
                {statusTag(result.message.confirm_status)}
                {urgencyTag(result.latest_extract?.extracted_urgency)}
                <Tag>{`${matchedConfidence(result)}%`}</Tag>
              </Space>
              <Steps
                direction="vertical"
                size="small"
                current={result.message.converted_order_id ? 3 : 2}
                items={[
                  { title: '接收报修消息', description: result.message.message_no },
                  { title: '抽取关键信息', description: `${extractedDepartment(result)} ${extractedLocation(result)}` },
                  { title: '匹配设备档案', description: `${candidateDevices(result).length || 0} 台疑似设备` },
                  { title: '生成标准工单', description: result.converted_order?.order_code || '等待确认' },
                ]}
              />
              <div className="unified-repair-candidate-list">
                {candidateDevices(result).map((item) => (
                  <div key={item.device_id}>
                    <Text strong>{item.display || item.device_name}</Text>
                    <Text type="secondary">{item.asset_code}</Text>
                    <Progress percent={confidence(item.confidence)} size="small" />
                  </div>
                ))}
              </div>
              <Button type="primary" onClick={confirmResult}>确认并生成工单</Button>
            </>
          ) : (
            <>
              <Title level={5}>等待输入报修内容</Title>
              <Steps
                direction="vertical"
                size="small"
                current={0}
                items={[
                  { title: '接收报修消息', description: '文字、语音、图片统一入池' },
                  { title: '抽取关键信息', description: '科室、位置、设备、故障、紧急程度' },
                  { title: '匹配设备档案', description: '展示候选设备并等待确认' },
                  { title: '生成标准工单', description: '确认后进入派工闭环' },
                ]}
              />
            </>
          )}
        </section>
      </div>
    </div>
  )
}

type ChatItem = {
  role: 'user' | 'ai'
  content: string
  messageId?: string
  extract?: RepairMessageBundle['latest_extract']
}

function AssistantView() {
  const [session, setSession] = useState<RepairAiSession | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [chat, setChat] = useState<ChatItem[]>([
    { role: 'ai', content: '请直接描述设备故障，也可以查询报修进度。我会先识别信息，再请你确认是否生成工单。' },
  ])

  const ensureSession = async () => {
    if (session) return session
    const created = await createRepairAiSession({ source_channel: 'AI_CHAT', current_intent: 'REPAIR_REPORT' })
    setSession(created)
    return created
  }

  const send = async () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    setSending(true)
    setChat((prev) => [...prev, { role: 'user', content: text }])
    try {
      if (/进度|处理到哪|到哪了|工单/.test(text)) {
        const code = text.match(/[A-Z]{1,3}\d{8,}/)?.[0]
        const progress = await fetchRepairProgress({ order_code: code, limit: 3 })
        const content = progress.items.length
          ? progress.items.map((x) => `工单号：${x.order_code}\n状态：${x.status_text || x.status}\n当前进度：${x.current_progress || '-'}`).join('\n\n')
          : '暂未查询到与你相关的报修工单。'
        setChat((prev) => [...prev, { role: 'ai', content }])
        return
      }
      const s = await ensureSession()
      const res = await appendRepairAiSessionMessage(s.id, { raw_message_type: 'TEXT', content: text })
      setSession(res.session)
      setChat((prev) => [
        ...prev,
        {
          role: 'ai',
          content: res.assistant_reply,
          messageId: res.message.id,
          extract: res.latest_extract,
        },
      ])
    } catch (e) {
      setChat((prev) => [...prev, { role: 'ai', content: `处理失败：${apiError(e)}` }])
    } finally {
      setSending(false)
    }
  }

  const confirmChatMessage = async (messageId: string) => {
    try {
      const res = await confirmRepairCenterMessage(messageId, { confirm_action: 'CREATE_ORDER' })
      setChat((prev) => [
        ...prev,
        { role: 'ai', content: res.converted_order ? `已生成报修工单：${res.converted_order.order_code}` : '已提交确认。' },
      ])
    } catch (e) {
      antdMessage.error(apiError(e))
    }
  }

  return (
    <div className="unified-repair-page">
      <PageHead title="AI报修助手" description="聊天式报修入口，支持文字、语音、图片、进度查询和常见故障自助排查。" />
      <div className="unified-repair-chat-layout">
        <section className="unified-repair-chat">
          {chat.map((item, idx) => (
            <div key={`${item.role}-${idx}`} className={`chat-bubble ${item.role}`}>
              <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: item.extract ? 8 : 0 }}>{item.content}</Paragraph>
              {item.extract ? (
                <>
                  <div className="chat-tags">
                    <Tag color="blue">{item.extract.extracted_department || '科室待确认'}</Tag>
                    <Tag color="cyan">{item.extract.extracted_location || '位置待确认'}</Tag>
                    <Tag color="orange">{item.extract.extracted_device_name || '设备待确认'}</Tag>
                    {urgencyTag(item.extract.extracted_urgency)}
                  </div>
                  <Space wrap>
                    <Button size="small" type="primary" disabled={!item.messageId} onClick={() => item.messageId && confirmChatMessage(item.messageId)}>
                      确认报修
                    </Button>
                    <Button size="small">更换设备</Button>
                    <Button size="small" icon={<PictureOutlined />}>补充照片</Button>
                    <Button size="small">转人工</Button>
                  </Space>
                </>
              ) : null}
            </div>
          ))}
          <Input.Search
            className="unified-repair-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入故障描述、报修进度查询或自助排查问题"
            enterButton={<SendOutlined />}
            loading={sending}
            onSearch={send}
          />
        </section>

        <aside className="unified-repair-assistant-side">
          <Title level={5}>助手能力</Title>
          <Space direction="vertical" size={8}>
            <Tag icon={<FileTextOutlined />}>文字报修</Tag>
            <Tag icon={<AudioOutlined />}>语音报修</Tag>
            <Tag icon={<PictureOutlined />}>图片上传</Tag>
            <Tag icon={<ToolOutlined />}>常见故障自助排查</Tag>
            <Tag icon={<CheckCircleOutlined />}>生成报修工单</Tag>
            <Tag icon={<ClockCircleOutlined />}>查询本人/本科室历史报修</Tag>
          </Space>
          <Alert showIcon type="info" message="确认机制" description="AI只生成识别结果和工单草稿，正式工单需要用户确认或设备科人工确认。" />
        </aside>
      </div>
    </div>
  )
}

function messageTypes(value: RepairChannelConfig['supported_message_types']) {
  if (Array.isArray(value)) return value
  return value?.items ?? []
}

function scopeLabel(value?: Record<string, unknown> | null) {
  const label = value?.label
  return typeof label === 'string' ? label : value ? JSON.stringify(value) : '-'
}

function ChannelsView() {
  const actionRef = useRef<ActionType>(null)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  const columns: ProColumns<RepairChannelConfig>[] = [
    { title: '渠道名称', dataIndex: 'channel_name', width: 180 },
    { title: '渠道类型', dataIndex: 'channel_type', width: 120, render: (_, row) => <Tag>{row.channel_type}</Tag> },
    {
      title: '启用状态',
      dataIndex: 'enabled',
      width: 100,
      render: (_, row) => (
        <Switch
          checked={row.enabled}
          onChange={async (checked) => {
            try {
              await patchRepairChannelConfig(row.id, { enabled: checked })
              antdMessage.success('渠道状态已更新')
              actionRef.current?.reload()
            } catch (e) {
              antdMessage.error(apiError(e))
            }
          }}
        />
      ),
    },
    { title: '机器人名称', dataIndex: 'robot_name', width: 160 },
    { title: '支持消息类型', dataIndex: 'supported_message_types', render: (_, row) => messageTypes(row.supported_message_types).map((x) => <Tag key={x}>{x}</Tag>) },
    { title: '科室范围', dataIndex: 'bound_department_scope', width: 160, render: (_, row) => scopeLabel(row.bound_department_scope) },
    { title: '自动生成', dataIndex: 'allow_auto_create_order', width: 100, render: (_, row) => <Tag color={row.allow_auto_create_order ? 'green' : 'default'}>{row.allow_auto_create_order ? '允许' : '关闭'}</Tag> },
    { title: '人工确认', dataIndex: 'require_manual_confirm', width: 100, render: (_, row) => <Tag color={row.require_manual_confirm ? 'orange' : 'blue'}>{row.require_manual_confirm ? '需要' : '可跳过'}</Tag> },
    { title: '回调地址', dataIndex: 'callback_url', ellipsis: true },
  ]

  const request: ProTableProps<RepairChannelConfig, Record<string, unknown>>['request'] = async () => {
    setError(null)
    try {
      const data = await fetchRepairChannelConfigs()
      return { data: data.items, success: true, total: data.total }
    } catch (e) {
      setError(apiError(e))
      return { data: [], success: false, total: 0 }
    }
  }

  const createChannel = async () => {
    const values = await form.validateFields()
    try {
      await createRepairChannelConfig({
        channel_name: values.channel_name,
        channel_type: values.channel_type,
        robot_name: values.robot_name,
        callback_url: values.callback_url,
        supported_message_types: { items: values.supported_message_types ?? [] },
        bound_department_scope: { label: values.bound_department_scope || '全院' },
        bound_user_scope: { label: values.bound_user_scope || '按渠道用户映射' },
        allow_auto_create_order: values.allow_auto_create_order ?? false,
        require_manual_confirm: values.require_manual_confirm ?? true,
      })
      antdMessage.success('渠道配置已创建')
      setModalOpen(false)
      form.resetFields()
      actionRef.current?.reload()
    } catch (e) {
      antdMessage.error(apiError(e))
    }
  }

  return (
    <div className="unified-repair-page">
      <PageHead title="多渠道接入" description="配置微信公众号、企业微信、飞书、钉钉、短信、内部消息、App/H5 和设备二维码入口。" />
      {error ? <Alert className="unified-repair-page-alert" showIcon type="error" message="渠道接口暂不可用" description={error} /> : null}
      <Alert className="unified-repair-page-alert" showIcon type="info" message="渠道安全" description="外部机器人回调需要签名校验、幂等写入和用户映射；Token / Secret 只显示脱敏摘要。" />
      <ProTable<RepairChannelConfig>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={request}
        search={false}
        pagination={false}
        toolBarRender={() => [<Button key="add" type="primary" icon={<ApiOutlined />} onClick={() => setModalOpen(true)}>新增渠道</Button>]}
      />
      <Modal title="新增报修渠道" open={modalOpen} onOk={createChannel} onCancel={() => setModalOpen(false)} destroyOnHidden>
        <Form form={form} layout="vertical" initialValues={{ enabled: true, require_manual_confirm: true, supported_message_types: ['TEXT', 'VOICE', 'IMAGE'] }}>
          <Form.Item name="channel_name" label="渠道名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="channel_type" label="渠道类型" rules={[{ required: true }]}>
            <Select options={CHANNEL_OPTIONS.filter((x) => x.value !== 'ALL')} />
          </Form.Item>
          <Form.Item name="robot_name" label="机器人名称">
            <Input />
          </Form.Item>
          <Form.Item name="callback_url" label="消息回调地址">
            <Input />
          </Form.Item>
          <Form.Item name="supported_message_types" label="支持消息类型">
            <Checkbox.Group options={['TEXT', 'VOICE', 'IMAGE', 'VIDEO', 'ALERT', 'CARD']} />
          </Form.Item>
          <Form.Item name="bound_department_scope" label="绑定科室范围">
            <Input placeholder="如 全院、急诊/ICU/手术室" />
          </Form.Item>
          <Form.Item name="bound_user_scope" label="绑定用户范围">
            <Input placeholder="如 院内用户、企业微信用户、手机号" />
          </Form.Item>
          <Form.Item name="allow_auto_create_order" label="是否允许自动生成工单" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="require_manual_confirm" label="是否需要人工确认" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function PendingView() {
  const actionRef = useRef<ActionType>(null)
  const [selected, setSelected] = useState<RepairMessageBundle | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runAction = async (bundle: RepairMessageBundle, action: 'CREATE_ORDER' | 'NEED_MORE_INFO' | 'MANUAL_REVIEW' | 'IGNORE', candidate?: CandidateDevice) => {
    try {
      await confirmRepairCenterMessage(bundle.message.id, {
        confirm_action: action,
        selected_device_id: candidate?.device_id || bundle.latest_extract?.matched_device_id || bundle.message.matched_device_id,
        fault_description: extractedFault(bundle),
        urgency: bundle.latest_extract?.extracted_urgency || bundle.message.ai_extracted_urgency,
      })
      antdMessage.success('待确认报修已处理')
      actionRef.current?.reload()
      if (selected?.message.id === bundle.message.id) {
        const fresh = await fetchRepairCenterMessageDetail(bundle.message.id)
        setSelected(fresh)
      }
    } catch (e) {
      antdMessage.error(apiError(e))
    }
  }

  const columns: ProColumns<RepairMessageBundle>[] = [
    { title: '消息来源', dataIndex: ['message', 'source_channel'], width: 130, render: (_, row) => channelName(row.message) },
    { title: '发送人', dataIndex: ['message', 'sender_name'], width: 110, render: (_, row) => row.message.sender_name || '-' },
    { title: '发送科室', dataIndex: ['message', 'sender_department'], width: 130, render: (_, row) => row.message.sender_department || '-' },
    { title: '原始内容', dataIndex: ['message', 'raw_message_content'], ellipsis: true, render: (_, row) => row.message.raw_message_content || '-' },
    { title: '语音转文字', dataIndex: ['message', 'transcribed_text'], ellipsis: true, render: (_, row) => row.message.transcribed_text || '-' },
    { title: 'AI识别设备', dataIndex: ['latest_extract', 'extracted_device_name'], width: 170, render: (_, row) => extractedDevice(row) },
    { title: 'AI识别故障', dataIndex: ['latest_extract', 'extracted_fault_description'], width: 220, ellipsis: true, render: (_, row) => extractedFault(row) },
    { title: '匹配置信度', dataIndex: ['latest_extract', 'matched_confidence'], width: 120, render: (_, row) => `${matchedConfidence(row)}%` },
    { title: '处理状态', dataIndex: ['message', 'confirm_status'], width: 130, render: (_, row) => statusTag(row.message.confirm_status) },
    {
      title: '操作',
      valueType: 'option',
      width: 250,
      render: (_, row) => [
        <a key="confirm" onClick={() => runAction(row, 'CREATE_ORDER')}>确认设备并生成工单</a>,
        <a key="more" onClick={() => runAction(row, 'NEED_MORE_INFO')}>退回补充</a>,
        <a key="drawer" onClick={() => { setSelected(row); setDrawerOpen(true) }}>疑似设备</a>,
      ],
    },
  ]

  const request: ProTableProps<RepairMessageBundle, PendingQuery>['request'] = async (params) => {
    setError(null)
    try {
      const data = await fetchPendingRepairMessages({
        page: params.current ?? 1,
        page_size: params.pageSize ?? 20,
        source_channel: params.source_channel,
        keyword: params.keyword,
      })
      return { data: data.items, success: true, total: data.total }
    } catch (e) {
      setError(apiError(e))
      return { data: [], success: false, total: 0 }
    }
  }

  return (
    <div className="unified-repair-page">
      <PageHead title="待确认报修" description="无法准确匹配设备的聊天、语音、微信、机器人和预警报修进入待确认池，由设备科确认后转为正式工单。" />
      {error ? <Alert className="unified-repair-page-alert" showIcon type="error" message="待确认池接口暂不可用" description={error} /> : null}
      <ProTable<RepairMessageBundle, PendingQuery, 'text'>
        actionRef={actionRef}
        rowKey={(row) => row.message.id}
        columns={columns}
        request={request}
        search={{ labelWidth: 'auto', defaultCollapsed: false }}
        pagination={{ pageSize: 8 }}
      />
      <Drawer title="疑似设备列表" open={drawerOpen} width={620} onClose={() => setDrawerOpen(false)}>
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <BundleTimeline bundle={selected} />
          <ProTable<CandidateDevice>
            rowKey="device_id"
            dataSource={candidateDevices(selected)}
            search={false}
            pagination={false}
            columns={[
              { title: '疑似设备', dataIndex: 'display', render: (_, row) => row.display || row.device_name },
              { title: '资产编号', dataIndex: 'asset_code', width: 150 },
              { title: '匹配度', dataIndex: 'confidence', width: 90, render: (_, row) => `${confidence(row.confidence)}%` },
              { title: '操作', valueType: 'option', width: 110, render: (_, row) => selected ? <a onClick={() => runAction(selected, 'CREATE_ORDER', row)}>选择生成</a> : null },
            ]}
          />
        </Space>
      </Drawer>
    </div>
  )
}

function RulesView() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const data = await fetchRepairRuleConfig()
        if (cancelled) return
        const rules = data.channel_confirm_rules ?? {}
        form.setFieldsValue({
          ...data,
          channel_confirm_list: Object.entries(rules).filter(([, v]) => String(v).includes('CONFIRM')).map(([k]) => k),
        })
      } catch (e) {
        if (!cancelled) setError(apiError(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [form])

  const save = async (values: RepairRuleConfig & { channel_confirm_list?: string[] }) => {
    setSaving(true)
    try {
      const confirmList = values.channel_confirm_list ?? []
      await patchRepairRuleConfig({
        allow_ai_auto_create_order: values.allow_ai_auto_create_order,
        channel_confirm_rules: Object.fromEntries(confirmList.map((x) => [x, 'MANUAL_CONFIRM'])),
        emergency_auto_upgrade: values.emergency_auto_upgrade,
        night_shift_notify: values.night_shift_notify,
        night_shift_time_range: values.night_shift_time_range,
        dispatch_timeout_minutes: values.dispatch_timeout_minutes,
        acceptance_timeout_hours: values.acceptance_timeout_hours,
        high_value_notify_threshold: values.high_value_notify_threshold,
        repeat_repair_window_days: values.repeat_repair_window_days,
        repeat_repair_threshold: values.repeat_repair_threshold,
        life_support_spare_hint: values.life_support_spare_hint,
        allow_clinical_progress_view: values.allow_clinical_progress_view,
      })
      antdMessage.success('报修规则已保存')
    } catch (e) {
      antdMessage.error(apiError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="unified-repair-page">
      <PageHead title="报修规则配置" description="用规则约束AI自动生成、人工确认、急救设备升级、夜间值班推送、SLA提醒和风险预警。" />
      {error ? <Alert className="unified-repair-page-alert" showIcon type="error" message="规则接口暂不可用" description={error} /> : null}
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" className="unified-repair-rules" onFinish={save}>
          <Form.Item label="是否允许AI自动生成工单" name="allow_ai_auto_create_order" valuePropName="checked">
            <Switch checkedChildren="允许" unCheckedChildren="关闭" />
          </Form.Item>
          <Form.Item label="不同渠道是否需要人工确认" name="channel_confirm_list">
            <Checkbox.Group options={[
              { label: '微信公众号', value: 'WECHAT' },
              { label: '企业微信', value: 'WEWORK' },
              { label: '飞书', value: 'FEISHU' },
              { label: '钉钉', value: 'DINGTALK' },
              { label: '系统预警', value: 'SYSTEM_ALERT' },
            ]} />
          </Form.Item>
          <Form.Item label="急救设备是否自动升级紧急程度" name="emergency_auto_upgrade" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="夜间报修是否推送值班人员" name="night_shift_notify" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="夜间时间范围" name="night_shift_time_range">
            <Input placeholder="18:00-08:00" />
          </Form.Item>
          <Form.Item label="超时未派工提醒规则（分钟）" name="dispatch_timeout_minutes">
            <InputNumber min={5} max={24 * 60} />
          </Form.Item>
          <Form.Item label="超时未验收提醒规则（小时）" name="acceptance_timeout_hours">
            <InputNumber min={1} max={24 * 30} />
          </Form.Item>
          <Form.Item label="高价值设备报修通知设备科主任阈值（元）" name="high_value_notify_threshold">
            <InputNumber min={0} step={50000} />
          </Form.Item>
          <Form.Item label="同一设备重复报修窗口（天）" name="repeat_repair_window_days">
            <InputNumber min={1} max={365} />
          </Form.Item>
          <Form.Item label="同一设备重复报修阈值（次）" name="repeat_repair_threshold">
            <InputNumber min={2} max={50} />
          </Form.Item>
          <Form.Item label="生命支持类设备故障提示备用设备调配" name="life_support_spare_hint" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="是否允许临床用户查看维修进度" name="allow_clinical_progress_view" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Space>
            <Button loading={saving} htmlType="submit" type="primary" icon={<SaveOutlined />}>保存规则</Button>
            <Button>查看规则命中记录</Button>
          </Space>
        </Form>
      </Spin>
    </div>
  )
}

export function UnifiedRepairCenterPage({ mode }: { mode: UnifiedRepairMode }) {
  if (mode === 'new') return <NewRepairView />
  if (mode === 'assistant') return <AssistantView />
  if (mode === 'channels') return <ChannelsView />
  if (mode === 'pending') return <PendingView />
  if (mode === 'rules') return <RulesView />
  return <WorkbenchView />
}
