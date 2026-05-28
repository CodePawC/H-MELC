/** 对齐 docs/05_前端设计/：菜单已挂路由，业务字段与交互待与接口联调 */

import { Card, Empty, Typography } from 'antd'
import { AppstoreOutlined } from '@ant-design/icons'

const { Paragraph } = Typography

type Props = {
  title: string
}

export function PlaceholderPage({ title }: Props) {
  return (
    <Card bordered={false} style={{ borderRadius: 8 }}>
      <Empty
        image={<AppstoreOutlined style={{ fontSize: 48, color: '#d1d5db' }} />}
        imageStyle={{ height: 64 }}
        description={
          <span>
            <Typography.Title level={4} style={{ marginTop: 0 }}>
              {title}
            </Typography.Title>
            <Paragraph type="secondary" style={{ maxWidth: 520, margin: '0 auto' }}>
              本页为 PC 管理端菜单占位。列表、表单与状态机以{' '}
              <Typography.Text code>docs/05_前端设计/</Typography.Text> 与{' '}
              <Typography.Text code>docs/06_接口设计/</Typography.Text> 为准；就绪后在此对接数据。
            </Paragraph>
          </span>
        }
      />
    </Card>
  )
}
