/**
 * HTTP 封装：成功体兼容
 * - **docs/06**：`{ code: 0, message, data }`（`code` 可为数字或数字字符串）
 * - **部分网关/平台**：`{ success: true, code: "OK", message, data }` 等字符串业务码
 * FastAPI HTTPException 常为 `{ detail }`。传输层使用 Axios（`lib/http.ts`）。
 */

import axios from 'axios'

import { ApiClientError } from './errors'
import { http } from './http'

export { ApiClientError } from './errors'

/** 将 Axios 的 `data` 规范为对象：兼容误配的 Content-Type、反代 HTML、纯文本等 */
function normalizeResponseBody(raw: unknown): unknown {
  if (raw == null) return raw
  if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) return null
    const lower = s.slice(0, 64).toLowerCase()
    if (lower.startsWith('<!doctype') || lower.startsWith('<html') || (s.startsWith('<') && s.includes('html'))) {
      throw new ApiClientError(
        '收到 HTML 页面而非接口 JSON：多为 API 根地址错误，或反代把 /api 指到了静态站点。请核对 `VITE_API_BASE_URL`（直连后端时应含端口，如 http://127.0.0.1:8000）；若走 Vite 代理可将 `VITE_API_BASE_URL` 置空并确认 `vite.config.ts` 中 `VITE_API_PROXY_TARGET` 指向后端。',
      )
    }
    try {
      return JSON.parse(s) as unknown
    } catch {
      throw new ApiClientError(
        `响应体不是合法 JSON（前 160 字符）：${s.slice(0, 160)}${s.length > 160 ? '…' : ''}`,
      )
    }
  }
  return raw
}

function envelopeNumericCode(body: object): number | null {
  if (!('code' in body)) return null
  const c = (body as { code: unknown }).code
  if (typeof c === 'number' && Number.isFinite(c)) return c
  if (typeof c === 'string' && c.trim() !== '') {
    const n = Number(c)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function extractEnvelopeMessage(b: object): string {
  const m = (b as { message?: unknown }).message
  return typeof m === 'string' && m.trim() ? m : '请求失败'
}

/** 字符串业务码表示成功（与数字 0 等价） */
function isStringSuccessCode(code: string): boolean {
  const t = code.trim().toLowerCase()
  return t === 'ok' || t === 'success' || t === '0'
}

/**
 * 解析统一业务信封；无法识别时返回 null（交由 FastAPI detail 或兜底错误处理）。
 */
function tryParseUnifiedEnvelope(
  b: object,
): { ok: true; data: unknown } | { ok: false; message: string } | null {
  if ('success' in b) {
    const s = (b as { success: unknown }).success
    if (s === false) {
      return { ok: false, message: extractEnvelopeMessage(b) }
    }
    if (s === true) {
      return { ok: true, data: 'data' in b ? (b as { data: unknown }).data : {} }
    }
  }

  const nc = envelopeNumericCode(b)
  if (nc !== null) {
    if (nc === 0) {
      return { ok: true, data: 'data' in b ? (b as { data: unknown }).data : {} }
    }
    return { ok: false, message: extractEnvelopeMessage(b) }
  }

  if ('code' in b && typeof (b as { code: unknown }).code === 'string') {
    const sc = (b as { code: unknown }).code as string
    if (!('data' in b)) return null
    if (isStringSuccessCode(sc)) {
      return { ok: true, data: (b as { data: unknown }).data }
    }
    return { ok: false, message: extractEnvelopeMessage(b) }
  }

  return null
}

function unwrapEnvelope<T>(body: unknown, status?: number): T {
  const parsed = normalizeResponseBody(body)

  if (parsed && typeof parsed === 'object') {
    const unified = tryParseUnifiedEnvelope(parsed)
    if (unified) {
      if (unified.ok) {
        return unified.data as T
      }
      throw new ApiClientError(unified.message, status)
    }
  }

  if (parsed && typeof parsed === 'object' && 'detail' in parsed) {
    const d = (parsed as { detail: unknown }).detail
    const msg =
      typeof d === 'string'
        ? d
        : Array.isArray(d)
          ? (d as { msg?: string }[]).map((x) => x.msg ?? JSON.stringify(x)).join('; ')
          : JSON.stringify(d)
    throw new ApiClientError(msg, status)
  }

  const statusHint = status != null ? `HTTP ${status}` : '无状态码'
  if (parsed == null) {
    throw new ApiClientError(
      `无法解析后端响应（${statusHint}）：响应体为空。若为登录或首屏请求，请确认后端已启动且路径前缀为 /api/v1。`,
      status,
    )
  }
  let preview: string
  try {
    preview = JSON.stringify(parsed)
  } catch {
    preview = String(parsed)
  }
  if (preview.length > 280) preview = `${preview.slice(0, 278)}…`
  throw new ApiClientError(
    `无法解析后端响应（${statusHint}）：期望 JSON 形如 { code:0, message, data }、{ success:true, data }、{ code:"OK", data } 或 FastAPI { detail }，实际为：${preview}`,
    status,
  )
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${path.startsWith('/') ? '' : '/'}${path}`
  const method = (init.method ?? 'GET').toUpperCase()

  const hdr: Record<string, string> = {}
  if (init.headers instanceof Headers) {
    init.headers.forEach((v, k) => {
      hdr[k] = v
    })
  } else if (init.headers && typeof init.headers === 'object') {
    Object.assign(hdr, init.headers as Record<string, string>)
  }

  const isForm = init.body instanceof FormData

  try {
    const res = await http.request({
      url,
      method,
      data:
        isForm
          ? init.body
          : init.body && typeof init.body === 'string'
            ? JSON.parse(init.body)
            : init.body,
      headers: isForm ? hdr : { 'Content-Type': 'application/json', ...hdr },
    })
    return unwrapEnvelope<T>(res.data, res.status)
  } catch (e) {
    if (axios.isAxiosError(e) && e.response) {
      return unwrapEnvelope<T>(e.response.data, e.response.status)
    }
    if (axios.isAxiosError(e) && !e.response) {
      const raw = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '').trim() ?? ''
      const base = raw || `${typeof window !== 'undefined' ? window.location.origin : ''}（同源，经 Vite 代理 /api → 后端）`
      if (e.code === 'ERR_NETWORK' || e.message === 'Network Error') {
        throw new ApiClientError(
          `后端无响应：无法建立连接（当前 API 根：${base || '未配置'}）。请先在本机启动 FastAPI（示例：cd backend 后执行 uvicorn app.main:app --reload --host 127.0.0.1 --port 8000），并确认 vite.config.ts 中环境变量 VITE_API_PROXY_TARGET（默认 http://127.0.0.1:8000）与后端监听地址一致。若 .env 中填写了直连 VITE_API_BASE_URL=http://127.0.0.1:8000，请与后端端口一致；本地开发也可将 VITE_API_BASE_URL 留空以走 npm run dev 的 /api 代理。`,
        )
      }
      if (e.code === 'ECONNABORTED') {
        throw new ApiClientError('请求超时，请检查网络或后端负载后重试')
      }
      throw new ApiClientError(e.message || '请求失败（无响应体）')
    }
    const msg = e instanceof Error ? e.message : String(e)
    throw new ApiClientError(msg)
  }
}
