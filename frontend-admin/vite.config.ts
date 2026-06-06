import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const SPA_ROUTE_PREFIXES = [
  '/dashboard',
  '/task-center',
  '/assets',
  '/lifecycle',
  '/maintenance',
  '/repair',
  '/pm',
  '/meter',
  '/purchase',
  '/consumables',
  '/supplier',
  '/supplier-portal',
  '/portal',
  '/finance',
  '/qcsafety',
  '/analytics',
  '/ioc',
  '/ai',
  '/knowledge',
  '/system',
]

function hospitalSpaRouteFallback(): Plugin {
  return {
    name: 'hospital-spa-route-fallback',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const method = req.method?.toUpperCase()
        const url = req.url?.split('?')[0] ?? ''
        const hasFileExtension = /\.[a-zA-Z0-9]+$/.test(url)
        const isAppRoute = SPA_ROUTE_PREFIXES.some((prefix) => url === prefix || url.startsWith(`${prefix}/`))
        if (method === 'GET' && !hasFileExtension && isAppRoute) {
          req.url = '/'
        }
        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // VITE_ 供 target；API_PROXY_ 仅 Node 侧注入代理请求头，不会随 import.meta.env 进浏览器包
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'API_PROXY_'])
  const proxyTarget =
    env.VITE_API_PROXY_TARGET?.trim() ||
    process.env.VITE_API_PROXY_TARGET?.trim() ||
    'http://127.0.0.1:8104'
  const proxyGatewayKey = (env.API_PROXY_GATEWAY_KEY ?? '').trim()
  const proxyGatewayHeader = (env.API_PROXY_GATEWAY_HEADER ?? 'X-API-Key').trim() || 'X-API-Key'

  return {
    plugins: [hospitalSpaRouteFallback(), react()],
    // 将 .env 中 VITE_API_BASE_URL 设为空字符串时，请求走同源 /api，由代理转发到后端，可避免浏览器 CORS 配置遗漏。
    server: {
      // 与联调工作区端口约定一致。
      host: '127.0.0.1',
      port: 5102,
      strictPort: true,
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          configure(proxy) {
            if (!proxyGatewayKey) return
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader(proxyGatewayHeader, proxyGatewayKey)
            })
          },
        },
        '/screen-api': {
          target: proxyTarget,
          changeOrigin: true,
          configure(proxy) {
            if (!proxyGatewayKey) return
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader(proxyGatewayHeader, proxyGatewayKey)
            })
          },
        },
      },
    },
  }
})
