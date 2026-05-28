"""与《API接口设计》一致的 JSON 外层信封。

规范来源：docs/06_接口设计/01_API接口设计.md
（成功时 code=0；业务数据放在 data）。
"""

from typing import Any


def envelope_ok(data: dict[str, Any] | list[Any] | None = None, *, message: str = "success") -> dict[str, Any]:
    return {"code": 0, "message": message, "data": data if data is not None else {}}
