from fastapi import APIRouter

from app.core.responses import envelope_ok

router = APIRouter(prefix="/suppliers", tags=["supplier"])


@router.get("", summary="供应商协同入口（导航）")
def supplier_root() -> dict[str, object]:
    """早期 `/suppliers` 根路径；正式对外能力在 `supplier-portal` 与竞价 `supplier-projects`。"""
    return envelope_ok(
        data={
            "module": "supplier",
            "name": "供应商协同",
            "portal_api_base": "/api/v1/supplier-portal",
            "procurement_admin_api_base": "/api/v1/supplier-projects",
            "qualifications_admin_api_base": "/api/v1/suppliers/qualifications",
            "finance_admin_api_base": "/api/v1/finance",
            "portal_finance": {
                "invoices": "/api/v1/supplier-portal/invoices",
                "payables": "/api/v1/supplier-portal/payables",
                "payments": "/api/v1/supplier-portal/payments",
            },
            "note": (
                "供应商登录与资质、发票、应付、付款见 portal_finance 与 portal_api_base；"
                "院内发布/审核竞价见 procurement_admin_api_base；"
                "院内审核供应商资质见 qualifications_admin_api_base；"
                "院内财务登记见 finance_admin_api_base。"
            ),
        }
    )