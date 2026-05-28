import type { ReactNode } from 'react'
import { Space, Typography } from 'antd'
import { ProCard } from '@ant-design/pro-components'

const { Title, Text } = Typography

type PageScaffoldProps = {
  title: string
  description?: string
  extra?: ReactNode
  children: ReactNode
}

/** 医院列表页统一：标题区 + 白卡片内容区（对齐 dashboard.html 非首页列表） */
export function PageScaffold({ title, description, extra, children }: PageScaffoldProps) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <Title level={4} style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#1f2937' }}>
            {title}
          </Title>
          {description ? (
            <Text style={{ display: 'block', marginTop: 6, maxWidth: 760, fontSize: 14, color: '#6b7280' }}>
              {description}
            </Text>
          ) : null}
        </div>
        {extra ? <Space wrap>{extra}</Space> : null}
      </div>
      <ProCard
        bordered
        style={{
          borderRadius: 10,
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)',
          background: '#ffffff',
        }}
        bodyStyle={{ padding: 16, background: '#ffffff' }}
      >
        {children}
      </ProCard>
    </div>
  )
}
