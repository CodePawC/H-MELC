# H-MELC 医院医学装备全生命周期闭环管理平台

正式中文名称：医院医学装备全生命周期闭环管理平台
英文名称：Hospital Medical Equipment Lifecycle Closed-loop Management Platform
项目简称：H-MELC
当前迁移版本：v0.1.0+20260527.017
历史内部代号：医学装备运营OS
历史目录/旧项目名：medical-equipment-platform
项目定位：面向医学装备管理业务的全生命周期闭环管理平台。系统支持独立部署，也支持可选接入 H-UMDG 医院统一主数据治理平台。默认独立部署模式下，使用本地基础数据维护模块；接入 H-UMDG 后，可优先调用统一主数据，并保留本地缓存和历史快照。

## 项目结构

```text
H-MELC/
├─ backend/                 # FastAPI 后端
├─ frontend-admin/          # PC 管理端
├─ frontend-mobile/         # 移动/H5 端
├─ frontend-supplier/       # 供应商门户
├─ ai-service/              # AI 服务预留
├─ docs/                    # 本项目需求、接口、前端、测试与部署文档
├─ deploy/                  # 部署文件
├─ scripts/                 # 初始化/导入/清洗脚本
└─ storage/                 # 本地上传、日志、备份目录（仅保留 .gitkeep）
```

## 主数据来源模式

H-MELC 通过 Master Data Adapter / masterDataService 获取主数据，业务模块不得硬编码 H-UMDG 地址，也不得直接绕过适配层调用 H-UMDG API。

- `local` 本地模式：默认模式，不依赖 H-UMDG。使用 H-MELC 内置基础数据维护模块，包括科室、人员、供应商、厂家、设备分类、耗材、医保编码等基础数据。
- `remote` 主数据平台模式：通过标准 API 调用 H-UMDG 获取主数据。H-MELC 只通过配置接入，不把 H-UMDG 做成部署强依赖。
- `hybrid` 混合模式：优先调用 H-UMDG，调用失败时使用本地缓存或本地基础数据兜底，保证核心业务不中断。

关键环境变量：

```env
MASTER_DATA_MODE=local
UMDG_API_BASE_URL=
UMDG_API_TOKEN=
MASTER_DATA_CACHE_ENABLED=true
MASTER_DATA_CACHE_TTL_SECONDS=3600
```

业务记录应保留主数据来源、编码和名称快照，例如 `department_source`、`department_id`、`department_code`、`department_name_snapshot`、`supplier_source`、`supplier_id`、`supplier_code`、`supplier_name_snapshot`。若当前表结构尚未覆盖全部字段，请先按 `docs/` 与迁移建议评审后再做数据库迁移。

## 本地开发

后端：

```powershell
cd backend
pip install -e ".[dev]"
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8102
```

PC 管理端：

```powershell
cd frontend-admin
npm install
npm run dev
```

默认端口：

- H-MELC PC 管理端：`http://127.0.0.1:5102`
- H-MELC 后端 API：`http://127.0.0.1:8102`

## 测试与构建

```powershell
cd backend
pytest

cd ..\frontend-admin
npm run build
```

## 配置与开源准备

- 本地私有配置使用 `.env.local`，不要提交 `.env` 或 `.env.local`。
- 仓库提交 `.env.example`，上传、日志、备份默认使用 `./storage/...` 相对目录。
- 开源前检查 API Key、数据库密码、真实患者/医院敏感数据、上传文件、运行日志、License、README 和安装文档。
