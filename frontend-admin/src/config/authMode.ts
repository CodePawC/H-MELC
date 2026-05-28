/** 是否使用前端 Mock 登录（完整 RBAC 演示）；关闭则走真实 /api/v1/auth/* */
/** 仅当 `.env` 显式 `VITE_AUTH_MOCK=true` 时启用离线 Mock；省略或非 true 均走后端 */
export const IS_AUTH_MOCK = import.meta.env.VITE_AUTH_MOCK === 'true'

export const APP_VERSION = import.meta.env.VITE_APP_VERSION ?? '0.0.0'
export const APP_BUILD_SERIAL = import.meta.env.VITE_APP_BUILD_SERIAL ?? '20260527.017'
export const APP_VERSION_LABEL = `v${APP_VERSION} · ${APP_BUILD_SERIAL}`
