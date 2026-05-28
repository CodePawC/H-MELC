import { useEffect, useState } from 'react'

import { fetchSupplierModuleInfo } from '../api/suppliers'
import type { SupplierModuleInfo } from '../api/suppliers'
import { ApiClientError } from '../lib/api'

/** docs/05 供应商档案：展示 `/api/v1/suppliers` 院内导航元数据（正式档案表待扩展） */

export function SupplierProfilesPage() {
  const [data, setData] = useState<SupplierModuleInfo | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const res = await fetchSupplierModuleInfo()
        if (!cancel) setData(res)
      } catch (e) {
        if (!cancel) setErr(e instanceof ApiClientError ? e.message : String(e))
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  return (
    <div className="page">
      <h2>供应商档案</h2>
      <p className="muted tiny">以下为协同模块路由导航；明细主体数据在门户与资质子系统中维护。</p>
      {err && <div className="banner danger">{err}</div>}
      {loading ? (
        <p>加载中…</p>
      ) : data ? (
        <div className="table-wrap" style={{ padding: '1rem' }}>
          <dl className="meta-dl">
            <dt>模块</dt>
            <dd>
              {data.name}（{data.module}）
            </dd>
            <dt>门户 API</dt>
            <dd>
              <code>{data.portal_api_base}</code>
            </dd>
            <dt>竞价管理</dt>
            <dd>
              <code>{data.procurement_admin_api_base}</code>
            </dd>
            <dt>资质审核</dt>
            <dd>
              <code>{data.qualifications_admin_api_base}</code>
            </dd>
            <dt>院内财务</dt>
            <dd>
              <code>{data.finance_admin_api_base}</code>
            </dd>
            <dt>门户财务镜像</dt>
            <dd>
              <ul className="bullet tiny">
                {Object.entries(data.portal_finance).map(([k, v]) => (
                  <li key={k}>
                    <strong>{k}</strong>：<code>{v}</code>
                  </li>
                ))}
              </ul>
            </dd>
            <dt>说明</dt>
            <dd className="muted tiny">{data.note}</dd>
          </dl>
        </div>
      ) : null}
    </div>
  )
}
