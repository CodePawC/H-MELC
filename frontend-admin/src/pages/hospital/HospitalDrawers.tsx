import { Descriptions, Drawer, Tabs, Timeline, Typography } from 'antd'
import type { MockAssetRow, MockRepairRow } from '../../mock/hospital/tables'
import { MOCK_ASSETS, MOCK_PAYMENTS } from '../../mock/hospital/tables'
import { SUPPLIERS } from '../../mock/hospital/fixtures'

const { Text } = Typography

export function DeviceArchiveDrawer({
  open,
  onClose,
  row,
}: {
  open: boolean
  onClose: () => void
  row: MockAssetRow | null
}) {
  if (!row) return null
  return (
    <Drawer title={`设备档案 — ${row.name}`} width={720} open={open} onClose={onClose} destroyOnClose>
      <Tabs
        items={[
          {
            key: '1',
            label: '基础信息',
            children: (
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="资产编号">{row.assetNo}</Descriptions.Item>
                <Descriptions.Item label="设备名称">{row.name}</Descriptions.Item>
                <Descriptions.Item label="规格型号">{row.spec}</Descriptions.Item>
                <Descriptions.Item label="品牌厂家">{row.brand}</Descriptions.Item>
                <Descriptions.Item label="设备分类">{row.category}</Descriptions.Item>
                <Descriptions.Item label="使用科室">{row.dept}</Descriptions.Item>
                <Descriptions.Item label="存放地点">{row.location}</Descriptions.Item>
                <Descriptions.Item label="启用日期">{row.startDate}</Descriptions.Item>
                <Descriptions.Item label="原值（元）">{row.originalValue.toLocaleString()}</Descriptions.Item>
                <Descriptions.Item label="状态">{row.status}</Descriptions.Item>
                <Descriptions.Item label="责任人">{row.owner}</Descriptions.Item>
                <Descriptions.Item label="二维码">{row.qr}</Descriptions.Item>
              </Descriptions>
            ),
          },
          { key: '2', label: '使用信息', children: <Text type="secondary">与 HIS/资产系统对接后展示使用频次、开机率等。</Text> },
          { key: '3', label: '维修记录', children: <Timeline items={[{ children: '2026-04-02 更换传感器' }, { children: '2025-11-18 预防性检查' }]} /> },
          { key: '4', label: '保养记录', children: <Text type="secondary">保养任务与 PM 计划关联展示。</Text> },
          { key: '5', label: '计量记录', children: <Text type="secondary">检定/校准记录与证书编号。</Text> },
          { key: '6', label: '合同发票', children: <Text type="secondary">合同与发票台账关联。</Text> },
          { key: '7', label: '附件资料', children: <Text type="secondary">说明书、验收单、培训记录等附件。</Text> },
          { key: '8', label: '操作日志', children: <Text type="secondary">字段级变更与操作人审计。</Text> },
        ]}
      />
    </Drawer>
  )
}

export function RepairOrderDrawer({
  open,
  onClose,
  row,
}: {
  open: boolean
  onClose: () => void
  row: MockRepairRow | null
}) {
  if (!row) return null
  return (
    <Drawer title={`维修工单 — ${row.orderNo}`} width={720} open={open} onClose={onClose} destroyOnClose>
      <Tabs
        items={[
          {
            key: '1',
            label: '工单信息',
            children: (
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="工单编号">{row.orderNo}</Descriptions.Item>
                <Descriptions.Item label="设备名称">{row.deviceName}</Descriptions.Item>
                <Descriptions.Item label="报修科室">{row.dept}</Descriptions.Item>
                <Descriptions.Item label="报修人">{row.reporter}</Descriptions.Item>
                <Descriptions.Item label="紧急程度">{row.urgent}</Descriptions.Item>
                <Descriptions.Item label="当前状态">{row.status}</Descriptions.Item>
                <Descriptions.Item label="工程师">{row.engineer}</Descriptions.Item>
                <Descriptions.Item label="报修时间">{row.reportTime}</Descriptions.Item>
              </Descriptions>
            ),
          },
          { key: '2', label: '故障描述', children: <Text>{row.fault}</Text> },
          { key: '3', label: '处理过程', children: <Timeline items={[{ children: '接单并电话指导' }, { children: '现场更换模块' }]} /> },
          { key: '4', label: '配件费用', children: <Text>合计：¥{row.fee}</Text> },
          { key: '5', label: '验收确认', children: <Text type="secondary">科室签字与满意度。</Text> },
          {
            key: '6',
            label: '时间线',
            children: <Timeline items={[{ color: 'green', children: '报修' }, { color: 'blue', children: '派工' }, { children: '处理中' }]} />,
          },
          { key: '7', label: '附件图片', children: <Text type="secondary">现场照片、铭牌、错误界面截图。</Text> },
        ]}
      />
    </Drawer>
  )
}

export function Supplier360Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = SUPPLIERS[0]
  const pay = MOCK_PAYMENTS[0]
  return (
    <Drawer title={`供应商 — ${s}`} width={720} open={open} onClose={onClose} destroyOnClose>
      <Tabs
        items={[
          {
            key: '1',
            label: '基础信息',
            children: (
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="名称">{s}</Descriptions.Item>
                <Descriptions.Item label="信用等级">A</Descriptions.Item>
                <Descriptions.Item label="联系人">张经理 / 138****0000</Descriptions.Item>
              </Descriptions>
            ),
          },
          { key: '2', label: '合同记录', children: <Text type="secondary">合同台账与履约里程碑。</Text> },
          { key: '3', label: '发票记录', children: <Text>最近发票 {pay.invoiceNo}</Text> },
          { key: '4', label: '付款记录', children: <Text>已付 {pay.paidAmt.toLocaleString()} 元</Text> },
          { key: '5', label: '对账记录', children: <Text type="secondary">月度对账差异与确认。</Text> },
          { key: '6', label: '服务评价', children: <Text type="secondary">响应时效、配件正品率、培训支持。</Text> },
        ]}
      />
    </Drawer>
  )
}

export function pickAssetById(id: string | undefined): MockAssetRow | null {
  if (!id) return null
  return MOCK_ASSETS.find((a) => a.id === id) ?? null
}
