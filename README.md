# fnOS Apps

飞牛 fnOS 应用 Monorepo，包含上架到 fnOS 应用商店的第三方应用打包。

## 项目结构

```
.
├── apps/
│   ├── fn-reader/                  # 阅读 - 在线电子书阅读器
│   ├── fn-xiaoya-only/             # 小雅 - 网盘聚合工具
│   ├── fn-bitwarden/               # Bitwarden - 密码管理器
│   ├── fn-mysql_v8/                # MySQL v8 - 关系型数据库(原生应用)
│   ├── fn-halo/                    # Halo - 建站系统
│   ├── fn-quark-auto-save/         # 夸克转存 - 夸克网盘自动化工具
│   ├── fn-new-api/                 # New API - AI API 管理平台
│   ├── fn-zentao/                  # 禅道项目管理 - 项目管理软件
│   ├── fn-memos/                   # Memos - 自托管笔记
│   ├── fn-moviepilot/              # MoviePilot - 影视自动化管理
│   ├── fn-hermes-agent/            # Hermes Agent - AI 代理(原生应用)
│   ├── fn-deepseek-harness/        # DeepSeek Harness - 插件化智能代理(原生应用)
│   ├── fn-uv/                      # uv - Python 包管理器(系统工具)
│   ├── fn-nvm/                     # NVM - Node.js 版本管理工具(系统工具)
│   └── fn-ohmyzsh/                 # Oh My Zsh - Zsh 配置管理框架
├── .github/workflows/              # CI: FPK 构建与 Release 发布
├── docs/                           # VitePress 项目文档
├── package.json                    # 项目版本与开发脚本
├── .gitignore
└── README.md
```

## 项目应用

