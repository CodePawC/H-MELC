import { Navigate, Route, Routes, useParams } from 'react-router-dom'

import type { AdminPageKind, AdminMenuLeaf } from './navigation/menu'
import { ADMIN_MENU_GROUPS, ADMIN_ROUTE_LEAVES, firstMenuLeafPath } from './navigation/menu'
import { RequireAuth } from './auth/RequireAuth'
import { PermissionOutlet } from './layout/PermissionOutlet'
import { ProAdminLayout } from './layout/ProAdminLayout'
import { AssetDetailPage } from './pages/AssetDetailPage'
import { AssetCreatePage } from './pages/AssetCreatePage'
import { AssetCodesPage } from './pages/AssetCodesPage'
import { AssetIntakeExtractorConfigPage } from './pages/AssetIntakeExtractorConfigPage'
import { AssetsOverviewPage } from './pages/AssetsOverviewPage'
import { AssetsPage } from './pages/AssetsPage'
import { AiGatewayPage } from './pages/AiGatewayPage'
import { ApiDirectoryPage } from './pages/ApiDirectoryPage'
import { Forbidden403Page } from './pages/Exception/Forbidden403'
import { FinanceAllocationsPage } from './pages/FinanceAllocationsPage'
import { FinanceAgingPage } from './pages/FinanceAgingPage'
import { FinanceInvoicesPage } from './pages/FinanceInvoicesPage'
import { FinancePayablesPage } from './pages/FinancePayablesPage'
import { FinancePaymentsPage } from './pages/FinancePaymentsPage'
import { FinancePriorityPage } from './pages/FinancePriorityPage'
import { HomePage } from './pages/HomePage'
import { HospitalPresetPage } from './pages/hospital/HospitalPresetPage'
import { IntegrationCenterPage } from './pages/IntegrationCenterPage'
import { KnowledgeDocumentDetailPage } from './pages/KnowledgeDocumentDetailPage'
import { KnowledgeDocumentsPage } from './pages/KnowledgeDocumentsPage'
import { LoginPage } from './pages/LoginPage'
import { MetrologyWorkbenchPage } from './pages/MetrologyWorkbenchPage'
import { MdmDictionaryPage } from './pages/MdmDictionaryPage'
import { MasterDataSourceConfigPage } from './pages/MasterDataSourceConfigPage'
import { MasterDataServicePage } from './pages/MasterDataServicePages'
import { PmAlertsPage } from './pages/pm/PmAlertsPage'
import { PmCalendarPage } from './pages/pm/PmCalendarPage'
import { PmInspectionPage } from './pages/pm/PmInspectionPage'
import { PmPlansPage } from './pages/pm/PmPlansPage'
import { PmTasksPage } from './pages/pm/PmTasksPage'
import { OperationCenterPage } from './pages/operation-center/OperationCenterPage'
import { PublicScreenPage } from './pages/operation-center/PublicScreenPage'
import { PortalHomePage } from './pages/portal/PortalHomePage'
import { PortalInvoicesPage } from './pages/portal/PortalInvoicesPage'
import { PortalPaymentsPage } from './pages/portal/PortalPaymentsPage'
import { PortalQuotationsPage } from './pages/portal/PortalQuotationsPage'
import { ProcurementWorkbenchPage } from './pages/ProcurementWorkbenchPage'
import { RepairDispatchPage } from './pages/RepairDispatchPage'
import { RepairTicketDetailPage } from './pages/RepairTicketDetailPage'
import { RepairTicketsPage } from './pages/RepairTicketsPage'
import { RepairWorkbenchPage } from './pages/RepairWorkbenchPage'
import { AboutSystemPage } from './pages/AboutSystemPage'
import { UnifiedRepairCenterPage } from './pages/UnifiedRepairCenterPage'
import { SupplierProfilesPage } from './pages/SupplierProfilesPage'
import { SupplierProjectsPage } from './pages/SupplierProjectsPage'
import { SupplierQualificationsPage } from './pages/SupplierQualificationsPage'
import { AuditLogManagementPage } from './pages/System/AuditLog/AuditLogManagementPage'
import { PermissionMenuPage } from './pages/System/Permission/PermissionMenuPage'
import { RoleManagementPage } from './pages/System/Role/RoleManagementPage'
import { UserManagementPage } from './pages/System/User/UserManagementPage'
import { WorkflowConsolePage } from './pages/WorkflowConsolePage'
import { SupplementRequestPage } from './pages/SupplementRequestPage'
import { ProcurementManagementPage } from './pages/ProcurementManagementPage'
import { WorkspaceRisksPage } from './pages/workspace/WorkspaceRisksPage'
import { WorkspaceTodosPage } from './pages/workspace/WorkspaceTodosPage'

