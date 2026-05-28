# H-UMDG 主数据适配设计

## 目标

H-MELC 必须支持独立部署，并可选接入 H-UMDG。业务模块统一通过 Master Data Adapter / masterDataService 获取主数据，不直接硬编码 H-UMDG 地址，也不读取 H-UMDG 数据库。

## 模式

- `local`：默认模式，使用 H-MELC 本地基础数据维护模块，H-UMDG 不启动时系统仍可运行。
- `remote`：通过 `UMDG_API_BASE_URL` 和 `UMDG_API_TOKEN` 调用 H-UMDG 标准 API。
- `hybrid`：优先 H-UMDG，失败时读取本地缓存或本地基础数据兜底。

## 快照字段建议

新增或调整数据库字段前需单独评审迁移脚本。建议业务记录保留以下主数据引用与快照字段：

```text
department_source
department_id
department_code
department_name_snapshot

supplier_source
supplier_id
supplier_code
supplier_name_snapshot
```

其中 `*_source` 建议取值为 `local`、`umdg`、`cache` 或 `manual_snapshot`。历史代码中的 `h-mdm` 可在适配层兼容转换，不建议继续扩散到新业务表。

## 当前实现状态

现有代码已在设备与 PM 等模块中出现 `department_source`、`department_code`、`mdm_department_id` 等字段，并通过后端集成模块代理 H-UMDG 类主数据查询。供应商来源、名称快照字段尚未完整统一；本次迁移不直接大规模改数据库结构，只补充配置、文档和适配层约束。

## 后续迁移建议

1. 梳理设备、维修、PM、计量、采购、财务涉及的科室、人员、供应商、厂家字段。
2. 建立统一 Master Data Adapter 接口，封装 local、remote、hybrid 三种策略。
3. 对历史 `hmdm` 模块和 `h-mdm` 来源值做兼容映射，新增代码统一使用 `umdg` 语义。
4. 分模块补齐 `*_source`、`*_code`、`*_name_snapshot` 字段与索引。
5. 为每次结构变更补充 Alembic 迁移、回滚说明和契约测试。
