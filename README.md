# fnOS Apps

飞牛 fnOS 应用 Monorepo，包含上架到 fnOS 应用商店的第三方应用打包。

## 项目结构

```
.
├── apps/
│   └── fn-reader/                  # 阅读 - 在线电子书阅读器
│       ├── manifest                # 应用清单
│       ├── ICON.PNG / ICON_256.PNG # 应用包图标
│       ├── logo.png                # 应用 Logo
│       └── fn-reader.fpk           # 打包产物（已忽略）
├── .gitignore
└── README.md
```

## 已上架应用

| 应用 | 显示名称 | 版本 | 说明 |
|------|----------|------|------|
| [fn-reader](apps/fn-reader/) | 阅读 | 3.2.13 | 开源在线电子书阅读器，支持多种格式、书架管理、阅读进度同步、全文搜索、主题定制 |

## 快速开始：创建新应用

### 1. 环境准备

- **系统**: fnOS 0.9.27 及以上（[官网下载](https://www.fnnas.com/download?key=fnos)）
- **架构**: x86_64 (AMD64)
- **技术栈**: Node.js / Python / Java / Go / HTML+JS+CSS 等
- **fnpack 工具**: 下载 [对应平台二进制](https://static2.fnnas.com/fnpack/) 放到 PATH

```bash
# macOS Apple Silicon
chmod +x fnpack-1.2.1-darwin-arm64
sudo mv fnpack-1.2.1-darwin-arm64 /usr/local/bin/fnpack
```

### 2. 创建应用

```bash
# Native 应用（自带 UI）
fnpack create <appname>

# 纯服务（无 UI 入口）
fnpack create <appname> --without-ui true

# Docker 应用
fnpack create <appname> --template docker

# Docker 应用（无 UI 入口）
fnpack create <appname> --template docker --without-ui true
```

生成的目录结构：

```
<appname>/
├── app/                            # 应用可执行文件
│   ├── ui/                         # 应用入口及视图
│   │   ├── config                  # 入口配置（JSON）
│   │   └── images/                 # 图标（icon_64.png, icon_256.png）
│   ├── www/                        # Web 资源（Native 应用）
│   └── docker/                     # Docker Compose（Docker 应用）
│       └── docker-compose.yaml
├── cmd/                            # 生命周期管理脚本
│   ├── main                        # 启动/停止/状态
│   ├── install_init/callback       # 安装初始化/回调
│   ├── uninstall_init/callback     # 卸载初始化/回调
│   ├── upgrade_init/callback       # 升级初始化/回调
│   └── config_init/callback        # 配置初始化/回调
├── config/
│   ├── privilege                   # 权限配置（JSON）
│   └── resource                    # 资源配置（JSON）
├── wizard/                         # 应用向导（安装/卸载/配置引导）
│   ├── install/
│   ├── uninstall/
│   └── config/
├── manifest                        # 应用基本信息
├── ICON.PNG                        # 包图标 64x64
└── ICON_256.PNG                    # 包图标 256x256
```

### 3. 编写 manifest

```ini
appname               = <appname>
version               = 1.0.0
display_name          = 应用显示名称
desc                  = 应用描述
arch                  = x86_64
source                = thirdparty
maintainer            = 原始维护者
maintainer_url        = https://github.com/xxx
distributor           = 分发者
distributor_url       = https://github.com/xxx
desktop_uidir         = ui
desktop_applaunchname = <appname>.Application
```

### 4. 配置应用入口（Native 应用）

`app/ui/config`：

```json
{
    ".url": {
        "<appname>.Application": {
            "title": "应用名称",
            "icon": "images/icon-{0}.png",
            "type": "iframe",
            "protocol": "http",
            "url": "/cgi/ThirdParty/<appname>/index.cgi/",
            "allUsers": true
        }
    }
}
```

### 5. 配置应用权限

`config/privilege`：

```json
{
    "defaults": {
        "run-as": "package"
    },
    "username": "<appname>",
    "groupname": "<appname>"
}
```

### 6. 编写生命周期脚本（cmd/main）

```bash
#!/bin/bash

case $1 in
start)
    # 启动应用，成功返回 0
    exit 0
    ;;
stop)
    # 停止应用，成功返回 0
    exit 0
    ;;
status)
    # 检查状态，运行中返回 0，未运行返回 3
    exit 0
    ;;
*)
    exit 1
    ;;
esac
```

### 7. 打包应用

```bash
cd <appname>
fnpack build
# 生成 <appname>.fpk
```

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
| `version` | 是 | 版本号，格式 `x[.y[.z]][-build]` | `3.2.13` |
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
- [iconfont 图标素材](https://www.iconfont.cn/)
