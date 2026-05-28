"""H-UMDG 外部 API 客户端。

注意：H-UMDG 是可选外部主数据系统。这里不保存、不维护任何权威主数据，只读取外部 API 结果。
"""

from __future__ import annotations

from typing import Any

import httpx

from app.core.config import get_settings


class HmdmClientError(RuntimeError):
    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class HmdmNotConfiguredError(HmdmClientError):
    pass


def _settings():
    return get_settings()


def is_configured() -> bool:
    s = _settings()
    return s.normalized_master_data_mode() in {"remote", "hybrid"} and bool(s.master_data_base_url())


def configured_base_url() -> str:
    return _settings().master_data_base_url().rstrip("/")


def _api_key_for_path(path: str, *, use_legacy_api_key: bool | None = None) -> str:
    s = _settings()
    if use_legacy_api_key is True:
        return s.hmdm_legacy_api_key.strip() or s.master_data_token()
    if use_legacy_api_key is False:
        return s.master_data_token()
    if path.startswith("/api/external/") and s.hmdm_legacy_api_key.strip():
        return s.hmdm_legacy_api_key.strip()
    return s.master_data_token()


async def request_json(
    path: str,
    params: dict[str, Any] | None = None,
    *,
    method: str = "GET",
    json: dict[str, Any] | None = None,
    use_legacy_api_key: bool | None = None,
) -> Any:
    s = _settings()
    base = s.master_data_base_url().rstrip("/")
    if not base:
        raise HmdmNotConfiguredError("UMDG_API_BASE_URL 未配置")
    if s.normalized_master_data_mode() == "local":
        raise HmdmNotConfiguredError("MASTER_DATA_MODE=local，未启用 H-UMDG 远程主数据")

    headers: dict[str, str] = {}
    api_key = _api_key_for_path(path, use_legacy_api_key=use_legacy_api_key)
    if api_key:
        headers["X-API-Key"] = api_key

    url = f"{base}{path}"
    try:
        async with httpx.AsyncClient(timeout=s.master_data_timeout()) as client:
            response = await client.request(method, url, params=params or {}, json=json, headers=headers)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as exc:
        raise HmdmClientError(str(exc), status_code=exc.response.status_code) from exc
    except httpx.HTTPError as exc:
        raise HmdmClientError(str(exc)) from exc
