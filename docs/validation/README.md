---
title: 真实环境验收记录
description: fnOS Apps 的 NAS、FPK、安装升级和发布环境验收记录规范。
---

# 真实环境验收记录

本目录保存真实 fnOS NAS、FPK 安装升级和发布环境的验收证据。它不是测试用例目录，也不能用本地构建结果替代目标环境结论。

## 记录模板

复制以下字段创建 `<功能 ID>-<环境>-YYYY-MM-DD.md`：

```yaml
---
feature: FNOS-001-01
acceptance: FNOS-001-01-AC-01
environment: fnOS NAS
fnosVersion: <版本>
appVersion: <FPK 版本>
pluginVersion: <插件版本>
verifiedAt: YYYY-MM-DD
status: passed|failed|blocked
---
```

正文至少记录：

1. 设备架构、用户角色、安装/升级方式和前置配置；
2. 操作步骤、预期结果和实际结果；
3. 日志、截图、失败复现或外部链接；
4. 遗留问题、回滚方式和下一步；
5. 验收人和最终结论。

同一需求的真实 NAS 记录按功能 ID 分开，完成后回写对应需求和计划状态。

## 验证通道

设备端结论有两个可互换的通道，**判定口径不因通道而变**：

| 通道 | 工具 | 说明 |
| --- | --- | --- |
| 设备端 CLI | `appcenter-cli` | 需要目标设备侧 RPC 权限；权限不足时启动即 panic，须记为「阻塞」并附原样错误输出 |
| Web UI 自动化 | Midscene（`@midscene/web`，Bridge 模式） | 复用用户已登录的 Chrome，在 fnOS Web UI 完成安装、启停、卸载与入口验证 |

走 UI 通道时，记录里必须写清：动作序列（点了什么、期望看到什么）、**观察到的界面文案**
（如应用中心按钮显示「打开」还是「启用」、入口实际地址、卸载向导的选项）、以及截图文件路径。
截图留在仓库外的临时目录，**不提交**；记录里以文字结论为准。

## 当前记录

| 记录 | 环境 | 状态 | 说明 |
| --- | --- | --- | --- |
| [FNOS-001 真实环境验收记录（2026-10-09）](/validation/FNOS-001-fnos-nas-2026-10-09) | fnOS NAS（目标设备） | 阻塞 | 阶段一（清单与规约）的本地核对部分已执行；设备端用例因 `appcenter-cli` 权限阻塞未执行 |
| [FNOS-001 真实环境验收记录（fnos-mi，2026-10-20）](/validation/FNOS-001-fnos-mi-2026-10-20) | fnOS NAS（目标测试设备） | 部分通过 | 改走 Midscene Web UI 通道，完成 `fn-it-tools` 安装与入口验证、端口占用场景与卸载向导验证 |


用例定义见 [FNOS-001 1Panel 应用转换测试用例](/testing/FNOS-001-test-cases)。
