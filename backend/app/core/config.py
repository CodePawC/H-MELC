from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
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

    # 认证模式：standalone（默认，本地用户表）/ unified（H-UMDG 统一身份）
    auth_mode: str = "standalone"

    # 主数据服务：H-MELC 作为主数据消费者，支持本地维护、标准服务和混合模式。
    master_data_mode: str = Field(default="hybrid", validation_alias="MASTER_DATA_MODE")
    master_data_provider: str = Field(default="custom", validation_alias="MASTER_DATA_PROVIDER")
    master_data_base_url_value: str = Field(default="", validation_alias="MASTER_DATA_BASE_URL")
    master_data_auth_type: str = Field(default="none", validation_alias="MASTER_DATA_AUTH_TYPE")
    master_data_api_key: str = Field(default="", validation_alias="MASTER_DATA_API_KEY")
    master_data_timeout_ms: int = Field(default=5000, validation_alias="MASTER_DATA_TIMEOUT")
    umdg_api_base_url: str = ""
    umdg_api_token: str = ""
    umdg_timeout: float = 5.0
    master_data_cache_enabled: bool = Field(default=True, validation_alias="MASTER_DATA_CACHE_ENABLED")
    master_data_cache_ttl_seconds: int = Field(default=3600, validation_alias="MASTER_DATA_CACHE_TTL")
    master_data_allow_local_override: bool = Field(default=False, validation_alias="MASTER_DATA_ALLOW_LOCAL_OVERRIDE")
    master_data_allow_temp_maintain: bool = Field(default=True, validation_alias="MASTER_DATA_ALLOW_TEMP_MAINTAIN")
    master_data_conflict_strategy: str = Field(default="standard_first", validation_alias="MASTER_DATA_CONFLICT_STRATEGY")
    master_data_quality_check_enabled: bool = Field(default=True, validation_alias="MASTER_DATA_QUALITY_CHECK_ENABLED")

    # 兼容历史内部集成模块命名；新部署优先使用 MASTER_DATA_*。
    hmdm_base_url: str = ""
    hmdm_api_key: str = ""
    hmdm_legacy_api_key: str = ""
    hmdm_timeout: float = 5.0
    hmdm_cache_ttl: int = 86400
    hmdm_enable_cache: bool = True
    hmdm_fallback_to_cache: bool = True

    def normalized_master_data_mode(self) -> str:
        mode = (self.master_data_mode or "local").strip().lower()
        if mode == "remote":
            return "service"
        return mode if mode in {"local", "service", "hybrid"} else "local"

    def master_data_base_url(self) -> str:
        if self.normalized_master_data_mode() == "local":
            return ""
        return (self.master_data_base_url_value or self.umdg_api_base_url or self.hmdm_base_url).strip()

    def master_data_token(self) -> str:
        if self.normalized_master_data_mode() == "local":
            return ""
        return (self.master_data_api_key or self.umdg_api_token or self.hmdm_api_key).strip()

    def master_data_timeout(self) -> float:
        if self.master_data_timeout_ms:
            return max(0.1, self.master_data_timeout_ms / 1000)
        return self.umdg_timeout or self.hmdm_timeout

    def effective_master_data_cache_enabled(self) -> bool:
        return self.master_data_cache_enabled and self.hmdm_enable_cache

    def effective_master_data_cache_ttl(self) -> int:
        return self.master_data_cache_ttl_seconds or self.hmdm_cache_ttl


@lru_cache
def get_settings() -> Settings:
    return Settings()
