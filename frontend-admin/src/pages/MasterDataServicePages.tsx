import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Modal,
  Progress,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
  message,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined,
  CloudSyncOutlined,
  DownloadOutlined,
  EyeOutlined,
  SyncOutlined,
} from '@ant-design/icons'

import {
  downloadMasterDataContract,
  refreshMasterDataSourceCache,
  testMasterDataSource,
  type MasterDataSourceTestResult,
} from '../api/hmdm'
import { PageScaffold } from '../components/hospital/PageScaffold'

const { Paragraph, Text, Title } = Typography

export type MasterDataServiceView = 'objects' | 'mapping' | 'sync' | 'quality' | 'conflicts'

type MasterDataMode = 'local' | 'service' | 'hybrid'
type DataState = 'usable' | 'pending' | 'conflict' | 'service_error' | 'disabled' | 'unsynced' | 'sync_failed'

type MasterDataObjectRow = {
  key: string
  objectName: string
  businessUsage: string
  standardCodeField: string
  standardNameField: string
  relationFields: string
  mode: MasterDataMode
  accessMethods: string
  syncMethod: string
  syncFrequency: string
  qualityScore: number
  localTemp: string
  conflictStrategy: string
  lastUpdatedAt: string
  state: DataState
}

type MappingRow = {
  key: string
  objectName: string
  sourceField: string
  standardField: string
  fieldType: string
  required: boolean
  transformRule: string
  defaultValue: string
  validationRule: string
  enabled: boolean
  updatedAt: string
}

type SyncTaskRow = {
  key: string
  taskName: string
  objectName: string
  syncMethod: string
  frequency: string
  lastRunAt: string
  nextRunAt: string
  successCount: number
  failedCount: number
  conflictCount: number
  status: 'normal' | 'running' | 'review' | 'partial_failed' | 'failed' | 'disabled'
}

type QualityIssueRow = {
  key: string
  objectName: string
  rule: string
  issueCount: number
  severity: 'info' | 'normal' | 'important' | 'serious'
  affectedBusiness: string
  checkedAt: string
  status: 'pending' | 'processing' | 'fixed' | 'ignored' | 'submitted'
}

type ConflictRow = {
  key: string
  objectName: string
  conflictType: string
  currentValue: string
  candidateValue: string
  affectedBusiness: string
  suggestion: string
  severity: 'info' | 'normal' | 'important' | 'serious'
  status: 'pending' | 'processing' | 'fixed' | 'ignored' | 'submitted'
  foundAt: string
}

type RefreshResult = {
  connected?: boolean
  refreshed?: Record<string, number>
  failed?: Array<{ object_code?: string; object_name?: string; message?: string; status_code?: number }>
  cache_status?: {
    cache_enabled?: boolean
    fallback_to_cache?: boolean
    ttl_seconds?: number
    latest_refreshed_at?: string
  }
}

