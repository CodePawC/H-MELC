/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_AUTH_MOCK?: string
  readonly VITE_APP_VERSION?: string
  readonly VITE_APP_BUILD_SERIAL?: string
  readonly VITE_API_PROXY_TARGET?: string
  /** 网关 / BFF 要求的静态 API Key（可选） */
  readonly VITE_API_KEY?: string
  /** 与 VITE_API_KEY 配套的请求头名，默认 X-API-Key */
  readonly VITE_API_KEY_HEADER?: string
}
