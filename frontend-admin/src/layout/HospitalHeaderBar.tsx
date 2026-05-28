import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dropdown, Input, Modal, Popover, Typography } from 'antd'
import {
  AlertOutlined,
  ApartmentOutlined,
  BellOutlined,
  BuildOutlined,
  CheckSquareOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  KeyOutlined,
  LogoutOutlined,
  MedicineBoxOutlined,
  MessageOutlined,
  RobotOutlined,
  SearchOutlined,
  ToolOutlined,
  UserSwitchOutlined,
  WarningOutlined,
} from '@ant-design/icons'

import { MePasswordModal } from '../components/MePasswordModal'
import { logoutSession } from '../auth/logout'
import { IS_AUTH_MOCK } from '../config/authMode'
import type { AdminMenuGroup } from '../navigation/menu'
import { useAuthSession } from '../stores/authSession'

const { Text } = Typography

type CommandTone = 'blue' | 'cyan' | 'orange' | 'red'
type IocTone = 'normal' | 'warning' | 'critical' | 'info'

interface CommandCategory {
  key: string
  label: string
  query: string
  icon: ReactNode
}

interface CommandItem {
  type: string
  title: string
  desc: string
  action: string
  path: string
  tone: CommandTone
  keywords: string[]
}

interface SystemStatusItem {
  key: string
  label: string
  value: string
  detail: string
  tone: IocTone
}

interface OpsMessageItem {
  key: string
  type: string
  title: string
  meta: string
  count: number
  tone: IocTone
  path: string
  icon: ReactNode
}

const COMMAND_CATEGORIES: CommandCategory[] = [
  { key: 'equipment', label: '设备', query: 'MRI', icon: <MedicineBoxOutlined /> },
  { key: 'risk', label: '风险', query: '风险', icon: <WarningOutlined /> },
  { key: 'workorder', label: '工单', query: '维修工单', icon: <ToolOutlined /> },
  { key: 'task', label: '任务', query: '闭环任务', icon: <CheckSquareOutlined /> },
  { key: 'department', label: '科室', query: 'ICU', icon: <ApartmentOutlined /> },
  { key: 'alarm', label: '报警', query: '报警', icon: <AlertOutlined /> },
  { key: 'supplier', label: '供应商', query: 'Mindray', icon: <BuildOutlined /> },
  { key: 'ai', label: 'AI', query: 'AI', icon: <RobotOutlined /> },
]

const COMMAND_ITEMS: CommandItem[] = [
  {
    type: '设备',
    title: 'MRI-001 · Siemens Magnetom',
    desc: '放射科 MRI一室 · 风险观察 · 在线率 87.2%',
    action: '进入设备档案',
    path: '/assets/archive',
    tone: 'orange',
    keywords: ['mri', 'siemens', '设备档案', '放射科', '风险观察'],
  },
  {
    type: '风险',
    title: 'MRI冷却系统风险',
    desc: 'AI预测未来7天故障率上升12%，建议提前检查冷却循环组件',
    action: '查看风险预警',
    path: '/dashboard/risk',
    tone: 'red',
    keywords: ['mri', '冷却', '风险', 'ai', '预测'],
  },
  {
    type: '任务',
    title: '任务运营中心 · 今日高风险任务',
    desc: '事件 → 任务 → 派单 → SLA升级 → 验收归档，当前高风险任务 11 项',
    action: '进入任务中枢',
    path: '/task-center/high-risk',
    tone: 'orange',
    keywords: ['任务', '闭环', 'sla', '督办', '高风险'],
  },
  {
    type: '工单',
    title: 'REP-2026-0513 · DSA高压报警',
    desc: 'DSA-003 · 介入导管室 · High · 等待工程师接单',
    action: '打开维修工单',
    path: '/repair/tickets',
    tone: 'red',
    keywords: ['工单', '维修', 'dsa', '报警', '介入导管室'],
  },
  {
    type: '科室',
    title: '急诊ICU设备压力画像',
    desc: '呼吸机、监护仪、注射泵可用率 99.2%，夜间值班资源偏紧',
    action: '查看科室使用分析',
    path: '/analytics/dept-usage',
    tone: 'cyan',
    keywords: ['icu', '科室', '呼吸机', '监护仪', '压力画像'],
  },
  {
    type: '报警',
    title: 'VENT-ICU-12 · 监护链路离线',
    desc: '15:40 · 急诊ICU · 网络链路抖动，已触发值班通知',
    action: '进入实时事件中心',
    path: '/dashboard/events',
    tone: 'orange',
    keywords: ['报警', '离线', 'icu', 'vent', '事件'],
  },
  {
    type: '供应商',
    title: 'Mindray供应商响应态势',
    desc: '平均响应 18min · 本月完成率 96.4% · 质量安全良好',
    action: '查看供应商分析',
    path: '/analytics/supplier',
    tone: 'blue',
    keywords: ['mindray', '迈瑞', '供应商', '响应', '分析'],
  },
  {
    type: 'AI',
    title: 'AI助手 · PM超期风险预测',
    desc: '介入中心 DSA PM执行率低于目标值，建议优先安排维护窗口',
    action: '打开AI助手',
    path: '/ai/ops',
    tone: 'cyan',
    keywords: ['ai', 'pm', '超期', '预测', '维护'],
  },
]

