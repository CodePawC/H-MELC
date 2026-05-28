/** docs/06 §二·2 列表筛选与地址栏同步（报修工单 / 工程师派单共用） */

import type { RepairListQueryParams } from '../api/repairs'

export function emptyFilters(): Omit<RepairListQueryParams, 'page' | 'page_size'> {
  return {
    order_status: '',
    asset_id: '',
    department_id: '',
    assigned_engineer_id: '',
    priority: '',
    date_from: '',
    date_to: '',
  }
}

export const FILTER_URL_KEYS = [
  'order_status',
  'asset_id',
  'department_id',
  'assigned_engineer_id',
  'priority',
  'date_from',
  'date_to',
] as const satisfies readonly (keyof Omit<RepairListQueryParams, 'page' | 'page_size'> & string)[]

export function repairsFiltersFromSearchParams(
  sp: URLSearchParams,
): Omit<RepairListQueryParams, 'page' | 'page_size'> {
  const row = emptyFilters()
  for (const key of FILTER_URL_KEYS) {
    const v = sp.get(key)?.trim() ?? ''
    row[key] = v
  }
  return row
}

export function searchParamsFromFilters(
  filters: Omit<RepairListQueryParams, 'page' | 'page_size'>,
): Record<string, string> {
  const next: Record<string, string> = {}
  for (const key of FILTER_URL_KEYS) {
    const raw = filters[key]?.trim()
    if (raw) next[key] = raw
  }
  return next
}

/** 派单台：URL 无 order_status 时默认待派单；`order_status=*` 表示不限状态（列表请求不传该参数） */
export const DISPATCH_STATUS_ALL = '*'

export function dispatchFiltersFromSearchParams(
  sp: URLSearchParams,
): Omit<RepairListQueryParams, 'page' | 'page_size'> {
  const row = repairsFiltersFromSearchParams(sp)
  if (!sp.has('order_status')) {
    row.order_status = 'PENDING_DISPATCH'
    return row
  }
  const v = row.order_status?.trim() ?? ''
  if (!v || v === DISPATCH_STATUS_ALL) {
    row.order_status = DISPATCH_STATUS_ALL
  }
  return row
}

export function searchParamsFromDispatchFilters(
  filters: Omit<RepairListQueryParams, 'page' | 'page_size'>,
): Record<string, string> {
  const st = filters.order_status?.trim() ?? ''
  const withoutStatus: Omit<RepairListQueryParams, 'page' | 'page_size'> = {
    ...emptyFilters(),
    ...filters,
    order_status: '',
  }
  const base = searchParamsFromFilters(withoutStatus)
  if (st === DISPATCH_STATUS_ALL || st === '') {
    return { ...base, order_status: DISPATCH_STATUS_ALL }
  }
  return { ...base, order_status: st }
}
