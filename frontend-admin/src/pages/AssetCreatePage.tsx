import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Button,
  Descriptions,
  Empty,
  Input,
  List,
  Modal,
  Progress,
  Select,
  Space,
  Steps,
  Table,
  Tag,
  Timeline,
  Typography,
  Upload,
  message,
} from 'antd'
import type { UploadFile } from 'antd'
import {
  AuditOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  DatabaseOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  QrcodeOutlined,
  RobotOutlined,
  SaveOutlined,
  SearchOutlined,
} from '@ant-design/icons'

import {
  addAssetIntakeFile,
  approveAssetIntakeTask,
  createAssetFromIntake,
  createAssetIntakeTask,
  extractAssetIntakeTask,
  fetchAssetIntakeTask,
  matchAssetIntakeMdm,
  reviewAssetIntakeTask,
  type AssetIntakeTaskJson,
} from '../api/assets'
import type { DeviceCategory } from '../api/mdm'
import type { BusinessPartnerMaster, DepartmentMaster, DisciplineMaster, PersonMaster } from '../api/mdm'
import { DeviceCategorySelector } from '../components/DeviceCategorySelector'
import { OrgMasterSelector } from '../components/OrgMasterSelector'
import { BusinessPartnerSelector } from '../components/BusinessPartnerSelector'
import { ApiClientError } from '../lib/api'

const { Paragraph, Text, Title } = Typography

type FieldValue = { value?: unknown; confidence?: number; source?: string; basis?: string; mock?: boolean; conflict?: boolean }
type ReviewPayload = {
  basic: Record<string, unknown>
  procurement: Record<string, unknown>
  usage: Record<string, unknown>
  components: Record<string, unknown>[]
  mdmDepartment?: DepartmentMaster
  mdmPerson?: PersonMaster
  mdmDiscipline?: DisciplineMaster
  mdmBusinessPartners?: {
    manufacturer?: BusinessPartnerMaster
    supplier?: BusinessPartnerMaster
    registrationHolder?: BusinessPartnerMaster
    maintainer?: BusinessPartnerMaster
    brandOwner?: BusinessPartnerMaster
    installer?: BusinessPartnerMaster
  }
}
type MatchCategory = DeviceCategory & { confidence?: number; matchBasis?: string[]; degraded?: boolean }

const fileTypes = [
  { key: 'nameplate_photo', label: '设备铭牌照片' },
  { key: 'appearance_photo', label: '设备外观照片' },
  { key: 'invoice', label: '发票' },
  { key: 'contract', label: '合同' },
  { key: 'acceptance_doc', label: '验收单' },
  { key: 'packing_list', label: '装箱单' },
  { key: 'registration_certificate', label: '注册证' },
  { key: 'manual', label: '说明书' },
  { key: 'other', label: '其他附件' },
]

const basicFields = [
  ['device_name', '设备名称'],
  ['generic_name', '通用名称'],
  ['brand', '品牌'],
  ['model', '型号'],
  ['specification', '规格'],
  ['serial_number', '序列号 / 出厂编号'],
  ['manufacturer_name', '生产厂家'],
  ['production_date', '生产日期'],
  ['registration_no', '注册证编号'],
  ['management_class', '管理类别'],
]

const procurementFields = [
  ['supplier_name', '供应商'],
  ['contract_no', '采购合同号'],
  ['invoice_no', '发票号'],
  ['purchase_amount', '采购金额'],
  ['purchase_date', '购置日期'],
  ['arrival_date', '到货日期'],
  ['acceptance_date', '验收日期'],
]

const usageFields = [
  ['department_name', '使用科室'],
  ['location', '存放位置'],
  ['responsible_person', '责任人'],
  ['install_date', '启用日期'],
]

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function asField(value: unknown): FieldValue {
  return asRecord(value) as FieldValue
}

function text(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'number') return value.toLocaleString('zh-CN')
  return String(value)
}

function confidenceColor(value?: number) {
  if ((value ?? 0) >= 90) return 'green'
  if ((value ?? 0) >= 70) return 'orange'
  return 'red'
}

function confidenceLabel(value?: number) {
  if (value == null) return '待识别'
  if (value >= 90) return '推荐值'
  if (value >= 70) return '需确认'
  return '必须人工确认'
}

