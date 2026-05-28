"""Alembic 迁移上下文：从应用配置读取 `database_url`，与 `app.db.base.Base` 元数据对齐。"""
from __future__ import annotations

import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.config import get_settings  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.modules.asset import models as _asset_models  # noqa: E402,F401 — 挂载 ORM 到 Base.metadata
from app.modules.repair import models as _repair_models  # noqa: E402,F401
from app.modules.repair_center import models as _repair_center_models  # noqa: E402,F401
from app.modules.audit import models as _audit_models  # noqa: E402,F401
from app.modules.identity import models as _identity_models  # noqa: E402,F401
from app.modules.mdm import models as _mdm_models  # noqa: E402,F401
from app.modules.ai import models as _ai_models  # noqa: E402,F401
from app.modules.knowledge import models as _kb_models  # noqa: E402,F401
from app.modules.workflow import models as _wf_models  # noqa: E402,F401
from app.modules.supplier_portal import models as _sp_models  # noqa: E402,F401
from app.modules.supplier_projects import models as _spr_models  # noqa: E402,F401
from app.modules.finance import models as _finance_models  # noqa: E402,F401
from app.modules.hmdm import models as _hmdm_models  # noqa: E402,F401
from app.modules.metrology import models as _metrology_models  # noqa: E402,F401
from app.modules.operation_center import models as _operation_center_models  # noqa: E402,F401


config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata
_settings = get_settings()
config.set_main_option("sqlalchemy.url", _settings.database_url)


def run_migrations_offline() -> None:
    url = _settings.database_url
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    section = config.get_section(config.config_ini_section) or {}
    section["sqlalchemy.url"] = _settings.database_url
    connectable = engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
