import { useEffect, useState } from 'react'

import { fetchAiGatewayMeta } from '../api/aiGateway'
import { fetchMdmModuleMeta } from '../api/mdm'
import { fetchKnowledgeRootMeta } from '../api/knowledge'
import { fetchSupplierModuleInfo } from '../api/suppliers'
import { fetchPmModuleMeta } from '../api/pm'
import { fetchWorkflowModuleMeta } from '../api/workflows'
import { apiRequest } from '../lib/api'

/** 系统管理·接口配置：聚合各模块 GET 根路径发现（对齐 docs/06 与各 router 占位契约） */

type Row = {
  title: string
  path: string
  ok: boolean
  detail: string | null
}

export function ApiDirectoryPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const jobs: Promise<Row>[] = [
      fetchWorkflowModuleMeta()
        .then((d) => ({
          title: '工作流',
          path: '/api/v1/workflows',
          ok: true,
          detail: JSON.stringify(d.paths ?? d, null, 0),
        }))
        .catch((e: unknown) => ({
          title: '工作流',
          path: '/api/v1/workflows',
          ok: false,
          detail: e instanceof Error ? e.message : String(e),
        })),
      fetchMdmModuleMeta()
        .then((d) => ({
          title: '主数据 MDM',
          path: '/api/v1/mdm',
          ok: true,
          detail: JSON.stringify(d.paths ?? d, null, 0),
        }))
        .catch((e: unknown) => ({
          title: '主数据 MDM',
          path: '/api/v1/mdm',
          ok: false,
          detail: e instanceof Error ? e.message : String(e),
        })),
      fetchSupplierModuleInfo()
        .then((d) => ({
          title: '供应商导航',
          path: '/api/v1/suppliers',
          ok: true,
          detail: Object.keys(d).join(', '),
        }))
        .catch((e: unknown) => ({
          title: '供应商导航',
          path: '/api/v1/suppliers',
          ok: false,
          detail: e instanceof Error ? e.message : String(e),
        })),
      fetchAiGatewayMeta()
        .then((d) => ({
          title: 'AI 网关',
          path: '/api/v1/ai',
          ok: true,
          detail: JSON.stringify(d.paths ?? d, null, 0),
        }))
        .catch((e: unknown) => ({
          title: 'AI 网关',
          path: '/api/v1/ai',
          ok: false,
          detail: e instanceof Error ? e.message : String(e),
        })),
      fetchKnowledgeRootMeta()
        .then((d) => ({
          title: '知识中心',
          path: '/api/v1/knowledge',
          ok: true,
          detail: `${d.module} · ${d.name}`,
        }))
        .catch((e: unknown) => ({
          title: '知识中心',
          path: '/api/v1/knowledge',
          ok: false,
          detail: e instanceof Error ? e.message : String(e),
        })),
      apiRequest<Record<string, unknown>>('/api/v1/finance')
        .then((d) => ({
          title: '财务模块',
          path: '/api/v1/finance',
          ok: true,
          detail: JSON.stringify(d.paths ?? d, null, 0),
        }))
        .catch((e: unknown) => ({
          title: '财务模块',
          path: '/api/v1/finance',
          ok: false,
          detail: e instanceof Error ? e.message : String(e),
        })),
      fetchPmModuleMeta()
        .then((d) => ({
          title: 'PM 预防维护',
          path: '/api/v1/pm',
          ok: true,
          detail: JSON.stringify(d.paths ?? d, null, 0),
        }))
        .catch((e: unknown) => ({
          title: 'PM 预防维护',
          path: '/api/v1/pm',
          ok: false,
          detail: e instanceof Error ? e.message : String(e),
        })),
    ]
    Promise.all(jobs).then((r) => {
      if (!cancelled) setRows(r)
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="page api-directory-page">
      <h2>接口配置</h2>
      <p className="muted tiny">
        并联请求各模块根路径（需已登录 JWT）。用于研发联调时发现子路由；不构成线上网关配置编辑。
      </p>
      {loading ? (
        <p>加载中…</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>模块</th>
                <th>根路径</th>
                <th>状态</th>
                <th>摘要</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.title}>
                  <td>{row.title}</td>
                  <td className="tiny mono">{row.path}</td>
                  <td>{row.ok ? '就绪' : '失败'}</td>
                  <td className="tiny muted" title={row.detail ?? ''}>
                    {row.detail ? (row.detail.length > 120 ? `${row.detail.slice(0, 118)}…` : row.detail) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
