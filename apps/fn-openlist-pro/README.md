# fn-openlist · OpenList

飞牛 fnOS 应用包 —— [OpenList](https://github.com/OpenListTeam/OpenList) 文件列表管理工具的 Native 版本。

## 应用信息

| 字段 | 值 |
|------|-----|
| 应用标识 | `fn-openlist` |
| 版本 | `4.0.0` |
| 显示名称 | OpenList |
| 桌面入口 | OpenList（5244） |
| 架构 | `x86_64` |
| 最低 fnOS 版本 | `0.9.27` |
| 上游项目 | https://github.com/OpenListTeam/OpenList |

## 功能

- 多云存储协议文件浏览与管理
- 文件在线预览与操作

## 项目结构

```
fn-openlist/
├── manifest                               # 应用清单
├── ICON.PNG / ICON_256.PNG                # 应用包图标
├── app/
│   ├── bin/                               # OpenList 二进制目录（安装时自动下载）
│   └── ui/
│       ├── config                         # 桌面入口配置
│       └── images/                        # 桌面图标
│           ├── icon_64.png
│           └── icon_256.png
├── cmd/
│   ├── main                               # 生命周期（启停/状态）
│   ├── install_callback                   # 安装初始化（下载 OpenList 二进制）
│   ├── uninstall_init / uninstall_callback# 卸载回调
│   ├── upgrade_init / upgrade_callback    # 升级回调
│   └── config_init / config_callback      # 配置回调
├── config/
│   ├── privilege                          # 权限配置
│   └── resource                           # 资源配置（data-share）
└── wizard/
    ├── install                            # 安装向导
    └── uninstall                          # 卸载向导
```

## 架构说明

本应用为 **Native 类型**（非 Docker），安装时通过 `install_callback` 脚本从 GitHub 自动下载最新版 OpenList 二进制。

数据目录通过 `--data` 参数指向飞牛应用共享数据目录。

## 本地开发

### 在 fnOS 设备上测试

```bash
# 在 fnOS 设备上，进入应用目录快速安装测试
cd apps/fn-openlist
appcenter-cli install-local

# 管理
appcenter-cli start fn-openlist
appcenter-cli stop fn-openlist
```

## 打包

```bash
cd apps/fn-openlist

# 打包
fnpack build
# 生成 fn-openlist.fpk
```