| 应用                                                                        | 显示名称     | 说明                                                                                |
| --------------------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------- |
| [fn-reader](https://github.com/tnnevol/fn-os-apps/releases/latest)          | 阅读         | 开源在线电子书阅读器，支持多种格式、书架管理、阅读进度同步、全文搜索、主题定制      |
| [fn-xiaoya-only](https://github.com/tnnevol/fn-os-apps/releases/latest)     | 小雅         | 基于 Alist 的网盘聚合工具，支持多网盘挂载、在线播放、WebDAV、目录索引               |
| [fn-bitwarden](https://github.com/tnnevol/fn-os-apps/releases/latest)       | Bitwarden    | 开源密码管理器，安全存储网站登录信息、信用卡、安全笔记等                            |
| [fn-mysql_v8](https://github.com/tnnevol/fn-os-apps/releases/latest)        | MySQL v8     | MySQL 8.4.9 原生应用，非 Docker 容器化部署，支持远程访问配置和 DNS 优化             |
| [fn-halo](https://github.com/tnnevol/fn-os-apps/releases/latest)            | Halo         | 简洁高效的开源建站系统，支持博客、知识库、企业官网等多种场景                        |
| [fn-quark-auto-save](https://github.com/tnnevol/fn-os-apps/releases/latest) | 夸克转存     | 夸克网盘签到、自动转存、命名整理、推送提醒和刷新媒体库自动化工具                    |
| [fn-new-api](https://github.com/tnnevol/fn-os-apps/releases/latest)         | New API      | 新一代 AI API 管理与分发平台，支持多模型接入、令牌管理、配额控制等功能              |
| [fn-zentao](https://github.com/tnnevol/fn-os-apps/releases/latest)          | 禅道项目管理 | 国产开源项目管理软件，基于敏捷和 Scrum 理念，包含产品管理、项目管理、质量管理等模块 |
| [fn-memos](https://github.com/tnnevol/fn-os-apps/releases/latest)           | Memos        | 轻量级自托管笔记工具，支持 Markdown 编写、标签管理、多端同步                        |
| [fn-moviepilot](https://github.com/tnnevol/fn-os-apps/releases/latest)      | MoviePilot   | 影视自动化管理工具，支持媒体库管理、智能订阅、自动化整理等功能                      |
| [fn-hermes-agent](https://github.com/tnnevol/fn-os-apps/releases/latest)    | Hermes Agent | Nous Research 开发的 AI 代理，支持多平台消息网关、自主学习、技能创建、跨会话记忆    |
| [fn-deepseek-harness](apps/fn-deepseek-harness/README.md)                   | DeepSeek Harness | DeepSeek AI 开源的插件化智能代理工具，通过 Web UI 提供 dsh 操作界面                 |
| [fn-uv](https://github.com/tnnevol/fn-os-apps/releases/latest)              | uv           | 极速 Python 包管理器，替代 pip/pip-tools，提供虚拟环境和依赖解析能力                |
| [fn-nvm](https://github.com/tnnevol/fn-os-apps/releases/latest)             | NVM          | Node.js 版本管理工具，由 UID 1000 用户管理 NVM 和 Node.js 运行时                   |
| [fn-ohmyzsh](https://github.com/tnnevol/fn-os-apps/releases/latest)         | Oh My Zsh    | Zsh 配置管理框架，提供丰富的插件、主题和自动补全，增强命令行体验                    |

## 测试与安装

### 项目文档

```bash
pnpm install
pnpm run docs:dev
```

生产构建使用 `pnpm run docs:build`，构建结果位于 `docs/.vitepress/dist/`。

### 本地快速安装（开发阶段推荐）

```bash
# 在 fnOS 设备上，进入应用目录直接安装
cd /path/to/<appname>
appcenter-cli install-local
```

### 通过 fpk 文件安装

```bash
appcenter-cli install-fpk <appname>.fpk

# 带环境变量静默安装
appcenter-cli install-fpk <appname>.fpk --env config.env
```

### 手动安装模式（用于分发测试）

```bash
# 开启手动安装入口
appcenter-cli manual-install enable

# 关闭
appcenter-cli manual-install disable
```

### 查看日志

```bash
# 日志路径
cat /var/apps/<appname>/var/info.log

# 应用管理
appcenter-cli list
appcenter-cli start <appname>
appcenter-cli stop <appname>
```

## 版本发布

通过 GitHub Actions 自动完成 FPK 构建和 Release 发布。项目根目录通过 `package.json` 维护当前版本号，根目录 `bump` 脚本负责同步更新应用版本。

### Tag 命名规范

```
v<版本号>
```

| Tag 示例     | 版本                |
| ------------ | ------------------- |
| `v4.0.0`     | 4.0.0               |
| `v4.1.0-rc1` | 4.1.0-rc1（预发布） |

### 发布步骤

1. **代码变更并推送**

```bash
git add apps/
git commit -m "feat: 更新多个应用"
git push origin main
```

2. **推送版本 Tag 触发发布**

```bash
pnpm run bump:patch
git push origin main && git push origin v<版本号>
```

`bump` 会同步更新根 `package.json`、所有 `apps/*/manifest` 和 README 中的版本示例，然后自动创建版本提交和 Tag。

也可以直接使用对应的 npm 脚本（任选其一）：

```bash
pnpm run bump:major
pnpm run bump:minor
pnpm run bump:patch
```

3. **GitHub Actions 自动执行**

- **discover** — 扫描 `apps/` 目录，收集所有应用名
- **build** — 为每个应用并行构建 FPK，文件名格式 `<app>-v4.0.0.fpk`
- **release** — 生成中文 Release 文案 → 创建 GitHub Release，附带所有 `.fpk` 包

单个应用也可以在自己的目录中执行 `./build` 构建。`fn-deepseek-harness` 的构建脚本默认自动递增 patch 版本。

## 上架应用

上架流程：

1. 加入飞牛粉丝群（[fnos.com](https://fnnas.com/) 二维码）→ 联系社区主理人加入 **应用中心开发者先锋交流群**
2. 提交基础信息完成认证（个人/企业信息、代表作品、技术栈等）
3. 获取官方文档 → 创建应用 → 提交审核 → 上架

> 开发者后台即将上线，在此之前通过群内专员协助完成内测和上架。

## manifest 字段参考

| 字段                         | 必填 | 说明                             | 示例                    |
| ---------------------------- | ---- | -------------------------------- | ----------------------- |
| `appname`                    | 是   | 应用唯一标识                     | `fn-reader`             |
| `version`                    | 是   | 版本号，格式 `x[.y[.z]][-build]` | `3.2.14`                |
| `display_name`               | 是   | 显示名称                         | `阅读`                  |
| `desc`                       | 是   | 应用描述（支持 HTML）            | 功能说明                |
| `platform`                   | 是   | 架构，`x86` / `arm` / `all`      | `x86`                   |
| `source`                     | 是   | 应用来源                         | `thirdparty`            |
| `maintainer`                 | -    | 原始维护者                       | GitHub ID               |
| `maintainer_url`             | -    | 原始项目地址                     | URL                     |
| `distributor`                | -    | 分发者                           | GitHub ID               |
| `distributor_url`            | -    | 分发者主页                       | URL                     |
| `service_port`               | -    | 服务端口                         | `4396`                  |
| `os_min_version`             | -    | 最低 fnOS 版本                   | `0.9.27`                |
| `desktop_uidir`              | -    | UI 目录名                        | `ui`                    |
| `desktop_applaunchname`      | -    | 桌面启动项                       | `<appname>.Application` |
| `disable_authorization_path` | -    | 禁用目录授权                     | `true`                  |

## 开发资源

- [飞牛开发者官网](https://developer.fnnas.com/)
- [fnpack 下载](https://developer.fnnas.com/docs/cli/fnpack/)
- [通用 CGI 网关集合](https://github.com/FNOSP/fnosAppCenterCgiCollection)
