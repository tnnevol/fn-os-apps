# 生命周期脚本

Native FPK 通过 `cmd/` 下的脚本与 fnOS 应用中心对接。脚本运行在 fnOS 管理的生命周期环境中，不能把普通开发机上的执行结果当作真实安装验证。

## 脚本职责

| 脚本 | 触发阶段 | 应负责 | 不应负责 |
| --- | --- | --- | --- |
| `install_callback` | 安装完成后 | 创建目录、初始化配置、安装应用运行时依赖 | 代替应用长期运行 |
| `main` | 应用中心 start/stop/status | 启动、停止和检测应用进程 | 修改用户未确认的配置 |
| `upgrade_callback` | 升级过程中 | 迁移配置、补齐新目录、处理兼容版本 | 无条件删除用户数据 |
| `uninstall_callback` | 卸载过程中 | 按用户选择清理或保留数据 | 绕过向导直接删除数据 |

## 推荐目录关系

```text
apps/<appname>/
├── cmd/
│   ├── install_callback
│   ├── main
│   ├── upgrade_callback
│   └── uninstall_callback
├── config/
├── wizard/
└── manifest
```

不同应用形态可能不需要所有回调，但不能删除模板提供的文件来规避生命周期契约。无需处理的脚本应保持安全、可重复执行并返回成功。

## `main` 的命令接口

应用中心通常通过参数调用 `main`：

```bash
cmd/main start
cmd/main stop
cmd/main status
```

推荐将三个操作拆成独立函数，并确保状态检查不会产生启动副作用：

```bash
#!/usr/bin/env bash
set -euo pipefail

case "${1:-}" in
  start) start_process ;;
  stop) stop_process ;;
  status) status_process ;;
  *) echo "usage: $0 {start|stop|status}" >&2; exit 2 ;;
esac
```

`start` 应先判断已有进程，避免重复启动；`stop` 应先发送温和信号并在超时后清理；`status` 应使用 PID、进程探测或应用自身健康检查返回明确的退出码。PID 文件、锁和临时文件必须在异常路径清理。

## 环境变量和目录

只有 fnOS 执行对应生命周期阶段时，`TRIM_*` 目录和向导字段环境变量才可靠存在。常见目录用途如下：

| 类型 | 典型来源 | 用途 |
| --- | --- | --- |
| 应用安装目录 | `TRIM_APPDEST` | 二进制、静态资源和只读应用文件 |
| 包变量目录 | `TRIM_PKGVAR` | PID、运行时配置、升级保留数据 |
| 向导字段 | `wizard_*` | 由 `wizard/*` 收集的用户配置 |

脚本必须检查关键变量，使用绝对路径，并对空值和路径中的空格保持安全处理。用户数据布局应与 `config/resource` 的声明及卸载策略一致。

## 回调编写原则

- 使用 `set -euo pipefail`，但对允许失败的探测显式处理退出码。
- 重复执行不应破坏已有配置；初始化优先使用“存在则保留”的策略。
- 配置迁移先备份或写入临时文件，成功后再原子替换。
- 不在脚本和日志中输出密码、Token 或完整 DSN。
- 生命周期诊断优先写标准输出和标准错误，便于应用中心统一收集。
- 重要操作失败返回非零退出码，让 fnOS 感知失败并停止后续流程。
- 脚本不要依赖当前工作目录、个人路径或开发机上的全局命令。

## 安装、升级和卸载顺序

```text
安装：校验清单 → 准备目录 → 运行 install_callback → 启动 main
升级：停止旧进程 → 运行 upgrade_callback → 保留数据 → 启动新版本
卸载：读取用户选择 → 停止进程 → uninstall_callback → 清理或保留数据
```

升级脚本需要兼容旧版本实际存在的目录和字段；卸载脚本应区分“删除应用运行文件”和“删除用户数据”。涉及应用配置的变更，应同时更新 [用户向导](./wizard) 和 [Manifest 配置](./manifest)。

## 验证

本地可以做语法和打包检查：

```bash
bash -n apps/<appname>/cmd/*
cd apps/<appname>
fnpack build
```

真实行为必须在测试 NAS 完成：

```bash
appcenter-cli install-local
appcenter-cli start <appname>
appcenter-cli stop <appname>
```

至少覆盖首次安装、重复启动、停止超时、升级保留配置、卸载保留数据和卸载删除数据。

相关页面：

- [Manifest 配置](./manifest)
- [权限与入口](./permissions)
- [用户向导](./wizard)
- [开发环境与脚本](./environment-and-scripts)
