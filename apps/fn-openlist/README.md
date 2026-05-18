# fn-openlist · OpenList

飞牛 fnOS 应用包 —— [OpenList](https://github.com/OpenListTeam/OpenList) 文件列表管理工具的 Native 版本。

## 应用信息

| 字段 | 值 |
|------|-----|
| 应用标识 | `fn-openlist` |
| 版本 | `4.0.0` |
| 显示名称 | OpenList |
| 桌面入口 | OpenList（5244）、OpenList 管理（5245） |
| 架构 | `x86_64` |
| 最低 fnOS 版本 | `0.9.27` |
| 上游项目 | https://github.com/OpenListTeam/OpenList |

## 功能

- 多云存储协议文件浏览与管理
- 文件在线预览与操作
- OpenList 管理面板（版本升级、进程控制、日志查看）

## 项目结构

```
fn-openlist/
├── manifest                               # 应用清单
├── ICON.PNG / ICON_256.PNG                # 应用包图标
├── app/
│   ├── server/
│   │   └── openlist-manager               # Go 管理面板二进制（编译产物）
│   └── ui/
│       ├── config                         # 桌面入口配置（双入口）
│       └── images/                        # 桌面图标
│           ├── icon_64.png
│           └── icon_256.png
├── cmd/
│   ├── main                               # 生命周期（启停/状态）
│   ├── install_init / install_callback    # 安装初始化（下载 OpenList 二进制）
│   ├── uninstall_init / uninstall_callback# 卸载回调
│   ├── upgrade_init / upgrade_callback    # 升级回调
│   └── config_init / config_callback      # 配置回调
├── config/
│   ├── privilege                          # 权限配置
│   └── resource                           # 资源配置（data-share）
├── openlist-manager/                      # Go 管理面板源码
│   ├── main.go                            # HTTP 路由
│   ├── go.mod
│   ├── templates/index.html               # 管理页面
│   └── openlist/
│       ├── config.go                      # 路径配置
│       ├── process.go                     # 进程管理（Start/Stop/Restart/Version）
│       └── upgrade.go                     # 版本升级
└── wizard/
    ├── install                            # 安装向导
    └── uninstall                          # 卸载向导
```

## 架构说明

本应用为 **Native 类型**（非 Docker），包含两个进程：

| 进程 | 端口 | 说明 |
|------|------|------|
| `openlist` | 5244 | OpenList 主服务，启动时自动从 GitHub 下载最新版 |
| `openlist-manager` | 5245 | Go 管理面板，用于版本升级、进程重启、日志查看 |

安装流程：`install_init` 通过 curl 下载 OpenList 最新二进制 → 将内置的 `openlist-manager` 复制到 server 目录 → 启动时通过 `cmd/main` 同时拉起两个进程。

数据目录通过 `--data` 参数指向飞牛应用共享数据目录。

## 本地开发

### 管理面板开发

```bash
# 进入管理面板源码目录
cd apps/fn-openlist/openlist-manager

# 本地编译（macOS）
go build -o out/openlist-manager .

# 交叉编译（Linux amd64，部署到飞牛设备）
GOOS=linux GOARCH=amd64 go build -o ../app/server/openlist-manager .
```

### 在 fnOS 设备上测试

```bash
# 在 fnOS 设备上，进入应用目录快速安装测试
cd apps/fn-openlist
appcenter-cli install-local

# 查看日志
cat /var/apps/fn-openlist/var/info.log

# 管理
appcenter-cli start fn-openlist
appcenter-cli stop fn-openlist
```

## 打包

```bash
cd apps/fn-openlist

# 先编译管理面板二进制
cd openlist-manager
GOOS=linux GOARCH=amd64 go build -o ../app/server/openlist-manager .
cd ..

# 打包
fnpack build
# 生成 fn-openlist.fpk
```
