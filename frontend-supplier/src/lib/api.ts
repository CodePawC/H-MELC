import { Envelope } from '../types/envelope'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? ''

function apiUrl(path: string): string {
  if (path.startsWith('http')) return path
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = localStorage.getItem('sp_access_token')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!(init.body instanceof FormData) && init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(apiUrl(path), { ...init, headers })

  if (!response.ok) {
    const text = await response.text()
    let detail = `HTTP ${response.status}`
    try {
      const parsed = JSON.parse(text)
      if (parsed?.detail) detail = typeof parsed.detail === 'string' ? parsed.detail : JSON.stringify(parsed.detail)
      else if (parsed?.message) detail = parsed.message
    } catch { /* ignore */ }
    throw new Error(detail)
  }

  const text = await response.text()
  if (!text.trim()) return null as T
  const body = JSON.parse(text) as Envelope<T>
  if (body.success === false) throw new Error(body.message || '请求失败')
  if ('code' in body && body.code !== 0 && body.code !== 'OK' && body.code !== '0') {
    throw new Error(body.message || '请求失败')
  }
  return body.data ?? (body as unknown as T)
}
