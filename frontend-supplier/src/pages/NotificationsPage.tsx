import { useEffect, useState } from 'react'
import { Badge, Card, List, Tag, Typography, message } from 'antd'
import { BellOutlined } from '@ant-design/icons'
import { apiRequest } from '../lib/api'

const { Title, Text } = Typography

type NotificationItem = {
  id: string; title: string; content: string
  notification_type: string; is_read: boolean; created_at: string
}

const TYPE_COLORS: Record<string, string> = {
  ENROLLMENT: 'blue', PROJECT: 'geekblue', BIDDING: 'volcano', SYSTEM: 'default',
}

export function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const unread = items.filter(i => !i.is_read).length

  const load = () => {
    setLoading(true)
    apiRequest<{ items: NotificationItem[]; total: number }>('/api/v1/supplier/procurement/notifications')
      .then(d => setItems(d.items || []))
      .catch(e => message.error(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const markRead = async (id: string) => {
    try {
      await apiRequest(`/api/v1/supplier/procurement/notifications/${id}/read`, { method: 'POST' })
      setItems(prev => prev.map(i => i.id === id ? { ...i, is_read: true } : i))
    } catch { /* ignore */ }
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 16 }}>
        <BellOutlined style={{ marginRight: 8 }} />
        消息通知
        {unread > 0 && <Badge count={unread} style={{ marginLeft: 8 }} />}
      </Title>
      <Card loading={loading}>
        <List
          dataSource={items}
          renderItem={(item) => (
            <List.Item
              onClick={() => !item.is_read && markRead(item.id)}
              style={{ cursor: !item.is_read ? 'pointer' : 'default', background: item.is_read ? '#fff' : '#f0f5ff', padding: '12px 16px', borderRadius: 8, marginBottom: 8 }}
            >
              <List.Item.Meta
                avatar={<Tag color={TYPE_COLORS[item.notification_type] || 'default'}>{item.notification_type}</Tag>}
                title={
                  <span>
                    {!item.is_read && <Badge status="processing" style={{ marginRight: 4 }} />}
                    {item.title}
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 12 }}>
                      {new Date(item.created_at).toLocaleString('zh-CN')}
                    </Text>
                  </span>
                }
                description={<Text style={{ fontSize: 13 }}>{item.content}</Text>}
              />
            </List.Item>
          )}
          locale={{ emptyText: '暂无消息通知' }}
        />
      </Card>
    </div>
  )
}
