"""知识库 HTTP API。

对齐：docs/06_接口设计/01_API接口设计.md §七 · `POST/GET /knowledge/documents`、`GET /knowledge/documents/{document_id}`、`POST /knowledge/chat`（`stub`；`references` 为题名关键词模糊命中；缺表时文档类接口 **503**）。
"""

from __future__ import annotations

import uuid
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.exc import SQLAlchemyError

from app.core.audit_emit import emit_audit
from app.core.deps import DbSession
from app.core.responses import envelope_ok
from app.db.session import engine
from app.integrations.minio_client import put_object_bytes
from app.modules.auth.deps import require_roles
from app.modules.auth.rbac import RBAC_KNOWLEDGE_READ, RBAC_KNOWLEDGE_WRITE
from app.modules.auth.schemas import JwtClaims
from app.modules.knowledge.schemas import KnowledgeChatRequest
from app.modules.knowledge import service as kb_svc

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

_MAX_UPLOAD_BYTES = 25 * 1024 * 1024


def _ensure_pg_knowledge() -> None:
    if engine.dialect.name != "postgresql":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="知识库需在 PostgreSQL 执行 `alembic upgrade head`（含 e007_ai_knowledge）后使用。",
        )


PgKbStore = Depends(_ensure_pg_knowledge)

_KB_PG_NOT_READY = (
    "知识库持久化未就绪：请在目标库执行 alembic upgrade head（含 e007_ai_knowledge）。"
)


@router.get("", summary="模块信息（兼容早期占位契约）")
def knowledge_root() -> dict[str, object]:
    return envelope_ok(data={"module": "knowledge", "name": "知识库"})


@router.get("/documents", dependencies=[PgKbStore])
def list_kb_documents(
    db: DbSession,
    _actor: JwtClaims = Depends(require_roles(*RBAC_KNOWLEDGE_READ)),
    keyword: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict:
    """§七·2 分页列表"""
    try:
        rows, total = kb_svc.list_documents(db, keyword=keyword, page=page, page_size=page_size)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_KB_PG_NOT_READY) from exc
    return envelope_ok(
        data={
            "items": [kb_svc.kb_row_to_api(r) for r in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    )


@router.get("/documents/{document_id}", dependencies=[PgKbStore])
def kb_document_detail(
    db: DbSession,
    document_id: UUID,
    _actor: JwtClaims = Depends(require_roles(*RBAC_KNOWLEDGE_READ)),
) -> dict:
    """§七·4：单条元数据（与 §七·2 列表项字段一致）。"""
    try:
        row = kb_svc.get_document(db, document_id)
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_KB_PG_NOT_READY) from exc
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="知识文档不存在")
    return envelope_ok(data=kb_svc.kb_row_to_api(row))


@router.post("/documents", dependencies=[PgKbStore])
async def create_kb_document(
    db: DbSession,
    actor: JwtClaims = Depends(require_roles(*RBAC_KNOWLEDGE_WRITE)),
    title: str = Form(..., min_length=1, max_length=512),
    source_type: str = Form(default="UPLOAD", max_length=64),
    file: UploadFile | None = File(None),
) -> dict:
    """§七·1 上传知识文档（元数据 + 可选二进制入 MinIO）"""
    oid: str | None = None
    mime: str | None = None
    fsize: int | None = None
    raw: bytes | None = None

    if file is not None and (file.filename or "").strip():
        raw = await file.read()
        if len(raw) > _MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="单文件不得超过 25MB")
        oid = f"knowledge/{uuid.uuid4().hex}/{file.filename}"
        mime = file.content_type or "application/octet-stream"
        fsize = len(raw)
        try:
            put_object_bytes(object_key=oid, data=raw, content_type=mime)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"MinIO 写入失败：{exc!s}",
            ) from exc

    try:
        row = kb_svc.create_document_metadata(
            db,
            title=title,
            source_type=source_type,
            created_by_user_id=actor.sub,
            object_key=oid,
            mime_type=mime,
            file_size=fsize,
        )
        emit_audit(
            db,
            actor,
            action="KNOWLEDGE_DOC_CREATE",
            object_type="kb_document",
            object_id=row.id,
            after_data={
                "title": row.title,
                "has_object_key": bool(row.object_key),
            },
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=_KB_PG_NOT_READY) from exc
    return envelope_ok(data=kb_svc.kb_row_to_api(row))


@router.post("/chat", dependencies=[PgKbStore])
def knowledge_chat(
    db: DbSession,
    body: KnowledgeChatRequest,
    _actor: JwtClaims = Depends(require_roles(*RBAC_KNOWLEDGE_READ)),
) -> dict:
    """§七·3：`references` 为题名关键词占位检索；真 RAG 仍由 ai-service 承接。"""
    refs, kb_degraded = kb_svc.chat_stub_references(db, question=body.question, top_k=5)
    note = "RAG/chat 完整链路参阅 docs/04_AI设计/"
    if kb_degraded:
        note += " 参考列表因知识库持久化不可用已跳过。"
    return envelope_ok(
        data={
            "stub": True,
            "interaction_id": str(uuid.uuid4()),
            "question": body.question,
            "scope": body.scope,
            "answer": (
                "当前为占位应答：向量检索与子图 RAG 未接入。"
                "下列参考由题名关键词模糊检索得到，仅供参考；"
                "正式环境由 ai-service 与向量索引承接。"
            ),
            "references": refs,
            "reference_search_degraded": kb_degraded,
            "note": note,
        },
    )