export const MASTER_DATA_OBJECTS: MasterDataObjectRow[] = [
  {
    key: 'asset',
    objectName: '设备业务台账',
    businessUsage: '设备档案、维修、计量、报废',
    standardCodeField: 'asset_code',
    standardNameField: 'asset_name',
    relationFields: 'department_id / supplier_id / category_id',
    mode: 'hybrid',
    accessMethods: '固定资产系统 / 本地维护 / 标准数据接入',
    syncMethod: '定时同步 + 本地补充',
    syncFrequency: '每日 02:00',
    localTemp: '是，需审核',
    qualityScore: 90,
    conflictStrategy: '标准服务优先，本地补充需审核',
    lastUpdatedAt: '2026-05-29 02:05',
    state: 'usable',
  },
  {
    key: 'department',
    objectName: '科室主数据',
    businessUsage: '设备归属、维修派工、统计报表',
    standardCodeField: 'department_code',
    standardNameField: 'department_name',
    relationFields: 'campus_id / parent_department_id',
    mode: 'service',
    accessMethods: '标准数据接入 / API / 文件导入',
    syncMethod: '定时同步',
    syncFrequency: '每 30 分钟',
    localTemp: '否',
    qualityScore: 96,
    conflictStrategy: '以标准主数据为准',
    lastUpdatedAt: '2026-05-30 08:30',
    state: 'usable',
  },
  {
    key: 'person',
    objectName: '人员主数据',
    businessUsage: '维修人员、设备责任人、放射工作人员管理',
    standardCodeField: 'person_code',
    standardNameField: 'person_name',
    relationFields: 'department_id / position_id / qualification_id',
    mode: 'service',
    accessMethods: '标准数据接入 / API / 文件导入',
    syncMethod: '定时同步 + 增量同步',
    syncFrequency: '每日 02:00 全量校验，每小时增量',
    localTemp: '部分允许，需审核',
    qualityScore: 88,
    conflictStrategy: '冲突数据进入待审核',
    lastUpdatedAt: '2026-05-30 07:00',
    state: 'pending',
  },
  {
    key: 'supplier',
    objectName: '厂商供应商主数据',
    businessUsage: '采购、合同、维修、售后、发票',
    standardCodeField: 'supplier_code',
    standardNameField: 'supplier_name',
    relationFields: 'unified_social_credit_code / role_type',
    mode: 'hybrid',
    accessMethods: '标准数据接入 / SPD / 财务系统 / 本地维护',
    syncMethod: '定时同步',
    syncFrequency: '每日 01:00',
    localTemp: '是，需审核',
    qualityScore: 82,
    conflictStrategy: '人工审核',
    lastUpdatedAt: '2026-05-30 01:05',
    state: 'conflict',
  },
  {
    key: 'consumable',
    objectName: '耗材主数据',
    businessUsage: '耗材使用、SPD、计费、追溯',
    standardCodeField: 'consumable_code',
    standardNameField: 'consumable_name',
    relationFields: 'spd_code / insurance_code',
    mode: 'service',
    accessMethods: 'SPD / 标准数据接入 / 文件导入',
    syncMethod: '定时同步',
    syncFrequency: '每日 03:00',
    localTemp: '否',
    qualityScore: 92,
    conflictStrategy: '以标准主数据为准',
    lastUpdatedAt: '2026-05-30 03:02',
    state: 'usable',
  },
  {
    key: 'charge',
    objectName: '收费项目主数据',
    businessUsage: '效益分析、成本核算、收费关联',
    standardCodeField: 'charge_item_code',
    standardNameField: 'charge_item_name',
    relationFields: 'insurance_item_code / service_item_id',
    mode: 'service',
    accessMethods: 'HIS / 医保平台 / 标准数据接入',
    syncMethod: '定时同步',
    syncFrequency: '每日 04:00',
    localTemp: '否',
    qualityScore: 94,
    conflictStrategy: '以收费与医保口径为准',
    lastUpdatedAt: '2026-05-30 04:02',
    state: 'usable',
  },
  {
    key: 'insurance',
    objectName: '医保编码',
    businessUsage: '耗材追溯、医保对码、合规管理',
    standardCodeField: 'insurance_code',
    standardNameField: 'insurance_name',
    relationFields: 'catalog_version / effective_status',
    mode: 'service',
    accessMethods: '医保平台 / 标准数据接入',
    syncMethod: '定时同步',
    syncFrequency: '每日 04:30',
    localTemp: '否',
    qualityScore: 91,
    conflictStrategy: '以医保平台为准',
    lastUpdatedAt: '2026-05-30 04:35',
    state: 'usable',
  },
  {
    key: 'category',
    objectName: '设备分类字典',
    businessUsage: '设备档案、统计分析、采购论证',
    standardCodeField: 'equipment_category_code',
    standardNameField: 'equipment_category_name',
    relationFields: 'parent_category_id / management_class',
    mode: 'service',
    accessMethods: '国家分类标准 / 标准数据接入 / 本地映射',
    syncMethod: 'API实时调用或定时同步',
    syncFrequency: '每小时增量',
    localTemp: '否',
    qualityScore: 98,
    conflictStrategy: '以国家分类标准和标准主数据为准',
    lastUpdatedAt: '2026-05-30 08:10',
    state: 'usable',
  },
  {
    key: 'equipment_generic_name',
    objectName: '医疗器械通用名称',
    businessUsage: '设备档案、采购验收、注册证匹配、统计归集',
    standardCodeField: 'generic_name_code',
    standardNameField: 'generic_name',
    relationFields: 'equipment_category_code / management_class',
    mode: 'service',
    accessMethods: '标准主数据服务 / API / 本地缓存',
    syncMethod: 'API实时查询 + 缓存刷新',
    syncFrequency: '实时调用，缓存 TTL 跟随主数据来源设置',
    localTemp: '否，缺失时提交主数据补充申请',
    qualityScore: 96,
    conflictStrategy: '以标准主数据服务为准，设备档案保存引用快照',
    lastUpdatedAt: '2026-06-02 10:00',
    state: 'usable',
  },
  {
    key: 'standard_equipment',
    objectName: '标准设备库',
    businessUsage: '设备档案、智能建档、采购验收、维修、保养、计量按标准设备归集',
    standardCodeField: 'standard_equipment_code',
    standardNameField: 'standard_equipment_name',
    relationFields: 'generic_name_code / equipment_category_code / brand_model_id',
    mode: 'service',
    accessMethods: '标准主数据服务 / API / 本地缓存',
    syncMethod: 'API实时查询 + 缓存刷新',
    syncFrequency: '实时调用，缓存 TTL 跟随主数据来源设置',
    localTemp: '否，缺失时提交主数据补充申请',
    qualityScore: 96,
    conflictStrategy: '以标准主数据服务为准，设备档案保存引用快照',
    lastUpdatedAt: '2026-06-02 10:00',
    state: 'usable',
  },
  {
    key: 'brand_model',
    objectName: '品牌型号库',
    businessUsage: '设备档案、采购验收、售后维保、注册证与 UDI 匹配',
    standardCodeField: 'brand_model_code',
    standardNameField: 'brand_model_name',
    relationFields: 'manufacturer_org_id / generic_name_code / registration_certificate_id / udi_id',
    mode: 'service',
    accessMethods: '标准主数据服务 / API / 本地缓存',
    syncMethod: 'API实时查询 + 缓存刷新',
    syncFrequency: '实时调用，缓存 TTL 跟随主数据来源设置',
    localTemp: '否，缺失时提交主数据补充申请',
    qualityScore: 95,
    conflictStrategy: '以标准主数据服务为准，设备档案保存品牌型号快照',
    lastUpdatedAt: '2026-06-02 10:00',
    state: 'usable',
  },
  {
    key: 'registration_certificate',
    objectName: '医疗器械注册证库',
    businessUsage: '设备档案合规校验、采购验收、效期预警、证照追溯',
    standardCodeField: 'registration_certificate_code',
    standardNameField: 'registration_certificate_name',
    relationFields: 'manufacturer_org_id / generic_name_code / brand_model_code / valid_to',
    mode: 'service',
    accessMethods: '标准主数据服务 / API / 本地缓存',
    syncMethod: 'API实时查询 + 缓存刷新',
    syncFrequency: '实时调用，缓存 TTL 跟随主数据来源设置',
    localTemp: '否，作废或过期由主数据侧治理',
    qualityScore: 97,
    conflictStrategy: '以标准主数据服务为准，设备档案保存证照快照',
    lastUpdatedAt: '2026-06-02 10:00',
    state: 'usable',
  },
  {
    key: 'udi',
    objectName: 'UDI数据库',
    businessUsage: '设备唯一标识、追溯、召回、监管报送、档案条码匹配',
    standardCodeField: 'udi_code',
    standardNameField: 'udi_device_name',
    relationFields: 'di / pi / registration_certificate_id / brand_model_code',
    mode: 'service',
    accessMethods: '标准主数据服务 / API / 本地缓存',
    syncMethod: 'API实时查询 + 缓存刷新',
    syncFrequency: '实时调用，缓存 TTL 跟随主数据来源设置',
    localTemp: '否，缺失时提交主数据补充申请',
    qualityScore: 97,
    conflictStrategy: '以标准主数据服务为准，设备档案保存 UDI 快照',
    lastUpdatedAt: '2026-06-02 10:00',
    state: 'usable',
  },
  {
    key: 'equipmentStatus',
    objectName: '设备状态字典',
    businessUsage: '在用、停用、维修、报废、借用、调拨',
    standardCodeField: 'equipment_status_code',
    standardNameField: 'equipment_status_name',
    relationFields: 'lifecycle_stage / business_available',
    mode: 'service',
    accessMethods: '标准数据接入 / 本地字典',
    syncMethod: '定时同步',
    syncFrequency: '每日 00:30',
    localTemp: '部分允许',
    qualityScore: 95,
    conflictStrategy: '生成新版本',
    lastUpdatedAt: '2026-05-30 00:31',
    state: 'usable',
  },
  {
    key: 'metrology',
    objectName: '计量属性字典',
    businessUsage: '强检、非强检、校准周期、证书管理',
    standardCodeField: 'metrology_attribute_code',
    standardNameField: 'metrology_attribute_name',
    relationFields: 'calibration_period / mandatory_flag',
    mode: 'service',
    accessMethods: '计量目录 / 标准数据接入 / 本地维护申请',
    syncMethod: '定时同步',
    syncFrequency: '每日 00:45',
    localTemp: '否',
    qualityScore: 86,
    conflictStrategy: '以标准主数据为准',
    lastUpdatedAt: '2026-05-29 00:45',
    state: 'sync_failed',
  },
  {
    key: 'risk',
    objectName: '风险等级字典',
    businessUsage: '设备风险分级、巡检频率、PM策略',
    standardCodeField: 'risk_level_code',
    standardNameField: 'risk_level_name',
    relationFields: 'pm_strategy_id / sla_level',
    mode: 'service',
    accessMethods: '标准数据接入 / 规则库',
    syncMethod: 'API实时调用或定时同步',
    syncFrequency: '每小时增量',
    localTemp: '否',
    qualityScore: 89,
    conflictStrategy: '以标准主数据为准',
    lastUpdatedAt: '—',
    state: 'unsynced',
  },
]

