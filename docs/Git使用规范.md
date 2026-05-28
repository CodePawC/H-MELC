# Git 使用规范

## 1. 分支规范

- `main`：稳定分支，只保留可发布或可验收状态。
- `dev`：日常开发分支，功能合并前先进入该分支集成验证。
- `feature/*`：新功能分支，例如 `feature/master-data-adapter`。
- `fix/*`：问题修复分支，例如 `fix/login-session-expiry`。
- `docs/*`：文档修改分支，例如 `docs/api-contracts`。
- `release/*`：发布准备分支，例如 `release/v0.1.1`.

## 2. 提交信息规范

使用 Conventional Commits：

- `feat:` 新功能
- `fix:` 修复问题
- `docs:` 文档
- `style:` 格式调整
- `refactor:` 重构
- `perf:` 性能优化
- `test:` 测试
- `build:` 构建
- `ci:` CI/CD
- `chore:` 杂项
- `security:` 安全修复

示例：

```bash
git commit -m "feat: add master data adapter"
git commit -m "fix: handle expired login session"
git commit -m "docs: update deployment guide"
```

## 3. 版本号规范

版本号使用：

```text
v主版本.次版本.修订版本+日期.流水号
```

示例：

```text
v0.1.1+20260528.001
```

## 4. 标签规范

每次可发布版本打 tag：

```bash
git tag v0.1.1+20260528.001
```

## 5. 禁止提交内容

- `.env.local`
- API Key
- 数据库密码
- 真实患者或医院敏感数据
- 上传文件
- 日志
- 备份
- `node_modules`
- `dist` / `build`
