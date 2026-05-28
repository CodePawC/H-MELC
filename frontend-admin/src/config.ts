/**
 * API 根：留空则请求为同源相对路径 `/api/v1/...`，由 `vite.config.ts` 的 `server.proxy['/api']` 转发到后端（本地开发推荐）。
 * 生产构建或需直连后端时，设置 `VITE_API_BASE_URL=https://api.example.com`（无尾部斜杠）。
 */
function normalizeApiBaseUrl(raw: string | undefined): string {
  if (raw == null) return ''
  return raw.replace(/\/+$/, '').trim()
}

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL as string | undefined)

/** 经网关访问时，部分环境要求固定 API Key（与 JWT 并存，常见请求头为 X-API-Key） */
export const API_GATEWAY_KEY = ((import.meta.env.VITE_API_KEY as string | undefined) ?? '').trim()

/** 自定义头名，默认 X-API-Key；若网关要求其它名称（如 X-Gateway-Token）在此配置 */
export const API_GATEWAY_KEY_HEADER =
  ((import.meta.env.VITE_API_KEY_HEADER as string | undefined) ?? 'X-API-Key').trim() || 'X-API-Key'
