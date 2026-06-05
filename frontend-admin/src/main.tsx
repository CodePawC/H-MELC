import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App as AntdApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'

import { appMeta } from './config/appMeta'
import { enterpriseTheme } from './theme/enterpriseTheme'
import { setAccessToken } from './lib/token'
import './styles/hospitalProLayout.css'
import './index.css'
import App from './App.tsx'

document.title = `${appMeta.chineseName} · ${appMeta.shortName}`

// 接收 H-UMDG 统一身份推送的 JWT（postMessage SSO）
// 安全：必须校验 event.origin，防止任意站点注入伪造 token
const ALLOWED_AUTH_ORIGINS = ['http://127.0.0.1:5101', 'http://localhost:5101']

window.addEventListener('message', (event) => {
  if (event.data?.type === 'h-umdg-auth' && event.data?.token) {
    if (!ALLOWED_AUTH_ORIGINS.includes(event.origin)) {
      console.warn(`[security] rejected postMessage from origin: ${event.origin}`)
      return
    }
    setAccessToken(event.data.token, true)
    // 仅在登录页才跳转，避免刷新已登录页面的死循环
    if (window.location.pathname === '/login' || window.location.pathname === '/') {
      window.location.href = '/'
    }
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider locale={zhCN} theme={enterpriseTheme}>
      <AntdApp>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
)