function toReviewPayload(task: AssetIntakeTaskJson | null): ReviewPayload {
  const raw = asRecord(task?.review_payload)
  const rawPartners = asRecord(raw.mdmBusinessPartners)
  return {
    basic: asRecord(raw.basic),
    procurement: asRecord(raw.procurement),
    usage: asRecord(raw.usage),
    components: Array.isArray(raw.components) ? raw.components.map(asRecord) : [],
    mdmDepartment: asRecord(raw.mdmDepartment).id ? asRecord(raw.mdmDepartment) as DepartmentMaster : undefined,
    mdmPerson: asRecord(raw.mdmPerson).id ? asRecord(raw.mdmPerson) as PersonMaster : undefined,
    mdmDiscipline: asRecord(raw.mdmDiscipline).id ? asRecord(raw.mdmDiscipline) as DisciplineMaster : undefined,
    mdmBusinessPartners: {
      ...(asRecord(rawPartners.manufacturer).id ? { manufacturer: rawPartners.manufacturer as BusinessPartnerMaster } : {}),
      ...(asRecord(rawPartners.supplier).id ? { supplier: rawPartners.supplier as BusinessPartnerMaster } : {}),
      ...(asRecord(rawPartners.registrationHolder).id ? { registrationHolder: rawPartners.registrationHolder as BusinessPartnerMaster } : {}),
      ...(asRecord(rawPartners.maintainer).id ? { maintainer: rawPartners.maintainer as BusinessPartnerMaster } : {}),
      ...(asRecord(rawPartners.brandOwner).id ? { brandOwner: rawPartners.brandOwner as BusinessPartnerMaster } : {}),
      ...(asRecord(rawPartners.installer).id ? { installer: rawPartners.installer as BusinessPartnerMaster } : {}),
    },
  }
}

function categoryFromMatch(value: unknown): MatchCategory | null {
  const raw = asRecord(value)
  if (!raw.id || !raw.code || !raw.name) return null
  return {
    id: text(raw.id),
    code: text(raw.code),
    name: text(raw.name),
    path: text(raw.path),
    parentId: raw.parentId == null ? null : text(raw.parentId),
    level: typeof raw.level === 'number' ? raw.level : null,
    managementClass: raw.managementClass == null ? null : text(raw.managementClass),
    source: text(raw.source) || 'h-mdm',
    version: raw.version == null ? null : text(raw.version),
    enabled: raw.enabled !== false,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : undefined,
    matchBasis: Array.isArray(raw.matchBasis) ? raw.matchBasis.map(text) : [],
    degraded: raw.degraded === true,
  }
}

function partnerFromMatch(value: unknown): BusinessPartnerMaster | null {
  const raw = asRecord(value)
  if (!raw.id || !raw.code || !raw.name) return null
  return raw as unknown as BusinessPartnerMaster
}

function partnerSummary(row?: BusinessPartnerMaster) {
  if (!row) return null
  return (
    <Space direction="vertical" size={0}>
      <Text>{row.name}（{row.code}）</Text>
      <Text type="secondary">
        {row.unifiedSocialCreditCode || '未标注统一社会信用代码'} · {row.source} · {row.version || '—'}
      </Text>
      <Space size={4} wrap>
        {(row.roles || []).slice(0, 3).map((role) => <Tag key={role.id}>{role.roleName || role.roleType}</Tag>)}
        {row.qualificationStatus ? <Tag color={row.qualificationStatus === 'valid' ? 'green' : 'orange'}>资质 {row.qualificationStatus}</Tag> : null}
      </Space>
    </Space>
  )
}

function errorMessage(error: unknown) {
  return error instanceof ApiClientError || error instanceof Error ? error.message : String(error)
}

function sectionValue(task: AssetIntakeTaskJson | null, section: string, key: string): FieldValue {
  return asField(asRecord(asRecord(task?.extracted_fields)[section])[key])
}

