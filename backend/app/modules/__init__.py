"""注册 v1 API 路由器。

挂载策略：单层前缀 /api/v1，与各子路由的 prefix（如 /assets）拼接。

参见：docs/06_接口设计/01_API接口设计.md（统一前缀 /api/v1）。
"""
from fastapi import APIRouter, FastAPI

from app.modules.auth.router import router as auth_router
from app.modules.audit.router import router as audit_router
from app.modules.mdm.router import router as mdm_router
from app.modules.ai.router import router as ai_router
from app.modules.asset.router import equipment_router
from app.modules.asset.router import router as asset_router
from app.modules.finance.router import router as finance_router
from app.modules.hmdm.router import master_data_router
from app.modules.hmdm.router import router as hmdm_router
from app.modules.integration_center.router import router as integration_center_router
from app.modules.knowledge.router import router as knowledge_router
from app.modules.repair.router import router as repair_router
from app.modules.repair_center.router import router as repair_center_router
from app.modules.supplier_projects.router import router as supplier_projects_router
from app.modules.scan.router import router as scan_router
from app.modules.supplier_qualifications.router import router as supplier_qualifications_router
from app.modules.supplier.router import router as supplier_router
from app.modules.workflow.router import router as workflow_router
from app.modules.supplier_portal.router import router as supplier_portal_router
from app.modules.system.router import router as system_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.pm.router import router as pm_router
from app.modules.metrology.router import router as metrology_router
from app.modules.operation_center.router import management_router as operation_center_router
from app.modules.operation_center.router import screen_router
from app.modules.operation_center.router import screen_ws_router
from app.modules.procurement.router import router as procurement_router
from app.modules.procurement.router import portal_router as procurement_portal_router
from app.modules.procurement.router import supplier_router as procurement_supplier_router


def register_routers(app: FastAPI) -> None:
    v1 = APIRouter(prefix="/api/v1")
    v1.include_router(auth_router)
    v1.include_router(audit_router)
    v1.include_router(dashboard_router)
    v1.include_router(asset_router)
    v1.include_router(equipment_router)
    v1.include_router(scan_router)
    v1.include_router(mdm_router)
    v1.include_router(repair_center_router)
    v1.include_router(repair_router)
    v1.include_router(supplier_projects_router)
    v1.include_router(supplier_router)
    v1.include_router(supplier_qualifications_router)
    v1.include_router(supplier_portal_router)
    v1.include_router(finance_router)
    v1.include_router(hmdm_router)
    v1.include_router(master_data_router)
    v1.include_router(integration_center_router)
    v1.include_router(workflow_router)
    v1.include_router(ai_router)
    v1.include_router(knowledge_router)
    v1.include_router(system_router)
    v1.include_router(pm_router)
    v1.include_router(metrology_router)
    v1.include_router(operation_center_router)
    v1.include_router(procurement_router)
    v1.include_router(procurement_portal_router)
    v1.include_router(procurement_supplier_router)
    app.include_router(v1)
    app.include_router(screen_router)
    app.include_router(screen_ws_router)
