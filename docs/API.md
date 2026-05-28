# API 补充说明

## H-UMDG 外部主数据接入

所有业务 API 仍使用 `/api/v1` 和统一响应信封 `{code,message,data}`。

H-UMDG 是另一个系统；以下接口只是 H-MELC 的代理、缓存和申请入口，不代表在 H-MELC 内建设权威主数据。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/hmdm` | H-UMDG 接入模块路径发现 |
| GET | `/api/v1/hmdm/status` | H-UMDG 配置、连通性和缓存状态 |
| GET | `/api/v1/hmdm/equipment-categories/tree` | 代理获取 H-UMDG 设备分类树 |
| GET | `/api/v1/hmdm/equipment-standard-names?keyword=&category_id=` | 代理查询设备标准名称 |
| GET | `/api/v1/hmdm/equipment-standard-names/{id}` | 代理查询设备标准名称详情 |
| GET | `/api/v1/hmdm/manufacturer-vendors?keyword=&role_type=&business_domain=` | 代理查询厂商机构 |
| GET | `/api/v1/hmdm/manufacturer-vendors/{id}` | 代理查询厂商详情 |
| GET | `/api/v1/hmdm/manufacturer-vendors/{id}/relations` | 代理查询厂商关系 |
| POST | `/api/v1/hmdm/equipment-standard-name-requests` | 提交新增设备标准名称候选申请 |
| POST | `/api/v1/hmdm/manufacturer-vendor-requests` | 提交新增厂商机构候选申请 |
| GET | `/api/v1/hmdm/cache/status` | 获取本地只读缓存状态 |
| POST | `/api/v1/hmdm/cache/refresh` | 手动刷新 H-UMDG 缓存 |

## 降级规则

- H-UMDG 可用时，H-MELC 代理 H-UMDG API 并刷新只读缓存。
- H-UMDG 不可用且配置允许降级时，H-MELC 返回最近一次成功同步的缓存，并在 `data.degraded` / `data.from_cache` 中标记。
- 缓存不是权威数据，不能在本系统编辑。
- 新增标准名称和厂商机构只能生成候选申请，不能直接写入权威库。
