# fnOS Apps

飞牛 fnOS 应用 Monorepo，包含上架到 fnOS 应用商店的第三方应用打包。

## 项目结构

```
.
├── apps/
│   ├── fn-reader/                  # 阅读 - 在线电子书阅读器
│   ├── fn-xiaoya-only/             # 小雅 - 网盘聚合工具
│   ├── fn-bitwarden/               # Bitwarden - 密码管理器
│   ├── fn-mysql-8_4_9/             # MySQL - 关系型数据库
│   ├── fn-halo/                    # Halo - 建站系统
│   └── quark-auto-save/            # 夸克转存 - 夸克网盘自动化工具
├── .github/workflows/              # CI: FPK 构建与 Release 发布
├── .gitignore
└── README.md
```

## 已上架应用

| 应用 | 显示名称 | 说明 |
|------|----------|------|
| [fn-reader](https://github.com/tnnevol/fn-os-apps/releases/latest) | 阅读 | 开源在线电子书阅读器，支持多种格式、书架管理、阅读进度同步、全文搜索、主题定制 |
| [fn-xiaoya-only](https://github.com/tnnevol/fn-os-apps/releases/latest) | 小雅 | 基于 Alist 的网盘聚合工具，支持多网盘挂载、在线播放、WebDAV、目录索引 |
| [fn-bitwarden](https://github.com/tnnevol/fn-os-apps/releases/latest) | Bitwarden | 开源密码管理器，安全存储网站登录信息、信用卡、安全笔记等 |
| [fn-mysql-8_4_9](https://github.com/tnnevol/fn-os-apps/releases/latest) | MySQL | 开源关系型数据库管理系统，固定版本 8.4.9，支持 utf8mb4 字符集 |
| [fn-halo](https://github.com/tnnevol/fn-os-apps/releases/latest) | Halo | 简洁高效的开源建站系统，支持博客、知识库、企业官网等多种场景 |
| [quark-auto-save](https://github.com/tnnevol/fn-os-apps/releases/latest) | 夸克转存 | 夸克网盘签到、自动转存、命名整理、推送提醒和刷新媒体库自动化工具 |

## 测试与安装

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

通过 GitHub Actions 自动完成版本升级、FPK 构建和 Release 发布。

### Tag 命名规范

```
<应用目录名>/v<版本号>
```

| Tag 示例 | 触发应用 | 版本 |
|----------|----------|------|
| `fn-xiaoya-only/v1.2.0` | 小雅 | 1.2.0 |
| `fn-reader/v3.3.0` | 阅读 | 3.3.0 |

### 发布步骤

1. **代码变更并推送**

```bash
git add apps/fn-xiaoya-only/
git commit -m "feat: 新增功能"
git push origin main
```

2. **推送版本 Tag 触发发布**

```bash
git tag fn-xiaoya-only/v1.2.0
git push origin fn-xiaoya-only/v1.2.0
```

3. **GitHub Actions 自动执行**（3 个 job 并行）

- **bump-version** — 更新 manifest 版本 → 提交到 main
- **build** — 安装 fnpack → 构建 FPK → 重命名为 `fn-xiaoya-only-v1.2.0.fpk`
- **release** — 生成中文 Release 文案 → 创建 GitHub Release 附带 FPK

> 每个应用独立发版，互不影响。

## 上架应用

上架流程：

1. 加入飞牛粉丝群（[fnos.com](https://fnnas.com/) 二维码）→ 联系社区主理人加入 **应用中心开发者先锋交流群**
2. 提交基础信息完成认证（个人/企业信息、代表作品、技术栈等）
3. 获取官方文档 → 创建应用 → 提交审核 → 上架

> 开发者后台即将上线，在此之前通过群内专员协助完成内测和上架。

## manifest 字段参考

| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `appname` | 是 | 应用唯一标识 | `fn-reader` |
| `version` | 是 | 版本号，格式 `x[.y[.z]][-build]` | `3.2.14` |
| `display_name` | 是 | 显示名称 | `阅读` |
| `desc` | 是 | 应用描述（支持 HTML） | 功能说明 |
| `arch` | 是 | 架构 | `x86_64` |
| `source` | 是 | 应用来源 | `thirdparty` |
| `maintainer` | - | 原始维护者 | GitHub ID |
| `maintainer_url` | - | 原始项目地址 | URL |
| `distributor` | - | 分发者 | GitHub ID |
| `distributor_url` | - | 分发者主页 | URL |
| `service_port` | - | 服务端口 | `4396` |
| `os_min_version` | - | 最低 fnOS 版本 | `0.9.27` |
| `desktop_uidir` | - | UI 目录名 | `ui` |
| `desktop_applaunchname` | - | 桌面启动项 | `<appname>.Application` |
| `disable_authorization_path` | - | 禁用目录授权 | `true` |

## 开发资源

- [飞牛开发者官网](https://developer.fnnas.com/)
- [fnpack 下载](https://static2.fnnas.com/fnpack/)
- [通用 CGI 网关集合](https://github.com/FNOSP/fnosAppCenterCgiCollection)
