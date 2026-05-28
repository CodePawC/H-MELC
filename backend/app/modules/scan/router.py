"""扫码解析 API · docs/06_接口设计/01_API接口设计.md §一·6；台账表未就绪时 **503**。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError

from app.core.audit_emit import emit_audit
from app.core.deps import DbSession
from app.core.responses import envelope_ok
from app.db.session import engine
from app.modules.asset.schemas import ScanAssetRequest, ScanAssetResponse
from app.modules.asset import service
from app.modules.auth.deps import require_roles
from app.modules.auth.rbac import RBAC_ASSET_READ
from app.modules.auth.schemas import JwtClaims


router = APIRouter(prefix="/scan", tags=["scan"])


def _ensure_pg_scan() -> None:
    if engine.dialect.name != "postgresql":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="扫码台账依赖 PostgreSQL asset schema（见台账路由说明）。",
        )


PgScanStore = Depends(_ensure_pg_scan)

_SCAN_PG_NOT_READY = (
    "扫码解析依赖的台账表未就绪：请在目标库执行 alembic upgrade head（含台账相关迁移）。"
)


@router.post("/asset", dependencies=[PgScanStore])
def scan_resolve_asset(
    db: DbSession,
    body: ScanAssetRequest,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    try:
        asset = service.resolve_scan(db, body.qr_token)
        if asset is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="无效或已过期的 qr_token")
        emit_audit(
            db,
            actor,
            action="ASSET_QR_SCAN",
            object_type="asset",
            object_id=asset.id,
            after_data={"asset_code": asset.asset_code},
        )
        out = ScanAssetResponse(
            asset_id=asset.id,
            asset_code=asset.asset_code,
            asset_name=asset.asset_name,
            main_status=asset.main_status,
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SCAN_PG_NOT_READY) from exc
    return envelope_ok(data=out.model_dump(mode="json"))
