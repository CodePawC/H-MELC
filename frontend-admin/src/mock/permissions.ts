/**
 * 权限码与菜单树（Mock / 前端 RBAC 演示）。
 * 格式：module:resource:action
 */

import type { DataNode } from 'antd/es/tree'

/** 全量权限码（用于角色分配、权限树勾选） */
export const PERMISSION_CODES: string[] = [
  'dashboard:home:view',
  // 设备台账
  'equipment:asset:view',
  'equipment:asset:create',
  'equipment:asset:update',
  'equipment:asset:delete',
  'equipment:asset:export',
  // 维修
  'equipment:repair:view',
  'equipment:repair:create',
  'equipment:repair:assign',
  'equipment:repair:process',
  'equipment:repair:confirm',
  'equipment:repair:close',
  'equipment:repair:export',
  // 预防性维护 / 计量等（院内扩展）
  'equipment:pm:view',
  'equipment:pm:execute',
  'equipment:metrology:view',
  'equipment:metrology:manage',
  'equipment:qc:view',
  'equipment:emergency:view',
  // 采购 / 合同 / 验收
  'equipment:purchase:view',
  'equipment:purchase:create',
  'equipment:purchase:approve',
  'equipment:purchase:reject',
  'equipment:purchase:export',
  'equipment:contract:view',
  'equipment:contract:manage',
  'equipment:acceptance:view',
  'equipment:acceptance:manage',
  'equipment:retire:view',
  'equipment:retire:approve',
  // 耗材
  'equipment:consumable:view',
  'equipment:consumable:manage',
  // 供应商协同（院内）
  'supplier:profile:view',
  'supplier:profile:manage',
  'supplier:qualification:view',
  'supplier:qualification:approve',
  'supplier:project:view',
  'supplier:project:manage',
  // 供应商门户（外部）
  'supplier:portal:access',
  'supplier:invoice:upload',
  'supplier:invoice:view',
  'supplier:payment:view',
  'supplier:quotation:upload',
  'supplier:contract:upload',
  // 财务
  'finance:invoice:view',
  'finance:payment:view',
  'finance:payment:approve',
  'finance:payment:confirm',
  'finance:payment:export',
  'finance:aging:view',
  // 知识 / AI
  'knowledge:doc:view',
  'knowledge:doc:upload',
  'ai:task:view',
  'ai:task:create',
  // 工作流 / 主数据
  'workflow:config:view',
  'workflow:task:view',
  'mdm:dict:view',
  'mdm:dict:edit',
  // 系统
  'system:user:view',
  'system:user:create',
  'system:user:update',
  'system:user:disable',
  'system:role:view',
  'system:role:update',
  'system:permission:update',
  'system:menu:assign',
  'system:audit:view',
  'system:param:view',
]