import './App.css'

function AdminRoutePage({ leaf }: { leaf: AdminMenuLeaf }) {
  if (leaf.hospitalPreset) {
    return <HospitalPresetPage preset={leaf.hospitalPreset} label={leaf.label} />
  }
  switch (leaf.page as AdminPageKind) {
    case 'home':
      return <HomePage />
    case 'assetsOverview':
      return <AssetsOverviewPage />
    case 'assets':
      return <AssetsPage />
    case 'assetCreate':
      return <AssetCreatePage />
    case 'assetCodes':
      return <AssetCodesPage />
    case 'repairCenter':
      return <UnifiedRepairCenterPage mode="workbench" />
    case 'repairNew':
      return <UnifiedRepairCenterPage mode="new" />
    case 'repairAssistant':
      return <UnifiedRepairCenterPage mode="assistant" />
    case 'repairChannels':
      return <UnifiedRepairCenterPage mode="channels" />
    case 'repairPending':
      return <UnifiedRepairCenterPage mode="pending" />
    case 'repairRules':
      return <UnifiedRepairCenterPage mode="rules" />
    case 'repairs':
      return <RepairTicketsPage />
    case 'repairDispatch':
      return <RepairDispatchPage />
    case 'repairProcess':
      return <RepairWorkbenchPage mode="process" />
    case 'repairAccept':
      return <RepairWorkbenchPage mode="accept" />
    case 'repairHistory':
      return <RepairWorkbenchPage mode="history" />
    case 'repairFaultAnalysis':
      return <RepairWorkbenchPage mode="fault" />
    case 'financeInvoices':
      return <FinanceInvoicesPage />
    case 'financePayables':
      return <FinancePayablesPage />
    case 'financePayments':
      return <FinancePaymentsPage />
    case 'financeAllocations':
      return <FinanceAllocationsPage />
    case 'financeAging':
      return <FinanceAgingPage />
    case 'financePriority':
      return <FinancePriorityPage />
    case 'auditLogs':
      return <AuditLogManagementPage />
    case 'supplierProfiles':
      return <SupplierProfilesPage />
    case 'supplierQualifications':
      return <SupplierQualificationsPage />
    case 'supplierProjects':
      return <SupplierProjectsPage />
    case 'procurementWorkbench':
      return <ProcurementWorkbenchPage />
    case 'procurementManagement':
      return <ProcurementManagementPage />
    case 'workflowConsole':
      return <WorkflowConsolePage />
    case 'mdmDictionary':
      return <MdmDictionaryPage />
    case 'assetIntakeExtractorConfig':
      return <AssetIntakeExtractorConfigPage />
    case 'masterDataSourceConfig':
      return <MasterDataSourceConfigPage />
    case 'masterDataObjects':
      return <MasterDataServicePage view="objects" />
    case 'masterDataFieldMapping':
      return <MasterDataServicePage view="mapping" />
    case 'masterDataSyncTasks':
      return <MasterDataServicePage view="sync" />
    case 'masterDataQualityCheck':
      return <MasterDataServicePage view="quality" />
    case 'masterDataConflicts':
      return <MasterDataServicePage view="conflicts" />
    case 'supplementRequests':
      return <SupplementRequestPage />
    case 'knowledgeDocuments':
      return <KnowledgeDocumentsPage />
    case 'aiGateway':
      return <AiGatewayPage />
    case 'apiDirectory':
      return <ApiDirectoryPage />
    case 'integrationCenter':
      return <IntegrationCenterPage />
    case 'standardDataAccess':
      return <IntegrationCenterPage initialTab="standard-data" />
    case 'businessInterfaces':
      return <IntegrationCenterPage initialTab="business-interfaces" />
    case 'iotDevices':
      return <IntegrationCenterPage initialTab="iot-devices" />
    case 'apiAuth':
      return <IntegrationCenterPage initialTab="api-auth" />
    case 'interfaceLogs':
      return <IntegrationCenterPage initialTab="interface-logs" />
    case 'messageQueue':
      return <IntegrationCenterPage initialTab="message-queue" />
    case 'pmPlans':
      return <PmPlansPage />
    case 'pmTasks':
      return <PmTasksPage />
    case 'pmCalendar':
      return <PmCalendarPage />
    case 'pmAlerts':
      return <PmAlertsPage />
    case 'pmInspection':
      return <PmInspectionPage />
    case 'metrologyWorkbench':
      return <MetrologyWorkbenchPage />
    case 'operationCenterOverview':
      return <OperationCenterPage mode="overview" />
    case 'operationCenterScreen': {
      const screenCode = leaf.path.split('/').filter(Boolean).pop()
      return <OperationCenterPage mode="screen" screenCode={screenCode} />
    }
    case 'operationCenterCarousel':
      return <OperationCenterPage mode="carousel" />
    case 'operationCenterPublish':
      return <OperationCenterPage mode="publish" />
    case 'operationCenterAccessKeys':
      return <OperationCenterPage mode="accessKeys" />
    case 'operationCenterTerminals':
      return <OperationCenterPage mode="terminals" />
    case 'operationCenterAccessLogs':
      return <OperationCenterPage mode="logs" />
    case 'workspaceTodos':
      return <WorkspaceTodosPage />
    case 'workspaceRisks':
      return <WorkspaceRisksPage />
    case 'workspaceAi':
      return <AiGatewayPage />
    case 'systemUsers':
      return <UserManagementPage />
    case 'systemRoles':
      return <RoleManagementPage />
    case 'systemMenus':
      return <PermissionMenuPage />
    case 'aboutSystem':
      return <AboutSystemPage />
    case 'portalHome':
      return <PortalHomePage />
    case 'portalInvoices':
      return <PortalInvoicesPage />
    case 'portalPayments':
      return <PortalPaymentsPage />
    case 'portalQuotations':
      return <PortalQuotationsPage />
    default:
      return <HospitalPresetPage preset={leaf.page ?? leaf.path.replace(/\W+/g, '_')} label={leaf.label} />
  }
}

