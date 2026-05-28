"""设备台账 API。

对齐：docs/06_接口设计/01_API接口设计.md §一（列表/详情/增改/二维码）。
依赖 PostgreSQL：`asset` schema（见 docs/03_数据库设计/04 §二、Alembic e002）。
已连 PG 但未迁库时捕获 SQL 异常返回 **503**。
访问：`Authorization: Bearer <JWT>`，详见 docs/01_需求文档/03 §二 与 RBAC 常量模块。
"""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError

from app.core.audit_emit import emit_audit
from app.core.deps import DbSession
from app.core.responses import envelope_ok
from app.db.session import engine
from app.modules.asset.schemas import (
    AssetCreate,
    AssetIntakeApproveRequest,
    AssetIntakeCreateAssetRequest,
    AssetIntakeFileCreate,
    AssetIntakeReviewRequest,
    AssetIntakeTaskCreate,
    AssetLabelTemplateListResponse,
    AssetPrintLabelResponse,
    AssetUpdate,
    ClassificationBindRequest,
    ClassificationImpactAdjustRequest,
    ClassificationImpactHandleRequest,
    ClassificationImpactSyncRequest,
)
from app.modules.asset import service
from app.modules.auth.deps import require_roles
from app.modules.auth.rbac import RBAC_ASSET_READ, RBAC_ASSET_WRITE
from app.modules.auth.schemas import JwtClaims


router = APIRouter(prefix="/assets", tags=["asset"])
equipment_router = APIRouter(prefix="/equipment/assets", tags=["equipment-assets"])


def _ensure_pg_assets() -> None:
    """SQLite 仅承担健康检查；必须先于 JWT 校验，避免本地烟测误判为 401。"""
    if engine.dialect.name != "postgresql":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="设备台账需在 PostgreSQL 执行 `alembic upgrade head` 创建 asset schema 后使用。"
            + " 参阅 docs/03_数据库设计/04、backend/alembic/versions/e002_asset_core_tables.py。",
        )


PgAssetStore = Depends(_ensure_pg_assets)

_ASSET_PG_NOT_READY = (
    "设备台账持久化未就绪：请在目标库执行 alembic upgrade head（含 e002_asset_core_tables / asset schema）。"
)


