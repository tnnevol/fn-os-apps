# AGENTS.md — 飞牛 fnOS 应用 Monorepo

## 项目概述

本仓库用于将第三方应用打包为飞牛 fnOS 应用商店格式。项目根目录 `package.json` 维护统一发布版本号，根目录 `bump` 脚本会同步更新各应用版本。

**技术栈**：fnOS Native 和 Docker 应用规范（bash 生命周期脚本 + JSON 配置；Docker 应用额外使用 docker-compose），非传统前后端项目。

---

## Agent 开发指南

### 官方文档

涉及飞牛应用开发相关问题时，优先使用 `fnnas-docs` skill 查阅官方文档：

```bash
# 安装技能（首次使用前执行一次）
npx skills add tnnevol/skills@fnnas-docs -g -y
```

该 skill 覆盖了 manifest 配置、权限管理、入口配置、Docker/Native 构建、向导配置、网关认证、CLI 工具等完整开发文档。

### SDD 维护模式

本仓库采用轻量规格驱动开发（SDD）维护模式：

- 新功能、用户可见行为、权限、数据、网关或插件契约变更，先更新 `docs/requirements/`，再在 `docs/plans/` 建立或调整实施计划。
- 需求规格描述范围、优先级和可观察的验收条件；计划描述实现、测试、发布和回滚，不用代码或测试替代规格。
- 每个 P0/P1 功能应保持需求、验收、计划任务、测试和目标环境证据的可追踪关系；涉及 fnOS 的功能必须区分本地验证和真实 NAS 验收。
- 应用和插件面向用户的说明以 `docs/` 为唯一维护入口；`README.md` 只保留项目识别、开发入口或历史兼容内容。
- 提交前运行 `pnpm run check:sdd` 和与改动相关的构建/测试；文档改动还需运行 `pnpm run docs:build` 与 `git diff --check`。

完整流程见 [`docs/guide/sdd-workflow.md`](docs/guide/sdd-workflow.md)。

### DSH 插件插槽开发约定

开发 DSH Client 插件时，先检查目标 Slot 的现有条目和 `priority`。列表插槽中相同 `id` 不能使用相同优先级，否则会导致插件加载失败。尤其注意 `conversation.composer.dock` 的内置会话步骤统计条目使用 `id: 'stats'`、`priority: 0`；需要置换它时必须使用不同优先级（例如 `priority: -1`，较低优先级生效），仅新增内容则使用自有 `id`，不要占用 `stats`。

### 创建新应用

```bash
cd apps
# Native 应用
fnpack create <appname>

# Docker 应用
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
| Native 服务代码/运行入口 | `app/`、`cmd/main`                         |
| Docker 容器配置          | `app/docker/docker-compose.yaml`           |
| 桌面入口                 | `app/ui/config`                            |
| 应用资源                 | `config/resource`                          |
| 运行权限                 | `config/privilege`                         |
| 生命周期脚本             | `cmd/`                                     |

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
**当前版本**：1.2.3

```bash
# macOS Apple Silicon
chmod +x fnpack-1.2.3-darwin-arm64
sudo mv fnpack-1.2.3-darwin-arm64 /usr/local/bin/fnpack

# Linux x86
chmod +x fnpack-1.2.3-linux-amd64
sudo mv fnpack-1.2.3-linux-amd64 /usr/local/bin/fnpack
```

打包命令：

```bash
cd apps/<appname>
fnpack build
# 输出 <appname>.fpk

# 支持自动递增版本的应用，也可使用应用目录中的构建包装脚本
./build
```

### 版本发布

项目根目录 `package.json` 维护版本号。使用根目录 `bump` 脚本或对应的 npm bump 脚本批量升级并自动 commit + tag。

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

# npm 脚本入口（任选其一）
pnpm run bump:major
pnpm run bump:minor
pnpm run bump:patch
```

脚本执行后会自动：
1. 更新根 `package.json` 的 version 字段
2. 更新所有 `apps/*/manifest` 的 version 字段
3. 更新 README.md 中的 Release 链接和 Tag 示例
4. `git commit -m "chore: bump version to vX.Y.Z"`
5. `git tag vX.Y.Z`

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
- 入口配置（`app/ui/config`）根据应用形态选择 `type: "url"` 或 `type: "iframe"`，Native 网关应用可以使用 iframe
- 不要编造项目中不存在的资源链接
