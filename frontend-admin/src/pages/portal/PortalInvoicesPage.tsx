import { Alert, Button, Card, Space, Table, Typography, Upload } from 'antd'
import { UploadOutlined } from '@ant-design/icons'

import { Auth } from '../../auth/Auth'
import { useAuthSession } from '../../stores/authSession'

const { Title } = Typography

export function PortalInvoicesPage() {
  const me = useAuthSession((s) => s.me)

  return (
    <div>
      <Title level={4}>发票与随货同行单</Title>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={`数据隔离：仅展示供应商 ${me?.supplierId ?? '—'} 相关业务（Mock 演示）。`}
      />
      <Card>
        <Table
          size="small"
          pagination={false}
          dataSource={[
            { key: '1', no: 'INV-202605001', amt: '¥ 12,800.00', status: '待审核' },
            { key: '2', no: 'INV-202604018', amt: '¥ 3,200.00', status: '已入账' },
          ]}
          columns={[
            { title: '发票号', dataIndex: 'no' },
            { title: '金额', dataIndex: 'amt' },
            { title: '状态', dataIndex: 'status' },
          ]}
        />
        <Space style={{ marginTop: 16 }}>
          <Auth permission="supplier:invoice:upload">
            <Upload beforeUpload={() => false} showUploadList={false}>
              <Button type="primary" icon={<UploadOutlined />}>
                上传发票 / 随货单
              </Button>
            </Upload>
          </Auth>
        </Space>
      </Card>
    </div>
  )
}
