import { Card, Space, Typography, Upload, Button } from 'antd'
import { UploadOutlined } from '@ant-design/icons'

import { Auth } from '../../auth/Auth'

const { Title, Paragraph } = Typography

export function PortalQuotationsPage() {
  return (
    <div>
      <Title level={4}>报价与合同附件</Title>
      <Paragraph type="secondary">院内竞价与合同流程的附件上传入口（Mock）。</Paragraph>
      <Card>
        <Space direction="vertical">
          <Auth permission="supplier:quotation:upload">
            <Upload beforeUpload={() => false}>
              <Button icon={<UploadOutlined />}>上传维修报价单</Button>
            </Upload>
          </Auth>
          <Auth permission="supplier:contract:upload">
            <Upload beforeUpload={() => false}>
              <Button icon={<UploadOutlined />}>上传合同扫描件</Button>
            </Upload>
          </Auth>
        </Space>
      </Card>
    </div>
  )
}
