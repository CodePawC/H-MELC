import { type ReactNode, useEffect, useMemo, useState } from 'react'
import {
  ApiOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloudSyncOutlined,
  DatabaseOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { Alert, Button, Descriptions, Drawer, Progress, Space, Spin, Table, Tag, Timeline, Typography } from 'antd'
import { fetchMasterDataSourceConfigs } from '../api/mdm'
import type { MasterDataSourceConfigRow } from '../api/mdm'
import { ApiClientError } from '../lib/api'

const { Paragraph, Text, Title } = Typography

type MasterDataObjectCode =
  | 'DEPARTMENT'
  | 'PERSON'
  | 'ASSET'
  | 'CONSUMABLE'
  | 'SUPPLIER'
  | 'CHARGE_ITEM'
  | 'INSURANCE_CODE'
  | 'EQUIPMENT_CATEGORY'
  | 'EQUIPMENT_STATUS'
  | 'METROLOGY_ATTRIBUTE'
  | 'RISK_LEVEL'

type SyncStatus = 'UNSYNCED' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'PENDING_REVIEW' | 'CONFLICT'

type SourceConfigRow = {
  key: MasterDataObjectCode
  objectName: string
  authoritySource: string
  optionalSources: string[]
  syncMode: string
  syncFrequency: string
  localMaintenance: string
  conflictStrategy: string
  lastSyncAt: string
  syncStatus: SyncStatus
  sourceTag: 'OS' | 'HUDMP' | 'MIXED'
  qualityScore: number
  mappingRate: number
  description: string
  protectedFields: string[]
  reviewRule: string
}

const SOURCE_ROWS: SourceConfigRow[] = [
  {
    key: 'ASSET',
    objectName: '设备业务台账',
    authoritySource: '医学装备运营平台',
    optionalSources: ['医学装备运营平台', 'H-UMDG 引用快照', '固定资产系统'],
    syncMode: '引用 H-UMDG 标准字段并保存业务快照',
    syncFrequency: '建档/审核时实时引用，夜间校验缓存',
    localMaintenance: '是',
    conflictStrategy: '业务事实以 H-MELC 为准，标准字典以 H-UMDG 为准',
    lastSyncAt: '2026-05-19 08:40',
    syncStatus: 'SYNCED',
    sourceTag: 'OS',
    qualityScore: 96,
    mappingRate: 92,
    description: 'H-MELC 负责设备新增、建档、验收、启用、二维码、附件组成和生命周期业务事实。',
    protectedFields: ['设备唯一编码', '资产编号', '品牌', '型号', '规格', '序列号 SN', '所属科室', '供应商快照', '风险等级快照', '计量属性快照', '设备状态'],
    reviewRule: '设备分类、设备标准名称、监管目录和厂商机构标准身份只引用 H-UMDG，不在 H-MELC 中审核发布为权威主数据。',
  },
  {
    key: 'DEPARTMENT',
    objectName: '科室主数据',
    authoritySource: 'H-UMDG',
    optionalSources: ['H-UMDG', 'HIS', '本地维护'],
    syncMode: 'API 实时调用或定时同步',
    syncFrequency: '实时查询 + 每 30 分钟增量同步',
    localMaintenance: '否',
    conflictStrategy: '以 H-UMDG 为准',
    lastSyncAt: '2026-05-19 08:30',
    syncStatus: 'SYNCED',
    sourceTag: 'HUDMP',
    qualityScore: 99,
    mappingRate: 98,
    description: 'OS 在设备建档、调拨、报修、PM、计量场景引用标准科室。',
    protectedFields: ['科室编码', '科室名称', '院区', '上级科室', '启停状态'],
    reviewRule: '本地不允许维护；差异通过 H-UMDG 数据质量流程处理。',
  },
  {
    key: 'PERSON',
    objectName: '人员主数据',
    authoritySource: 'H-UMDG',
    optionalSources: ['H-UMDG', 'HIS', '人事系统', '本地维护'],
    syncMode: '定时同步',
    syncFrequency: '每日 02:00 全量校验，每小时增量',
    localMaintenance: '部分允许',
    conflictStrategy: '冲突数据进入待审核',
    lastSyncAt: '2026-05-19 07:00',
    syncStatus: 'PENDING_REVIEW',
    sourceTag: 'HUDMP',
    qualityScore: 91,
    mappingRate: 88,
    description: '允许在 OS 中维护工程师技能、值班、维修资质等业务扩展属性。',
    protectedFields: ['人员编码', '姓名', '工号', '所属科室', '在职状态'],
    reviewRule: '身份字段以 H-UMDG 为准；工程师技能与班组信息由 H-MELC 本地维护。',
  },
  {
    key: 'SUPPLIER',
    objectName: '厂商机构主数据',
    authoritySource: 'H-UMDG',
    optionalSources: ['H-UMDG', 'SPD', '财务系统', '本地业务快照'],
    syncMode: '定时同步',
    syncFrequency: '每日 01:00 同步，资质变更即时推送',
    localMaintenance: '部分允许',
    conflictStrategy: '人工审核',
    lastSyncAt: '2026-05-19 01:05',
    syncStatus: 'CONFLICT',
    sourceTag: 'HUDMP',
    qualityScore: 86,
    mappingRate: 81,
    description: 'H-MELC 可维护联系人、履约评价、设备服务范围等业务字段；标准身份、统一社会信用代码和关系由 H-UMDG 维护。',
    protectedFields: ['统一社会信用代码', '供应商标准编码', '标准名称', '启停状态'],
    reviewRule: '标准身份字段冲突进入人工审核；业务评价字段保留 OS 记录。',
  },
  {
    key: 'CONSUMABLE',
    objectName: '耗材主数据',
    authoritySource: 'H-UMDG / SPD',
    optionalSources: ['H-UMDG', 'SPD', '医保平台', '本地维护'],
    syncMode: '定时同步',
    syncFrequency: '每日 03:00',
    localMaintenance: '否',
    conflictStrategy: '以 H-UMDG 标准目录为准',
    lastSyncAt: '2026-05-19 03:03',
    syncStatus: 'SYNCED',
    sourceTag: 'MIXED',
    qualityScore: 94,
    mappingRate: 93,
    description: 'OS 仅消费耗材目录，用于配件更换、耗材领用和成本归集。',
    protectedFields: ['耗材编码', '通用名', '规格', '医保耗材码', 'SPD编码'],
    reviewRule: '目录不在 H-MELC 中直接新建，异常走 H-UMDG/SPD 修订流程。',
  },
  {
    key: 'CHARGE_ITEM',
    objectName: '收费项目主数据',
    authoritySource: 'HIS / H-UMDG',
    optionalSources: ['HIS', '医保平台', 'H-UMDG'],
    syncMode: '定时同步',
    syncFrequency: '每日 04:00',
    localMaintenance: '否',
    conflictStrategy: '以 HIS 和医保映射结果为准',
    lastSyncAt: '2026-05-19 04:02',
    syncStatus: 'SYNCED',
    sourceTag: 'MIXED',
    qualityScore: 95,
    mappingRate: 96,
    description: '用于设备效益、ROI、收入归因和大型设备运营分析。',
    protectedFields: ['收费项目编码', '项目名称', '医保映射', '启停状态'],
    reviewRule: '由 HIS/医保平台维护，OS 只读引用。',
  },
  {
    key: 'INSURANCE_CODE',
    objectName: '医保编码',
    authoritySource: '医保平台 / H-UMDG',
    optionalSources: ['医保平台', 'H-UMDG'],
    syncMode: '定时同步',
    syncFrequency: '每日 04:30',
    localMaintenance: '否',
    conflictStrategy: '以医保平台为准',
    lastSyncAt: '2026-05-19 04:36',
    syncStatus: 'SYNCED',
    sourceTag: 'MIXED',
    qualityScore: 97,
    mappingRate: 95,
    description: '用于耗材、收费项目、设备服务项目与医保目录映射。',
    protectedFields: ['医保编码', '医保名称', '目录版本', '有效状态'],
    reviewRule: '医保编码不允许本地维护。',
  },
  {
    key: 'EQUIPMENT_CATEGORY',
    objectName: '设备分类字典',
    authoritySource: 'H-UMDG',
    optionalSources: ['H-UMDG', '国家分类标准', '本地候选申请'],
    syncMode: 'API 实时调用或定时同步',
    syncFrequency: '每小时增量',
    localMaintenance: '否',
    conflictStrategy: '以 H-UMDG 为准',
    lastSyncAt: '2026-05-19 08:10',
    syncStatus: 'SYNCED',
    sourceTag: 'HUDMP',
    qualityScore: 98,
    mappingRate: 94,
    description: '支持设备多分类体系、监管分类、影像/检验/治疗等运营分析维度。',
    protectedFields: ['分类编码', '分类名称', '上级分类', '标准来源'],
    reviewRule: '本地找不到分类时提交候选申请，由 H-UMDG 审核发布。',
  },
  {
    key: 'EQUIPMENT_STATUS',
    objectName: '设备状态字典',
    authoritySource: 'H-UMDG',
    optionalSources: ['H-UMDG', '医学装备运营平台业务状态'],
    syncMode: '定时同步',
    syncFrequency: '每日 00:30',
    localMaintenance: '部分允许',
    conflictStrategy: '生成新版本',
    lastSyncAt: '2026-05-19 00:32',
    syncStatus: 'SYNCED',
    sourceTag: 'HUDMP',
    qualityScore: 96,
    mappingRate: 90,
    description: '状态字典纳入作废、停用、待报废、已报废、归档、隐藏，不允许物理删除。',
    protectedFields: ['状态编码', '状态名称', '生命周期含义', '是否可用'],
    reviewRule: '状态字典暂按业务系统配置管理；如需纳入全院标准字典，由 H-UMDG 审核发布。',
  },
  {
    key: 'METROLOGY_ATTRIBUTE',
    objectName: '计量属性字典',
    authoritySource: 'H-UMDG',
    optionalSources: ['H-UMDG', '计量监管目录', '本地候选申请'],
    syncMode: '定时同步',
    syncFrequency: '每日 00:45',
    localMaintenance: '否',
    conflictStrategy: '以 H-UMDG 为准',
    lastSyncAt: '2026-05-19 00:48',
    syncStatus: 'FAILED',
    sourceTag: 'HUDMP',
    qualityScore: 78,
    mappingRate: 76,
    description: '用于强检/非强检、校准周期、证书到期预警和计量合规。',
    protectedFields: ['计量属性编码', '属性名称', '检定周期', '监管要求'],
    reviewRule: '同步失败后保持上次有效版本，运维需排查 H-UMDG API。',
  },
  {
    key: 'RISK_LEVEL',
    objectName: '风险等级字典',
    authoritySource: 'H-UMDG',
    optionalSources: ['H-UMDG', '医学装备运营平台业务规则'],
    syncMode: 'API 实时调用或定时同步',
    syncFrequency: '每小时增量',
    localMaintenance: '否',
    conflictStrategy: '以 H-UMDG 为准',
    lastSyncAt: '—',
    syncStatus: 'UNSYNCED',
    sourceTag: 'HUDMP',
    qualityScore: 0,
    mappingRate: 0,
    description: '用于风险预警、SLA、任务升级、IOC 红色告警和设备画像。',
    protectedFields: ['风险等级编码', '等级名称', 'SLA映射', '颜色规则'],
    reviewRule: '首次对接后由 H-UMDG 发布标准版本。',
  },
]

function normalizeSourceRow(row: MasterDataSourceConfigRow): SourceConfigRow {
  const localMaintenanceMap: Record<string, string> = {
    YES: '是',
    NO: '否',
    PARTIAL: '部分允许',
  }
  const objectCode = row.object_code as MasterDataObjectCode
  const fallback = SOURCE_ROWS.find((item) => item.key === objectCode)
  return {
    key: objectCode,
    objectName: row.object_name,
    authoritySource: row.authority_source,
    optionalSources: row.available_sources ?? fallback?.optionalSources ?? [],
    syncMode: row.sync_mode,
    syncFrequency: row.sync_frequency,
    localMaintenance: localMaintenanceMap[row.allow_local_maintenance] ?? row.allow_local_maintenance,
    conflictStrategy: row.conflict_strategy,
    lastSyncAt: row.last_sync_at ? row.last_sync_at.replace('T', ' ').slice(0, 16) : '—',
    syncStatus: row.sync_status,
    sourceTag:
      row.authority_source.includes('医学装备运营 OS')
      || row.authority_source.includes('医学装备运营平台')
      || row.authority_source.includes('MEDICAL_EQUIPMENT_OS')
        ? 'OS'
        : row.authority_source.includes('H-UMDG')
          ? 'HUDMP'
          : 'MIXED',
    qualityScore: Number(row.quality_score ?? fallback?.qualityScore ?? 0),
    mappingRate: Number(row.mapping_rate ?? fallback?.mappingRate ?? 0),
    description: row.description ?? fallback?.description ?? '',
    protectedFields: row.protected_fields?.length ? row.protected_fields : fallback?.protectedFields ?? [],
    reviewRule: row.review_rule ?? fallback?.reviewRule ?? '',
  }
}

function syncStatusTag(status: SyncStatus) {
  const map: Record<SyncStatus, { color: string; label: string; icon: ReactNode }> = {
    SYNCED: { color: 'green', label: '已同步', icon: <CheckCircleOutlined /> },
    PENDING_REVIEW: { color: 'orange', label: '待审核', icon: <ClockCircleOutlined /> },
    CONFLICT: { color: 'red', label: '冲突待处理', icon: <ExclamationCircleOutlined /> },
    UNSYNCED: { color: 'default', label: '未同步', icon: <InfoCircleOutlined /> },
    FAILED: { color: 'red', label: '同步失败', icon: <ExclamationCircleOutlined /> },
    SYNCING: { color: 'processing', label: '同步中', icon: <CloudSyncOutlined /> },
  }
  const item = map[status]
  return (
    <Tag color={item.color} icon={item.icon}>
      {item.label}
    </Tag>
  )
}

function sourceTag(row: SourceConfigRow) {
  if (row.sourceTag === 'OS') return <Tag color="blue">本地维护</Tag>
  if (row.sourceTag === 'HUDMP') return <Tag color="purple">H-UMDG 来源</Tag>
  return <Tag color="geekblue">混合来源</Tag>
}

function scoreColor(score: number) {
  if (score >= 92) return '#16a34a'
  if (score >= 80) return '#f59e0b'
  return '#ef4444'
}

export function MasterDataSourceConfigPage() {
  const [rows, setRows] = useState<SourceConfigRow[]>(SOURCE_ROWS)
  const [selected, setSelected] = useState<SourceConfigRow | null>(SOURCE_ROWS[0] ?? null)
  const [loading, setLoading] = useState(false)
  const [loadMessage, setLoadMessage] = useState<string | null>(null)

  useEffect(() => {
    let canceled = false
    setLoading(true)
    fetchMasterDataSourceConfigs()
      .then((payload) => {
        if (canceled) return
        const nextRows = payload.items?.length ? payload.items.map(normalizeSourceRow) : SOURCE_ROWS
        setRows(nextRows)
        setSelected((current) => current ?? nextRows[0] ?? null)
        setLoadMessage(null)
      })
      .catch((e) => {
        if (canceled) return
        setRows(SOURCE_ROWS)
        setSelected((current) => current ?? SOURCE_ROWS[0] ?? null)
        setLoadMessage(e instanceof ApiClientError ? `${e.message}。当前使用内置推荐配置。` : '接口暂不可用，当前使用内置推荐配置。')
      })
      .finally(() => {
        if (!canceled) setLoading(false)
      })
    return () => {
      canceled = true
    }
  }, [])

  const summary = useMemo(() => {
    const total = rows.length
    const synced = rows.filter((item) => item.syncStatus === 'SYNCED').length
    const review = rows.filter((item) => item.syncStatus === 'PENDING_REVIEW').length
    const conflict = rows.filter((item) => item.syncStatus === 'CONFLICT' || item.syncStatus === 'FAILED').length
    const avgQuality = total ? Math.round(rows.reduce((sum, item) => sum + item.qualityScore, 0) / total) : 0
    return { total, synced, review, conflict, avgQuality }
  }, [rows])

  const columns: ColumnsType<SourceConfigRow> = [
    {
      title: '主数据对象',
      dataIndex: 'objectName',
      fixed: 'left',
      width: 150,
      render: (value, row) => (
        <Space direction="vertical" size={2}>
          <Text strong>{value}</Text>
          {sourceTag(row)}
        </Space>
      ),
    },
    { title: '当前权威来源', dataIndex: 'authoritySource', width: 170 },
    {
      title: '可选数据来源',
      dataIndex: 'optionalSources',
      width: 260,
      render: (sources: string[]) => (
        <Space wrap size={[4, 4]}>
          {sources.map((source) => (
            <Tag key={source}>{source}</Tag>
          ))}
        </Space>
      ),
    },
    { title: '同步方式', dataIndex: 'syncMode', width: 190 },
    { title: '同步频率', dataIndex: 'syncFrequency', width: 220 },
    { title: '是否允许本地维护', dataIndex: 'localMaintenance', width: 130 },
    { title: '冲突处理策略', dataIndex: 'conflictStrategy', width: 260 },
    { title: '最近同步时间', dataIndex: 'lastSyncAt', width: 160 },
    {
      title: '同步状态',
      dataIndex: 'syncStatus',
      width: 130,
      render: (status: SyncStatus) => syncStatusTag(status),
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 150,
      render: (_, row) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setSelected(row)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<ReloadOutlined />}>
            同步
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div className="page master-data-source-page">
      <div className="master-data-source-page__hero">
        <div>
          <Text className="master-data-source-page__eyebrow">H-UMDG External Reference</Text>
          <Title level={2}>主数据来源配置</Title>
          <Paragraph>
            H-UMDG 是另外一个系统，负责基础主数据、标准字典、厂商机构标准身份和发布查询 API。H-MELC 只保存引用字段、必要快照、只读缓存和候选申请。
          </Paragraph>
        </div>
        <Space wrap>
          <Button icon={<ApiOutlined />}>接口连通性检查</Button>
          <Button type="primary" icon={<EditOutlined />}>
            新建配置
          </Button>
        </Space>
      </div>

      <div className="master-data-source-page__stats">
        <div>
          <span>对象总数</span>
          <strong>{summary.total}</strong>
        </div>
        <div>
          <span>已同步</span>
          <strong>{summary.synced}</strong>
        </div>
        <div>
          <span>待审核</span>
          <strong>{summary.review}</strong>
        </div>
        <div>
          <span>异常/冲突</span>
          <strong>{summary.conflict}</strong>
        </div>
        <div>
          <span>平均质量评分</span>
          <strong>{summary.avgQuality}</strong>
        </div>
      </div>

      <Alert
        showIcon
        type={loadMessage ? 'warning' : 'info'}
        message="H-MELC 不建设第二个 H-UMDG；设备分类、设备标准名称、监管目录和厂商机构标准身份均以 H-UMDG 为权威来源。"
        description={loadMessage ?? undefined}
        style={{ marginBottom: 16 }}
      />

      <Spin spinning={loading}>
        <Table
          className="master-data-source-page__table"
          size="middle"
          rowKey="key"
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1850 }}
          pagination={false}
        />
      </Spin>

      <Drawer
        title={selected ? `${selected.objectName} · 来源配置详情` : '来源配置详情'}
        open={Boolean(selected)}
        width={760}
        onClose={() => setSelected(null)}
        destroyOnHidden
        extra={
          <Space>
            {selected ? syncStatusTag(selected.syncStatus) : null}
            <Button icon={<EditOutlined />}>编辑</Button>
          </Space>
        }
      >
        {selected ? (
          <div className="master-data-source-page__drawer">
            <Alert
              type={selected.key === 'ASSET' ? 'success' : selected.syncStatus === 'CONFLICT' || selected.syncStatus === 'FAILED' ? 'warning' : 'info'}
              showIcon
              message={selected.description}
              style={{ marginBottom: 16 }}
            />
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="主数据对象">{selected.objectName}</Descriptions.Item>
              <Descriptions.Item label="当前权威来源">{selected.authoritySource}</Descriptions.Item>
              <Descriptions.Item label="可选数据来源">{selected.optionalSources.join('、')}</Descriptions.Item>
              <Descriptions.Item label="同步方式">{selected.syncMode}</Descriptions.Item>
              <Descriptions.Item label="同步频率">{selected.syncFrequency}</Descriptions.Item>
              <Descriptions.Item label="是否允许本地维护">{selected.localMaintenance}</Descriptions.Item>
              <Descriptions.Item label="冲突处理策略">{selected.conflictStrategy}</Descriptions.Item>
              <Descriptions.Item label="最近同步时间">{selected.lastSyncAt}</Descriptions.Item>
            </Descriptions>

            <div className="master-data-source-page__quality">
              <div>
                <Text type="secondary">数据质量评分</Text>
                <Progress percent={selected.qualityScore} strokeColor={scoreColor(selected.qualityScore)} />
              </div>
              <div>
                <Text type="secondary">映射完成率</Text>
                <Progress percent={selected.mappingRate} strokeColor={scoreColor(selected.mappingRate)} />
              </div>
            </div>

            <Title level={5}>关键治理字段</Title>
            <Space wrap size={[6, 8]} style={{ marginBottom: 18 }}>
              {selected.protectedFields.map((field) => (
                <Tag key={field} color="blue">
                  {field}
                </Tag>
              ))}
            </Space>

            <Title level={5}>同步与审核策略</Title>
            <Timeline
              items={[
                {
                  color: 'blue',
                  dot: <DatabaseOutlined />,
                  children: <span>业务系统创建或引用主数据对象，先按当前权威来源解析标准编码。</span>,
                },
                {
                  color: 'purple',
                  dot: <CloudSyncOutlined />,
                  children: <span>调用 H-UMDG 获取标准编码、标准名称、监管属性和厂商机构标准身份。</span>,
                },
                {
                  color: 'orange',
                  dot: <SafetyCertificateOutlined />,
                  children: <span>{selected.reviewRule}</span>,
                },
              ]}
            />
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}
