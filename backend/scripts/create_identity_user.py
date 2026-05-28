"""
院内用户预置脚本（PostgreSQL identity schema）。

示例（工作目录 backend）：
  python scripts/create_identity_user.py admin yourStrongPwd SYS_ADMIN AUDIT_ADMIN
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import delete, select  # noqa: E402

from app.db.session import SessionLocal  # noqa: E402
from app.modules.auth.service import hash_password  # noqa: E402
from app.modules.identity.models import AppUser, UserRole  # noqa: E402


def main() -> None:
    p = argparse.ArgumentParser(description="在 identity schema 创建/更新本地用户")
    p.add_argument("username")
    p.add_argument("password")
    p.add_argument("roles", nargs="+", help="角色编码，例如 SYS_ADMIN AUDIT_ADMIN")
    args = p.parse_args()

    db = SessionLocal()
    try:
        row = db.execute(select(AppUser).where(AppUser.username == args.username)).scalar_one_or_none()
        pwd = hash_password(args.password)
        if row is None:
            row = AppUser(username=args.username, password_hash=pwd, display_name=args.username)
            db.add(row)
            db.flush()
            for rc in args.roles:
                db.add(UserRole(user_id=row.id, role_code=rc.upper()))
        else:
            row.password_hash = pwd
            row.is_active = True
            db.execute(delete(UserRole).where(UserRole.user_id == row.id))
            for rc in args.roles:
                db.add(UserRole(user_id=row.id, role_code=rc.upper()))
        db.commit()
        print(f"OK: user {args.username} roles={[r.upper() for r in args.roles]}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