const MAPPING_ROWS: MappingRow[] = [
  { key: 'm1', objectName: '人员主数据', sourceField: 'emp_no', standardField: 'person_code', fieldType: 'string', required: true, transformRule: '直接映射', defaultValue: '—', validationRule: '唯一且非空', enabled: true, updatedAt: '2026-05-30 08:20' },
  { key: 'm2', objectName: '人员主数据', sourceField: 'name', standardField: 'person_name', fieldType: 'string', required: true, transformRule: '去除首尾空格', defaultValue: '—', validationRule: '非空', enabled: true, updatedAt: '2026-05-30 08:20' },
  { key: 'm3', objectName: '人员主数据', sourceField: 'dept_id', standardField: 'department_id', fieldType: 'string', required: true, transformRule: '标准科室ID转换', defaultValue: '—', validationRule: '必须存在有效科室', enabled: true, updatedAt: '2026-05-30 08:20' },
  { key: 'm4', objectName: '人员主数据', sourceField: 'radiation_flag', standardField: 'radiation_worker_flag', fieldType: 'boolean', required: false, transformRule: 'Y/N 转布尔', defaultValue: 'false', validationRule: '值域校验', enabled: true, updatedAt: '2026-05-30 08:20' },
  { key: 'm5', objectName: '科室主数据', sourceField: 'dept_code', standardField: 'department_code', fieldType: 'string', required: true, transformRule: '直接映射', defaultValue: '—', validationRule: '唯一且非空', enabled: true, updatedAt: '2026-05-30 08:00' },
  { key: 'm6', objectName: '科室主数据', sourceField: 'dept_name', standardField: 'department_name', fieldType: 'string', required: true, transformRule: '直接映射', defaultValue: '—', validationRule: '非空', enabled: true, updatedAt: '2026-05-30 08:00' },
  { key: 'm7', objectName: '供应商主数据', sourceField: 'vendor_code', standardField: 'supplier_code', fieldType: 'string', required: true, transformRule: '直接映射', defaultValue: '—', validationRule: '唯一且非空', enabled: true, updatedAt: '2026-05-30 01:05' },
  { key: 'm8', objectName: '供应商主数据', sourceField: 'credit_code', standardField: 'unified_social_credit_code', fieldType: 'string', required: true, transformRule: '大写归一', defaultValue: '—', validationRule: '统一社会信用代码格式', enabled: true, updatedAt: '2026-05-30 01:05' },
]

