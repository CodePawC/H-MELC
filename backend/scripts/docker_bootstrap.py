"""Docker / 一键本地：等待数据库、执行 alembic upgrade head，并可选预置开发账号 admin。

由 docker-entrypoint 调用；仅当环境变量 MEP_BOOTSTRAP_DEV_ADMIN=1（或 true）且库为 PostgreSQL 时创建/跳过已存在的 admin。
生产环境请勿设置 MEP_BOOTSTRAP_DEV_ADMIN，并改用 scripts/create_identity_user.py 预置账号。
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.exc import OperationalError, SQLAlchemyError  # noqa: E402

from app.core.config import get_settings  # noqa: E402


def _wait_for_db(url: str, *, attempts: int = 60, interval_sec: float = 1.0) -> None:
    eng = create_engine(url, pool_pre_ping=True)
    last: Exception | None = None
    for i in range(attempts):
        try:
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            eng.dispose()
            return
        except (OperationalError, SQLAlchemyError) as e:
            last = e
            time.sleep(interval_sec)
    eng.dispose()
    raise RuntimeError(f"数据库在 {attempts * interval_sec:.0f}s 内未就绪: {last!s}") from last


def _alembic_upgrade() -> None:
    ini = ROOT / "alembic.ini"
    cfg = Config(str(ini))
    command.upgrade(cfg, "head")


def _bootstrap_dev_admin() -> None:
    flag = os.environ.get("MEP_BOOTSTRAP_DEV_ADMIN", "").strip().lower()
    if flag not in ("1", "true", "yes", "on"):
        return

    from sqlalchemy import select  # noqa: E402

    from app.db.session import SessionLocal  # noqa: E402
    from app.modules.auth.service import hash_password  # noqa: E402
    from app.modules.identity.models import AppUser, UserRole  # noqa: E402

    username = os.environ.get("MEP_DEV_ADMIN_USERNAME", "admin").strip() or "admin"
    password = os.environ.get("MEP_DEV_ADMIN_PASSWORD", "admin123").strip()
    if not password:
        print("docker_bootstrap: MEP_DEV_ADMIN_PASSWORD 为空，跳过预置账号", flush=True)
        return

    db = SessionLocal()
    try:
        row = db.execute(select(AppUser).where(AppUser.username == username)).scalar_one_or_none()
        if row is not None:
            print(f"docker_bootstrap: 用户 {username} 已存在，跳过创建", flush=True)
            return
        row = AppUser(username=username, password_hash=hash_password(password), display_name=username)
        db.add(row)
        db.flush()
        for rc in ("SYS_ADMIN", "AUDIT_ADMIN", "DEVICE_ADMIN"):
            db.add(UserRole(user_id=row.id, role_code=rc))
        db.commit()
        print(f"docker_bootstrap: 已预置开发账号 {username}（请在生产环境修改口令并关闭 MEP_BOOTSTRAP_DEV_ADMIN）", flush=True)
    finally:
        db.close()


def main() -> None:
    url = get_settings().database_url
    if not url.startswith("postgresql"):
        print("docker_bootstrap: 非 PostgreSQL DATABASE_URL，跳过迁移与预置（本地契约测试可用 SQLite）", flush=True)
        return

    print("docker_bootstrap: 等待数据库…", flush=True)
    _wait_for_db(url)
    print("docker_bootstrap: alembic upgrade head …", flush=True)
    _alembic_upgrade()
    _bootstrap_dev_admin()


if __name__ == "__main__":
    main()
