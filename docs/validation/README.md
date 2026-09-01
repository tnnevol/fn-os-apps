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
feature: FNOS-001-10
acceptance: FNOS-001-10-AC-01
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

当前 FNOS-001 的真实 NAS 记录应按功能 ID 分开，完成后回写对应需求和计划状态。

## 当前记录

- [FNOS-002 NAS 浏览器验收记录（2026-09-01）](/validation/FNOS-002-nas-2026-09-01)