const SYNC_TASK_ROWS: SyncTaskRow[] = [
  { key: 's1', taskName: '科室主数据半小时同步', objectName: '科室主数据', syncMethod: '定时同步', frequency: '每 30 分钟', lastRunAt: '2026-05-30 08:30', nextRunAt: '2026-05-30 09:00', successCount: 268, failedCount: 0, conflictCount: 0, status: 'normal' },
  { key: 's2', taskName: '人员主数据增量同步', objectName: '人员主数据', syncMethod: '增量同步', frequency: '每小时', lastRunAt: '2026-05-30 08:00', nextRunAt: '2026-05-30 09:00', successCount: 1231, failedCount: 7, conflictCount: 4, status: 'partial_failed' },
  { key: 's3', taskName: '供应商标准身份同步', objectName: '厂商供应商主数据', syncMethod: '定时同步', frequency: '每日 01:00', lastRunAt: '2026-05-30 01:05', nextRunAt: '2026-05-31 01:00', successCount: 482, failedCount: 2, conflictCount: 12, status: 'review' },
  { key: 's4', taskName: '计量属性字典同步', objectName: '计量属性字典', syncMethod: '定时同步', frequency: '每日 00:45', lastRunAt: '2026-05-29 00:45', nextRunAt: '2026-05-31 00:45', successCount: 0, failedCount: 36, conflictCount: 0, status: 'failed' },
]

const QUALITY_ROWS: QualityIssueRow[] = [
  { key: 'q1', objectName: '人员主数据', rule: '人员编码、姓名、科室不能为空', issueCount: 7, severity: 'important', affectedBusiness: '维修派工、放射工作人员管理', checkedAt: '2026-05-30 08:15', status: 'pending' },
  { key: 'q2', objectName: '人员主数据', rule: '人员状态与岗位/科室一致', issueCount: 3, severity: 'serious', affectedBusiness: '培训、剂量监测、权限同步', checkedAt: '2026-05-30 08:15', status: 'submitted' },
  { key: 'q3', objectName: '供应商主数据', rule: '统一社会信用代码唯一', issueCount: 5, severity: 'important', affectedBusiness: '采购、合同、发票', checkedAt: '2026-05-30 01:20', status: 'processing' },
  { key: 'q4', objectName: '设备分类字典', rule: '分类编码与管理类别有效', issueCount: 0, severity: 'info', affectedBusiness: '设备档案、统计分析', checkedAt: '2026-05-30 08:10', status: 'fixed' },
]

const CONFLICT_ROWS: ConflictRow[] = [
  { key: 'c1', objectName: '厂商供应商主数据', conflictType: '供应商名称不一致', currentValue: '上海某医疗科技有限公司', candidateValue: '上海某医疗科技股份有限公司', affectedBusiness: '合同、发票、售后', suggestion: '以人工审核为准', severity: 'important', status: 'pending', foundAt: '2026-05-30 01:18' },
  { key: 'c2', objectName: '人员主数据', conflictType: '人员状态不一致', currentValue: '在岗', candidateValue: '退休', affectedBusiness: '放射工作人员管理、培训', suggestion: '提交上游修正', severity: 'serious', status: 'submitted', foundAt: '2026-05-30 08:18' },
  { key: 'c3', objectName: '科室主数据', conflictType: '科室归属不一致', currentValue: '影像中心', candidateValue: '医技系统/影像中心', affectedBusiness: '统计报表、维修派工', suggestion: '以标准服务为准', severity: 'normal', status: 'processing', foundAt: '2026-05-29 18:40' },
]

export function modeTag(mode: MasterDataMode) {
  const map: Record<MasterDataMode, { color: string; label: string }> = {
    local: { color: 'blue', label: '本地维护模式' },
    service: { color: 'purple', label: '标准服务模式' },
    hybrid: { color: 'cyan', label: '混合模式' },
  }
  const item = map[mode]
  return <Tag color={item.color}>{item.label}</Tag>
}

export function dataStateTag(state: DataState) {
  const map: Record<DataState, { color: string; label: string }> = {
    usable: { color: 'green', label: '可用' },
    pending: { color: 'orange', label: '待校验' },
    conflict: { color: 'red', label: '冲突待处理' },
    service_error: { color: 'red', label: '服务异常' },
    disabled: { color: 'default', label: '已停用' },
    unsynced: { color: 'default', label: '待同步' },
    sync_failed: { color: 'red', label: '同步失败' },
  }
  const item = map[state]
  return <Tag color={item.color}>{item.label}</Tag>
}

