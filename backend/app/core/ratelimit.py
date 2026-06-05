"""速率限制中间件（暴力破解防护，无外部依赖）。

登录端点 10 次/分钟/IP，其他 API 120 次/分钟/IP。
config.rate_limit_enabled=False 时跳过（测试环境默认关闭）。
"""

import time
from collections import defaultdict

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import get_settings


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._requests: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        if not get_settings().rate_limit_enabled or request.method == "OPTIONS":
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        now = time.time()
        cutoff = now - 60
        is_login = request.url.path.endswith("/auth/login")
        limit = 10 if is_login else 120
        key = f"{client_ip}:{request.url.path}"
        self._requests[key] = [t for t in self._requests[key] if t > cutoff]

        if len(self._requests[key]) >= limit:
            return JSONResponse(
                status_code=429,
                content={"code": 429, "message": "TOO_MANY_REQUESTS", "data": {"retry_after": 60}},
                headers={"Retry-After": "60"},
            )

        self._requests[key].append(now)
        return await call_next(request)
