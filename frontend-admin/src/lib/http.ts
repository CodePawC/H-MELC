/**
 * Axios 实例：Bearer、baseURL。
 */

import axios, { AxiosHeaders } from 'axios'

import { API_BASE_URL, API_GATEWAY_KEY, API_GATEWAY_KEY_HEADER } from '../config'
import { clearAuthProfile } from './authProfileStorage'
import { clearAccessToken, getAccessToken } from './token'

export const http = axios.create({
  baseURL: API_BASE_URL.replace(/\/$/, ''),
  timeout: 60_000,
})

http.interceptors.request.use((config) => {
  if (API_GATEWAY_KEY) {
    config.headers = AxiosHeaders.from(config.headers ?? {}).set(
      API_GATEWAY_KEY_HEADER,
      API_GATEWAY_KEY,
    )
  }
  const token = getAccessToken()
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (res) => res,
  (err: { response?: { status?: number; data?: unknown } }) => {
    const data = err.response?.data
    const detail = data && typeof data === 'object' && 'detail' in data ? (data as { detail?: unknown }).detail : null
    const code =
      detail && typeof detail === 'object' && 'code' in detail
        ? String((detail as { code?: unknown }).code ?? '')
        : data && typeof data === 'object' && 'code' in data
          ? String((data as { code?: unknown }).code ?? '')
          : ''
    const isOsAuthError = ['AUTH_TOKEN_MISSING', 'AUTH_TOKEN_INVALID', 'AUTH_TOKEN_EXPIRED'].includes(code)
    if (err.response?.status === 401 && isOsAuthError) {
      clearAccessToken()
      clearAuthProfile()
      const path = window.location.pathname
      if (!path.startsWith('/login')) {
        window.location.assign('/login?reason=session_expired')
      }
    }
    return Promise.reject(err)
  },
)