function syncTaskStatusTag(status: SyncTaskRow['status']) {
  const map: Record<SyncTaskRow['status'], { color: string; label: string }> = {
    normal: { color: 'green', label: '正常' },
    running: { color: 'blue', label: '执行中' },
    review: { color: 'orange', label: '待审核' },
    partial_failed: { color: 'orange', label: '部分失败' },
    failed: { color: 'red', label: '同步失败' },
    disabled: { color: 'default', label: '已停用' },
  }
  const item = map[status]
  return <Tag color={item.color}>{item.label}</Tag>
}

function severityTag(severity: QualityIssueRow['severity']) {
  const map: Record<QualityIssueRow['severity'], { color: string; label: string }> = {
    info: { color: 'blue', label: '提示' },
    normal: { color: 'gold', label: '一般' },
    important: { color: 'orange', label: '重要' },
    serious: { color: 'red', label: '严重' },
  }
  const item = map[severity]
  return <Tag color={item.color}>{item.label}</Tag>
}

function processStatusTag(status: QualityIssueRow['status']) {
  const map: Record<QualityIssueRow['status'], { color: string; label: string }> = {
    pending: { color: 'orange', label: '待处理' },
    processing: { color: 'blue', label: '处理中' },
    fixed: { color: 'green', label: '已修复' },
    ignored: { color: 'default', label: '已忽略' },
    submitted: { color: 'purple', label: '已提交上游处理' },
  }
  const item = map[status]
  return <Tag color={item.color}>{item.label}</Tag>
}

function scoreColor(score: number) {
  if (score >= 92) return '#16a34a'
  if (score >= 80) return '#f59e0b'
  return '#ef4444'
}

function RadiationScenarioCard() {
  return (
    <Card title="典型场景：放射工作人员管理" bordered={false}>
      <Paragraph>
        医疗设备科负责放射工作人员管理，但人员入职、调岗、退休通常首先发生在人事科和用人科室。如果没有统一主数据，可能出现人事科已招人、影像科已用人、设备科却不知道；也可能出现人员已退休但放射工作人员台账仍显示在岗。通过全院统一主数据，H-MELC 可直接消费标准人员、科室、岗位、资质和在岗状态，自动识别新增、调岗、退休、资质异常等情况，避免数据孤岛和填报口径不一致。
      </Paragraph>
      <Timeline
        items={[
          { color: 'blue', children: '人事科办理入职 / 调岗 / 退休。' },
          { color: 'blue', children: '统一主数据更新人员、科室、岗位、状态。' },
          { color: 'cyan', children: 'H-MELC 自动识别与医学装备业务相关的人员变化。' },
          { color: 'purple', children: '放射工作人员管理、培训、剂量监测、设备权限同步更新。' },
          { color: 'green', children: '统计报表使用同一人员、同一科室、同一状态口径。' },
        ]}
      />
      <Alert showIcon type="success" message="同一人员、同一科室、同一状态，全院一致。" />
    </Card>
  )
}

function BoundaryCard() {
  return (
    <Alert
      showIcon
      type="info"
      message="H-MELC 与标准主数据服务边界"
      description="标准主数据服务负责统一人员、科室、院区、供应商、设备分类、字典、编码、映射和数据质量；H-MELC 负责医学装备业务过程，包括设备档案、采购验收、维修、保养、计量、放射工作人员管理、培训、风险预警、资产处置、效益分析等。两者通过标准数据接口或标准数据包进行解耦，不形成系统强绑定。"
    />
  )
}

function ObjectDrawer({ row, onClose }: { row: MasterDataObjectRow | null; onClose: () => void }) {
  return (
    <Drawer
      title={row ? `${row.objectName} · 主数据对象详情` : '主数据对象详情'}
      open={Boolean(row)}
      width={780}
      onClose={onClose}
      destroyOnHidden
      extra={row ? dataStateTag(row.state) : null}
    >
      {row ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="主数据对象">{row.objectName}</Descriptions.Item>
            <Descriptions.Item label="业务用途">{row.businessUsage}</Descriptions.Item>
            <Descriptions.Item label="标准编码字段">{row.standardCodeField}</Descriptions.Item>
            <Descriptions.Item label="标准名称字段">{row.standardNameField}</Descriptions.Item>
            <Descriptions.Item label="关键关联字段">{row.relationFields}</Descriptions.Item>
            <Descriptions.Item label="当前模式">{modeTag(row.mode)}</Descriptions.Item>
            <Descriptions.Item label="可选接入方式">{row.accessMethods}</Descriptions.Item>
            <Descriptions.Item label="同步方式">{row.syncMethod}</Descriptions.Item>
            <Descriptions.Item label="是否允许本地临时维护">{row.localTemp}</Descriptions.Item>
            <Descriptions.Item label="冲突处理策略">{row.conflictStrategy}</Descriptions.Item>
          </Descriptions>
          <Card title="字段映射" size="small">
            <Table size="small" pagination={false} rowKey="key" dataSource={MAPPING_ROWS.filter((item) => item.objectName === row.objectName || (row.key === 'supplier' && item.objectName === '供应商主数据'))} columns={mappingColumns(false)} />
          </Card>
          <Card title="同步策略" size="small">
            <Table size="small" pagination={false} rowKey="key" dataSource={SYNC_TASK_ROWS.filter((item) => item.objectName === row.objectName)} columns={syncColumns(false)} />
          </Card>
          <Card title="质量校验" size="small">
            <Table size="small" pagination={false} rowKey="key" dataSource={QUALITY_ROWS.filter((item) => item.objectName === row.objectName || (row.key === 'supplier' && item.objectName === '供应商主数据'))} columns={qualityColumns(false)} locale={{ emptyText: <Empty description="暂无校验问题。当前主数据对象通过质量校验。" /> }} />
          </Card>
          <Card title="冲突处理" size="small">
            <Table size="small" pagination={false} rowKey="key" dataSource={CONFLICT_ROWS.filter((item) => item.objectName === row.objectName || (row.key === 'supplier' && item.objectName === '厂商供应商主数据'))} columns={conflictColumns(false)} locale={{ emptyText: <Empty description="暂无待处理冲突。当前主数据口径一致。" /> }} />
          </Card>
          <Card title="调用日志" size="small">
            <Timeline
              items={[
                { color: 'green', dot: <CheckCircleOutlined />, children: `${row.lastUpdatedAt} 完成最近一次数据状态确认。` },
                { color: 'blue', dot: <CloudSyncOutlined />, children: `${row.syncMethod} 按 ${row.syncFrequency} 执行。` },
              ]}
            />
          </Card>
        </Space>
      ) : null}
    </Drawer>
  )
}

