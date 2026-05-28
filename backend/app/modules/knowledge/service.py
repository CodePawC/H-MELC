"""知识库存储。"""

from __future__ import annotations

import re
import uuid
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.modules.knowledge.models import KbDocument

_TOKEN_RE = re.compile(r"[\w\u4e00-\u9fff]+", re.UNICODE)


def keywords_from_question(question: str, *, max_terms: int = 5) -> list[str]:
    """从提问拆出题名检索用词（占位 RAG：仅用于 `ilike`，非分词向量）。"""
    q = (question or "").strip()
    if not q:
        return []
    raw = _TOKEN_RE.findall(q)
    seen: set[str] = set()
    out: list[str] = []
    for t in raw:
        if len(t) < 2:
            continue
        if len(t) > 120:
            t = t[:120]
        if t not in seen:
            seen.add(t)
            out.append(t)
        if len(out) >= max_terms:
            break
    if not out:
        out.append(q[:120])
    return out


def list_documents(
    db: Session,
    *,
    keyword: str | None,
    page: int,
    page_size: int,
) -> tuple[list[KbDocument], int]:
    flt_kw: str | None = None
    if keyword and keyword.strip():
        flt_kw = f"%{keyword.strip()}%"

    cnt_stmt = select(func.count(KbDocument.id)).select_from(KbDocument)
    if flt_kw is not None:
        cnt_stmt = cnt_stmt.where(KbDocument.title.ilike(flt_kw))
    total = int(db.scalar(cnt_stmt) or 0)

    q = select(KbDocument).order_by(KbDocument.created_at.desc())
    if flt_kw is not None:
        q = q.where(KbDocument.title.ilike(flt_kw))
    rows = db.scalars(q.offset((page - 1) * page_size).limit(page_size)).all()
    return list(rows), total


def create_document_metadata(
    db: Session,
    *,
    title: str,
    source_type: str,
    created_by_user_id: UUID | None,
    object_key: str | None,
    mime_type: str | None,
    file_size: int | None,
) -> KbDocument:
    doc = KbDocument(
        id=uuid.uuid4(),
        title=title,
        source_type=source_type,
        created_by_user_id=created_by_user_id,
        object_key=object_key,
        mime_type=mime_type,
        file_size=file_size,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def get_document(db: Session, document_id: UUID) -> KbDocument | None:
    return db.get(KbDocument, document_id)


def chat_stub_references(
    db: Session, *, question: str, top_k: int = 5
) -> tuple[list[dict[str, Any]], bool]:
    """§七·3 占位：按关键词在文档标题中模糊检索；第二项为 True 表示持久化异常未检索。

    未命中与库未就绪均可能得到空列表，由第二项区分降级原因。
    """
    cap = max(1, min(int(top_k), 20))
    seen: set[UUID] = set()
    rows: list[KbDocument] = []
    try:
        for kw in keywords_from_question(question):
            if len(rows) >= cap:
                break
            batch, _ = list_documents(db, keyword=kw, page=1, page_size=cap)
            for r in batch:
                if r.id not in seen:
                    seen.add(r.id)
                    rows.append(r)
                if len(rows) >= cap:
                    break
    except SQLAlchemyError:
        return [], True
    return [{"id": r.id, "title": r.title, "snippet": None} for r in rows], False


def kb_row_to_api(row: KbDocument) -> dict[str, Any]:
    return {
        "id": row.id,
        "title": row.title,
        "source_type": row.source_type,
        "object_key": row.object_key,
        "mime_type": row.mime_type,
        "file_size": row.file_size,
        "created_by_user_id": row.created_by_user_id,
        "created_at": row.created_at,
    }