@router.get("", dependencies=[PgAssetStore])
def list_assets(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
    keyword: str | None = Query(None),
    department_id: UUID | None = Query(None),
    category_code: str | None = Query(None),
    main_status: str | None = Query(None),
    risk_level: str | None = Query(None),
    classification_match_status: str | None = Query(None),
    classification_change_status: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    """§一·1 查询列表（占位阶段含过滤与分页）。"""
    try:
        items, total, pg, psz = service.list_assets(
            db,
            keyword=keyword,
            department_id=department_id,
            category_code=category_code,
            main_status=main_status,
            risk_level=risk_level,
            classification_match_status=classification_match_status,
            classification_change_status=classification_change_status,
            page=page,
            page_size=page_size,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_ASSET_PG_NOT_READY) from exc
    payload = {
        "items": [i.model_dump(mode="json") for i in items],
        "total": total,
        "page": pg,
        "page_size": psz,
    }
    return envelope_ok(data=payload)


@router.get("/label-templates", dependencies=[PgAssetStore])
def list_asset_label_templates(
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    """§一·7a 设备标签模板预设：纸张类型、纸张尺寸与版式。"""
    payload = service.list_label_templates()
    return envelope_ok(data=AssetLabelTemplateListResponse.model_validate(payload).model_dump(mode="json"))


@router.post("/intake/tasks", dependencies=[PgAssetStore])
def create_asset_intake_task(
    db: DbSession,
    body: AssetIntakeTaskCreate,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    """智能建档任务：资料采集、AI/OCR、H-UMDG 匹配、人工审核和正式建档的业务壳。"""
    try:
        row = service.create_intake_task(db, body, actor)
        emit_audit(
            db,
            actor,
            action="ASSET_INTAKE_TASK_CREATE",
            object_type="asset_intake_task",
            object_id=row.id,
            after_data={"title": row.title, "mode": row.mode, "intake_source": row.intake_source},
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_ASSET_PG_NOT_READY) from exc
    return envelope_ok(data=row.model_dump(mode="json"))


@router.get("/intake/tasks/{task_id}", dependencies=[PgAssetStore])
def get_asset_intake_task(
    db: DbSession,
    task_id: UUID,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    try:
        row = service.get_intake_task(db, task_id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_ASSET_PG_NOT_READY) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="智能建档任务不存在")
    return envelope_ok(data=row.model_dump(mode="json"))


@router.post("/intake/tasks/{task_id}/files", dependencies=[PgAssetStore])
def add_asset_intake_file(
    db: DbSession,
    task_id: UUID,
    body: AssetIntakeFileCreate,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    """资料归档元数据：真实对象存储接口接入前，先形成可追溯的原始资料归档记录。"""
    try:
        row = service.add_intake_file(db, task_id, body)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="智能建档任务不存在")
        emit_audit(
            db,
            actor,
            action="ASSET_INTAKE_FILE_ARCHIVE",
            object_type="asset_intake_file",
            object_id=row.id,
            after_data={"task_id": str(task_id), "file_name": row.file_name, "file_type": row.file_type},
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_ASSET_PG_NOT_READY) from exc
    return envelope_ok(data=row.model_dump(mode="json"))


@router.post("/intake/tasks/{task_id}/extract", dependencies=[PgAssetStore])
def extract_asset_intake_task(
    db: DbSession,
    task_id: UUID,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    """触发 AI/OCR 信息抽取。当前接入 mock provider，并在结果中显式标记 mock。"""
    try:
        row = service.extract_intake_task(db, task_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="智能建档任务不存在")
        emit_audit(
            db,
            actor,
            action="ASSET_INTAKE_EXTRACT",
            object_type="asset_intake_task",
            object_id=task_id,
            after_data={"ai_extraction_status": row.ai_extraction_status, "mock": True},
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_ASSET_PG_NOT_READY) from exc
    return envelope_ok(data=row.model_dump(mode="json"))


@router.post("/intake/tasks/{task_id}/match-mdm", dependencies=[PgAssetStore])
async def match_asset_intake_mdm(
    db: DbSession,
    task_id: UUID,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    """根据 OCR 结果通过 OS 后端调用 H-UMDG 匹配医疗器械分类目录。"""
    try:
        row = await service.match_intake_mdm(db, task_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="智能建档任务不存在")
        emit_audit(
            db,
            actor,
            action="ASSET_INTAKE_MDM_MATCH",
            object_type="asset_intake_task",
            object_id=task_id,
            after_data={
                "connected": row.mdm_match_result.get("connected"),
                "degraded": row.mdm_match_result.get("degraded"),
                "source": row.mdm_match_result.get("source"),
            },
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_ASSET_PG_NOT_READY) from exc
    return envelope_ok(data=row.model_dump(mode="json"))


@router.post("/intake/tasks/{task_id}/review", dependencies=[PgAssetStore])
def review_asset_intake_task(
    db: DbSession,
    task_id: UUID,
    body: AssetIntakeReviewRequest,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    try:
        row = service.review_intake_task(db, task_id, body, actor)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="智能建档任务不存在")
        emit_audit(
            db,
            actor,
            action="ASSET_INTAKE_REVIEW_SAVE",
            object_type="asset_intake_task",
            object_id=task_id,
            after_data={"review_status": row.ai_review_status},
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_ASSET_PG_NOT_READY) from exc
    return envelope_ok(data=row.model_dump(mode="json"))


@router.post("/intake/tasks/{task_id}/approve", dependencies=[PgAssetStore])
def approve_asset_intake_task(
    db: DbSession,
    task_id: UUID,
    body: AssetIntakeApproveRequest | None = None,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    try:
        row = service.approve_intake_task(db, task_id, body or AssetIntakeApproveRequest(), actor)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="智能建档任务不存在")
        emit_audit(
            db,
            actor,
            action="ASSET_INTAKE_APPROVE",
            object_type="asset_intake_task",
            object_id=task_id,
            after_data={"review_status": row.ai_review_status, "reviewed_by": row.ai_reviewed_by},
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_ASSET_PG_NOT_READY) from exc
    return envelope_ok(data=row.model_dump(mode="json"))


@router.post("/intake/tasks/{task_id}/create-asset", dependencies=[PgAssetStore])
def create_asset_from_intake(
    db: DbSession,
    task_id: UUID,
    body: AssetIntakeCreateAssetRequest | None = None,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    try:
        asset, task = service.create_asset_from_intake(db, task_id, body or AssetIntakeCreateAssetRequest())
        if task is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="智能建档任务不存在")
        if asset is None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="资产编码可能已存在或其它唯一约束冲突")
        emit_audit(
            db,
            actor,
            action="ASSET_INTAKE_CREATE_ASSET",
            object_type="asset",
            object_id=asset.id,
            after_data={"task_id": str(task_id), "asset_code": asset.asset_code, "mdm_source": asset.mdm_source},
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_ASSET_PG_NOT_READY) from exc
    return envelope_ok(
        data={
            "asset": asset.model_dump(mode="json"),
            "task": task.model_dump(mode="json"),
        }
    )


@router.get("/{asset_id}", dependencies=[PgAssetStore])
def get_asset_detail(
    db: DbSession,
    asset_id: UUID,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    """§一·2 设备详情壳；维修/计量等数组待各域实现后填入。"""
    try:
        bundle = service.detail_bundle(db, asset_id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_ASSET_PG_NOT_READY) from exc
    if bundle is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="设备不存在或已删除")
    return envelope_ok(data=bundle)


@router.post("", dependencies=[PgAssetStore])
def create_asset(
    db: DbSession,
    body: AssetCreate,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    """§一·3 入库建账。"""
    try:
        row = service.create_asset(db, body)
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="资产编码可能已存在或其它唯一约束冲突"
            )
        emit_audit(
            db,
            actor,
            action="ASSET_CREATE",
            object_type="asset",
            object_id=row.id,
            after_data={"asset_code": row.asset_code, "asset_name": row.asset_name},
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_ASSET_PG_NOT_READY) from exc
    return envelope_ok(data=row.model_dump(mode="json"), message="success")


@router.put("/{asset_id}", dependencies=[PgAssetStore])
def update_asset(
    db: DbSession,
    asset_id: UUID,
    body: AssetUpdate,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    """§一·4"""
    try:
        row = service.update_asset(db, asset_id, body)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="设备不存在或已删除")
        emit_audit(
            db,
            actor,
            action="ASSET_UPDATE",
            object_type="asset",
            object_id=asset_id,
            after_data=row.model_dump(mode="json"),
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_ASSET_PG_NOT_READY) from exc
    return envelope_ok(data=row.model_dump(mode="json"))


def _classification_bind_impl(
    db: DbSession,
    asset_id: UUID,
    body: ClassificationBindRequest,
    actor: JwtClaims,
) -> dict:
    try:
        row, handled_impact = service.bind_classification(db, asset_id, body, actor)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="设备不存在或已删除")
        emit_audit(
            db,
            actor,
            action="ASSET_CLASSIFICATION_BIND",
            object_type="asset",
            object_id=asset_id,
            after_data={
                "classification_id": row.classification_id,
                "classification_code": row.classification_code,
                "classification_version_id": row.classification_version_id,
                "classification_match_method": row.classification_match_method,
            },
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_ASSET_PG_NOT_READY) from exc
    return envelope_ok(
        data={
            "asset": row.model_dump(mode="json"),
            "handled_impact": handled_impact.model_dump(mode="json") if handled_impact else None,
        }
    )


@router.post("/{asset_id}/classification-bind", dependencies=[PgAssetStore])
def bind_asset_classification(
    db: DbSession,
    asset_id: UUID,
    body: ClassificationBindRequest,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    """设备档案绑定 H-UMDG 医疗器械分类目录引用。"""
    return _classification_bind_impl(db, asset_id, body, actor)


@router.get("/{asset_id}/qrcode", dependencies=[PgAssetStore])
def get_asset_qrcode(
    db: DbSession,
    asset_id: UUID,
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    """§一·5"""
    try:
        qr = service.qrcode_public_view(db, asset_id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_ASSET_PG_NOT_READY) from exc
    if qr is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="设备不存在或已删除")
    return envelope_ok(data=qr)


@router.get("/{asset_id}/print-label", dependencies=[PgAssetStore])
def get_asset_print_label(
    db: DbSession,
    asset_id: UUID,
    template_code: str | None = Query(None, max_length=64),
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    """§一·7 设备标签打印载荷：按模板生成 PC/移动端可消费的精臣打印数据。"""
    if service.get_label_template(template_code) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="标签模板不存在")
    try:
        payload = service.print_label_payload(db, asset_id, template_code=template_code)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_ASSET_PG_NOT_READY) from exc
    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="设备不存在或已删除")
    return envelope_ok(data=AssetPrintLabelResponse.model_validate(payload).model_dump(mode="json", by_alias=True))


@equipment_router.get("/classification-impacts", dependencies=[PgAssetStore])
def list_equipment_classification_impacts(
    db: DbSession,
    equipment_id: UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    try:
        items, total, pg, psz = service.list_classification_impacts(
            db,
            equipment_id=equipment_id,
            status=status_filter,
            page=page,
            page_size=page_size,
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_ASSET_PG_NOT_READY) from exc
    return envelope_ok(data={"items": [x.model_dump(mode="json") for x in items], "total": total, "page": pg, "page_size": psz})


@equipment_router.post("/classification-impacts/sync", dependencies=[PgAssetStore])
def sync_equipment_classification_impacts(
    db: DbSession,
    body: ClassificationImpactSyncRequest | None = None,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    try:
        items, created_count = service.sync_classification_impacts(db, since=body.since if body else None)
        emit_audit(
            db,
            actor,
            action="ASSET_CLASSIFICATION_IMPACT_SYNC",
            object_type="asset",
            after_data={"created_count": created_count},
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_ASSET_PG_NOT_READY) from exc
    return envelope_ok(data={"created_count": created_count, "items": [x.model_dump(mode="json") for x in items]})


def _impact_action_response(asset, impact) -> dict:
    return envelope_ok(
        data={
            "asset": asset.model_dump(mode="json"),
            "impact": impact.model_dump(mode="json"),
        }
    )


@equipment_router.post("/classification-impacts/{impact_id}/confirm", dependencies=[PgAssetStore])
def confirm_equipment_classification_impact(
    db: DbSession,
    impact_id: UUID,
    body: ClassificationImpactHandleRequest | None = None,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    """人工确认当前分类仍适用，并关闭对应 H-UMDG 分类变更影响。"""
    try:
        asset, impact = service.confirm_classification_impact(db, impact_id, actor)
        if asset is None or impact is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分类影响记录不存在")
        emit_audit(
            db,
            actor,
            action="ASSET_CLASSIFICATION_IMPACT_CONFIRM",
            object_type="equipment_classification_impact",
            object_id=impact_id,
            after_data={
                "equipment_id": str(asset.id),
                "source_change_id": impact.source_change_id,
                "handle_reason": body.handle_reason if body else None,
                "status": impact.status,
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_ASSET_PG_NOT_READY) from exc
    return _impact_action_response(asset, impact)


@equipment_router.post("/classification-impacts/{impact_id}/ignore", dependencies=[PgAssetStore])
def ignore_equipment_classification_impact(
    db: DbSession,
    impact_id: UUID,
    body: ClassificationImpactHandleRequest | None = None,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    """忽略一次低/中风险分类变更影响；高风险与需重映射变更必须确认或调整。"""
    try:
        asset, impact = service.ignore_classification_impact(db, impact_id, actor)
        if asset is None or impact is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分类影响记录不存在")
        emit_audit(
            db,
            actor,
            action="ASSET_CLASSIFICATION_IMPACT_IGNORE",
            object_type="equipment_classification_impact",
            object_id=impact_id,
            after_data={
                "equipment_id": str(asset.id),
                "source_change_id": impact.source_change_id,
                "handle_reason": body.handle_reason if body else None,
                "status": impact.status,
            },
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_ASSET_PG_NOT_READY) from exc
    return _impact_action_response(asset, impact)


@equipment_router.post("/classification-impacts/{impact_id}/adjust", dependencies=[PgAssetStore])
def adjust_equipment_classification_impact(
    db: DbSession,
    impact_id: UUID,
    body: ClassificationImpactAdjustRequest,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    """人工调整到新 H-UMDG 分类，关闭对应影响并写入绑定日志。"""
    try:
        asset, impact = service.adjust_classification_impact(db, impact_id, body, actor)
        if asset is None or impact is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="分类影响记录不存在")
        emit_audit(
            db,
            actor,
            action="ASSET_CLASSIFICATION_IMPACT_ADJUST",
            object_type="equipment_classification_impact",
            object_id=impact_id,
            before_data={
                "old_classification_id": impact.old_classification_id,
                "old_classification_code": impact.old_classification_code,
            },
            after_data={
                "equipment_id": str(asset.id),
                "classification_id": asset.classification_id,
                "classification_code": asset.classification_code,
                "classification_version_id": asset.classification_version_id,
                "source_change_id": impact.source_change_id,
                "handle_reason": body.handle_reason,
                "status": impact.status,
            },
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_ASSET_PG_NOT_READY) from exc
    return _impact_action_response(asset, impact)


@equipment_router.post("/{equipment_id}/classification-bind", dependencies=[PgAssetStore])
def bind_equipment_classification(
    db: DbSession,
    equipment_id: UUID,
    body: ClassificationBindRequest,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_WRITE)),
) -> dict:
    """兼容业务命名路径：/equipment/assets/{equipmentId}/classification-bind。"""
    return _classification_bind_impl(db, equipment_id, body, actor)


@equipment_router.post("/{equipment_id}/classification-detail-viewed", dependencies=[PgAssetStore])
def record_equipment_classification_detail_view(
    db: DbSession,
    equipment_id: UUID,
    actor: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ)),
) -> dict:
    """记录用户查看 H-UMDG 标准目录详情的审计动作。"""
    try:
        row = service.get_asset_strict(db, equipment_id)
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="设备不存在或已删除")
        emit_audit(
            db,
            actor,
            action="ASSET_CLASSIFICATION_DETAIL_VIEW",
            object_type="asset",
            object_id=equipment_id,
            after_data={
                "classification_id": row.classification_id,
                "classification_code": row.classification_code,
                "classification_version_id": row.classification_version_id,
            },
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_ASSET_PG_NOT_READY) from exc
    return envelope_ok(
        data={
            "classification_id": row.classification_id,
            "classification_code": row.classification_code,
            "classification_name": row.classification_name,
            "classification_version_id": row.classification_version_id,
            "management_class": row.management_class,
        }
    )