function objectColumns(onSelect?: (row: MasterDataObjectRow) => void, onRefresh?: () => Promise<void>): ColumnsType<MasterDataObjectRow> {
  return [
    { title: '主数据对象', dataIndex: 'objectName', width: 170, fixed: 'left', render: (value, row) => <Button type="link" onClick={() => onSelect?.(row)}>{value}</Button> },
    { title: '业务用途', dataIndex: 'businessUsage', width: 260 },
    { title: '标准编码字段', dataIndex: 'standardCodeField', width: 160 },
    { title: '标准名称字段', dataIndex: 'standardNameField', width: 170 },
    { title: '关键关联字段', dataIndex: 'relationFields', width: 230 },
    { title: '当前模式', dataIndex: 'mode', width: 130, render: (mode: MasterDataMode) => modeTag(mode) },
    { title: '同步方式', dataIndex: 'syncMethod', width: 170 },
    { title: '数据质量评分', dataIndex: 'qualityScore', width: 150, render: (score: number) => <Progress percent={score} size="small" strokeColor={scoreColor(score)} /> },
    { title: '是否允许本地临时维护', dataIndex: 'localTemp', width: 170 },
    { title: '最近更新时间', dataIndex: 'lastUpdatedAt', width: 160 },
    { title: '状态', dataIndex: 'state', width: 130, render: (state: DataState) => dataStateTag(state) },
    {
      title: '操作',
      width: 180,
      fixed: 'right',
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => onSelect?.(row)}>详情</Button>
          <Button
            size="small"
            icon={<SyncOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确认刷新主数据来源缓存？',
                content: `${row.objectName} 将随当前主数据来源配置一起执行连通检查和缓存刷新。`,
                okText: '刷新',
                cancelText: '取消',
                onOk: () => onRefresh?.(),
              })
            }}
          >
            刷新
          </Button>
        </Space>
      ),
    },
  ]
}

function mappingColumns(withAction = true): ColumnsType<MappingRow> {
  return [
    { title: '映射对象', dataIndex: 'objectName', width: 150 },
    { title: '原始字段名', dataIndex: 'sourceField', width: 140 },
    { title: '标准字段名', dataIndex: 'standardField', width: 170 },
    { title: '字段类型', dataIndex: 'fieldType', width: 110 },
    { title: '是否必填', dataIndex: 'required', width: 100, render: (value: boolean) => <Tag color={value ? 'red' : 'default'}>{value ? '必填' : '可空'}</Tag> },
    { title: '转换规则', dataIndex: 'transformRule', width: 180 },
    { title: '默认值', dataIndex: 'defaultValue', width: 100 },
    { title: '校验规则', dataIndex: 'validationRule', width: 180 },
    { title: '启用状态', dataIndex: 'enabled', width: 100, render: (value: boolean) => <Tag color={value ? 'green' : 'default'}>{value ? '启用' : '停用'}</Tag> },
    { title: '最后修改时间', dataIndex: 'updatedAt', width: 160 },
    ...(withAction ? [{ title: '操作', width: 100, render: () => <Button size="small">编辑</Button> }] as ColumnsType<MappingRow> : []),
  ]
}

function syncColumns(withAction = true): ColumnsType<SyncTaskRow> {
  return [
    { title: '任务名称', dataIndex: 'taskName', width: 190 },
    { title: '主数据对象', dataIndex: 'objectName', width: 150 },
    { title: '同步方式', dataIndex: 'syncMethod', width: 130 },
    { title: '执行频率', dataIndex: 'frequency', width: 170 },
    { title: '最近执行时间', dataIndex: 'lastRunAt', width: 160 },
    { title: '下次执行时间', dataIndex: 'nextRunAt', width: 160 },
    { title: '成功数量', dataIndex: 'successCount', width: 100 },
    { title: '失败数量', dataIndex: 'failedCount', width: 100 },
    { title: '冲突数量', dataIndex: 'conflictCount', width: 100 },
    { title: '任务状态', dataIndex: 'status', width: 120, render: (status: SyncTaskRow['status']) => syncTaskStatusTag(status) },
    ...(withAction ? [{ title: '操作', width: 120, render: () => <Button size="small">执行</Button> }] as ColumnsType<SyncTaskRow> : []),
  ]
}

