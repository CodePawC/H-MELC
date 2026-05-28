import { useState } from 'react'
import { Button, Tag } from 'antd'
import type { ProColumns } from '@ant-design/pro-components'
import { ProTable } from '@ant-design/pro-components'

import { MOCK_AUDIT_LOGS, type MockAuditLogRow } from '../../../mock/auditLogs'
import { AuditLogsPage } from '../../AuditLogsPage'

export function AuditLogManagementMockPage() {
  const [useRealApi, setUseRealApi] = useState(false)

  if (useRealApi) {
    return (
      <div>
        <Button type="link" onClick={() => setUseRealApi(false)} style={{ marginBottom: 12 }}>
          返回 Mock 审计日志
        </Button>
        <AuditLogsPage />
      </div>
    )
  }

  const columns: ProColumns<MockAuditLogRow>[] = [
    { title: '操作时间', dataIndex: 'createdAt', width: 170, sorter: (a, b) => a.createdAt.localeCompare(b.createdAt) },
    { title: '操作人', dataIndex: 'username', width: 120 },
    { title: '用户角色', dataIndex: 'roleCode', width: 140, render: (v) => v ?? '—' },
    { title: '操作模块', dataIndex: 'module', width: 120 },
    { title: '操作类型', dataIndex: 'action', width: 140 },
    { title: 'IP 地址', dataIndex: 'ip', width: 130 },
    {
      title: '结果',
      dataIndex: 'result',
      width: 90,
      render: (v) => (v === 'success' ? <Tag color="success">成功</Tag> : <Tag color="error">失败</Tag>),
    },
    { title: '详情', dataIndex: 'detail', ellipsis: true },
  ]

  return (
    <ProTable<MockAuditLogRow>
      rowKey="id"
      headerTitle="审计日志（Mock）"
      columns={columns}
      dataSource={MOCK_AUDIT_LOGS}
      search={false}
      pagination={{ pageSize: 10 }}
      toolBarRender={() => [
        <Button key="api" onClick={() => setUseRealApi(true)}>
          切换真实 API 页
        </Button>,
      ]}
    />
  )
}