const SYSTEM_STATUS_ITEMS: SystemStatusItem[] = [
  { key: 'his', label: 'HIS', value: '正常', detail: '门诊 / 住院接口延迟 42ms', tone: 'normal' },
  { key: 'pacs', label: 'PACS', value: '异常', detail: '影像回传队列积压 3 条，已生成任务', tone: 'critical' },
  { key: 'iot', label: 'IoT', value: '在线', detail: '设备网关 286/292 在线', tone: 'normal' },
  { key: 'mqtt', label: 'MQTT', value: '正常', detail: '最近心跳 8 秒前，订阅 34 个主题', tone: 'info' },
]

const OPS_MESSAGE_ITEMS: OpsMessageItem[] = [
  {
    key: 'risk',
    type: '风险通知',
    title: 'MRI冷却系统风险升级',
    meta: 'Critical · MRI-001 · 已转任务',
    count: 3,
    tone: 'critical',
    path: '/dashboard/risk',
    icon: <WarningOutlined />,
  },
  {
    key: 'pm',
    type: 'PM提醒',
    title: 'DSA PM窗口不足',
    meta: 'High · 介入导管室 · 今日督办',
    count: 4,
    tone: 'warning',
    path: '/pm/alerts',
    icon: <CheckSquareOutlined />,
  },
  {
    key: 'ai',
    type: 'AI预警',
    title: '未来7天故障率上升 12%',
    meta: 'AI OPS · 建议提前更换冷却组件',
    count: 2,
    tone: 'info',
    path: '/ai/ops',
    icon: <RobotOutlined />,
  },
  {
    key: 'system',
    type: '系统消息',
    title: 'PACS接口自动重连中',
    meta: 'SYSTEM · WebSocket 已同步',
    count: 1,
    tone: 'normal',
    path: '/dashboard/messages',
    icon: <MessageOutlined />,
  },
]

/** 医院运营平台顶栏：IOC Command Search + 系统状态 / 消息中心 / 值班控制区 */
const ROLE_LABELS: Record<string, string> = {
  PLATFORM_ADMIN: '平台管理员',
  SYS_ADMIN: '系统管理员',
  DEVICE_DIRECTOR: '设备科主任',
  DEVICE_ADMIN: '设备管理',
  DEVICE_ENGINEER: '设备科工程师',
  ENGINEER: '工程师',
  DEPT_DIRECTOR: '科室主任',
  DEPT_HEAD_NURSE: '科室护士长',
  DEPT_USER: '科室用户',
  PROCUREMENT: '采购',
  FINANCE: '财务',
  SUPPLIER_PORTAL: '供应商',
  AUDIT_QC: '质控审计',
  AUDIT_ADMIN: '审计',
}

