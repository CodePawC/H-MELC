# 测试说明

## 必跑项

- 后端：`cd backend && python -m pytest`
- 前端：`cd frontend-admin && npm run build`
- 后端编译：`python -m compileall backend/app`

## H-UMDG 接入测试

- H-UMDG 模块根路径返回统一信封，并声明 H-UMDG 是另一个系统。
- 非 PostgreSQL 环境下，依赖缓存/申请表的接口返回 503。
- PostgreSQL 环境下，无 JWT 调用 H-UMDG 代理、缓存和申请接口返回 401。
- 设备台账可保存 H-UMDG 装备字典引用字段。
- 设备台账可保存 H-UMDG 厂商机构引用字段。
- 设备新增页面可检索 H-UMDG 分类树、设备标准名称和厂商机构，并保存引用快照到资产台账。
- H-UMDG 不可用且允许降级时，返回只读缓存并标记 `degraded` / `from_cache`。

## 不计入真实闭环测试

HospitalPresetPage 演示页、IoT、RFID、数字孪生、高级 BI、正式 RAG、全自动 AI 审批不计入一期真实闭环 Verified 测试。
