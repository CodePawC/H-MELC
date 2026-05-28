"""供应商门户鉴权：JWT 须含角色 SUPPLIER 且账号仍存在。"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status


from app.core.deps import DbSession
from app.modules.auth.deps import get_current_claims_required
from app.modules.auth.schemas import JwtClaims
from app.modules.supplier_portal.models import SupplierPortalAccount


def get_supplier_portal_account(
    db: DbSession,
    claims: JwtClaims = Depends(get_current_claims_required),
) -> SupplierPortalAccount:
    if "SUPPLIER" not in claims.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要供应商门户令牌（角色 SUPPLIER）",
        )
    try:
        uid = claims.sub if isinstance(claims.sub, UUID) else UUID(str(claims.sub))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="令牌主体无效",
        ) from exc

    row = db.get(SupplierPortalAccount, uid)
    if row is None or not row.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="供应商账号不可用或已停用")
    return row


SupplierPortalAccountDep = Annotated[SupplierPortalAccount, Depends(get_supplier_portal_account)]