function qualityColumns(withAction = true): ColumnsType<QualityIssueRow> {
  return [
    { title: '校验对象', dataIndex: 'objectName', width: 150 },
    { title: '校验规则', dataIndex: 'rule', width: 260 },
    { title: '问题数量', dataIndex: 'issueCount', width: 100 },
    { title: '严重程度', dataIndex: 'severity', width: 110, render: (severity: QualityIssueRow['severity']) => severityTag(severity) },
    { title: '影响业务', dataIndex: 'affectedBusiness', width: 240 },
    { title: '最近校验时间', dataIndex: 'checkedAt', width: 160 },
    { title: '处理状态', dataIndex: 'status', width: 150, render: (status: QualityIssueRow['status']) => processStatusTag(status) },
    ...(withAction ? [{ title: '操作', width: 120, render: () => <Button size="small">处理</Button> }] as ColumnsType<QualityIssueRow> : []),
  ]
}

function conflictColumns(withAction = true): ColumnsType<ConflictRow> {
  return [
    { title: '冲突对象', dataIndex: 'objectName', width: 160 },
    { title: '冲突类型', dataIndex: 'conflictType', width: 170 },
    { title: '当前使用值', dataIndex: 'currentValue', width: 220 },
    { title: '候选值', dataIndex: 'candidateValue', width: 220 },
    { title: '影响业务', dataIndex: 'affectedBusiness', width: 220 },
    { title: '建议处理方式', dataIndex: 'suggestion', width: 160 },
    { title: '严重程度', dataIndex: 'severity', width: 110, render: (severity: ConflictRow['severity']) => severityTag(severity) },
    { title: '处理状态', dataIndex: 'status', width: 150, render: (status: ConflictRow['status']) => processStatusTag(status) },
    { title: '发现时间', dataIndex: 'foundAt', width: 160 },
    ...(withAction ? [{ title: '操作', width: 120, render: () => <Button size="small">处理</Button> }] as ColumnsType<ConflictRow> : []),
  ]
}

