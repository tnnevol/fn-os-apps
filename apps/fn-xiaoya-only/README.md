# fn-xiaoya-only · 小雅

飞牛 fnOS 应用包 —— [小雅 Alist](https://github.com/NAKION/xiaoya) 网盘工具。

## 应用信息

| 字段 | 值 |
|------|-----|
| 应用标识 | `fn-xiaoya-only` |
| 版本 | `1.0.0` |
| 显示名称 | 小雅 |
| 服务端口 | `5344` |
| 架构 | `x86_64` |
| 最低 fnOS 版本 | `0.9.27` |
| 上游项目 | https://github.com/NAKION/xiaoya |

## 功能

- 多网盘聚合挂载（阿里云盘、夸克、115 等）
- 在线播放音视频
- WebDAV 文件管理
- 目录列表索引

## 项目结构

```
fn-xiaoya-only/
├── manifest                           # 应用清单
├── ICON.PNG / ICON_256.PNG            # 应用包图标
├── app/
│   ├── docker/
│   │   └── docker-compose.yaml        # Docker 编排文件
│   └── ui/
│       ├── config                     # 桌面入口配置
│       └── images/                    # 桌面图标
│           ├── icon_64.png
│           └── icon_256.png
├── cmd/
│   ├── main                           # 生命周期（启停/状态）
│   ├── install_init / install_callback    # 安装初始化
│   ├── uninstall_init / uninstall_callback  # 卸载回调
│   ├── upgrade_init / upgrade_callback      # 升级回调
│   └── config_init / config_callback        # 配置回调
├── config/
│   ├── privilege                      # 权限配置
│   └── resource                       # 资源配置
└── wizard/
    ├── install                        # 安装向导
    └── config                         # 配置向导
```

## Docker 配置

容器基于 `xiaoyaliu/alist:latest` 镜像运行：

```yaml
image: xiaoyaliu/alist:latest
ports:
  - "5344:8080"
volumes:
  - ${TRIM_PKGVAR}/data:/data       # 数据目录
  - ${TRIM_PKGVAR}/config:/config   # 配置目录
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PUID` | `0` | 运行用户 ID |
| `PGID` | `0` | 运行用户组 ID |
| `UMASK` | `022` | 文件权限掩码 |

## 本地开发

```bash
# 在 fnOS 设备上，进入应用目录快速安装测试
cd apps/fn-xiaoya-only
appcenter-cli install-local

# 查看日志
cat /var/apps/fn-xiaoya-only/var/info.log

# 管理
appcenter-cli start fn-xiaoya-only
appcenter-cli stop fn-xiaoya-only
```

## 打包

```bash
fnpack build
# 生成 fn-xiaoya-only.fpk
```
