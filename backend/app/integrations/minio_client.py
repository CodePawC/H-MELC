from minio import Minio

from app.core.config import get_settings


def get_minio_client() -> Minio | None:
    s = get_settings()
    if not s.minio_access_key or not s.minio_secret_key:
        return None
    endpoint = _normalize_endpoint(s.minio_endpoint)
    kwargs: dict[str, object] = {}
    if s.minio_region:
        kwargs["region"] = s.minio_region
    return Minio(
        endpoint,
        access_key=s.minio_access_key,
        secret_key=s.minio_secret_key,
        secure=s.minio_secure,
        **kwargs,
    )


def _normalize_endpoint(raw: str) -> str:
    """MinIO SDK 只需要 host[:port]，不要协议前缀。"""
    v = raw.strip()
    if "://" in v:
        host = v.split("://", 1)[1]
    else:
        host = v
    return host.rstrip("/")


def ensure_minio_bucket() -> None:
    client = get_minio_client()
    if client is None:
        return
    bucket = get_settings().minio_bucket
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)


def put_object_bytes(*, object_key: str, data: bytes, content_type: str) -> None:
    """写入对象至业务桶；未配置密钥时抛错便于路由返回 503。"""
    from io import BytesIO

    client = get_minio_client()
    if client is None:
        raise RuntimeError("MinIO 未配置密钥")
    bucket = get_settings().minio_bucket
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)
    client.put_object(bucket, object_key, BytesIO(data), length=len(data), content_type=content_type)


def ping_minio() -> bool | None:
    """可连通且桶可用（必要时自动创建）时为 True；未配置密钥时返回 None。"""
    client = get_minio_client()
    if client is None:
        return None
    bucket = get_settings().minio_bucket
    try:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
        return True
    except Exception:
        return False
