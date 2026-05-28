/**
 * 详情 Drawer 内保养/计量/合同等演示行（后端详情壳尚未返回时使用）。
 */

import type { AssetArchiveDisplayRow } from './assetArchiveEnrichment'

export type PmMockRow = {
  plan: string
  item: string
  executor: string
  done_at: string
  result: string
}

export type CalMockRow = {
  cal_date: string
  due_date: string
  org: string
  cert_no: string
  result: string
  attachment: string
}

export type ContractMockRow = {
  contract_no: string
  supplier: string
  invoice_no: string
  amount: string
  pay_status: string
}

export type AttachmentMock = { type: string; name: string; status: string }

export type LifecycleMockItem = { time: string; title: string; detail: string }

function seed(row: AssetArchiveDisplayRow): number {
  let h = 0
  for (let i = 0; i < row.id.length; i++) h = (h * 31 + row.id.charCodeAt(i)) >>> 0
  return h
}

export function mockPmRows(row: AssetArchiveDisplayRow): PmMockRow[] {
  const y = seed(row)
  return [
    {
      plan: `${row.category_label}年度预防性维护`,
      item: '外观检查 / 功能自检 / 附件校准',
      executor: '医学装备科 · 工程师甲',
      done_at: `2026-${String((y % 9) + 1).padStart(2, '0')}-12`,
      result: '合格',
    },
    {
      plan: `${row.asset_name.slice(0, 12)}…专项巡检`,
      item: '电气安全 / 报警限值复核',
      executor: '第三方服务机构',
      done_at: `2025-${String((y % 11) + 1).padStart(2, '0')}-08`,
      result: '整改完成',
    },
  ]
}

export function mockCalRows(row: AssetArchiveDisplayRow): CalMockRow[] {
  if (!row.is_metrology_device) return []
  const y = seed(row)
  const year = 2025 + (y % 2)
  return [
    {
      cal_date: `${year}-03-18`,
      due_date: `${year + 1}-03-17`,
      org: '山东省计量科学研究院',
      cert_no: `SDJL-YX-${100000 + (y % 99999)}`,
      result: '合格',
      attachment: `${row.asset_code}_校准证书.pdf`,
    },
  ]
}

export function mockContractRows(row: AssetArchiveDisplayRow): ContractMockRow[] {
  return [
    {
      contract_no: `WLX-CG-2024-${row.asset_code.slice(-4)}`,
      supplier: row.supplier_demo_name,
      invoice_no: `INV-${String(seed(row)).slice(0, 8)}`,
      amount: `¥ ${Number(row.original_value || 0).toLocaleString('zh-CN')}`,
      pay_status: seed(row) % 3 === 0 ? '已付清' : '部分付款',
    },
  ]
}

export function mockAttachmentGallery(row: AssetArchiveDisplayRow): AttachmentMock[] {
  const base = row.asset_code
  return [
    { type: '验收报告', name: `${base}_验收报告.pdf`, status: '已归档' },
    { type: '合同', name: `${base}_购销合同.pdf`, status: '已归档' },
    { type: '发票', name: `${base}_增值税发票.pdf`, status: '已扫描' },
    { type: '说明书', name: `${base}_使用说明书.pdf`, status: '院内可见' },
    { type: '注册证', name: `${row.registration_no ?? '注册证'}.pdf`, status: '合规留存' },
    { type: '合格证', name: `${base}_合格证.jpg`, status: '已上传' },
    { type: '维修图片', name: `${base}_维修记录_2025.png`, status: '工单关联' },
  ]
}

export function mockLifecycleTimeline(row: AssetArchiveDisplayRow): LifecycleMockItem[] {
  return [
    {
      time: row.created_at?.slice(0, 10) ?? '—',
      title: '资产建档入库',
      detail: `编制资产编号 ${row.asset_code}，归口医学装备科台账`,
    },
    {
      time: row.install_display,
      title: '启用与科室绑定',
      detail: `分配至 ${row.department_name} · ${row.location_text}`,
    },
    {
      time: '2025-06-01',
      title: '年度巡检完成',
      detail: '生命周期质检记录已写入（演示）',
    },
    {
      time: row.updated_at?.slice(0, 10) ?? '—',
      title: '最近台账更新',
      detail: '运行状态 / 风险分级复核',
    },
  ]
}