function ArchiveAssetRedirect() {
  const { assetId } = useParams<{ assetId: string }>()
  const suffix = assetId ? `?asset_id=${encodeURIComponent(assetId)}` : ''
  return <Navigate to={`/assets/archive${suffix}`} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/public-screen/:screenCode/:accessKey" element={<PublicScreenPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<ProAdminLayout />}>
          <Route path="/403" element={<Forbidden403Page />} />
          <Route element={<PermissionOutlet />}>
            <Route path="/lifecycle/assets/:assetId" element={<AssetDetailPage />} />
            <Route path="/assets/archive/:assetId" element={<ArchiveAssetRedirect />} />
            <Route path="/maintenance/tickets/:repairOrderId" element={<RepairTicketDetailPage />} />
            <Route path="/repair/tickets/:repairOrderId" element={<RepairTicketDetailPage />} />
            <Route path="/knowledge/documents/:documentId" element={<KnowledgeDocumentDetailPage />} />

            <Route path="/assets" element={<Navigate to="/assets/overview" replace />} />
            <Route path="/assets/create" element={<Navigate to="/assets/new" replace />} />
            <Route path="/lifecycle/assets" element={<Navigate to="/assets/archive" replace />} />
            <Route path="/lifecycle/assets/new" element={<Navigate to="/assets/new" replace />} />
          <Route path="/lifecycle/asset-codes" element={<Navigate to="/assets/qrcodes" replace />} />
          <Route path="/maintenance/tickets" element={<Navigate to="/repair/tickets" replace />} />
          <Route path="/maintenance/dispatch" element={<Navigate to="/repair/dispatch" replace />} />
            <Route path="/repair" element={<Navigate to="/repair/center" replace />} />
            <Route path="/" element={<HomePage />} />
            <Route path="/workspace/todos" element={<Navigate to="/task-center/my" replace />} />
            <Route path="/workspace/risks" element={<Navigate to="/dashboard/risk" replace />} />
            <Route path="/workspace/kpi" element={<Navigate to="/dashboard/kpi" replace />} />
            <Route path="/workspace/events" element={<Navigate to="/dashboard/events" replace />} />
            <Route path="/workspace/messages" element={<Navigate to="/dashboard/messages" replace />} />
            <Route path="/workspace/reports" element={<Navigate to="/dashboard/reports" replace />} />
            <Route path="/workspace/ai" element={<Navigate to="/dashboard/insight" replace />} />
            <Route path="/workspace/ai/risk" element={<Navigate to="/ai/risk" replace />} />
            <Route path="/workspace/ai/repair" element={<Navigate to="/ai/repair" replace />} />
            <Route path="/workspace/ai/qa" element={<Navigate to="/ai/qa" replace />} />
            <Route path="/workspace/ai/analysis" element={<Navigate to="/ai/analysis" replace />} />
            <Route path="/workspace/ai/report" element={<Navigate to="/ai/report" replace />} />
            <Route path="/analytics" element={<Navigate to="/analytics/bi" replace />} />
            <Route path="/ai" element={<Navigate to="/dashboard/insight" replace />} />
            <Route path="/pm/overdue" element={<Navigate to="/pm/alerts" replace />} />
            <Route path="/finance/progress" element={<Navigate to="/supplier-portal/payments" replace />} />
            <Route path="/operation-center/overview" element={<Navigate to="/ioc/overview" replace />} />
            <Route path="/operation-center/equipment-overview" element={<Navigate to="/ioc/equipment-overview" replace />} />
            <Route path="/operation-center/equipment-status" element={<Navigate to="/ioc/equipment-status" replace />} />
            <Route path="/operation-center/repair-dispatch" element={<Navigate to="/ioc/repair-dispatch" replace />} />
            <Route path="/operation-center/pm-loop" element={<Navigate to="/ioc/pm-loop" replace />} />
            <Route path="/operation-center/qc-meter-alert" element={<Navigate to="/ioc/qc-meter" replace />} />
            <Route path="/operation-center/medical-gas" element={<Navigate to="/ioc/gas" replace />} />
            <Route path="/operation-center/spd-consumables" element={<Navigate to="/ioc/spd" replace />} />
            <Route path="/operation-center/finance-overview" element={<Navigate to="/ioc/finance" replace />} />
            <Route path="/operation-center/emergency-war-room" element={<Navigate to="/ioc/emergency" replace />} />
            <Route path="/operation-center/radiation-safety" element={<Navigate to="/ioc/radiation" replace />} />
            <Route path="/operation-center/supplier-payment" element={<Navigate to="/ioc/payment" replace />} />
            <Route path="/operation-center/carousel" element={<Navigate to="/ioc/carousel" replace />} />
            <Route path="/operation-center/publish" element={<Navigate to="/ioc/publish" replace />} />
            <Route path="/operation-center/access-keys" element={<Navigate to="/ioc/access-keys" replace />} />
            <Route path="/operation-center/terminals" element={<Navigate to="/ioc/terminals" replace />} />
            <Route path="/operation-center/access-logs" element={<Navigate to="/ioc/access-logs" replace />} />
            <Route path="/system/master-data-sources" element={<Navigate to="/system/master-data/service-config" replace />} />
            <Route path="/system/humdg-integration" element={<Navigate to="/system/master-data/service-config" replace />} />
            <Route path="/system/hmdm-integration" element={<Navigate to="/system/master-data/service-config" replace />} />
            <Route path="/system/interface-integration" element={<Navigate to="/system/integration/business-interfaces" replace />} />
            <Route path="/system/api-config" element={<Navigate to="/system/integration/business-interfaces" replace />} />
            <Route path="/system/iot" element={<Navigate to="/system/integration/iot-devices" replace />} />
            <Route path="/system/iot-devices" element={<Navigate to="/system/integration/iot-devices" replace />} />
            <Route path="/system/security" element={<Navigate to="/system/users" replace />} />
            <Route path="/system/basic" element={<Navigate to="/system/dictionary" replace />} />
            <Route path="/system/master-data" element={<Navigate to="/system/master-data/service-config" replace />} />
            <Route path="/system/integration" element={<Navigate to="/system/integration/standard-data" replace />} />
            <Route path="/system/rules" element={<Navigate to="/system/rules/task-engine" replace />} />
            <Route path="/system/notifications" element={<Navigate to="/system/notifications/messages" replace />} />
            <Route path="/system/data-ops" element={<Navigate to="/system/data-ops/backup" replace />} />

            <Route path="/portal/home" element={<Navigate to="/supplier-portal/dashboard" replace />} />
            <Route path="/portal/invoices" element={<Navigate to="/supplier-portal/invoices" replace />} />
            <Route path="/portal/payments" element={<Navigate to="/supplier-portal/payments" replace />} />
            <Route path="/portal/quotations" element={<Navigate to="/supplier-portal/quotes" replace />} />
            <Route path="/portal" element={<Navigate to="/supplier-portal/dashboard" replace />} />

            {ADMIN_MENU_GROUPS.map((g) => (
              g.items[0]?.path === `/${g.id}` ? null : (
                <Route
                  key={`redirect-${g.id}`}
                  path={`/${g.id}`}
                  element={<Navigate to={firstMenuLeafPath(g.items) ?? '/'} replace />}
                />
              )
            ))}
            {ADMIN_ROUTE_LEAVES.map((leaf) => (
              <Route key={leaf.path} path={leaf.path} element={<AdminRoutePage leaf={leaf} />} />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
