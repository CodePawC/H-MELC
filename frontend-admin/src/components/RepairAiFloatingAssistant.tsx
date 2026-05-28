import { useState } from 'react'
import { Button, Drawer, Input, Space, Tag, Typography, message } from 'antd'
import { AudioOutlined, MessageOutlined, PictureOutlined, RobotOutlined, SendOutlined, ToolOutlined } from '@ant-design/icons'

import {
  appendRepairAiSessionMessage,
  confirmRepairCenterMessage,
  createRepairAiSession,
  fetchRepairProgress,
} from '../api/repairCenter'
import type { RepairAiSession } from '../api/repairCenter'
import { ApiClientError } from '../lib/api'

const { Paragraph, Text } = Typography

type ChatItem = {
  role: 'user' | 'ai'
  content: string
  messageId?: string
}

function apiError(e: unknown) {
  return e instanceof ApiClientError ? e.message : e instanceof Error ? e.message : String(e)
}

export function RepairAiFloatingAssistant() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<RepairAiSession | null>(null)
  const [items, setItems] = useState<ChatItem[]>([
    { role: 'ai', content: '我是AI报修助手。可以直接描述故障、上传图片线索，或问“我的报修处理到哪了”。' },
  ])

  const ensureSession = async () => {
    if (session) return session
    const created = await createRepairAiSession({ source_channel: 'AI_CHAT', current_intent: 'REPAIR_REPORT' })
    setSession(created)
    return created
  }

  const send = async () => {
    const text = input.trim()
    if (!text) return
    setInput('')
    setLoading(true)
    setItems((prev) => [...prev, { role: 'user', content: text }])
    try {
      if (/进度|处理到哪|到哪了|工单/.test(text)) {
        const code = text.match(/[A-Z]{1,3}\d{8,}/)?.[0]
        const data = await fetchRepairProgress({ order_code: code, limit: 3 })
        setItems((prev) => [
          ...prev,
          {
            role: 'ai',
            content: data.items.length
              ? data.items.map((x) => `工单号：${x.order_code}\n状态：${x.status_text || x.status}\n当前进度：${x.current_progress || '-'}`).join('\n\n')
              : '暂未查询到相关报修工单。',
          },
        ])
        return
      }
      const current = await ensureSession()
      const res = await appendRepairAiSessionMessage(current.id, { raw_message_type: 'TEXT', content: text })
      setSession(res.session)
      setItems((prev) => [...prev, { role: 'ai', content: res.assistant_reply, messageId: res.message.id }])
    } catch (e) {
      setItems((prev) => [...prev, { role: 'ai', content: `处理失败：${apiError(e)}` }])
    } finally {
      setLoading(false)
    }
  }

  const confirm = async (messageId: string) => {
    try {
      const res = await confirmRepairCenterMessage(messageId, { confirm_action: 'CREATE_ORDER' })
      message.success(res.converted_order ? `已生成工单 ${res.converted_order.order_code}` : '已提交确认')
      setItems((prev) => [...prev, { role: 'ai', content: res.converted_order ? `已生成工单：${res.converted_order.order_code}` : '已提交确认。' }])
    } catch (e) {
      message.error(apiError(e))
    }
  }

  return (
    <>
      <Button className="repair-ai-float" type="primary" shape="round" icon={<RobotOutlined />} onClick={() => setOpen(true)}>
        AI报修助手
      </Button>
      <Drawer title="AI报修助手" width={420} open={open} onClose={() => setOpen(false)} destroyOnHidden={false}>
        <div className="repair-ai-drawer">
          <div className="repair-ai-drawer__messages">
            {items.map((item, idx) => (
              <div key={`${item.role}-${idx}`} className={`repair-ai-drawer__bubble repair-ai-drawer__bubble--${item.role}`}>
                <Paragraph style={{ marginBottom: item.messageId ? 8 : 0, whiteSpace: 'pre-wrap' }}>{item.content}</Paragraph>
                {item.messageId ? (
                  <Space wrap>
                    <Button size="small" type="primary" onClick={() => confirm(item.messageId!)}>
                      确认报修
                    </Button>
                    <Button size="small">补充照片</Button>
                    <Button size="small">转人工</Button>
                  </Space>
                ) : null}
              </div>
            ))}
          </div>
          <Space wrap>
            <Tag icon={<MessageOutlined />}>文字</Tag>
            <Tag icon={<AudioOutlined />}>语音</Tag>
            <Tag icon={<PictureOutlined />}>图片</Tag>
            <Tag icon={<ToolOutlined />}>自助排查</Tag>
          </Space>
          <Input.Search
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onSearch={send}
            loading={loading}
            enterButton={<SendOutlined />}
            placeholder="描述故障或查询报修进度"
          />
          <Text type="secondary">AI会先形成识别结果，确认后才会生成标准报修工单。</Text>
        </div>
      </Drawer>
    </>
  )
}
