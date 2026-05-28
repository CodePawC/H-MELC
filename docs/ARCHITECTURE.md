# 架构说明：H-MELC 与 H-UMDG

## 系统关系

```text
H-UMDG（医院统一主数据治理平台）
  ↓ 装备字典 API / 厂商机构 API
H-MELC（医院医学装备全生命周期闭环管理平台）
  ↓ 引用字段、快照、只读缓存、候选申请
设备新增、设备台账、维修、PM、巡检、计量、采购、供应商门户、财务、工作流
```

H-UMDG 是基础主数据源，负责设备分类目录、设备标准名称、医疗器械分类目录、管理类别、厂商机构标准身份和厂商关系。H-MELC 是设备业务系统，负责具体设备资产、生命周期事件和业务闭环。

## 接入原则

- H-MELC 不维护 H-UMDG 权威字典。
- H-MELC 只保存 H-UMDG 字典引用字段和必要快照。
- H-UMDG 不可用时，H-MELC 可使用最近一次成功同步的只读缓存降级。
- 缓存不是权威数据，页面必须提示缓存过期或降级状态。
- 找不到标准设备名称或厂商机构时，H-MELC 只生成候选申请，后续同步给 H-UMDG 审核。

## 后端模块

- `backend/app/modules/hmdm/client.py`：H-UMDG 外部 HTTP 客户端。
- `backend/app/modules/hmdm/service.py`：代理查询、只读缓存、候选申请。
- `backend/app/modules/hmdm/router.py`：`/api/v1/hmdm/*` 管理端代理接口。
- `backend/app/modules/hmdm/models.py`：缓存表和候选申请表 ORM。
- `backend/alembic/versions/e021_hmdm_external_integration.py`：H-UMDG 引用字段、缓存表、申请表迁移。

## 降级路径

1. 页面调用 H-MELC 的 `/api/v1/hmdm/*` 代理接口。
2. H-MELC 调用 H-UMDG 外部 API。
3. 调用成功时刷新只读缓存。
4. 调用失败且允许降级时返回最近缓存，并标记 `degraded=true`、`from_cache=true`。
5. 无缓存时返回外部 API 错误，页面提示 H-UMDG 暂不可用。
