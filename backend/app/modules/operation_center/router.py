"""数字运营中心 API。"""

from __future__ import annotations

import asyncio
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from app.core.audit_emit import emit_audit
from app.core.deps import DbSession
from app.core.responses import envelope_ok
from app.db.session import SessionLocal
from app.db.session import engine
from app.modules.auth.deps import require_roles
from app.modules.auth.rbac import RBAC_OPERATION_CENTER_READ, RBAC_OPERATION_CENTER_WRITE
from app.modules.auth.schemas import JwtClaims
from app.modules.operation_center import service as oc_svc
from app.modules.operation_center.schemas import AccessKeyCreate, AccessKeyPatch, TerminalCreate, TerminalPatch

management_router = APIRouter(prefix="/operation-center", tags=["operation-center"])
screen_router = APIRouter(prefix="/screen-api", tags=["screen-api"])
screen_ws_router = APIRouter(prefix="/screen-ws", tags=["screen-ws"])

_PG_DETAIL = "数字运营中心需在 PostgreSQL 执行 `alembic upgrade head`（含 e019_operation_center_tables）后使用。"
_SQL_FAIL = "数字运营中心查询失败：请确认 operation_center schema 已创建并完成迁移。"


def _ensure_pg_operation_center() -> None:
    if engine.dialect.name != "postgresql":
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_PG_DETAIL)


PgOperationCenter = Depends(_ensure_pg_operation_center)


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    return request.client.host if request.client else None


def _websocket_client_ip(websocket: WebSocket) -> str | None:
    forwarded = websocket.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",", 1)[0].strip()
    return websocket.client.host if websocket.client else None


@management_router.get("")
def operation_center_root(_actor: JwtClaims = Depends(require_roles(*RBAC_OPERATION_CENTER_READ))) -> dict:
    return envelope_ok(
        {
            "module": "operation-center",
            "name": "数字运营中心",
            "screens": oc_svc.SCREEN_DEFS,
            "screen_api_prefix": "/screen-api",
        }
    )


@management_router.get("/screens")
def list_screens(_actor: JwtClaims = Depends(require_roles(*RBAC_OPERATION_CENTER_READ))) -> dict:
    return envelope_ok({"items": oc_svc.SCREEN_DEFS, "total": len(oc_svc.SCREEN_DEFS)})


@management_router.get("/access-keys", dependencies=[PgOperationCenter])
def list_access_keys(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_OPERATION_CENTER_READ)),
    screen_code: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    try:
        rows, total = oc_svc.list_keys(db, screen_code=screen_code, page=page, page_size=page_size)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok({"items": [oc_svc.key_to_api(x) for x in rows], "total": total, "page": page, "page_size": page_size})


@management_router.post("/access-keys", dependencies=[PgOperationCenter])
def create_access_key(
    db: DbSession,
    body: AccessKeyCreate,
    actor: JwtClaims = Depends(require_roles(*RBAC_OPERATION_CENTER_WRITE)),
) -> dict:
    try:
        row = oc_svc.create_key(db, body, user_id=actor.sub, username=actor.username)
        emit_audit(db, actor, action="SCREEN_ACCESS_KEY_CREATE", object_type="screen_access_key", object_id=row.id, after_data=body.model_dump(mode="json"))
    except IntegrityError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="访问密钥值已存在") from exc
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(oc_svc.key_to_api(row))


@management_router.patch("/access-keys/{key_id}", dependencies=[PgOperationCenter])
def patch_access_key(
    db: DbSession,
    key_id: UUID,
    body: AccessKeyPatch,
    actor: JwtClaims = Depends(require_roles(*RBAC_OPERATION_CENTER_WRITE)),
) -> dict:
    try:
        row = oc_svc.patch_key(db, key_id, body)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="访问密钥不存在")
        emit_audit(db, actor, action="SCREEN_ACCESS_KEY_PATCH", object_type="screen_access_key", object_id=row.id, after_data=body.model_dump(mode="json", exclude_unset=True))
    except HTTPException:
        raise
    except IntegrityError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="访问密钥值已存在") from exc
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(oc_svc.key_to_api(row))


@management_router.get("/terminals", dependencies=[PgOperationCenter])
def list_terminals(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_OPERATION_CENTER_READ)),
    screen_code: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    try:
        rows, total = oc_svc.list_terminals(db, screen_code=screen_code, page=page, page_size=page_size)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok({"items": [oc_svc.terminal_to_api(x) for x in rows], "total": total, "page": page, "page_size": page_size})