export function HospitalHeaderBar({ groups: _groups }: { groups: AdminMenuGroup[] }) {
  void _groups
  const nav = useNavigate()
  const me = useAuthSession((s) => s.me)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const [messageOpen, setMessageOpen] = useState(false)

  const roles = me?.roles ?? []
  const roleLine = roles.length ? roles.map((r) => ROLE_LABELS[r] ?? r).slice(0, 2).join(' · ') : '—'
  const permCount = me?.permissions?.includes('*') ? '全部' : String(me?.permissions?.length ?? 0)

  const normalizedCommandQuery = commandQuery.trim().toLowerCase()
  const filteredCommands = useMemo(() => {
    if (!normalizedCommandQuery) return COMMAND_ITEMS
    return COMMAND_ITEMS.filter((item) =>
      [item.type, item.title, item.desc, item.action, ...item.keywords].some((value) =>
        value.toLowerCase().includes(normalizedCommandQuery),
      ),
    )
  }, [normalizedCommandQuery])

  function logout() {
    logoutSession()
    nav('/login', { replace: true })
  }

  function runCommand(path: string) {
    setCommandOpen(false)
    setCommandQuery('')
    nav(path)
  }

  function openOpsMessage(path: string) {
    setMessageOpen(false)
    nav(path)
  }

  const totalMessageCount = OPS_MESSAGE_ITEMS.reduce((sum, item) => sum + item.count, 0)

  return (
    <div
      className="hospital-top-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        boxSizing: 'border-box',
        flexShrink: 0,
        paddingInline: 20,
        gap: 16,
        minWidth: 0,
        borderBottom: '1px solid #e5e7eb',
        background: '#ffffff',
        boxShadow: '0 1px 0 rgba(15, 23, 42, 0.04)',
      }}
    >
      <div
        className="hospital-command-slot"
        style={{
          display: 'flex',
          flex: '1 1 320px',
          justifyContent: 'flex-start',
          alignItems: 'center',
          gap: 14,
          minWidth: 0,
        }}
      >
        <button
          type="button"
          className="hospital-command-search"
          onClick={() => setCommandOpen(true)}
          aria-label="打开全局运营搜索"
        >
          <span className="hospital-command-search__kbd">⌘</span>
          <span className="hospital-command-search__label">搜索设备 / 风险 / 工单 / 报警</span>
          <span className="hospital-command-search__scope">IOC Command Search</span>
        </button>
      </div>

      <div className="hospital-ioc-control-zone">
        <Popover
          trigger="hover"
          placement="bottomRight"
          overlayClassName="hospital-ioc-popover"
          content={
            <div className="hospital-status-panel">
              <div className="hospital-popover-head">
                <span>SYSTEM STATUS</span>
                <strong>接口与设备网关状态</strong>
              </div>
              <div className="hospital-status-panel__list">
                {SYSTEM_STATUS_ITEMS.map((item) => (
                  <div key={item.key} className="hospital-status-panel__item" data-tone={item.tone}>
                    <i className="hospital-ioc-dot" />
                    <span>
                      <b>{item.label}</b>
                      <em>{item.detail}</em>
                    </span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          }
        >
          <button type="button" className="hospital-status-console" aria-label="系统状态">
            <span className="hospital-status-console__title">
              <CloudServerOutlined />
              SYSTEM STATUS
            </span>
            <span className="hospital-status-console__grid">
              {SYSTEM_STATUS_ITEMS.map((item) => (
                <span key={item.key} className="hospital-status-mini" data-tone={item.tone}>
                  <i className="hospital-ioc-dot" />
                  <b>{item.label}</b>
                  <em>{item.value}</em>
                </span>
              ))}
            </span>
          </button>
        </Popover>

        <Popover
          trigger="click"
          open={messageOpen}
          onOpenChange={setMessageOpen}
          placement="bottomRight"
          overlayClassName="hospital-ioc-popover"
          content={
            <div className="hospital-message-panel">
              <div className="hospital-popover-head">
                <span>MESSAGE CENTER</span>
                <strong>运营消息流</strong>
              </div>
              <div className="hospital-message-panel__list">
                {OPS_MESSAGE_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className="hospital-message-item"
                    data-tone={item.tone}
                    onClick={() => openOpsMessage(item.path)}
                  >
                    <i>{item.icon}</i>
                    <span>
                      <small>{item.type}</small>
                      <b>{item.title}</b>
                      <em>{item.meta}</em>
                    </span>
                    <strong>{item.count}</strong>
                  </button>
                ))}
              </div>
            </div>
          }
        >
          <button type="button" className="hospital-message-console" aria-label="运营消息中心">
            <BellOutlined />
            <span>
              <b>MESSAGE CENTER</b>
              <em>风险 · PM · AI · 系统</em>
            </span>
            <strong className="hospital-message-console__count">{totalMessageCount}</strong>
          </button>
        </Popover>

        <button type="button" className="hospital-ai-console" onClick={() => nav('/ai/ops')} aria-label="AI助手">
          <RobotOutlined />
          <span>
            <b>AI ASSISTANT</b>
            <em>嵌入式运营建议</em>
          </span>
        </button>

        <Dropdown
          menu={{
            items: [
              {
                key: 'roles',
                label: (
                  <Text type="secondary" style={{ maxWidth: 280 }}>
                    角色：{roles.length ? roles.map((r) => ROLE_LABELS[r] ?? r).join('、') : '—'}
                  </Text>
                ),
                disabled: true,
              },
              {
                key: 'perm',
                label: (
                  <Text type="secondary" style={{ maxWidth: 280 }}>
                    权限码：{permCount} 项{IS_AUTH_MOCK ? '（Mock）' : ''}
                  </Text>
                ),
                disabled: true,
              },
              { type: 'divider' },
              {
                key: 'pwd',
                icon: <KeyOutlined />,
                label: '修改密码',
                onClick: () => setPwdOpen(true),
                disabled: IS_AUTH_MOCK,
              },
              {
                key: 'logout',
                icon: <LogoutOutlined />,
                label: '退出登录',
                onClick: logout,
              },
            ],
          }}
        >
          <button
            type="button"
            className="hospital-duty-console"
            aria-label="值班工程师状态"
          >
            <span className="hospital-duty-console__icon">
              <UserSwitchOutlined />
            </span>
            <span className="hospital-duty-console__text">
              <em>ENGINEER ON DUTY</em>
              <strong>设备科值班</strong>
              <small>{me?.displayName ?? me?.username ?? roleLine} · 在线中</small>
            </span>
            <i className="hospital-ioc-dot" data-tone="normal" />
          </button>
        </Dropdown>
      </div>
      <Modal
        open={commandOpen}
        footer={null}
        width={780}
        centered
        className="hospital-command-modal"
        onCancel={() => setCommandOpen(false)}
      >
        <div className="hospital-command-center">
          <div className="hospital-command-center__head">
            <span>IOC COMMAND CENTER</span>
            <strong>全局运营搜索</strong>
            <p>统一检索设备、风险、工单、科室、报警、供应商与 AI 运营分析。</p>
          </div>
          <Input
            autoFocus
            allowClear
            size="large"
            value={commandQuery}
            className="hospital-command-center__input"
            placeholder="搜索 MRI / ICU / PM / 报警 / 维修工单"
            prefix={<SearchOutlined />}
            onChange={(event) => setCommandQuery(event.target.value)}
            onPressEnter={() => {
              const first = filteredCommands[0]
              if (first) runCommand(first.path)
            }}
          />
          <div className="hospital-command-categories" aria-label="运营搜索分类">
            {COMMAND_CATEGORIES.map((category) => (
              <button
                key={category.key}
                type="button"
                className="hospital-command-chip"
                onClick={() => setCommandQuery(category.query)}
              >
                {category.icon}
                <span>{category.label}</span>
              </button>
            ))}
          </div>
          <div className="hospital-command-results">
            <div className="hospital-command-results__title">
              <span>Command Center</span>
              <em>{filteredCommands.length} 条运营结果</em>
            </div>
            {filteredCommands.length ? (
              filteredCommands.map((item) => (
                <button
                  key={`${item.type}-${item.title}`}
                  type="button"
                  className="hospital-command-result"
                  data-tone={item.tone}
                  onClick={() => runCommand(item.path)}
                >
                  <i />
                  <span>
                    <small>{item.type}</small>
                    <strong>{item.title}</strong>
                    <em>{item.desc}</em>
                  </span>
                  <b>{item.action}</b>
                </button>
              ))
            ) : (
              <div className="hospital-command-empty">
                <DatabaseOutlined />
                <span>未找到匹配结果，可尝试 MRI、ICU、PM、报警或供应商名称。</span>
              </div>
            )}
          </div>
        </div>
      </Modal>
      <MePasswordModal open={pwdOpen} onClose={() => setPwdOpen(false)} />
    </div>
  )
}