export function AssetCreatePage() {
  const navigate = useNavigate()
  const [task, setTask] = useState<AssetIntakeTaskJson | null>(null)
  const [reviewPayload, setReviewPayload] = useState<ReviewPayload>(() => toReviewPayload(null))
  const [selectedCategory, setSelectedCategory] = useState<MatchCategory | null>(null)
  const [categorySelectorOpen, setCategorySelectorOpen] = useState(false)
  const [orgSelector, setOrgSelector] = useState<'department' | 'person' | 'discipline' | null>(null)
  const [partnerSelector, setPartnerSelector] = useState<'manufacturer' | 'supplier' | 'registrationHolder' | 'maintainer' | 'brandOwner' | 'installer' | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [activeFileType, setActiveFileType] = useState('nameplate_photo')
  const [logs, setLogs] = useState<string[]>(['进入智能建档工作台，等待资料采集。'])
  const [assetCode, setAssetCode] = useState('')

  const matchResult = useMemo(() => asRecord(task?.mdm_match_result), [task])
  const candidates = useMemo(
    () => (Array.isArray(matchResult.candidates) ? matchResult.candidates.map(categoryFromMatch).filter((x): x is MatchCategory => Boolean(x)) : []),
    [matchResult],
  )
  const connected = matchResult.connected === true
  const degraded = matchResult.degraded === true || selectedCategory?.degraded === true
  const canCreate = task?.ai_review_status === 'approved' && selectedCategory?.source === 'h-mdm' && !degraded
  const partners = reviewPayload.mdmBusinessPartners ?? {}

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const row = await createAssetIntakeTask({ title: '智能建档：病人监护仪资料采集', mode: 'single', intake_source: 'nameplate_photo' })
        if (cancelled) return
        setTask(row)
        setReviewPayload(toReviewPayload(row))
        setLogs((prev) => [`已创建智能建档任务 ${row.id.slice(0, 8)}。`, ...prev])
      } catch (error) {
        if (!cancelled) message.error(errorMessage(error))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!task) return
    setReviewPayload(toReviewPayload(task))
    const selected = categoryFromMatch(asRecord(task.mdm_match_result).selectedCategory)
    const recommended = categoryFromMatch(asRecord(task.mdm_match_result).categoryRecommendation)
    setSelectedCategory(selected ?? recommended)
  }, [task])

  async function run(label: string, work: () => Promise<void>) {
    setBusy(label)
    try {
      await work()
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  async function archiveFiles(files: UploadFile[]) {
    if (!task) {
      message.warning('智能建档任务尚未创建完成')
      return
    }
    await run('archive', async () => {
      for (const file of files) {
        await addAssetIntakeFile(task.id, {
          file_name: file.name,
          file_type: activeFileType,
          mime_type: file.type,
          size_bytes: file.size,
        })
      }
      const latest = await fetchAssetIntakeTask(task.id)
      setTask(latest)
      setLogs((prev) => [`已归档 ${files.length} 份原始资料，文件类型：${fileTypes.find((x) => x.key === activeFileType)?.label ?? activeFileType}。`, ...prev])
    })
  }

  function setReview(section: 'basic' | 'procurement' | 'usage', key: string, value: string) {
    setReviewPayload((prev) => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }))
  }

  function selectDepartment(row: DepartmentMaster) {
    setReviewPayload((prev) => ({
      ...prev,
      usage: { ...prev.usage, department_name: row.name },
      mdmDepartment: row,
    }))
    setOrgSelector(null)
    setLogs((prev) => [`已选择 H-UMDG 使用科室：${row.name}（${row.code}）。`, ...prev])
  }

  function selectPerson(row: PersonMaster) {
    setReviewPayload((prev) => ({
      ...prev,
      usage: { ...prev.usage, responsible_person: row.name },
      mdmPerson: row,
    }))
    setOrgSelector(null)
    setLogs((prev) => [`已选择 H-UMDG 责任人：${row.name}（${row.employeeNo || row.code}）。`, ...prev])
  }

  function selectDiscipline(row: DisciplineMaster) {
    setReviewPayload((prev) => ({
      ...prev,
      mdmDiscipline: row,
    }))
    setOrgSelector(null)
    setLogs((prev) => [`已选择 H-UMDG 服务学科：${row.name}（${row.code}）。`, ...prev])
  }

  function selectPartner(key: NonNullable<typeof partnerSelector>, row: BusinessPartnerMaster) {
    const fieldMap: Record<string, [string, 'basic' | 'procurement']> = {
      manufacturer: ['manufacturer_name', 'basic'],
      supplier: ['supplier_name', 'procurement'],
      registrationHolder: ['registration_holder_name', 'basic'],
      maintainer: ['maintainer_name', 'procurement'],
      brandOwner: ['brand_owner_name', 'basic'],
      installer: ['installer_name', 'procurement'],
    }
    const [field, section] = fieldMap[key] ?? ['manufacturer_name', 'basic']
    setReviewPayload((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: row.name },
      mdmBusinessPartners: { ...(prev.mdmBusinessPartners ?? {}), [key]: row },
    }))
    setPartnerSelector(null)
    setLogs((prev) => [`已选择 H-UMDG 往来单位：${row.name}（${row.code}）。`, ...prev])
  }

  async function handleExtract() {
    if (!task) return
    await run('extract', async () => {
      const row = await extractAssetIntakeTask(task.id)
      setTask(row)
      setLogs((prev) => ['AI/OCR mock provider 已完成信息抽取，结果已标记 mock，等待人工审核。', ...prev])
    })
  }

  async function handleMatch() {
    if (!task) return
    await run('match', async () => {
      const row = await matchAssetIntakeMdm(task.id)
      setTask(row)
      const next = categoryFromMatch(asRecord(row.mdm_match_result).categoryRecommendation)
      const manufacturer = partnerFromMatch(asRecord(row.mdm_match_result).manufacturerRecommendation)
      const supplier = partnerFromMatch(asRecord(row.mdm_match_result).supplierRecommendation)
      const holder = partnerFromMatch(asRecord(row.mdm_match_result).registrationHolderRecommendation)
      setReviewPayload((prev) => ({
        ...prev,
        mdmBusinessPartners: {
          ...(prev.mdmBusinessPartners ?? {}),
          ...(manufacturer ? { manufacturer } : {}),
          ...(supplier ? { supplier } : {}),
          ...(holder ? { registrationHolder: holder } : {}),
        },
      }))
      if (next) {
        setSelectedCategory(next)
        setLogs((prev) => [`H-UMDG 已推荐分类目录：${next.name}，置信度 ${next.confidence ?? '—'}%。`, ...prev])
      } else {
        setLogs((prev) => ['H-UMDG 未找到匹配分类目录，可提交主数据补充申请。', ...prev])
      }
    })
  }

  async function handleSaveReview(status: 'draft' | 'pending_review') {
    if (!task) return
    await run(status, async () => {
      const row = await reviewAssetIntakeTask(task.id, {
        review_payload: reviewPayload as unknown as Record<string, unknown>,
        selected_mdm_category: selectedCategory as unknown as Record<string, unknown> | undefined,
        review_status: status,
      })
      setTask(row)
      setLogs((prev) => [status === 'draft' ? '已保存建档草稿。' : '已提交人工审核，等待审核通过后正式建档。', ...prev])
      message.success(status === 'draft' ? '草稿已保存' : '已提交审核')
    })
  }

  async function handleApprove() {
    if (!task) return
    await run('approve', async () => {
      const row = await approveAssetIntakeTask(task.id)
      setTask(row)
      setLogs((prev) => ['人工审核已通过，可以正式生成设备档案和二维码。', ...prev])
      message.success('审核已通过')
    })
  }

  async function handleCreateAsset() {
    if (!task) return
    if (!canCreate) {
      message.warning('必须审核通过，并选择 connected=true、degraded=false 的 H-UMDG 分类目录后才能正式建档')
      return
    }
    await run('create', async () => {
      const result = await createAssetFromIntake(task.id, { asset_code: assetCode.trim() || undefined })
      setLogs((prev) => [`已正式生成设备档案 ${result.asset.asset_code}，并生成二维码记录。`, ...prev])
      message.success('设备档案已生成')
      navigate(`/lifecycle/assets/${result.asset.id}`)
    })
  }

  function manualSelect(category: DeviceCategory) {
    const next: MatchCategory = { ...category, confidence: 100, matchBasis: ['人工通过 H-UMDG 分类目录选择器确认'], degraded: false }
    setSelectedCategory(next)
    setCategorySelectorOpen(false)
    setLogs((prev) => [`人工选择 H-UMDG 分类目录：${next.name}（${next.code}）。`, ...prev])
  }

  const steps = [
    { title: '资料采集', status: task?.files.length ? 'finish' : 'process' },
    { title: 'AI/OCR识别', status: task?.ai_extraction_status.includes('completed') ? 'finish' : task?.files.length ? 'process' : 'wait' },
    { title: 'H-UMDG匹配', status: connected && !degraded ? 'finish' : task?.ai_extraction_status.includes('completed') ? 'process' : 'wait' },
    { title: '人工审核', status: task?.ai_review_status === 'approved' ? 'finish' : task?.status === 'pending_review' ? 'process' : 'wait' },
    { title: '正式建档', status: task?.created_asset_id ? 'finish' : canCreate ? 'process' : 'wait' },
  ] as const

  const fieldTable = (section: 'basic' | 'procurement' | 'usage', rows: string[][]) => (
    <Table
      size="small"
      pagination={false}
      rowKey={(row) => row[0]}
      dataSource={rows}
      columns={[
        { title: '字段', width: 132, render: (_, row) => row[1] },
        {
          title: '识别结果 / 审核值',
          render: (_, row) => {
            const field = sectionValue(task, section, row[0])
            const orgField = section === 'usage' && ['department_name', 'responsible_person'].includes(row[0])
            return (
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                {orgField ? (
                  <Space.Compact style={{ width: '100%' }}>
                    <Input
                      readOnly
                      value={text(reviewPayload[section][row[0]])}
                      status={field.conflict ? 'error' : undefined}
                      onClick={() => setOrgSelector(row[0] === 'department_name' ? 'department' : 'person')}
                    />
                    <Button type="primary" onClick={() => setOrgSelector(row[0] === 'department_name' ? 'department' : 'person')}>
                      选择
                    </Button>
                  </Space.Compact>
                ) : (
                  <Input
                    value={text(reviewPayload[section][row[0]])}
                    onChange={(event) => setReview(section, row[0], event.target.value)}
                    status={field.conflict ? 'error' : undefined}
                  />
                )}
                <Text type="secondary">
                  {orgField
                    ? '来自 H-UMDG 主数据，请通过选择器选择。如需新增或修正，请在 H-UMDG 中维护。'
                    : field.source ? `${field.source} · ${field.basis ?? ''}` : '等待 OCR/AI 识别'}
                </Text>
              </Space>
            )
          },
        },
        {
          title: '置信度',
          width: 128,
          render: (_, row) => {
            const field = sectionValue(task, section, row[0])
            return (
              <Space direction="vertical" size={2}>
                <Tag color={confidenceColor(field.confidence)}>{field.confidence == null ? '—' : `${field.confidence}%`}</Tag>
                <Text type={field.confidence != null && field.confidence < 70 ? 'danger' : 'secondary'}>{confidenceLabel(field.confidence)}</Text>
              </Space>
            )
          },
        },
      ]}
    />
  )

  return (
    <div className="page asset-create-page">
      <div className="master-data-source-page__hero">
        <div>
          <Text className="master-data-source-page__eyebrow">Asset Intelligent Intake</Text>
          <Title level={2}>智能建档工作台</Title>
          <Paragraph>
            通过铭牌和业务附件抽取设备信息，再由 OS 后端调用 H-UMDG 匹配主数据；正式建档必须经过人工审核确认。
          </Paragraph>
        </div>
        <Space wrap>
          <Tag color={connected && !degraded ? 'green' : 'orange'} icon={<DatabaseOutlined />}>
            H-UMDG {connected && !degraded ? 'connected=true · degraded=false' : '待匹配/不可用'}
          </Tag>
          <Button icon={<SaveOutlined />} loading={busy === 'draft'} onClick={() => void handleSaveReview('draft')}>保存草稿</Button>
          <Button icon={<AuditOutlined />} loading={busy === 'pending_review'} onClick={() => void handleSaveReview('pending_review')}>提交审核</Button>
          <Button icon={<CheckCircleOutlined />} loading={busy === 'approve'} onClick={() => void handleApprove()}>审核通过</Button>
          <Button type="primary" icon={<QrcodeOutlined />} loading={busy === 'create'} disabled={!canCreate} onClick={() => void handleCreateAsset()}>
            正式建档
          </Button>
        </Space>
      </div>

      <Steps size="small" items={steps.map((step) => ({ title: step.title, status: step.status }))} style={{ marginBottom: 16 }} />

      <Alert
        showIcon
        type={degraded ? 'error' : 'info'}
        message={degraded ? '当前为降级数据，不允许作为正式主数据引用保存。' : 'H-UMDG 是主数据权威来源，AI/OCR 结果必须人工确认后才能正式建档。'}
        description="OCR/AI 当前使用可替换 mock provider，所有 mock 结果均明确标记；正式主数据分类只允许来自 H-UMDG。"
        style={{ marginBottom: 16 }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 0.9fr) minmax(420px, 1.45fr) minmax(320px, 1fr)', gap: 16, alignItems: 'start' }}>
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#fff' }}>
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <Space>
              <CloudUploadOutlined />
              <Text strong>资料采集与原始归档</Text>
            </Space>
            <Select
              value={activeFileType}
              onChange={setActiveFileType}
              options={fileTypes.map((item) => ({ value: item.key, label: item.label }))}
              style={{ width: '100%' }}
            />
            <Upload.Dragger
              multiple
              showUploadList={false}
              beforeUpload={(file) => {
                void archiveFiles([file as UploadFile])
                return Upload.LIST_IGNORE
              }}
            >
              <p><CloudUploadOutlined style={{ fontSize: 28 }} /></p>
              <p>上传或拍摄资料</p>
              <p><Text type="secondary">铭牌、外观、发票、合同、验收单、装箱单、注册证、说明书等会形成原始资料归档。</Text></p>
            </Upload.Dragger>
            <Space wrap>
              <Tag color="blue">单台设备</Tag>
              <Tag color="purple">批量同型号</Tag>
              <Tag color="cyan">历史补建</Tag>
              <Tag color="gold">成套设备</Tag>
            </Space>
            <List
              size="small"
              dataSource={task?.files ?? []}
              locale={{ emptyText: '暂无归档资料' }}
              renderItem={(file) => (
                <List.Item>
                  <Space direction="vertical" size={0}>
                    <Text strong>{file.file_name}</Text>
                    <Text type="secondary">{file.file_type} · {file.archive_status} · {file.size_bytes ?? 0} bytes</Text>
                  </Space>
                </List.Item>
              )}
            />
          </Space>
        </section>

        <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#fff' }}>
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
              <Space>
                <RobotOutlined />
                <Text strong>AI/OCR 识别与人工审核</Text>
                {task?.ai_extraction_status === 'mock_completed' ? <Tag color="orange">mock provider</Tag> : null}
              </Space>
              <Button type="primary" icon={<FileSearchOutlined />} loading={busy === 'extract'} onClick={() => void handleExtract()}>
                AI/OCR识别
              </Button>
            </Space>
            <Progress percent={Number(task?.ai_extraction_confidence ?? 0)} status={task?.ai_extraction_status === 'mock_completed' ? 'active' : 'normal'} />
            <Title level={5}>基础信息</Title>
            {fieldTable('basic', basicFields)}
            <Title level={5}>采购信息</Title>
            {fieldTable('procurement', procurementFields)}
            <Title level={5}>使用信息</Title>
            {fieldTable('usage', usageFields)}
            <Title level={5}>附件/组成结构</Title>
            <Table
              size="small"
              pagination={false}
              rowKey={(row, index) => `${row.name}-${index}`}
              dataSource={reviewPayload.components}
              columns={[
                { title: '部件', dataIndex: 'name' },
                { title: '类型', dataIndex: 'type', width: 132 },
                { title: '数量', dataIndex: 'quantity', width: 80 },
                { title: '独立二维码', dataIndex: 'independent_qr', width: 110, render: (value) => value ? <Tag color="green">是</Tag> : <Tag>否</Tag> },
                { title: '置信度', dataIndex: 'confidence', width: 96, render: (value) => <Tag color={confidenceColor(Number(value))}>{text(value)}%</Tag> },
              ]}
              locale={{ emptyText: 'OCR 后展示主机、附件、探头、模块、线缆、软件授权等组成部件' }}
            />
          </Space>
        </section>

        <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#fff' }}>
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <Space align="center" style={{ justifyContent: 'space-between', width: '100%' }}>
              <Space>
                <DatabaseOutlined />
                <Text strong>H-UMDG 主数据匹配</Text>
              </Space>
              <Button icon={<SearchOutlined />} loading={busy === 'match'} onClick={() => void handleMatch()}>
                自动匹配
              </Button>
            </Space>
            {matchResult.message ? <Alert type={degraded ? 'error' : 'warning'} showIcon message={text(matchResult.message)} /> : null}
            {selectedCategory ? (
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="推荐分类">{selectedCategory.name}</Descriptions.Item>
                <Descriptions.Item label="分类编码">{selectedCategory.code}</Descriptions.Item>
                <Descriptions.Item label="分类路径">{selectedCategory.path}</Descriptions.Item>
                <Descriptions.Item label="来源"><Tag color={selectedCategory.source === 'h-mdm' ? 'green' : 'red'}>{selectedCategory.source}</Tag></Descriptions.Item>
                <Descriptions.Item label="主数据版本">{selectedCategory.version || '—'}</Descriptions.Item>
                <Descriptions.Item label="匹配置信度">{selectedCategory.confidence ? `${selectedCategory.confidence}%` : '人工确认'}</Descriptions.Item>
                <Descriptions.Item label="匹配依据">{selectedCategory.matchBasis?.join('；') || '人工选择'}</Descriptions.Item>
              </Descriptions>
            ) : (
              <Empty description="尚未匹配 H-UMDG 分类目录" />
            )}
            <Space wrap>
              <Button icon={<SearchOutlined />} onClick={() => setCategorySelectorOpen(true)}>手动选择分类目录</Button>
              <Button onClick={() => Modal.info({ title: '主数据补充申请', content: '占位入口：后续接入 H-UMDG 主数据申请流程。' })}>
                提交主数据补充申请
              </Button>
            </Space>
            <Table
              size="small"
              pagination={false}
              rowKey="id"
              dataSource={candidates}
              columns={[
                { title: '候选分类', dataIndex: 'name' },
                { title: '编码', dataIndex: 'code', width: 116 },
                { title: '置信度', dataIndex: 'confidence', width: 90, render: (value) => <Tag color={confidenceColor(Number(value))}>{text(value)}%</Tag> },
                {
                  title: '操作',
                  width: 80,
                  render: (_, row) => <Button size="small" onClick={() => setSelectedCategory(row)}>选择</Button>,
                },
              ]}
              locale={{ emptyText: '无候选分类' }}
            />
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label="使用科室">
                {reviewPayload.mdmDepartment ? (
                  <Space direction="vertical" size={0}>
                    <Text>{reviewPayload.mdmDepartment.name}（{reviewPayload.mdmDepartment.code}）</Text>
                    <Text type="secondary">{reviewPayload.mdmDepartment.campusName || '未标注院区'} · {reviewPayload.mdmDepartment.source} · {reviewPayload.mdmDepartment.version || '—'}</Text>
                  </Space>
                ) : (
                  <Button size="small" onClick={() => setOrgSelector('department')}>选择 H-UMDG 科室</Button>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="责任人">
                {reviewPayload.mdmPerson ? (
                  <Space direction="vertical" size={0}>
                    <Text>{reviewPayload.mdmPerson.name}（{reviewPayload.mdmPerson.employeeNo || reviewPayload.mdmPerson.code}）</Text>
                    <Text type="secondary">{reviewPayload.mdmPerson.departmentName || '未标注科室'} · {reviewPayload.mdmPerson.source} · {reviewPayload.mdmPerson.version || '—'}</Text>
                  </Space>
                ) : (
                  <Button size="small" onClick={() => setOrgSelector('person')}>选择 H-UMDG 人员</Button>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="服务学科">
                {reviewPayload.mdmDiscipline ? (
                  <Space direction="vertical" size={0}>
                    <Text>{reviewPayload.mdmDiscipline.name}（{reviewPayload.mdmDiscipline.code}）</Text>
                    <Text type="secondary">{reviewPayload.mdmDiscipline.isKeyDiscipline ? '重点学科' : reviewPayload.mdmDiscipline.type || '学科'} · {reviewPayload.mdmDiscipline.source} · {reviewPayload.mdmDiscipline.version || '—'}</Text>
                  </Space>
                ) : (
                  <Button size="small" onClick={() => setOrgSelector('discipline')}>选择 H-UMDG 学科</Button>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="厂家匹配">
                <Space direction="vertical" size={6}>
                  {partnerSummary(partners.manufacturer) || <Text type="secondary">待匹配</Text>}
                  <Button size="small" onClick={() => setPartnerSelector('manufacturer')}>选择生产厂家</Button>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="品牌匹配">
                <Space direction="vertical" size={6}>
                  {partnerSummary(partners.brandOwner) || <Text type="secondary">{text(asRecord(matchResult.brandRecommendation).name) || '待匹配'}</Text>}
                  <Button size="small" onClick={() => setPartnerSelector('brandOwner')}>选择品牌方</Button>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="供应商匹配">
                <Space direction="vertical" size={6}>
                  {partnerSummary(partners.supplier) || <Text type="secondary">待匹配</Text>}
                  <Button size="small" onClick={() => setPartnerSelector('supplier')}>选择供应商</Button>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="注册证持有人">
                <Space direction="vertical" size={6}>
                  {partnerSummary(partners.registrationHolder) || <Text type="secondary">待匹配</Text>}
                  <Button size="small" onClick={() => setPartnerSelector('registrationHolder')}>选择注册证持有人</Button>
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="维保商">
                <Space direction="vertical" size={6}>
                  {partnerSummary(partners.maintainer) || <Text type="secondary">待选择</Text>}
                  <Button size="small" onClick={() => setPartnerSelector('maintainer')}>选择维保商</Button>
                </Space>
              </Descriptions.Item>
            </Descriptions>
            <Input
              placeholder="可选：指定资产编号；留空则系统生成设备唯一编码"
              value={assetCode}
              onChange={(event) => setAssetCode(event.target.value)}
            />
          </Space>
        </section>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1fr)', gap: 16, marginTop: 16 }}>
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#fff' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space><FileProtectOutlined /><Text strong>建档进度与风险提示</Text></Space>
            <Alert showIcon type="warning" message="低于 70% 置信度字段不得自动绑定，必须人工确认。" />
            <Alert showIcon type="info" message="H-UMDG degraded=true 或 source 非 h-mdm 时，正式建档按钮保持不可用。" />
            <Alert showIcon type="success" message="审核通过后生成设备档案、设备唯一编码、二维码、附件归档记录、AI 识别记录和审核记录。" />
          </Space>
        </section>
        <section style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, background: '#fff' }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space><AuditOutlined /><Text strong>操作日志</Text></Space>
            <Timeline items={logs.map((item) => ({ children: item }))} />
          </Space>
        </section>
      </div>

      <DeviceCategorySelector
        open={categorySelectorOpen}
        value={selectedCategory}
        onCancel={() => setCategorySelectorOpen(false)}
        onSelect={manualSelect}
      />
      <OrgMasterSelector
        open={orgSelector === 'department'}
        kind="department"
        value={reviewPayload.mdmDepartment ?? null}
        onCancel={() => setOrgSelector(null)}
        onSelect={(row) => selectDepartment(row as DepartmentMaster)}
      />
      <OrgMasterSelector
        open={orgSelector === 'person'}
        kind="person"
        value={reviewPayload.mdmPerson ?? null}
        departmentId={reviewPayload.mdmDepartment?.id}
        onCancel={() => setOrgSelector(null)}
        onSelect={(row) => selectPerson(row as PersonMaster)}
      />
      <OrgMasterSelector
        open={orgSelector === 'discipline'}
        kind="discipline"
        value={reviewPayload.mdmDiscipline ?? null}
        onCancel={() => setOrgSelector(null)}
        onSelect={(row) => selectDiscipline(row as DisciplineMaster)}
      />
      <BusinessPartnerSelector
        open={partnerSelector === 'manufacturer'}
        roleType="生产厂家"
        title="H-UMDG 生产厂家选择器"
        value={partners.manufacturer ?? null}
        onCancel={() => setPartnerSelector(null)}
        onSelect={(row) => selectPartner('manufacturer', row)}
      />
      <BusinessPartnerSelector
        open={partnerSelector === 'brandOwner'}
        roleType="品牌方"
        title="H-UMDG 品牌方选择器"
        value={partners.brandOwner ?? null}
        onCancel={() => setPartnerSelector(null)}
        onSelect={(row) => selectPartner('brandOwner', row)}
      />
      <BusinessPartnerSelector
        open={partnerSelector === 'registrationHolder'}
        roleType="注册证持有人"
        title="H-UMDG 注册证持有人选择器"
        value={partners.registrationHolder ?? null}
        onCancel={() => setPartnerSelector(null)}
        onSelect={(row) => selectPartner('registrationHolder', row)}
      />
      <BusinessPartnerSelector
        open={partnerSelector === 'supplier'}
        roleType="供应商"
        title="H-UMDG 供应商选择器"
        value={partners.supplier ?? null}
        onCancel={() => setPartnerSelector(null)}
        onSelect={(row) => selectPartner('supplier', row)}
      />
      <BusinessPartnerSelector
        open={partnerSelector === 'maintainer'}
        roleType="维保商"
        title="H-UMDG 维保商选择器"
        value={partners.maintainer ?? null}
        onCancel={() => setPartnerSelector(null)}
        onSelect={(row) => selectPartner('maintainer', row)}
      />
      <BusinessPartnerSelector
        open={partnerSelector === 'installer'}
        roleType="服务商"
        title="H-UMDG 安装单位选择器"
        value={partners.installer ?? null}
        onCancel={() => setPartnerSelector(null)}
        onSelect={(row) => selectPartner('installer', row)}
      />
    </div>
  )
}
