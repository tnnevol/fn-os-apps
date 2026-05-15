# fn-reader · 阅读

飞牛 fnOS 应用包 —— [reader](https://github.com/hectorqin/reader) 在线电子书阅读器。

## 应用信息

| 字段 | 值 |
|------|-----|
| 应用标识 | `fn-reader` |
| 版本 | `3.2.13` |
| 显示名称 | 阅读 |
| 服务端口 | `4396` |
| 架构 | `x86_64` |
| 最低 fnOS 版本 | `0.9.27` |
| 上游项目 | https://github.com/hectorqin/reader |

## 功能

- 多格式电子书阅读（EPUB、PDF、TXT 等）
- 书架管理与阅读进度同步
- 全文搜索
- 阅读主题定制
- 多用户支持

## 项目结构

```
fn-reader/
├── manifest                           # 应用清单
├── ICON.PNG / ICON_256.PNG            # 应用包图标
├── logo.png                           # 应用 Logo
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
└── wizard/
    ├── install                        # 安装向导
    ├── config                         # 配置向导
    └── (uninstall)                    # 卸载向导
```

## Docker 配置

容器基于 `hectorqin/reader:latest` 镜像运行，关键配置：

```yaml
image: hectorqin/reader:latest
ports:
  - "4396:8080"    # 将容器 8080 端口映射到 fnOS 服务端口 4396
volumes:
  - ${TRIM_PKGVAR}/storage:/storage   # 数据持久化
  - ${TRIM_PKGVAR}/logs:/logs         # 日志持久化
```

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `SPRING_PROFILES_ACTIVE` | `prod` | Spring 运行配置 |
| `READER_APP_USERLIMIT` | `20` | 用户数量上限 |
| `READER_APP_USERBOOKLIMIT` | `200000` | 用户书架上限 |
| `READER_APP_CACHECHAPTERCONTENT` | `true` | 缓存章节内容 |
| `READER_APP_SECURE` | `true` | 启用安全模式 |
| `READER_APP_SECUREKEY` | - | 安全密钥 |

## 本地开发

```bash
# 在 fnOS 设备上，进入应用目录快速安装测试
cd apps/fn-reader
appcenter-cli install-local

# 查看日志
cat /var/apps/fn-reader/var/info.log

# 管理
appcenter-cli start fn-reader
appcenter-cli stop fn-reader
```

## 打包

```bash
fnpack build
# 生成 fn-reader.fpk
```
