"""Add Phase 2 endpoints to procurement router."""
import json

with open('app/modules/procurement/router.py', 'r', encoding='utf-8') as f:
    content = f.read()

new_apis = '''
@router.post("/{project_id}/bidding/round", dependencies=[PgDep])
def start_new_bidding_round(db: DbSession, project_id: str, body: dict[str, Any], _: JwtClaims = Depends(require_roles(*RBAC_PROCUREMENT_REVIEW))) -> dict:
    project = db.execute(text("SELECT * FROM supplier.procurement_project WHERE id = :id"), {"id": project_id}).first()
    if not project: raise HTTPException(status_code=404, detail="项目不存在")
    max_rn = db.execute(text("SELECT COALESCE(MAX(round_number), 0) FROM supplier.procurement_bid WHERE project_id = :pid"), {"pid": project_id}).scalar() or 0
    new_rn = max_rn + 1
    db.execute(text("UPDATE supplier.procurement_project SET status = 'BIDDING', bid_deadline = :dl WHERE id = :id"), {"dl": body.get("deadline"), "id": project_id})
    orgs = db.execute(text("SELECT DISTINCT organization_id FROM supplier.procurement_enrollment WHERE project_id = :pid AND status = 'APPROVED'"), {"pid": project_id}).all()
    for org in orgs:
        db.execute(text("INSERT INTO supplier.notification_message (organization_id, title, content, notification_type) VALUES (:oid, :t, :c, 'BIDDING')"), {"oid": str(org[0]), "t": f"第{new_rn}轮竞价邀请", "c": f"项目{project.title}第{new_rn}轮竞价已开始"})
    db.commit()
    return envelope_ok(data={"round_number": new_rn, "status": "BIDDING", "deadline": body.get("deadline")})

@supplier_router.get("/bids", response_model=None)
def list_my_bids(db: DbSession, claims: JwtClaims = Depends(require_roles(*RBAC_ASSET_READ))) -> dict:
    rows = db.execute(text("SELECT b.*, p.title as project_title FROM supplier.procurement_bid b LEFT JOIN supplier.procurement_project p ON p.id = b.project_id WHERE b.organization_id = :oid ORDER BY b.created_at DESC"), {"oid": str(claims.sub)}).all()
    items = [{"id": str(r.id), "project_id": str(r.project_id), "project_title": getattr(r, "project_title", ""), "quoted_amount": float(r.quoted_amount), "round_number": r.round_number, "bid_status": r.bid_status or "SUBMITTED", "created_at": r.created_at.isoformat() if r.created_at else None} for r in rows]
    return envelope_ok(data={"items": items, "total": len(items)})

@router.get("/suppliers/credit", dependencies=[PgDep])
def list_supplier_credit(db: DbSession, _: JwtClaims = Depends(require_roles(*RBAC_PROCUREMENT_READ))) -> dict:
    rows = db.execute(text("SELECT id, legal_name, short_name, credit_score, credit_level, unified_social_credit_code, contact_person, contact_phone FROM supplier.organization ORDER BY credit_score DESC")).all()
    items = [{"id": str(r.id), "legal_name": r.legal_name, "short_name": r.short_name or "", "credit_score": r.credit_score, "credit_level": r.credit_level, "unified_social_credit_code": r.unified_social_credit_code or "", "contact_person": r.contact_person or "", "contact_phone": r.contact_phone or ""} for r in rows]
    return envelope_ok(data={"items": items, "total": len(items)})

@router.patch("/suppliers/{org_id}/credit", dependencies=[PgDep])
def update_supplier_credit(db: DbSession, org_id: str, body: dict[str, Any], _: JwtClaims = Depends(require_roles(*RBAC_PROCUREMENT_REVIEW))) -> dict:
    score = body.get("credit_score", 80)
    level = "A" if score >= 90 else "B" if score >= 70 else "C"
    db.execute(text("UPDATE supplier.organization SET credit_score = :s, credit_level = :l WHERE id = :id"), {"s": score, "l": level, "id": org_id})
    db.commit()
    return envelope_ok(data={"id": org_id, "credit_score": score, "credit_level": level})
'''

content = content.rstrip() + new_apis
with open('app/modules/procurement/router.py', 'w', encoding='utf-8') as f:
    f.write(content)
print('Added Phase 2 endpoints')
