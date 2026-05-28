import redis

from app.core.config import get_settings

_client: redis.Redis | None = None


def get_redis_sync() -> redis.Redis | None:
    """同步 Redis；未配置 `redis_url` 时返回 None。"""
    global _client
    url = get_settings().redis_url
    if not url:
        return None
    if _client is None:
        _client = redis.from_url(url, decode_responses=True, socket_timeout=5.0)
    return _client


def ping_redis() -> bool | None:
    """连接正常返回 True；未配置返回 None。"""
    c = get_redis_sync()
    if c is None:
        return None
    try:
        return bool(c.ping())
    except redis.RedisError:
        return False
