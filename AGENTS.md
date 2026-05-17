# AGENTS.md — 飞牛 fnOS 应用 Monorepo

## 项目概述

这是上架到飞牛 fnOS 应用商店的第三方应用打包仓库（Monorepo），包含多个应用的配置与打包产物。

**技术栈**：fnOS Docker 应用规范（bash 脚本 + docker-compose + JSON 配置），非传统前端/后端项目。

## 项目结构

每个应用目录遵循飞牛应用规范：

```
apps/<appname>/
├── manifest                 # 应用基本信息（INI 格式）
├── ICON.PNG / ICON_256.PNG  # 图标
├── app/                     # Docker 配置及入口
│   ├── docker/docker-compose.yaml
│   └── ui/                  # 桌面入口配置
│       ├── config           # JSON 格式入口配置
│       └── images/          # 图标
├── cmd/                     # 生命周期脚本（bash）
│   └── main                 # start/stop/status
├── config/                  # 权限与资源配置（JSON）
│   ├── privilege
│   └── resource
└── wizard/                  # 安装向导配置
```

## 常用开发流程

### 创建新应用

```bash
# 在 apps 目录下创建 Docker 应用（推荐）
cd apps
fnpack create <appname> --template docker
```

创建后需手动编辑：
- `manifest` — 应用标识、版本号、显示名称、描述、架构等
- `app/docker/docker-compose.yaml` — 容器镜像、端口映射、数据卷
- `app/ui/config` — 桌面入口配置（JSON 格式）
- `cmd/main` — 容器启停与状态检查脚本
- `config/privilege` — 运行权限（username/groupname 使用 `docker-<appname>`）
- `config/resource` — 资源限制
- `wizard/install` — 安装向导（如需用户输入密码等参数）
- 替换 `ICON.PNG`（64x64）和 `ICON_256.PNG`（256x256）

### 修改应用配置

直接编辑对应 `apps/<appname>/` 下的文件，常见修改：
- 改 manifest → `manifest`
- 改 Docker 配置 → `app/docker/docker-compose.yaml`
- 改桌面入口 → `app/ui/config`
- 改权限 → `config/privilege`
- 改生命周期 → `cmd/main`

### 本地测试

需在飞牛 fnOS 设备上：

```bash
cd apps/<appname>
appcenter-cli install-local
```

### 版本发布

应用升级只需按规则推送 tag，无需手动改版本号。

**以下文件由 CI 自动更新：**
- `manifest` — `version` 字段
- `README.md` — 已上架应用表格中的版本号和 Release 链接

```bash
# 提交代码
git add apps/<appname>/
git commit -m "feat: 描述"
git push origin main

# 推送 tag 触发自动构建和 Release
git tag <appname>/v<版本号>
git push origin <appname>/v<版本号>
```

推送 tag 后 GitHub Actions 自动：
1. 更新 manifest 和 README 中的版本号
2. 用 fnpack 构建 .fpk 包
3. 创建 GitHub Release 附带中文文案

### CI/CD

配置文件：`.github/workflows/build-release.yml`
- Tag 格式：`<应用目录名>/v<版本号>`（必须带 `/`）
- 每个应用独立发版，互不影响

## AI 开发指南

### 使用 fnnas-docs skill

涉及飞牛应用开发相关问题时，使用 `fnnas-docs` skill 查阅官方文档：

```bash
# 安装技能（首次使用前执行一次）
npx skills add tnnevol/skills@fnnas-docs -g -y
```

覆盖：
- manifest 配置规范
- 应用权限与资源管理
- 应用入口配置
- Docker/Native 应用构建
- 向导配置（wizard）
- 网关认证
- CLI 工具（fnpack、appcenter-cli）

### fnpack 打包工具

- 文档：[飞牛开发者官网](https://developer.fnnas.com/)
- 下载：https://static2.fnnas.com/fnpack/
- 当前版本：1.2.1
- 本地安装：

```bash
# macOS Apple Silicon
chmod +x fnpack-1.2.1-darwin-arm64
sudo mv fnpack-1.2.1-darwin-arm64 /usr/local/bin/fnpack

# Linux x86
chmod +x fnpack-1.2.1-linux-amd64
sudo mv fnpack-1.2.1-linux-amd64 /usr/local/bin/fnpack
```

### 打包命令

```bash
cd apps/<appname>
fnpack build
# 生成 <appname>.fpk
```

## 注意事项

- 每个应用**独立版本管理**，不要强行统一版本号
- manifest 是 INI 格式，字段对齐靠空格，不要随意修改格式
- `config/privilege` 中 username/groupname 使用 `docker-<appname>` 前缀
- 入口配置（`app/ui/config`）使用 `type: "url"` + `port`，不是 iframe 方式
- 不要编造项目中不存在的资源链接
