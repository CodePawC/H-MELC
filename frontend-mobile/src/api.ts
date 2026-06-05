import type {
  AssetLabelTemplateListPayload,
  AssetPrintLabelPayload,
  CurrentUser,
  Envelope,
  LoginResult,
  ScanAssetResult,
} from './types'

const TOKEN_KEY = 'mep_mobile_access_token'
const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? ''

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function apiUrl(path: string): string {
  if (path.startsWith('http')) return path
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

function isSuccessCode(code: unknown): boolean {
  if (code === 0) return true
  if (typeof code === 'string') {
    const v = code.trim().toLowerCase()
    return v === '0' || v === 'ok' || v === 'success'
  }
  return false
}

function detailMessage(detail: unknown): string {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object' && 'msg' in item) return String((item as { msg: unknown }).msg)
        return JSON.stringify(item)
      })
      .join('; ')
  }
  if (detail && typeof detail === 'object') return JSON.stringify(detail)
  return '请求失败'
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text.trim()) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new ApiError(`接口返回不是 JSON：${text.slice(0, 120)}`, response.status)
  }
}

function unwrap<T>(body: unknown, status?: number): T {
  if (body && typeof body === 'object') {
    const envelope = body as Envelope<T>
    if (envelope.success === true) return envelope.data as T
    if (envelope.success === false) throw new ApiError(envelope.message || '请求失败', status)
    if ('code' in envelope) {
      if (isSuccessCode(envelope.code)) return envelope.data as T
      throw new ApiError(envelope.message || '请求失败', status)
    }
    if ('detail' in envelope) throw new ApiError(detailMessage(envelope.detail), status)
  }
  return body as T
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!(init.body instanceof FormData) && init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(apiUrl(path), { ...init, headers })
  } catch (error) {
    throw new ApiError(error instanceof Error ? error.message : '无法连接后端服务')
  }

  const body = await readBody(response)
  if (!response.ok) {
    if (body && typeof body === 'object' && 'detail' in body) {
      throw new ApiError(detailMessage((body as Envelope<T>).detail), response.status)
    }
    throw new ApiError(`HTTP ${response.status}`, response.status)
  }
  return unwrap<T>(body, response.status)
}

export async function login(username: string, password: string): Promise<LoginResult> {
  return apiRequest<LoginResult>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export async function fetchMe(): Promise<CurrentUser> {
  return apiRequest<CurrentUser>('/api/v1/auth/me')
}

export async function postScanAsset(qrToken: string): Promise<ScanAssetResult> {
  return apiRequest<ScanAssetResult>('/api/v1/scan/asset', {
    method: 'POST',
    body: JSON.stringify({ qr_token: qrToken }),
  })
}

export async function fetchAssetLabelTemplates(): Promise<AssetLabelTemplateListPayload> {
  return apiRequest<AssetLabelTemplateListPayload>('/api/v1/assets/label-templates')
}

export async function fetchAssetPrintLabel(assetId: string, templateCode?: string): Promise<AssetPrintLabelPayload> {
  const sp = new URLSearchParams()
  if (templateCode?.trim()) sp.set('template_code', templateCode.trim())
  const q = sp.toString()
  return apiRequest<AssetPrintLabelPayload>(`/api/v1/assets/${encodeURIComponent(assetId)}/print-label${q ? `?${q}` : ''}`)
}

export async function scanAssetByQr(qrToken: string): Promise<ScanAssetResult> {
  return apiRequest<ScanAssetResult>('/api/v1/scan/asset', {
    method: 'POST',
    body: JSON.stringify({ qr_token: qrToken }),
  })
}

export async function createRepairReport(
  assetId: string,
  faultDesc: string,
  faultType: string,
  senderName: string,
  senderPhone?: string,
): Promise<{ message_id: string; message_no: string }> {
  return apiRequest<{ message_id: string; message_no: string }>('/api/v1/repair-center/messages', {
    method: 'POST',
    body: JSON.stringify({
      source_channel: 'MOBILE',
      source_channel_name: '移动报修',
      raw_message_type: 'TEXT',
      raw_message_content: `[${faultType}] ${faultDesc}`,
      asset_id: assetId,
      sender_name: senderName,
      sender_phone: senderPhone || null,
    }),
  })
}
