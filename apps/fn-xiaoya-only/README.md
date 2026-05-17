# fn-xiaoya-only · 小雅

飞牛 fnOS 应用包 —— [小雅 Alist](https://github.com/xiaoyaLL/xiaoya) 网盘工具。

## 应用信息

| 字段 | 值 |
|------|-----|
| 应用标识 | `fn-xiaoya-only` |
| 版本 | `1.1.0` |
| 显示名称 | 小雅 |
| 桌面入口 | 小雅（5678）、小雅 Emby（2345） |
| 架构 | `x86_64` |
| 最低 fnOS 版本 | `0.9.27` |
| 上游项目 | https://github.com/xiaoyaLL/xiaoya |

## 功能

- 多网盘聚合挂载（阿里云盘、夸克、115 等）
- 在线播放音视频
- WebDAV 文件管理
- 目录列表索引
- Emby 媒体服务

## 项目结构

```
fn-xiaoya-only/
├── manifest                           # 应用清单
├── ICON.PNG / ICON_256.PNG            # 小雅应用包图标
├── icon_emby_256.png                  # Emby 入口图标
├── app/
│   ├── docker/
│   │   └── docker-compose.yaml        # Docker 编排文件
│   └── ui/
│       ├── config                     # 桌面入口配置
│       └── images/                    # 桌面图标
│           ├── icon_64.png
│           ├── icon_256.png
│           ├── icon_emby_64.png
│           └── icon_emby_256.png
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
    └── install                        # 安装向导
```

## Docker 配置

包含三个服务：

```yaml
services:
  xiaoya:
    image: xiaoyaliu/alist:latest
    container_name: xiaoya
    ports:
      - "5678:80"
      - "2345:2345"
      - "2346:2346"
      - "2347:2347"
    volumes:
      - ${TRIM_PKGVAR}/alist/data:/data
      - ${TRIM_PKGVAR}/alist/opt/alist/data:/opt/alist/data
      - ${TRIM_PKGVAR}/alist/www/data:/www/data

  xiaoya-aliyuntvtoken_connector:
    image: ddsderek/xiaoya-glue:aliyuntvtoken_connector
    container_name: xiaoya-aliyuntvtoken_connector

  115cleaner:
    image: ddsderek/xiaoya-115cleaner:latest
    container_name: xiaoya-115cleaner
```

### 向导配置项

安装时用户需填写：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `xiaoya_pass` | password | 是 | 小雅访问密码 |
| `pan115_cookie` | text | 否 | 115网盘 Cookie |
| `pan115_key` | password | 否 | 115删除转存密码 |
| `ali_cookie` | text | 否 | 阿里云盘 Cookie |
| `quark_cookie` | text | 否 | 夸克网盘 Cookie |
| `emby_media_path` | text | 否 | Emby 媒体路径 |

安装向导会将这些值写入 `${TRIM_PKGVAR}/alist/data/` 下的配置文件。

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
cd apps/fn-xiaoya-only
fnpack build
# 生成 fn-xiaoya-only.fpk
```
