# AGENTS.md — 飞牛 fnOS 应用 Monorepo

## 项目概述

本仓库用于将第三方应用打包为飞牛 fnOS 应用商店格式。每个应用独立管理版本号，互不影响。

**技术栈**：fnOS Docker 应用规范（bash 生命周期脚本 + docker-compose + JSON 配置），非传统前后端项目。

---

## Agent 开发指南

### 官方文档

涉及飞牛应用开发相关问题时，优先使用 `fnnas-docs` skill 查阅官方文档：

```bash
# 安装技能（首次使用前执行一次）
npx skills add tnnevol/skills@fnnas-docs -g -y
```

该 skill 覆盖了 manifest 配置、权限管理、入口配置、Docker/Native 构建、向导配置、网关认证、CLI 工具等完整开发文档。

### 创建新应用

```bash
cd apps
fnpack create <appname> --template docker
```

创建后需编辑以下文件：

| 文件                             | 说明                                                   |
| -------------------------------- | ------------------------------------------------------ |
| `manifest`                       | 应用标识、版本号、显示名称、描述                       |
| `app/docker/docker-compose.yaml` | 容器镜像、端口映射、数据卷                             |
| `app/ui/config`                  | 桌面入口配置（JSON）                                   |
| `cmd/main`                       | 容器启停与状态检查                                     |
| `config/privilege`               | 运行权限（username/groupname 使用 `docker-<appname>`） |
| `ICON.PNG` / `ICON_256.PNG`      | 64×64 和 256×256 图标                                  |

### 修改应用配置

直接编辑对应 `apps/<appname>/` 目录下的文件：

| 修改目标        | 文件                             |
| --------------- | -------------------------------- |
| 应用基本信息    | `manifest`                       |
| Docker 容器配置 | `app/docker/docker-compose.yaml` |
| 桌面入口        | `app/ui/config`                  |
| 运行权限        | `config/privilege`               |
| 生命周期脚本    | `cmd/`                           |

### 卸载开发流程

为应用添加 `wizard/uninstall` 向导，让用户在卸载时选择保留或删除数据，并在 `cmd/uninstall_callback` 中根据 `wizard_data_action` 环境变量执行对应逻辑。

具体表单项类型和脚本流程参见 `fnnas-docs` skill 中的**用户向导**文档。

### 本地测试

需要在飞牛 fnOS 设备上执行：

```bash
cd apps/<appname>
appcenter-cli install-local
```

### fnpack 打包

**下载地址**：https://static2.fnnas.com/fnpack/
**当前版本**：1.2.1

```bash
# macOS Apple Silicon
chmod +x fnpack-1.2.1-darwin-arm64
sudo mv fnpack-1.2.1-darwin-arm64 /usr/local/bin/fnpack

# Linux x86
chmod +x fnpack-1.2.1-linux-amd64
sudo mv fnpack-1.2.1-linux-amd64 /usr/local/bin/fnpack
```

打包命令：

```bash
cd apps/<appname>
fnpack build
# 输出 <appname>.fpk
```

### 版本发布

所有应用共享同一版本号。使用根目录 `bump` 脚本批量升级并自动 commit + tag。

```bash
# 快速升级（基于当前版本号自动计算）
./bump major          # 4.4.1 → 5.0.0
./bump minor          # 4.4.1 → 4.5.0
./bump patch          # 4.4.1 → 4.4.2

# 指定版本号（支持 v 前缀或无前缀）
./bump -t 4.5.0
./bump -t v4.5.0
./bump --tag v4.5.0

# 仅修改文件，不自动 commit/tag
./bump patch --no-commit

# 自动 commit 但不打 tag
./bump patch --no-tag
```

脚本执行后会自动：
1. 更新所有 `apps/*/manifest` 的 version 字段
2. 更新 README.md 中的 Release 链接和 Tag 示例
3. `git commit -m "chore: bump version to vX.Y.Z"`
4. `git tag vX.Y.Z`

最后手动推送：

```bash
git push origin main && git push origin v4.5.0
```

推送 tag 后 GitHub Actions 自动执行：
1. **discover** — 扫描 `apps/` 目录，收集所有应用名
2. **build** — 为每个应用并行构建 `.fpk` 包
3. **release** — 创建 GitHub Release 并附带所有 `.fpk` 包

### CI/CD

- **配置文件**：[.github/workflows/build-release.yml](.github/workflows/build-release.yml)
- **Tag 格式**：`v<版本号>`（如 `v4.0.0`、`v4.1.0-rc1`）
- **版本升级脚本**：[bump](bump)

---

## 注意事项

- 每个应用**独立版本管理**，不要强行统一版本号
- `manifest` 为 INI 格式，字段对齐靠空格，不要随意修改格式
- `config/privilege` 中 `username`/`groupname` 使用 `docker-<appname>` 前缀
- 入口配置（`app/ui/config`）使用 `type: "url"` + `port`，不要使用 iframe 方式
- 不要编造项目中不存在的资源链接