@management_router.post("/terminals", dependencies=[PgOperationCenter])
def create_terminal(
    db: DbSession,
    body: TerminalCreate,
    actor: JwtClaims = Depends(require_roles(*RBAC_OPERATION_CENTER_WRITE)),
) -> dict:
    try:
        row = oc_svc.create_terminal(db, body)
        emit_audit(db, actor, action="SCREEN_TERMINAL_CREATE", object_type="screen_terminal", object_id=row.id, after_data=body.model_dump(mode="json"))
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(oc_svc.terminal_to_api(row))


@management_router.patch("/terminals/{terminal_id}", dependencies=[PgOperationCenter])
def patch_terminal(
    db: DbSession,
    terminal_id: UUID,
    body: TerminalPatch,
    actor: JwtClaims = Depends(require_roles(*RBAC_OPERATION_CENTER_WRITE)),
) -> dict:
    try:
        row = oc_svc.patch_terminal(db, terminal_id, body)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="大屏终端不存在")
        emit_audit(db, actor, action="SCREEN_TERMINAL_PATCH", object_type="screen_terminal", object_id=row.id, after_data=body.model_dump(mode="json", exclude_unset=True))
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(oc_svc.terminal_to_api(row))


@management_router.get("/access-logs", dependencies=[PgOperationCenter])
def list_access_logs(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_OPERATION_CENTER_READ)),
    screen_code: str | None = Query(None),
    success: bool | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    try:
        rows, total = oc_svc.list_logs(db, screen_code=screen_code, success=success, page=page, page_size=page_size)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok({"items": [oc_svc.log_to_api(x) for x in rows], "total": total, "page": page, "page_size": page_size})


@screen_router.get("/{screen_code}", dependencies=[PgOperationCenter])
def get_public_screen(
    db: DbSession,
    request: Request,
    screen_code: str,
    accessKey: str = Query(..., min_length=1),
    user_agent: str | None = Header(default=None, alias="User-Agent"),
) -> dict:
    if screen_code not in oc_svc.SCREEN_NAME:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="大屏页面不存在")
    ip = _client_ip(request)
    try:
        validation = oc_svc.validate_access_key(db, screen_code=screen_code, access_key=accessKey, ip=ip)
        oc_svc.record_access(db, validation=validation, screen_code=screen_code, access_key=accessKey, ip=ip, user_agent=user_agent)
        if not validation.ok or validation.row is None:
            raise HTTPException(status_code=validation.status_code, detail=validation.reason or "访问密钥校验失败")
        if screen_code == "carousel":
            data = oc_svc.build_carousel_payload(db, key=validation.row)
        else:
            data = oc_svc.build_screen_payload(db, screen_code=screen_code, key=validation.row)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_SQL_FAIL) from exc
    return envelope_ok(data)


@screen_ws_router.websocket("/{screen_code}")
async def public_screen_ws(websocket: WebSocket, screen_code: str, accessKey: str = Query(..., min_length=1)) -> None:
    """公开大屏实时通道：同 `/screen-api/{screen_code}` 鉴权，同源 payload 周期推送。"""
    if engine.dialect.name != "postgresql":
        await websocket.close(code=1013, reason="operation center requires PostgreSQL")
        return
    if screen_code not in oc_svc.SCREEN_NAME:
        await websocket.close(code=1008, reason="screen not found")
        return

    ip = _websocket_client_ip(websocket)
    user_agent = websocket.headers.get("user-agent")
    db = SessionLocal()
    try:
        validation = oc_svc.validate_access_key(db, screen_code=screen_code, access_key=accessKey, ip=ip)
        oc_svc.record_access(db, validation=validation, screen_code=screen_code, access_key=accessKey, ip=ip, user_agent=user_agent)
        if not validation.ok or validation.row is None:
            await websocket.close(code=1008, reason=validation.reason or "access key denied")
            return
        refresh_seconds = max(10, min(int(validation.row.refresh_interval_seconds or 60), 3600))
    except SQLAlchemyError:
        await websocket.close(code=1013, reason="operation center query failed")
        return
    finally:
        db.close()

    await websocket.accept()
    try:
        while True:
            db = SessionLocal()
            try:
                row = oc_svc.validate_access_key(db, screen_code=screen_code, access_key=accessKey, ip=ip).row
                if row is None:
                    await websocket.close(code=1008, reason="access key denied")
                    return
                if screen_code == "carousel":
                    data = oc_svc.build_carousel_payload(db, key=row)
                else:
                    data = oc_svc.build_screen_payload(db, screen_code=screen_code, key=row)
                await websocket.send_json(envelope_ok(data))
                refresh_seconds = max(10, min(int(row.refresh_interval_seconds or refresh_seconds), 3600))
            finally:
                db.close()
            await asyncio.sleep(refresh_seconds)
    except WebSocketDisconnect:
        return