/** Ant Design Tree 用菜单/权限树（Mock 分配界面） */
export const PERMISSION_MENU_TREE: DataNode[] = [
  {
    title: '工作台',
    key: 'mod-dashboard',
    children: [{ title: '首页驾驶舱 (dashboard:home:view)', key: 'dashboard:home:view' }],
  },
  {
    title: '设备全生命周期',
    key: 'mod-lifecycle',
    children: [
      { title: '台账查看', key: 'equipment:asset:view' },
      { title: '台账新建', key: 'equipment:asset:create' },
      { title: '台账编辑', key: 'equipment:asset:update' },
      { title: '台账删除', key: 'equipment:asset:delete' },
      { title: '台账导出', key: 'equipment:asset:export' },
      { title: '预防维护', key: 'equipment:pm:view' },
      { title: '预防维护执行', key: 'equipment:pm:execute' },
      { title: '计量合规', key: 'equipment:metrology:view' },
      { title: '计量管理', key: 'equipment:metrology:manage' },
      { title: '质控检查', key: 'equipment:qc:view' },
      { title: '应急调配', key: 'equipment:emergency:view' },
      { title: '报废处置', key: 'equipment:retire:view' },
      { title: '报废审批', key: 'equipment:retire:approve' },
      { title: '耗材管理', key: 'equipment:consumable:view' },
      { title: '耗材维护', key: 'equipment:consumable:manage' },
    ],
  },
  {
    title: '维修管理',
    key: 'mod-repair',
    children: [
      { title: '工单查看', key: 'equipment:repair:view' },
      { title: '报修发起', key: 'equipment:repair:create' },
      { title: '派单', key: 'equipment:repair:assign' },
      { title: '处理过程', key: 'equipment:repair:process' },
      { title: '科室确认', key: 'equipment:repair:confirm' },
      { title: '结案', key: 'equipment:repair:close' },
      { title: '导出', key: 'equipment:repair:export' },
    ],
  },
  {
    title: '采购 / 合同 / 验收',
    key: 'mod-procurement',
    children: [
      { title: '采购查看', key: 'equipment:purchase:view' },
      { title: '采购新建', key: 'equipment:purchase:create' },
      { title: '采购审核', key: 'equipment:purchase:approve' },
      { title: '采购驳回', key: 'equipment:purchase:reject' },
      { title: '采购导出', key: 'equipment:purchase:export' },
      { title: '合同', key: 'equipment:contract:view' },
      { title: '合同维护', key: 'equipment:contract:manage' },
      { title: '验收查看', key: 'equipment:acceptance:view' },
      { title: '验收维护', key: 'equipment:acceptance:manage' },
    ],
  },
  {
    title: '供应商协同（院内）',
    key: 'mod-supplier-in',
    children: [
      { title: '档案', key: 'supplier:profile:view' },
      { title: '档案维护', key: 'supplier:profile:manage' },
      { title: '资质', key: 'supplier:qualification:view' },
      { title: '资质审核', key: 'supplier:qualification:approve' },
      { title: '竞价项目', key: 'supplier:project:view' },
      { title: '项目管理', key: 'supplier:project:manage' },
    ],
  },
  {
    title: '供应商门户',
    key: 'mod-supplier-portal',
    children: [
      { title: '门户入口', key: 'supplier:portal:access' },
      { title: '发票上传', key: 'supplier:invoice:upload' },
      { title: '发票查看', key: 'supplier:invoice:view' },
      { title: '付款进度', key: 'supplier:payment:view' },
      { title: '报价上传', key: 'supplier:quotation:upload' },
      { title: '合同附件', key: 'supplier:contract:upload' },
    ],
  },
  {
    title: '发票与付款',
    key: 'mod-finance',
    children: [
      { title: '发票查看', key: 'finance:invoice:view' },
      { title: '付款查看', key: 'finance:payment:view' },
      { title: '付款审批', key: 'finance:payment:approve' },
      { title: '付款确认', key: 'finance:payment:confirm' },
      { title: '付款导出', key: 'finance:payment:export' },
      { title: '账龄', key: 'finance:aging:view' },
    ],
  },
  {
    title: '知识中心 / AI',
    key: 'mod-knowledge',
    children: [
      { title: '文档查看', key: 'knowledge:doc:view' },
      { title: '文档上传', key: 'knowledge:doc:upload' },
      { title: 'AI 任务', key: 'ai:task:view' },
      { title: 'AI 创建', key: 'ai:task:create' },
    ],
  },
  {
    title: '系统管理',
    key: 'mod-system',
    children: [
      { title: '用户查看', key: 'system:user:view' },
      { title: '用户新建', key: 'system:user:create' },
      { title: '用户编辑', key: 'system:user:update' },
      { title: '用户启停', key: 'system:user:disable' },
      { title: '角色查看', key: 'system:role:view' },
      { title: '角色维护', key: 'system:role:update' },
      { title: '权限分配', key: 'system:permission:update' },
      { title: '菜单授权', key: 'system:menu:assign' },
      { title: '审计日志', key: 'system:audit:view' },
      { title: '系统参数', key: 'system:param:view' },
    ],
  },
]
