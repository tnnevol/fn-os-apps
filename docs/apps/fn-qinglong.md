<AppIcon name="fn-qinglong" alt="青龙图标" />

# 青龙

## 应用简介

青龙是定时任务管理平台，支持在线编写和运行 Python3、JavaScript、Shell 等脚本，并提供任务日志与环境变量管理。

## 主要能力

- 在线编写与运行 Python3、JavaScript、Shell 等脚本。
- 支持 cron 表达式定时调度与手动触发。
- 任务日志、环境变量与依赖管理。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-qinglong` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开，首次登录使用容器内的初始账号（详见上游文档），建议登录后立即修改密码。任务脚本与运行数据保存在目标 NAS 的应用数据目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/whyour/qinglong)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-qinglong)