export function MasterDataServicePage({ view }: { view: MasterDataServiceView }) {
  const [selected, setSelected] = useState<MasterDataObjectRow | null>(null)
  const [testing, setTesting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [testResult, setTestResult] = useState<MasterDataSourceTestResult | null>(null)
  const [refreshResult, setRefreshResult] = useState<RefreshResult | null>(null)

  useEffect(() => { runConnectionTest() }, [])

  const summary = useMemo(() => {
    const total = MASTER_DATA_OBJECTS.length
    const enabled = MASTER_DATA_OBJECTS.filter((item) => item.state !== 'disabled').length
    const pending = MASTER_DATA_OBJECTS.filter((item) => item.state === 'pending' || item.state === 'unsynced').length
    const conflict = MASTER_DATA_OBJECTS.filter((item) => item.state === 'conflict' || item.state === 'service_error' || item.state === 'sync_failed').length
    const avg = Math.round(MASTER_DATA_OBJECTS.reduce((sum, item) => sum + item.qualityScore, 0) / total)
    return { total, enabled, pending, conflict, avg }
  }, [])

  const runConnectionTest = async () => {
    setTesting(true)
    try {
      const result = await testMasterDataSource()
      setTestResult(result)
      const failed = result.items.filter((item) => !item.ok)
      if (failed.length) {
        message.warning(`主数据来源连通测试完成，${failed.length} 个对象不可用`)
      } else {
        message.success('主数据来源连通测试通过')
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '主数据来源连通测试失败')
    } finally {
      setTesting(false)
    }
  }

  const runCacheRefresh = async () => {
    setRefreshing(true)
    try {
      const result = await refreshMasterDataSourceCache()
      setRefreshResult(result as RefreshResult)
      const failed = (result as RefreshResult).failed ?? []
      if (failed.length) {
        message.warning(`缓存刷新完成，${failed.length} 个对象失败`)
      } else {
        message.success('主数据来源缓存已刷新')
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '主数据来源缓存刷新失败')
    } finally {
      setRefreshing(false)
    }
  }

  const meta: Record<MasterDataServiceView, { title: string; description: string }> = {
    objects: {
      title: '数据对象管理',
      description: '定义 H-MELC 业务运行所需的主数据对象，包括人员、科室、院区、岗位、资质、供应商、设备分类、设备状态、计量属性、风险等级等。',
    },
    mapping: {
      title: '字段映射规则',
      description: '将外部标准数据服务或导入文件中的字段映射为 H-MELC 可识别的标准字段。H-MELC 不关心原始字段叫什么，只要求最终字段符合平台标准。',
    },
    sync: {
      title: '同步任务管理',
      description: '管理标准主数据的同步任务，包括实时查询、定时同步、增量同步、文件导入、API推送和消息队列推送。',
    },
    quality: {
      title: '数据质量校验',
      description: '对接入的标准主数据进行完整性、一致性、唯一性、有效性和时效性校验，确保 H-MELC 使用的数据可信。',
    },
    conflicts: {
      title: '数据冲突处理',
      description: '处理同一主数据对象在不同来源、不同批次或不同时间点出现的不一致问题，保证 H-MELC 最终使用的数据口径统一。',
    },
  }

  const table = {
    objects: (
      <Table
        rowKey="key"
        columns={objectColumns(setSelected, runCacheRefresh)}
        dataSource={MASTER_DATA_OBJECTS}
        scroll={{ x: 1900 }}
        locale={{ emptyText: <Empty description="暂无主数据来源设置。请先添加需要接入的标准主数据对象，配置字段映射、同步策略和质量校验规则。" /> }}
      />
    ),
    mapping: (
      <Table
        rowKey="key"
        columns={mappingColumns()}
        dataSource={MAPPING_ROWS}
        scroll={{ x: 1500 }}
        locale={{ emptyText: <Empty description="暂无字段映射规则。请为接入数据配置原始字段与 H-MELC 标准字段之间的映射关系。" /> }}
      />
    ),
    sync: (
      <Table
        rowKey="key"
        columns={syncColumns()}
        dataSource={SYNC_TASK_ROWS}
        scroll={{ x: 1500 }}
        locale={{ emptyText: <Empty description="暂无同步任务。请为主数据对象配置实时查询、定时同步、文件导入或消息推送任务。" /> }}
      />
    ),
    quality: (
      <Table
        rowKey="key"
        columns={qualityColumns()}
        dataSource={QUALITY_ROWS}
        scroll={{ x: 1400 }}
        locale={{ emptyText: <Empty description="暂无校验问题。当前主数据对象通过质量校验。" /> }}
      />
    ),
    conflicts: (
      <Table
        rowKey="key"
        columns={conflictColumns()}
        dataSource={CONFLICT_ROWS}
        scroll={{ x: 1650 }}
        locale={{ emptyText: <Empty description="暂无待处理冲突。当前主数据口径一致。" /> }}
      />
    ),
  }[view]

  return (
    <PageScaffold title={meta[view].title} description={meta[view].description}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          showIcon
          type="info"
          message="本模块用于配置 H-MELC 所需标准主数据的接入、映射、同步、校验和异常处理。系统只消费规范、可用、可信的主数据，不关心来源系统名称。"
        />
        <Space wrap>
          <Button icon={<CheckCircleOutlined />} loading={testing} onClick={runConnectionTest}>
            测试连接
          </Button>
          <Button icon={<SyncOutlined />} loading={refreshing} onClick={runCacheRefresh}>
            刷新缓存
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={() => downloadMasterDataContract().catch((error) => message.error(error instanceof Error ? error.message : String(error)))}
          >
            导出对接包
          </Button>
        </Space>
        {testResult ? (
          <Alert
            showIcon
            type={testResult.connected ? 'success' : 'warning'}
            message={`最近连通测试：${testResult.connected ? '全部关键对象可访问' : '存在不可访问对象'}`}
            description={`${testResult.source_name} · ${testResult.base_url} · ${testResult.items.filter((item) => item.ok).length}/${testResult.items.length} 个对象通过 · ${testResult.tested_at}`}
          />
        ) : null}
        {refreshResult ? (
          <Alert
            showIcon
            type={(refreshResult.failed ?? []).length ? 'warning' : 'success'}
            message="最近缓存刷新结果"
            description={`已刷新 ${Object.keys(refreshResult.refreshed ?? {}).length} 类对象；失败 ${(refreshResult.failed ?? []).length} 类；缓存 TTL ${refreshResult.cache_status?.ttl_seconds ?? '—'} 秒；最近刷新 ${refreshResult.cache_status?.latest_refreshed_at ?? '—'}。`}
          />
        ) : null}
        <div className="master-data-source-page__stats">
          <div><span>主数据对象数</span><strong>{summary.total}</strong></div>
          <div><span>已启用对象</span><strong>{summary.enabled}</strong></div>
          <div><span>待校验对象</span><strong>{summary.pending}</strong></div>
          <div><span>异常 / 冲突</span><strong>{summary.conflict}</strong></div>
          <div><span>平均质量评分</span><strong>{summary.avg}</strong></div>
        </div>
        {view === 'objects' ? (
          <Card bordered={false}>
            <Title level={5}>设备档案与主数据关系</Title>
            <Paragraph>
              设备档案中的科室、院区、厂商、供应商、维保商、设备分类、设备状态、计量属性、风险等级等字段应优先引用标准主数据。购置日期、验收记录、维修记录、保养记录、计量记录、停机记录、报废记录、效益分析等属于 H-MELC 业务数据。
            </Paragraph>
            <Paragraph>
              主数据回答“这个对象是谁、标准编码是什么、标准名称是什么、当前状态是什么”。H-MELC 回答“这个对象在医学装备业务中发生了什么”。
            </Paragraph>
          </Card>
        ) : null}
        {view === 'mapping' ? (
          <Card bordered={false}>
            <Space direction="vertical">
              <Text strong>字段映射示例</Text>
              <Text>emp_no / staff_id / user_code / worker_code → person_code</Text>
              <Text>dept_name / department / office_name → dept_name</Text>
            </Space>
          </Card>
        ) : null}
        {table}
        {view === 'objects' || view === 'quality' || view === 'conflicts' ? <RadiationScenarioCard /> : null}
        <BoundaryCard />
      </Space>
      <ObjectDrawer row={selected} onClose={() => setSelected(null)} />
    </PageScaffold>
  )
}
