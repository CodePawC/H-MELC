"""系统用户与角色 HTTP API。

对齐：docs/06_接口设计/01_API接口设计.md §十三。
PostgreSQL 未迁移 identity 时返回 **503**（与认证模块一致）。
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError

from app.core.audit_emit import emit_audit
from app.core.deps import DbSession
from app.core.responses import envelope_ok
from app.db.session import engine
from app.modules.auth.deps import get_current_claims_required, require_roles
from app.modules.auth.rbac import RBAC_SYSTEM_USER_READ, RBAC_SYSTEM_USER_WRITE
from app.modules.auth.schemas import JwtClaims
from app.modules.system.schemas import (
    AdminPasswordResetBody,
    MePasswordBody,
    SystemRolesPut,
    SystemUserCreate,
    SystemUserPatch,
)
from app.modules.system import service as sys_svc


router = APIRouter(prefix="/system", tags=["system"])

_IDENTITY_PG_NOT_READY = (
    "身份持久化未就绪：请在目标库执行 alembic upgrade head（含 e005_identity_auth）。"
)


def _require_pg_identity() -> None:
    if engine.dialect.name != "postgresql":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="系统用户 API 需在 PostgreSQL 执行 `alembic upgrade head`（含 identity schema）后使用。",
        )


PgIdentityStore = Depends(_require_pg_identity)


@router.get("/roles", dependencies=[PgIdentityStore])
def list_roles_catalog(
    _actor: JwtClaims = Depends(require_roles(*RBAC_SYSTEM_USER_READ)),
) -> dict:
    """§十三·7"""
    items = [x.model_dump() for x in sys_svc.catalog_roles()]
    return envelope_ok(data={"items": items})


@router.get("/users", dependencies=[PgIdentityStore])
def list_users(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_SYSTEM_USER_READ)),
    keyword: str | None = Query(None),
    role: str | None = Query(None, description="按单一角色代码过滤"),
    is_active: bool | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    """§十三·1"""
    try:
        items, total, pg, psz = sys_svc.list_users(
            db,
            keyword=keyword,
            role=role,
            is_active=is_active,
            page=page,
            page_size=page_size,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_IDENTITY_PG_NOT_READY
        ) from exc
    return envelope_ok(
        data={
            "items": [i.model_dump(mode="json") for i in items],
            "total": total,
            "page": pg,
            "page_size": psz,
        }
    )


@router.post("/users", dependencies=[PgIdentityStore])
def create_user(
    db: DbSession,
    body: SystemUserCreate,
    actor: JwtClaims = Depends(require_roles(*RBAC_SYSTEM_USER_WRITE)),
) -> dict:
    """§十三·2"""
    try:
        raw = sys_svc.create_user(db, body)
        if isinstance(raw, tuple):
            code, msg = raw
            if code == "conflict":
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
        row = raw
        db.commit()
        emit_audit(
            db,
            actor,
            action="SYSTEM_USER_CREATE",
            object_type="identity_user",
            object_id=row.id,
            after_data={"username": row.username, "roles": row.role_codes},
        )
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_IDENTITY_PG_NOT_READY
        ) from exc
    return envelope_ok(data=row.model_dump(mode="json"))


@router.get("/users/{user_id}", dependencies=[PgIdentityStore])
def get_user(
    db: DbSession,
    user_id: UUID,
    _actor: JwtClaims = Depends(require_roles(*RBAC_SYSTEM_USER_READ)),
) -> dict:
    """§十三·3"""
    try:
        row = sys_svc.get_user(db, user_id)
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_IDENTITY_PG_NOT_READY
        ) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="用户不存在")
    return envelope_ok(data=row.model_dump(mode="json"))


@router.patch("/users/{user_id}", dependencies=[PgIdentityStore])
def patch_user(
    db: DbSession,
    user_id: UUID,
    body: SystemUserPatch,
    actor: JwtClaims = Depends(require_roles(*RBAC_SYSTEM_USER_WRITE)),
) -> dict:
    """§十三·4"""
    try:
        raw = sys_svc.patch_user(db, user_id, body)
        if isinstance(raw, tuple):
            _code, msg = raw
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        row = raw
        db.commit()
        emit_audit(
            db,
            actor,
            action="SYSTEM_USER_PATCH",
            object_type="identity_user",
            object_id=user_id,
            after_data=body.model_dump(exclude_unset=True),
        )
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_IDENTITY_PG_NOT_READY
        ) from exc
    return envelope_ok(data=row.model_dump(mode="json"))


@router.put("/users/{user_id}/roles", dependencies=[PgIdentityStore])
def put_user_roles(
    db: DbSession,
    user_id: UUID,
    body: SystemRolesPut,
    actor: JwtClaims = Depends(require_roles(*RBAC_SYSTEM_USER_WRITE)),
) -> dict:
    """§十三·5"""
    try:
        raw = sys_svc.replace_user_roles(db, user_id, body.role_codes)
        if isinstance(raw, tuple):
            _code, msg = raw
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        row = raw
        db.commit()
        emit_audit(
            db,
            actor,
            action="SYSTEM_USER_ROLES_PUT",
            object_type="identity_user",
            object_id=user_id,
            after_data={"role_codes": row.role_codes},
        )
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_IDENTITY_PG_NOT_READY
        ) from exc
    return envelope_ok(data=row.model_dump(mode="json"))


@router.post("/users/{user_id}/password-reset", dependencies=[PgIdentityStore])
def admin_password_reset(
    db: DbSession,
    user_id: UUID,
    body: AdminPasswordResetBody,
    actor: JwtClaims = Depends(require_roles(*RBAC_SYSTEM_USER_WRITE)),
) -> dict:
    """§十三·6"""
    try:
        raw = sys_svc.admin_reset_password(db, user_id, body.new_password)
        if isinstance(raw, tuple):
            _code, msg = raw
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        db.commit()
        emit_audit(
            db,
            actor,
            action="SYSTEM_USER_PASSWORD_RESET",
            object_type="identity_user",
            object_id=user_id,
            after_data={},
        )
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_IDENTITY_PG_NOT_READY
        ) from exc
    return envelope_ok(data={"ok": True})


@router.post("/me/password", dependencies=[PgIdentityStore])
def change_me_password(
    db: DbSession,
    body: MePasswordBody,
    claims: JwtClaims = Depends(get_current_claims_required),
) -> dict:
    """§十三·8：任意已登录用户修改本人密码。"""
    try:
        raw = sys_svc.change_own_password(db, claims.sub, body.old_password, body.new_password)
        if isinstance(raw, tuple):
            code, msg = raw
            if code == "not_found":
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)
        db.commit()
        emit_audit(
            db,
            claims,
            action="SYSTEM_ME_PASSWORD_CHANGE",
            object_type="identity_user",
            object_id=claims.sub,
            after_data={},
        )
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_IDENTITY_PG_NOT_READY
        ) from exc
    return envelope_ok(data={"ok": True})
