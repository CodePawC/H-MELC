import { useEffect, useState } from 'react'
import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom'
import { ConfigProvider, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { AppLayout } from './AppLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { InvoicesPage } from './pages/InvoicesPage'
import { PaymentsPage } from './pages/PaymentsPage'
import { QualificationsPage } from './pages/QualificationsPage'
import { ProcurementPortalPage } from './pages/ProcurementPortalPage'
import { getToken } from './lib/token'
import { useAuthStore } from './stores/authStore'
import { apiRequest } from './lib/api'
import { clearToken } from './lib/token'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = getToken()
  if (!token) return <Navigate to="/login" replace />
  return <AppLayout>{children}</AppLayout>
}

function AppRoutes() {
  const [ready, setReady] = useState(false)
  const setUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    const token = getToken()
    if (token) {
      apiRequest<{ id: string; username: string; organization_id?: string; legal_name?: string; roles?: string[] }>('/api/v1/auth/me')
        .then((me) => {
          setUser({
            id: me.id,
            username: me.username,
            organization_id: me.organization_id || '',
            legal_name: me.legal_name || me.username,
            roles: me.roles || ['SUPPLIER'],
          })
        })
        .catch(() => clearToken())
        .finally(() => setReady(true))
    } else {
      setReady(true)
    }
  }, [setUser])

  if (!ready) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>加载中...</div>

  return (
    <Routes>
      <Route path="/portal" element={<ProcurementPortalPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
      <Route path="/invoices" element={<ProtectedRoute><InvoicesPage /></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><PaymentsPage /></ProtectedRoute>} />
      <Route path="/qualifications" element={<ProtectedRoute><QualificationsPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <AntdApp>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  )
}
