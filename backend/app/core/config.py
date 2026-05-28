from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 对齐 docs/07_部署运维：DATABASE_URL / REDIS_URL / MinIO 等可由 Docker 注入
    app_name: str = "H-MELC"
    app_display_name: str = "医院医学装备全生命周期闭环管理平台"
    app_env: str = "development"
    server_port: int = 8102
    frontend_port: int = 5102
    upload_dir: str = "./storage/uploads"
    log_dir: str = "./storage/logs"
    backup_dir: str = "./storage/backups"

    database_url: str = "sqlite:///./local.db"

    redis_url: str | None = None

    minio_endpoint: str = "127.0.0.1:9000"
    minio_access_key: str = ""
    minio_secret_key: str = ""
    minio_bucket: str = "mep-files"
    minio_secure: bool = False
    minio_region: str | None = None

    cors_origins: str = (
        "http://localhost:5102,http://127.0.0.1:5102,"
        "http://localhost:5173,http://127.0.0.1:5173,"
        "http://localhost:5174,http://127.0.0.1:5174,"
        "http://localhost:5175,http://127.0.0.1:5175,"
        "http://localhost:5176,http://127.0.0.1:5176,"
        "http://localhost:5177,http://127.0.0.1:5177,"
        "http://localhost:5178,http://127.0.0.1:5178"
    )

    # JWT（Phase 0）：生产环境务必通过环境变量覆盖 jwt_secret_key
    jwt_secret_key: str = "dev-jwt-secret-change-me-in-production-min-32-chars!!"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 720

    # 主数据来源：local 独立部署；remote 接入 H-UMDG；hybrid 优先 H-UMDG，失败后缓存/本地兜底。
    master_data_mode: str = "local"
    umdg_api_base_url: str = ""
    umdg_api_token: str = ""
    umdg_timeout: float = 5.0
    master_data_cache_enabled: bool = True
    master_data_cache_ttl_seconds: int = 3600

    # 兼容历史内部集成模块命名；新部署优先使用 UMDG_*。
    hmdm_base_url: str = ""
    hmdm_api_key: str = ""
    hmdm_legacy_api_key: str = ""
    hmdm_timeout: float = 5.0
    hmdm_cache_ttl: int = 86400
    hmdm_enable_cache: bool = True
    hmdm_fallback_to_cache: bool = True

    def normalized_master_data_mode(self) -> str:
        mode = (self.master_data_mode or "local").strip().lower()
        return mode if mode in {"local", "remote", "hybrid"} else "local"

    def master_data_base_url(self) -> str:
        if self.normalized_master_data_mode() == "local":
            return ""
        return (self.umdg_api_base_url or self.hmdm_base_url).strip()

    def master_data_token(self) -> str:
        if self.normalized_master_data_mode() == "local":
            return ""
        return (self.umdg_api_token or self.hmdm_api_key).strip()

    def master_data_timeout(self) -> float:
        return self.umdg_timeout or self.hmdm_timeout

    def effective_master_data_cache_enabled(self) -> bool:
        return self.master_data_cache_enabled and self.hmdm_enable_cache

    def effective_master_data_cache_ttl(self) -> int:
        return self.master_data_cache_ttl_seconds or self.hmdm_cache_ttl


@lru_cache
def get_settings() -> Settings:
    return Settings()
