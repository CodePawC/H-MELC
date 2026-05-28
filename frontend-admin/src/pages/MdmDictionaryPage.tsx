import { type FormEvent, useCallback, useEffect, useState } from 'react'

import type { CategoryEntryRow, MdmModuleMeta } from '../api/mdm'
import { createCategoryEntry, fetchCategoryEntries, fetchMdmModuleMeta } from '../api/mdm'
import { ApiClientError } from '../lib/api'

/** 对齐 docs/05 系统管理·主数据字典；列表/新建对齐 MDM Phase 0 接口（RBAC_ASSET_READ / RBAC_ASSET_WRITE） */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function MdmDictionaryPage() {
  const [meta, setMeta] = useState<MdmModuleMeta | null>(null)
  const [items, setItems] = useState<CategoryEntryRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 50

  const [dimension, setDimension] = useState('')
  const [keyword, setKeyword] = useState('')
  const [parentFilter, setParentFilter] = useState('')
  const [rootsOnlyIn, setRootsOnlyIn] = useState(false)
  const [includeInactiveIn, setIncludeInactiveIn] = useState(false)

  const [appliedDim, setAppliedDim] = useState('')
  const [appliedKw, setAppliedKw] = useState('')
  const [appliedParent, setAppliedParent] = useState('')
  const [appliedRoots, setAppliedRoots] = useState(false)
  const [appliedInactive, setAppliedInactive] = useState(false)

  const [listErr, setListErr] = useState<string | null>(null)
  const [listLoading, setListLoading] = useState(true)
  const [flashOk, setFlashOk] = useState<string | null>(null)

  const [createDim, setCreateDim] = useState('CLINICAL_ADMIN')
  const [createCode, setCreateCode] = useState('')
  const [createName, setCreateName] = useState('')
  const [createParent, setCreateParent] = useState('')
  const [createSort, setCreateSort] = useState('0')
  const [createBusy, setCreateBusy] = useState(false)
  const [createErr, setCreateErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setListLoading(true)
    setListErr(null)
    const parent = appliedParent.trim()
    const roots = appliedRoots
    if (roots && parent) {
      setListErr('顶层筛选与 parent_id 不能同时使用（后端将返回 422）。')
      setItems([])
      setTotal(0)
      setListLoading(false)
      return
    }
    if (parent && !UUID_RE.test(parent)) {
      setListErr('parent_id 须为合法 UUID，或留空。')
      setItems([])
      setTotal(0)
      setListLoading(false)
      return
    }
    try {
      const data = await fetchCategoryEntries({
        page,
        page_size: pageSize,
        dimension_code: appliedDim.trim() || undefined,
        keyword: appliedKw.trim() || undefined,
        parent_id: parent || undefined,
        roots_only: roots || undefined,
        include_inactive: appliedInactive || undefined,
      })
      setItems(data.items)
      setTotal(data.total)
    } catch (e) {
      setListErr(e instanceof ApiClientError ? e.message : String(e))
      setItems([])
      setTotal(0)
    } finally {
      setListLoading(false)
    }
  }, [
    page,
    pageSize,
    appliedDim,
    appliedKw,
    appliedParent,
    appliedRoots,
    appliedInactive,
  ])

  useEffect(() => {
    let c = false
    fetchMdmModuleMeta()
      .then((m) => {
        if (!c) setMeta(m)
      })
      .catch(() => {})
    return () => {
      c = true
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function applyFilters(ev: FormEvent) {
    ev.preventDefault()
    const pf = parentFilter.trim()
    const ro = rootsOnlyIn
    if (ro && pf) {
      setListErr('请取消「仅顶层」或清空 parent_id 后再检索。')
      return
    }
    setAppliedDim(dimension.trim())
    setAppliedKw(keyword.trim())
    setAppliedParent(pf)
    setAppliedRoots(ro)
    setAppliedInactive(includeInactiveIn)
    setPage(1)
    setListErr(null)
  }

  async function onCreate(ev: FormEvent) {
    ev.preventDefault()
    setCreateErr(null)
    setFlashOk(null)
    const cp = createParent.trim()
    if (cp && !UUID_RE.test(cp)) {
      setCreateErr('父节点 parent_id 须为合法 UUID 或留空')
      return
    }
    let sort = 0
    try {
      sort = parseInt(createSort, 10)
      if (Number.isNaN(sort)) throw new Error('sort_order 须为整数')
    } catch {
      setCreateErr('sort_order 须为整数')
      return
    }
    setCreateBusy(true)
    try {
      await createCategoryEntry({
        dimension_code: createDim.trim(),
        category_code: createCode.trim(),
        name: createName.trim(),
        parent_id: cp && UUID_RE.test(cp) ? cp : undefined,
        sort_order: sort,
      })
      setFlashOk('已创建分类条目。')
      setCreateCode('')
      setCreateName('')
      setCreateParent('')
      setCreateSort('0')
      await load()
    } catch (e) {
      setCreateErr(e instanceof ApiClientError ? e.message : String(e))
    } finally {
      setCreateBusy(false)
    }
  }

  function ts(s: string) {
    return s.replace('T', ' ').slice(0, 19)
  }

  return (
    <div className="page mdm-page">
      <h2>主数据字典</h2>
      <p className="muted tiny">
        Phase 0：多维分类条目。读接口需资产只读权限，新建需 <code>RBAC_ASSET_WRITE</code>
        ；未迁 PostgreSQL e006 时为 503。
      </p>
      {meta?.paths?.category_entries && (
        <p className="tiny muted">
          列表路径：<code>{meta.paths.category_entries}</code>
        </p>
      )}

      {flashOk && <div className="banner ok wf-flash">{flashOk}</div>}

      <section className="wf-panel">
        <h3>检索</h3>
        <form className="inline-search mdm-filter" onSubmit={applyFilters} style={{ flexWrap: 'wrap' }}>
          <input placeholder="dimension_code" value={dimension} onChange={(e) => setDimension(e.target.value)} />
          <input placeholder="关键字（名称/编码）" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          <input
            placeholder="parent_id UUID（单层子节点）"
            value={parentFilter}
            onChange={(e) => setParentFilter(e.target.value)}
            style={{ minWidth: 280 }}
          />
          <label className="mdm-check muted tiny">
            <input type="checkbox" checked={rootsOnlyIn} onChange={(e) => setRootsOnlyIn(e.target.checked)} />{' '}
            仅顶层
          </label>
          <label className="mdm-check muted tiny">
            <input type="checkbox" checked={includeInactiveIn} onChange={(e) => setIncludeInactiveIn(e.target.checked)} />{' '}
            含停用
          </label>
          <button type="submit" className="btn">
            检索
          </button>
        </form>
      </section>

      {listErr && <div className="banner danger">{listErr}</div>}

      {listLoading ? (
        <p>加载中…</p>
      ) : (
        <>
          <p className="muted tiny">
            共 <strong>{total}</strong> 条 · 第 {page} / {Math.max(1, Math.ceil(total / pageSize))} 页
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>维度</th>
                  <th>编码</th>
                  <th>名称</th>
                  <th>父节点</th>
                  <th>排序</th>
                  <th>启用</th>
                  <th>更新</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="muted">
                      无数据或未迁 mdm schema。
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.dimension_code}</td>
                      <td className="tiny mono">{row.category_code}</td>
                      <td>{row.name}</td>
                      <td className="tiny muted">{row.parent_id ? `${row.parent_id.slice(0, 8)}…` : '—'}</td>
                      <td>{row.sort_order}</td>
                      <td>{row.is_active ? '是' : '否'}</td>
                      <td className="tiny">{ts(String(row.updated_at))}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <button type="button" className="btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              上一页
            </button>
            <button
              type="button"
              className="btn"
              disabled={page * pageSize >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </button>
          </div>
        </>
      )}

      <section className="wf-panel">
        <h3>新建分类条目</h3>
        <p className="muted tiny">
          <code>dimension_code + category_code</code> 唯一；父节点须同维度且已激活。
        </p>
        {createErr && <div className="banner danger">{createErr}</div>}
        <form className="wf-start-form card-like" onSubmit={onCreate}>
          <label>
            dimension_code
            <input value={createDim} onChange={(e) => setCreateDim(e.target.value)} required minLength={1} />
          </label>
          <label>
            category_code
            <input value={createCode} onChange={(e) => setCreateCode(e.target.value)} required minLength={1} />
          </label>
          <label>
            name
            <input value={createName} onChange={(e) => setCreateName(e.target.value)} required minLength={1} />
          </label>
          <label>
            parent_id（可选）
            <input value={createParent} onChange={(e) => setCreateParent(e.target.value)} />
          </label>
          <label>
            sort_order
            <input value={createSort} onChange={(e) => setCreateSort(e.target.value)} />
          </label>
          <button type="submit" className="btn primary" disabled={createBusy}>
            {createBusy ? '提交中…' : '创建'}
          </button>
        </form>
      </section>
    </div>
  )
}
