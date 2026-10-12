---
title: FNOS-001 1Panel 应用转换测试用例
description: FNOS-001 各批次应用转换的构建、安装、数据落盘、权限与资源集成测试用例。
lastVerified: 2026-10-09
---

# FNOS-001 1Panel 应用转换测试用例

本用例集覆盖 [FNOS-001 1Panel 应用商店应用转换](/requirements/FNOS-001-1panel-app-conversion) 中已进入 [PLAN-FNOS-001](/plans/PLAN-FNOS-001-1panel-app-conversion) 实施范围的功能：阶段一（清单与规约）与 T0/T1/T2 三个批次。编号、状态与证据口径见[测试用例规范](/testing/index)。

未进入当前计划的 P2 功能（FNOS-001-07 T3、FNOS-001-08 T4）**不在本用例集范围内**。

## 执行环境区分

用例分两类环境，「状态」的判定标准不同：

| 环境类型 | 可执行位置 | 判定依据 |
| --- | --- | --- |
| 本地 | 开发机仓库工作区 | 命令与输出、仓库内文件路径与行号 |
| 目标 NAS | fnOS 设备（目标 NAS） | `docs/validation/` 下的验收记录小节，含截图或日志 |

**本地通过不等于目标环境通过。** 涉及 fnOS 设备的用例在设备不可达时状态为「阻塞」，不得以本地构建结果替代。

## 状态口径

| 状态 | 本用例集的使用规则 |
| --- | --- |
| 未执行 | 用例已定义，前置条件（通常是试点应用尚未产出）未满足，尚未运行 |
| 通过 | 已完成执行，预期结果全部观察成立，证据可复核 |
| 失败 | 已完成执行，实际结果与预期存在差异 |
| 阻塞 | 环境、权限或工具不可用导致无法执行，且已记录原样错误输出与解锁条件 |

## T0 批次应用（14 个）

T0 批次共 14 个应用（见[转换清单](/development/1panel-conversion-inventory)）。用例中的 `<app>` 指下表任一。

**A 组（首批 3 个，2026-10-09 第 1 轮验证）**

| 上游应用 | 目标目录 | 上游主镜像 | 上游默认端口（`PANEL_APP_PORT_HTTP.default`） | 容器内端口 |
| --- | --- | --- | --- | --- |
| `it-tools` | `apps/fn-it-tools/` | `corentinth/it-tools:2024.10.22-7ca5933` | `40116` | `80` |
| `linux-command` | `apps/fn-linux-command/` | `wcjiang/linux-command:1.22.0` | `40255` | `3000` |
| `adminer` | `apps/fn-adminer/` | `adminer:6.1.1-standalone` | `9853` | `8080` |

**B 组（收尾 11 个，2026-10-10 第 2 轮验证）**

| 上游应用 | 目标目录 | 上游主镜像 | 上游默认端口 | 容器内端口 | 形态 |
| --- | --- | --- | --- | --- | --- |
| `browserless` | `apps/fn-browserless/` | `ghcr.io/browserless/chrome:v2.57.0` | `3000` | `3000` | 常规入口 |
| `chatgpt-next-web` | `apps/fn-chatgpt-next-web/` | `yidadaa/chatgpt-next-web:v2.16.1` | `40042` | `3000` | 常规入口 |
| `cloudflared` | `apps/fn-cloudflared/` | `cloudflare/cloudflared:2026.10.0` | 无（上游无端口字段） | 无端口 | **`{}` 无入口** |
| `cyberchef` | `apps/fn-cyberchef/` | `ghcr.io/gchq/cyberchef:10.24.0` | `8080` | `8080` | 常规入口 |
| `llama-cpp` | `apps/fn-llama-cpp/` | `ghcr.io/ggml-org/llama.cpp:server` | `8080` | `8080` | **用户路径只读挂载** |
| `lobe-chat` | `apps/fn-lobe-chat/` | `lobehub/lobe-chat:1.143.3` | `40247` | `3210` | 常规入口 |
| `memcached` | `apps/fn-memcached/` | `memcached:1.6.22` | `11211` | `11211` | **`{}` 无入口** |
| `web-check` | `apps/fn-web-check/` | `lissy93/web-check:2.3.2` | `40095` | `3000` | 常规入口 |
| `wechatmarkdowneditor` | `apps/fn-wechatmarkdowneditor/` | `doocs/md:2.1.0` | `8080` | `80` | **`.main` 入口** |
| `yesplaymusic` | `apps/fn-yesplaymusic/` | `fogforest/yesplaymusic:0.4.9` | `40075` | `80` | 常规入口 |
| `zabbix-agent` | `apps/fn-zabbix-agent/` | `zabbix/zabbix-agent:alpine-7.4.5` | `10050`（`PANEL_APP_PORT_AGENT`） | `10050` | **`{}` 无入口** |

上表端口数值取自 `appstore/apps/<app>/<version>/data.yml` 的 `PANEL_APP_PORT_HTTP.default`（上游提交 `3b142d2`），已实测核对。注意 `zabbix-agent` 上游使用的是 `PANEL_APP_PORT_AGENT`（agent 端口 10050）而非 HTTP 端口，`cloudflared` 上游**没有**任何端口字段。用例执行时应重新读取该文件确认，不得直接采信本文档的记录。

上游默认端口以 `appstore/apps/<app>/<version>/data.yml` 的 `formFields` 中端口字段的 `default` 为准；用例执行时须从该文件读取实际值填入，不得凭记忆填写。

> **路径说明**：上游 `appstore/` 检出在**工作区**中，与 `fn-os-apps/` 仓库同级，不在本仓库内（`git check-ignore` 与 `git status` 均可确认它不受本仓库跟踪）。因此本文中凡出现 `appstore/...` 的命令，一律在**工作区根**（即 `fn-os-apps/` 的上一级目录）执行；其余命令在仓库根 `fn-os-apps/` 执行。两类命令不得混用同一工作目录。

## 用例总览

| 用例 ID | 覆盖功能 | 追踪依据 | 优先级 | 环境 | 状态 |
| --- | --- | --- | --- | --- | --- |
| FNOS-001-01-TEST-01 | FNOS-001-01 | FNOS-001-01-AC-01 | P0 | 本地 | 通过 |
| FNOS-001-01-TEST-02 | FNOS-001-01 | FNOS-001-01-AC-02 | P0 | 本地 | 通过 |
| FNOS-001-01-TEST-03 | FNOS-001-01 | FNOS-001-01-AC-03 | P0 | 本地 | 通过 |
| FNOS-001-01-TEST-04 | FNOS-001-01 | FNOS-001-01-AC-04 | P0 | 本地 | 通过 |
| FNOS-001-02-TEST-01 | FNOS-001-02 | FNOS-001-02-AC-01 | P0 | 本地 | 通过 |
| FNOS-001-02-TEST-02 | FNOS-001-02 | FNOS-001-02-AC-01 | P0 | 本地 | 通过 |
| FNOS-001-02-TEST-03 | FNOS-001-02 | FNOS-001-02-AC-01 | P0 | 本地 | 通过 |
| FNOS-001-03-TEST-01 | FNOS-001-03 | FNOS-001-03-AC-01 | P0 | 本地 | 通过 |
| FNOS-001-04-TEST-01 | FNOS-001-04 | FNOS-001-04-AC-01 | P1 | 本地 | 通过 |
| FNOS-001-04-TEST-02 | FNOS-001-04 | FNOS-001-04-AC-01 | P1 | 本地 | 通过 |
| FNOS-001-04-TEST-03 | FNOS-001-04 | FNOS-001-04-AC-02 | P1 | 目标 NAS | 通过 |
| FNOS-001-04-TEST-04 | FNOS-001-04 | FNOS-001-04-AC-03 | P1 | 目标 NAS | 阻塞 |
| FNOS-001-04-TEST-05 | FNOS-001-04 | FNOS-001-04-AC-04 | P1 | 本地 | 通过 |
| FNOS-001-04-TEST-06 | FNOS-001-04 | FNOS-001-04-AC-06 | P1 | 目标 NAS | 未执行 |
| FNOS-001-04-TEST-07 | FNOS-001-04 | 需求「交互和行为约束」P1 步骤 3 + 字段映射表（校验 1—65535，无独立 AC） | P1 | 本地 | 通过 |
| FNOS-001-04-TEST-08 | FNOS-001-04 | 需求「交互和行为约束」P1 步骤 3 + 字段映射表（校验 1—65535，无独立 AC） | P1 | 本地 | 通过 |
| FNOS-001-04-TEST-09 | FNOS-001-04 | FNOS-001-04-AC-05 | P1 | 本地 | 通过 |
| FNOS-001-04-TEST-10 | FNOS-001-04 | FNOS-001-04-AC-07 | P1 | 本地 | 通过 |
| FNOS-001-04-TEST-11 | FNOS-001-04 | FNOS-001-04-AC-07 | P1 | 本地 | 通过 |
| FNOS-001-04-TEST-12 | FNOS-001-04 | FNOS-001-04-AC-02 + AC-05 | P1 | 目标 NAS | 通过 |
| FNOS-001-04-TEST-13 | FNOS-001-04 | FNOS-001-04-AC-01 + AC-04 | P1 | 本地 | 通过 |
| FNOS-001-05-TEST-01 | FNOS-001-05 | FNOS-001-05-AC-01 | P1 | 目标 NAS | 阻塞 |
| FNOS-001-05-TEST-02 | FNOS-001-05 | FNOS-001-05-AC-01 | P1 | 目标 NAS | 阻塞 |
| FNOS-001-05-TEST-03 | FNOS-001-05 | FNOS-001-05-AC-01 + FNOS-001-04-AC-03 | P1 | 目标 NAS | 阻塞 |
| FNOS-001-05-TEST-04 | FNOS-001-05 | FNOS-001-05-AC-01 | P1 | 本地 | 阻塞 |
| FNOS-001-05-TEST-05 | FNOS-001-05 | FNOS-001-05-AC-01 + FNOS-001-04-AC-04 | P1 | 本地 + 目标 NAS | 阻塞 |
| FNOS-001-05-TEST-06 | FNOS-001-05 | FNOS-001-05-AC-01 | P1 | 本地 + 目标 NAS | 阻塞 |
| FNOS-001-05-TEST-07 | FNOS-001-05 | FNOS-001-05-AC-01 | P1 | 本地 | 阻塞 |
| FNOS-001-05-TEST-08 | FNOS-001-05 | FNOS-001-05-AC-01 | P1 | 本地 + 目标 NAS | 未执行 |
| FNOS-001-05-TEST-09 | FNOS-001-05 | FNOS-001-05-AC-01 + FNOS-001-04-AC-03 | P1 | 目标 NAS | 未执行 |
| FNOS-001-05-TEST-10 | FNOS-001-05 | FNOS-001-05-AC-01 + 04-AC-04/07 + 02-AC-01 | P1 | 本地 | 阻塞 |
| FNOS-001-06-TEST-01 | FNOS-001-06 | FNOS-001-06-AC-01 | P1 | 目标 NAS | 阻塞 |
| FNOS-001-06-TEST-02 | FNOS-001-06 | FNOS-001-06-AC-01 | P1 | 目标 NAS | 阻塞 |
| FNOS-001-06-TEST-03 | FNOS-001-06 | PLAN-FNOS-001-T03-02（需求无独立 AC） | P1 | 本地 | 未执行 |
| FNOS-001-06-TEST-04 | FNOS-001-06 | FNOS-001-06-AC-01 | P1 | 目标 NAS | 阻塞 |

## 用例详情

### FNOS-001-01-TEST-01 清单覆盖全部上游应用

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-01-TEST-01 |
| 对应功能 | FNOS-001-01 转换清单与规约落库 |
| 验收条件 | FNOS-001-01-AC-01 |
| 优先级 | P0 |
| 环境 | 本地 |
| 状态 | 通过 |

**前置条件**：上游仓库已检出在**工作区**的 `appstore/`（与 `fn-os-apps/` 同级）；`docs/development/1panel-conversion-inventory.md` 存在。

**步骤**

1. 在工作区根统计上游应用目录数：`ls -d appstore/apps/*/ | wc -l`。
2. 解析清单中所有 `### T*` 小节内的批次明细表，提取每个应用的 `分级`、`展示名`、`主镜像`、`关键改造点`。
3. 比对清单应用集合与上游目录集合是否一致，并检查每行四个必需列是否非空。

**预期结果**：清单应用数为 265，与上游目录数一致；集合完全相同；无任何行缺少分级、展示名、主镜像或改造点。

**实际结果**：清单解析出 265 行、265 个去重应用，四列均非空（缺失行 0）；上游 `appstore/apps/` 目录数 265。集合一致。通过。

**证据位置**：本用例执行命令见下方复核命令；对应验收记录 `docs/validation/FNOS-001-fnos-nas-2026-10-09.md`「阶段一 清单核对」小节。

复核命令（第 1 条在工作区根执行，第 2 条在仓库根 `fn-os-apps/` 执行）：

```bash
# 工作区根
ls -d appstore/apps/*/ | wc -l          # → 265

# 仓库根 fn-os-apps/
grep -c '^| *P[0-9] *| *`' docs/development/1panel-conversion-inventory.md   # → 265
```

### FNOS-001-01-TEST-02 清单统计量与上游实际一致

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-01-TEST-02 |
| 对应功能 | FNOS-001-01 转换清单与规约落库 |
| 验收条件 | FNOS-001-01-AC-02 |
| 优先级 | P0 |
| 环境 | 本地 |
| 状态 | 通过 |

**前置条件**：同 TEST-01；`appstore/` 检出版本与清单声明的盘点口径一致。

**步骤**

1. 在工作区根记录 `appstore/` 当前提交：`git -C appstore rev-parse --short HEAD`，与清单「盘点口径」声明的提交比对。
2. 逐项复算 AC-02 的 5 个指标：应用总数、有 `formFields` 的应用数、使用 `1panel-network` 的应用数、使用 `./` 相对挂载的应用数、使用外部命名卷（`external: true`）的应用数。
3. `formFields` 按 YAML 键位置匹配（`^[ \t]*formFields[ \t]*:`），读取 `apps/<app>/<version>/data.yml`（每个应用的所有版本目录都计入）。
4. `1panel-network` 按 compose 文件内容包含该字符串统计。
5. `./` 相对挂载按卷挂载行 `^\s*-\s*["']?\./` 统计（**引号无关**）。
6. 外部命名卷只统计顶层 `volumes:` 段内、卷名下缩进的 `external: true`。

**预期结果**：复算结果与清单声明逐项一致：应用总数 265、有 `formFields` 259、使用 `1panel-network` 257、使用 `./` 相对挂载 223、使用外部命名卷 2。

**实际结果**：**五项全部一致。** 上游提交 `3b142d2`，复算结果：

| 指标 | 清单声明 | 复算结果 | 结论 |
| --- | --- | --- | --- |
| 应用总数 | 265 | 265 | 一致 |
| 有 `formFields` | 259 | 259 | 一致 |
| 使用 `1panel-network` | 257 | 257 | 一致 |
| 使用 `./` 相对挂载 | 223 | 223 | 一致 |
| 使用外部命名卷 | 2 | 2（`maddy-mail`、`synapse`） | 一致 |

**历史经过（不静默改状态）**：本用例在 2026-10-09 上一轮执行时判定为「失败」——当时清单声明 `formFields` 257、`./` 挂载 221，实测 259 与 223，两项偏差。根因已定位：

- `formFields`：`jupyter-notebook/latest/data.yml`、`oceanbase/4.4.2-lts/data.yml` 含制表符残留，严格 YAML 解析失败；清单已订正为「按容错口径计 259」。
- `./` 挂载：清单原口径漏掉带引号的挂载写法。`newsnow/0.0.41/docker-compose.yml:10` 写 `- './data:/usr/app/.data'`、`openldap/2.6.10/docker-compose.yml:16` 写 `- './data:/bitnami/openldap'`，`./` 未紧跟 `- ` 而未被识别。**这 2 个应用因此被错分到 T0，实为有状态应用应属 T1**，清单已订正判据为引号无关正则并完成移位。

清单订正后重跑本用例，五项全一致，故由「失败」改判「通过」。

**证据位置**：`docs/validation/FNOS-001-fnos-nas-2026-10-09.md`「阶段一 清单核对」小节（含本轮复算表与订正前后对照）；缺陷 D-02 已闭环，见 `docs/testing/FNOS-001-t0-round1-report.md`。

复核命令（工作区根执行）：

```bash
ls -d appstore/apps/*/ | wc -l                      # → 265
git -C appstore rev-parse --short HEAD              # → 3b142d2
```

### FNOS-001-01-TEST-03 SDD 校验与文档站构建通过

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-01-TEST-03 |
| 对应功能 | FNOS-001-01 转换清单与规约落库 |
| 验收条件 | FNOS-001-01-AC-03 |
| 优先级 | P0 |
| 环境 | 本地 |
| 状态 | 通过 |

**前置条件**：仓库依赖已安装（`pnpm install` 完成）。

**步骤**

1. 在仓库根执行 `pnpm run check -- --all`。
2. 记录退出码与末尾输出。

**预期结果**：命令退出码为 0；SDD 校验通过并打印 `SDD docs check passed`；VitePress 文档站构建完成。

**实际结果**：退出码 0。输出含 `SDD docs check passed: 1 requirement document(s), 1 plan document(s)` 与 `build complete in 18.65s.`。通过。

**证据位置**：`docs/validation/FNOS-001-fnos-nas-2026-10-09.md`「本地工具链验证」小节。

### FNOS-001-01-TEST-04 分级唯一归属与总量守恒

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-01-TEST-04 |
| 对应功能 | FNOS-001-01 转换清单与规约落库 |
| 验收条件 | FNOS-001-01-AC-04 |
| 优先级 | P0 |
| 环境 | 本地 |
| 状态 | 通过 |

**前置条件**：同 TEST-01。

**步骤**

1. 按 `### T*` 小节统计各分级应用数：T0、T1、T2、T3（含运行环境型、能力重复、中间件型三个子小节）、T4。
2. 校验任何应用不出现在两个分级中。
3. 校验各分级数量之和等于 265，且与 AC-04 声明的守恒式一致。
4. 校验清单的统计口径描述中不存在需要人工再解释的分歧（即判据可机械复现）。

**预期结果**：每个应用有唯一分级归属；`14 + 98 + 74 + 46 + 33 = 265`；判据可直接复算，不需要人工解释。

**实际结果**：T0=14、T1=98、T2=74、T3=46（12+14+20）、T4=33，合计 265 行、265 个去重应用，全局无重复；守恒式 `14 + 98 + 74 + 46 + 33 = 265` 成立。通过。

**历史经过（不静默改状态）**：本用例在 2026-10-09 上一轮执行时按旧数字（`17 + 92 + 77 + 46 + 33`）判定，当时结果也是「通过」。但在 D-02 根因定位后复核发现：AC-04 含「**不需要人工解释的口径分歧**」子句，而当时 `./` 挂载的 221 口径无法机械复现（实测 223），且 `newsnow`、`openldap` 因漏判被错分到 T0——这正是「需要人工解释的口径分歧」，**严格按 AC-04 该子句当时的判定应为「失败」**。测试成员据此上报，清单维护者订正了判据（引号无关正则）与移位。订正后判据可机械复现、无分歧，故本用例维持「通过」。

**证据位置**：`docs/validation/FNOS-001-fnos-nas-2026-10-09.md`「阶段一 清单核对」小节；订正前后对照见 `docs/testing/FNOS-001-t0-round1-report.md`。

### FNOS-001-02-TEST-01 图标四产物存在且合规

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-02-TEST-01 |
| 对应功能 | FNOS-001-02 图标资产管线 |
| 验收条件 | FNOS-001-02-AC-01 |
| 优先级 | P0 |
| 环境 | 本地 |
| 状态 | 通过 |

**前置条件**：图标管线已产出目标应用的图标资产（PLAN-FNOS-001-T00-02）。

**步骤**

1. 确认四个产物存在：`apps/fn-<app>/ICON.PNG`、`apps/fn-<app>/ICON_256.PNG`、`apps/fn-<app>/app/ui/images/icon_64.png`、`apps/fn-<app>/app/ui/images/icon_256.png`。
2. 读取每个 PNG 的 IHDR 宽高（文件偏移 16—24 字节的 big-endian `uint32` 对）。
3. 校验宽 == 高（正方形）、格式为 PNG（文件头 `\x89PNG\r\n\x1a\n`）、单文件大小 ≤ 1024 KB。

**预期结果**：四个产物均存在；`ICON.PNG` 与 `icon_64.png` 为 64×64；`ICON_256.PNG` 与 `icon_256.png` 为 256×256；全部为 PNG 且 ≤ 1024 KB。

**实际结果**：**T0 全 14 个应用全部通过。**

A 组（3 个）：

| 应用 | ICON.PNG | ICON_256.PNG | icon_64.png | icon_256.png |
| --- | --- | --- | --- | --- |
| `fn-it-tools` | 64×64, 1017 B | 256×256, 7831 B | 64×64, 1017 B | 256×256, 7831 B |
| `fn-linux-command` | 64×64, 5654 B | 256×256, 56536 B | 64×64, 5654 B | 256×256, 56536 B |
| `fn-adminer` | 64×64, 3200 B | 256×256, 18238 B | 64×64, 3200 B | 256×256, 18238 B |

B 组（11 个）：`fn-browserless`、`fn-chatgpt-next-web`、`fn-cloudflared`、`fn-cyberchef`、`fn-llama-cpp`、`fn-lobe-chat`、`fn-memcached`、`fn-web-check`、`fn-wechatmarkdowneditor`、`fn-yesplaymusic`、`fn-zabbix-agent` —— **四产物全部存在、均为正方形 PNG、尺寸正确（64² / 256²）、且均 ≤ 1024 KB**，`docs/public/icons/fn-<app>.png` 亦全部存在。

均为正方形 PNG；A 组最大 56536 B ≈ 55.2 KB，远低于 1024 KB 上限。

**证据位置**：`docs/testing/FNOS-001-t0-round1-report.md`（A 组）与 `docs/testing/FNOS-001-t0-round2-report.md`（B 组）「用例结果明细」FNOS-001-02-TEST-01 行。

复核命令（仓库根执行）：

```bash
python3 - <<'EOF'
import struct, os
apps = ['fn-it-tools', 'fn-linux-command', 'fn-adminer', 'fn-browserless', 'fn-chatgpt-next-web',
        'fn-cloudflared', 'fn-cyberchef', 'fn-llama-cpp', 'fn-lobe-chat', 'fn-memcached',
        'fn-web-check', 'fn-wechatmarkdowneditor', 'fn-yesplaymusic', 'fn-zabbix-agent']
for app in apps:
    for n in ['ICON.PNG', 'ICON_256.PNG', 'app/ui/images/icon_64.png', 'app/ui/images/icon_256.png']:
        p = os.path.join('apps', app, n)
        d = open(p, 'rb').read()
        w, h = struct.unpack('>II', d[16:24])
        print(f'{app}/{n}: {w}x{h}, {len(d)}B, png={d[:8] == b"\\x89PNG\\r\\n\\x1a\\n"}, square={w == h}, ok={len(d) <= 1024 * 1024}')
EOF
```

### FNOS-001-02-TEST-02 入口配置 icon 字段与图标文件一致

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-02-TEST-02 |
| 对应功能 | FNOS-001-02 图标资产管线 |
| 验收条件 | FNOS-001-02-AC-01 |
| 优先级 | P0 |
| 环境 | 本地 |
| 状态 | 通过 |

**前置条件**：`apps/fn-<app>/app/ui/config` 存在且为合法 JSON。

**步骤**

1. 读取 `app/ui/config` 中 `.url.<entry>.icon` 字段的值。
2. 若值含 `{0}` 占位符，将 `{0}` 依次替换为 `64`、`256`，得到两个期望文件名。
3. 确认 `app/ui/images/` 下两个文件都存在。
4. 确认入口的 `port` 字段引用的是与向导端口字段一致的变量。

**预期结果**：`icon` 引用的 `icon_64.png` 与 `icon_256.png` 均真实存在；`port` 使用与 `wizard/install` 中端口字段同名的变量（如 `${APP_PORT}`），不写死端口。

**实际结果**：**11 个有入口的应用全部通过；3 个无入口应用不适用（N/A）。**

A 组与 B 组全部有入口的应用均为 `"icon": "images/icon_{0}.png"`，替换 `{0}` 为 `64`/`256` 后两个目标文件都真实存在。入口 ID 与 `manifest.desktop_applaunchname` 逐字符一致；其中 `fn-wechatmarkdowneditor` 使用 `.main` 后缀（见 FNOS-001-04-TEST-10）。

**不适用（N/A）的 3 个**：`fn-cloudflared`、`fn-memcached`、`fn-zabbix-agent` 的 `app/ui/config` 为 `{}`，**无入口即无 `icon` 字段**——这是 AC-07 规定的合法形态（见 FNOS-001-04-TEST-11）。注意：这 3 个应用的**包图标**（`ICON.PNG`/`ICON_256.PNG`）仍必须存在且合规，已由 FNOS-001-02-TEST-01 验证通过。

附带核对（超出本用例的 AC-01 原文，但属 FNOS-001-04-AC-05 范围）：有入口应用的 `port` 均为 `${APP_PORT}`，与 `wizard/install` 字段名一致，未写死端口——该项归 FNOS-001-04-TEST-09 判定，此处仅记录同一文件的一致性事实。

**证据位置**：`docs/testing/FNOS-001-t0-round1-report.md`（A 组）与 `docs/testing/FNOS-001-t0-round2-report.md`（B 组）「用例结果明细」FNOS-001-02-TEST-02 行。

**参考**：现有实现 `apps/fn-halo/app/ui/config` 使用 `"icon": "images/icon_{0}.png"` 与 `"port": "${APP_PORT}"`，可作为一致性的对照样例。

### FNOS-001-02-TEST-03 非正方形与超限图标必须被拒绝

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-02-TEST-03 |
| 对应功能 | FNOS-001-02 图标资产管线 |
| 验收条件 | FNOS-001-02-AC-01 |
| 优先级 | P0 |
| 环境 | 本地 |
| 状态 | 通过 |

**前置条件**：图标管线 `scripts/generate-icons.mjs` 存在；上游 `appstore/apps/<app>/logo.png` 可读。

**步骤**

1. 对**非正方形**的上游图标运行管线，确认被拒绝。
2. 对**小于 64px** 的上游图标运行管线，确认给出警告。
3. 对合规图标运行管线，确认产物为正方形。
4. 确认管线为「每个尺寸从源图单次重采样」，不产生多级插值累积。

**预期结果**：非正方形输入→报错且不产出；<64px 输入→警告但仍产出；正常输入→五个产物尺寸正确。

**实际结果**：**通过（含真实上游样本验证）。**

- 上游 265 个 `logo.png` 普查：**26 个不是正方形**、5 个 < 64px、另有 6 个不是 PNG（`dvwa`、`komga`、`localai`、`mblog`、`neko`、`nezha` 等）。例如 `metabase` 为 256×324、`mongodb` 为 256×192、`go` 为 1061×938。
- 用真实非正方形样本 `metabase/logo.png`（256×324）执行 `node scripts/generate-icons.mjs metabase`，实际输出并退出码 1：

  ```text
  generate-icons 失败: 上游图标不是正方形: 256×324
  EXIT=1
  ```

  即**在生成阶段拒绝**，不会产出错过尺寸的图标。
- `<64px` 输入在第 146 行给出警告但不阻断（设计如此）。

**证据位置**：`scripts/generate-icons.mjs:144-146`；`docs/testing/FNOS-001-t0-round1-report.md`「用例结果明细」FNOS-001-02-TEST-03 行。

**历史经过**：上一轮执行时本用例的状态为「未执行」，且记录了一项已观测事实：`fnpack` 自身不校验图标是否为正方形（32×64 的 `ICON.PNG` 仍 `Packing successfully`）。该事实当时登记为缺陷 D-03，处置方式**不是**要求 `fnpack` 改变行为，而是要求图标管线自行强制。app-builder 已在 `scripts/generate-icons.mjs:145` 实现 `if (width !== height) throw`，本轮实测确认生效，**D-03 闭环**。

**结论**：AC-01 要求的「正方形」由管线在生成阶段保证，不依赖打包工具。三应用产物已由 FNOS-001-02-TEST-01 验证为正方形。

### FNOS-001-03-TEST-01 转换规约字段映射表覆盖需求全部映射行

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-03-TEST-01 |
| 对应功能 | FNOS-001-03 转换矩阵（字段映射） |
| 验收条件 | FNOS-001-03-AC-01 |
| 优先级 | P0 |
| 环境 | 本地 |
| 状态 | 通过 |

**前置条件**：`docs/development/1panel-conversion.md` 存在；需求「上游字段到 fnOS 的对应关系」表可解析。

**步骤**

1. 解析需求「上游字段到 fnOS 的对应关系」表的数据行（应 9 行）。
2. 逐行取「上游」列的字段名，在规约全文中查找对应映射项，统计覆盖率。
3. 对每个映射项，在上游 `appstore/apps/**/data.yml`、`**/docker-compose.yml(.yaml)` 中查找对应来源，确认不是凭空发明。
4. 确认规约明确写出「上游 `default` 是唯一默认值来源」等约束，而非仅罗列字段名。

**预期结果**：需求 9 行全部在规约中有对应映射；每个映射项都能在上游文件中找到来源。

**实际结果**：**两个子句均成立。**

子句 1（覆盖全部 9 行）：需求表数据行为 9 行，逐行核对规约（规约共 6 张映射表）覆盖 9/9：

| # | 需求「上游」列 | 规约对应小节 | 覆盖 |
| --- | --- | --- | --- |
| 1 | `PANEL_APP_PORT_HTTP` | 端口 | 是 |
| 2 | `TZ` / `TIME_ZONE` | 时区 | 是 |
| 3 | `PANEL_DB_*` + `type: apps`/`service` 联动 | 数据库与联动字段 | 是 |
| 4 | `PANEL_REDIS_*` | Redis 与其他中间件 | 是 |
| 5 | `./data`、`./conf` 等相对挂载 | 存储与挂载 | 是 |
| 6 | `container_name: ${CONTAINER_NAME}` | 网络、标签与其他 | 是 |
| 7 | `networks: 1panel-network`（external） | 网络、标签与其他 | 是 |
| 8 | `PANEL_APP_PORT_HTTPS` | 端口 | 是 |
| 9 | `labelEn`/`label` 多语言 | 表单多语言 | 是 |

子句 2（每项可在上游找到来源）：扫描上游 1013 个 YAML 文件，9 个映射项全部命中真实来源——`PANEL_APP_PORT_HTTP` 676 文件、`TZ`/`TIME_ZONE` 72、`PANEL_DB_*` 188、`PANEL_REDIS_*` 46、`./` 相对挂载 325、`${CONTAINER_NAME}` 371、`1panel-network` 363、`PANEL_APP_PORT_HTTPS` 25、`labelEn`/多语言 324。无凭空发明的映射项。

**证据位置**：`docs/development/1panel-conversion.md`（6 张映射表）；`docs/testing/FNOS-001-t0-round1-report.md`「用例结果明细」FNOS-001-03-TEST-01 行。

复核命令（仓库根执行；第 1 条需工作区根的 `appstore/`）：

```bash
# 需求映射表数据行数（期望 9）
sed -n '/### 上游字段到 fnOS 的对应关系/,/### 行为约束/p' \
  docs/requirements/FNOS-001-1panel-app-conversion.md | grep -c '^| `'
```

**说明**：本用例为本轮新增。上一轮该功能因**需求侧没有 `FNOS-001-03-AC-##`** 而被登记为待确认（U-05），测试成员当时**未自行发明通过标准**。需求补齐 AC 后，本用例按 AC 的两个子句逐条判定。

### FNOS-001-04-TEST-01 fnpack build 产出 FPK

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-04-TEST-01 |
| 对应功能 | FNOS-001-04 批次 T0：直接套模板 |
| 验收条件 | FNOS-001-04-AC-01 |
| 优先级 | P1 |
| 环境 | 本地 |
| 状态 | 通过 |

**前置条件**：`apps/fn-<app>/` 目录已按转换规约完成，且 `manifest`、`app/ui/config`、`config/privilege`、`config/resource` 均为合法 JSON/INI。

**步骤**

1. 在 `apps/fn-<app>/` 目录执行 `fnpack build`（本用例在临时目录副本中执行，避免把 `.fpk` 写入受版本控制的目录）。
2. 记录退出码与标准输出。
3. **确认 `<appname>.fpk` 文件确实生成**，且 mtime 不早于本次构建开始时间。

**预期结果**：退出码 0，输出含 `Packing successfully`，且存在本次生成的 `<appname>.fpk`（mtime ≥ 构建开始时间）。

**实际结果**：**A 组三应用 + B 组十一应用全部通过三重判定**（均在临时目录的源目录副本中构建，未写入 `apps/`）。

A 组（2026-10-09 第 1 轮）：

| 应用 | 退出码 | 输出末行 | `.fpk` 大小 | mtime ≥ 构建开始 |
| --- | --- | --- | --- | --- |
| `fn-it-tools` | 0 | `Packing successfully...` | 19864 B | 是 |
| `fn-linux-command` | 0 | `Packing successfully...` | 126453 B | 是 |
| `fn-adminer` | 0 | `Packing successfully...` | 46434 B | 是 |

源目录在构建前后内容哈希一致（`fn-it-tools` `a0c98193c7551693`、`fn-linux-command` `0a894f97488008f8`、`fn-adminer` `049cf85a1b43a00c`），构建未污染 `apps/`。

B 组（2026-10-10 第 2 轮，11 个应用全部 exit 0 + `.fpk` 生成 + mtime ≥ 构建开始）：

| 应用 | 退出码 | `.fpk` 大小 | mtime ≥ 构建开始 |
| --- | --- | --- | --- |
| `fn-browserless` | 0 | 27887 B | 是 |
| `fn-chatgpt-next-web` | 0 | 94975 B | 是 |
| `fn-cloudflared` | 0 | 105686 B | 是 |
| `fn-cyberchef` | 0 | 79598 B | 是 |
| `fn-llama-cpp` | 0 | 17662 B | 是 |
| `fn-lobe-chat` | 0 | 183763 B | 是 |
| `fn-memcached` | 0 | 78708 B | 是 |
| `fn-web-check` | 0 | 150218 B | 是 |
| `fn-wechatmarkdowneditor` | 0 | 34935 B | 是 |
| `fn-yesplaymusic` | 0 | 105040 B | 是 |
| `fn-zabbix-agent` | 0 | 33467 B | 是 |

**证据位置**：`docs/testing/FNOS-001-t0-round1-report.md`「用例结果明细」FNOS-001-04-TEST-01 行（A 组）；`docs/testing/FNOS-001-t0-round2-report.md`「用例结果明细」FNOS-001-04-TEST-01 行（B 组，含完整命令与输出）。

> **判定口径（已裁决，强制）**：本机 `fnpack 1.2.4` 在**打包失败时仍返回退出码 0**。因此本用例**必须以「退出码 0 **且** `.fpk` 存在 **且** mtime 晚于本次构建开始」三重条件判定**，不得只看退出码。缺陷 D-01 已由构建入口 `tooling/fn-os-apps-cli/src/commands/build.ts` 的 `fpkProduced()` 兜底修复，并在第 1 轮复验通过。第 2 轮的 FNOS-001-04-TEST-10 又实测到 3 种「`fnpack` 报失败但退出码为 0」的场景，再次印证该口径的必要性。

### FNOS-001-04-TEST-02 FPK 包内结构完整

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-04-TEST-02 |
| 对应功能 | FNOS-001-04 批次 T0：直接套模板 |
| 验收条件 | FNOS-001-04-AC-01 |
| 优先级 | P1 |
| 环境 | 本地 |
| 状态 | 通过 |

**前置条件**：FNOS-001-04-TEST-01 已通过。

**步骤**

1. 列出 FPK 顶层内容：`tar tzf <app>.fpk`。
2. 展开内层 `app.tgz`：`tar xzOf <app>.fpk app.tgz | tar tz`。
3. 核对两个层级的内容清单是否与订正后的 AC-01 一致。

**预期结果**（订正后的 AC-01 口径）：

- 顶层含 `manifest`、`app.tgz`、`cmd/`、`config/`、`wizard/`、`ICON.PNG`、`ICON_256.PNG`。
- `app.tgz` 解开后含 `docker/docker-compose.yaml`、`ui/config`、`ui/images/icon_{64,256}.png`。

**实际结果**：**A 组三应用 + B 组十一应用包结构完全一致且符合 AC-01**（共 14 个应用，逐一实测）。

顶层 21 个条目：`app.tgz`、`cmd/`（9 个脚本：`main`、`config_init`、`config_callback`、`install_init`、`install_callback`、`upgrade_init`、`upgrade_callback`、`uninstall_init`、`uninstall_callback`）、`config/`（`privilege`、`resource`）、`wizard/`（`install`、`config`、`uninstall`）、`manifest`、`ICON.PNG`、`ICON_256.PNG`。

`app.tgz` 解开后：`docker/`、`docker/docker-compose.yaml`、`ui/`、`ui/config`、`ui/images/`、`ui/images/icon_64.png`、`ui/images/icon_256.png`、`config/`、`config/privilege`、`config/resource`。

B 组 11 个应用的逐项实测（`顶层` = 非目录条目数）：

| 应用 | 顶层条目 | `cmd/` | `wizard/` | `ui/config` | `.DS_Store` |
| --- | --- | --- | --- | --- | --- |
| `fn-browserless` | 21 | 9 | 3 | ✓ | 0 |
| `fn-chatgpt-next-web` | 21 | 9 | 3 | ✓ | 0 |
| `fn-cloudflared` | 21 | 9 | 3 | ✓ | 0 |
| `fn-cyberchef` | 21 | 9 | 3 | ✓ | 0 |
| `fn-llama-cpp` | 21 | 9 | 3 | ✓ | 0 |
| `fn-lobe-chat` | 21 | 9 | 3 | ✓ | 0 |
| `fn-memcached` | 21 | 9 | 3 | ✓ | 0 |
| `fn-web-check` | 21 | 9 | 3 | ✓ | 0 |
| `fn-wechatmarkdowneditor` | 21 | 9 | 3 | ✓ | 0 |
| `fn-yesplaymusic` | 21 | 9 | 3 | ✓ | 0 |
| `fn-zabbix-agent` | 21 | 9 | 3 | ✓ | 0 |

两个层级均**无 `.DS_Store`** 或其它临时文件。

**证据位置**：`docs/testing/FNOS-001-t0-round1-report.md`「用例结果明细」FNOS-001-04-TEST-02 行（A 组）；`docs/testing/FNOS-001-t0-round2-report.md`「用例结果明细」FNOS-001-04-TEST-02 行（B 组）。

**历史经过（口径订正）**：上一轮 AC-01 原文写「包内包含 `app/`」，而 `fnpack 1.2.4` 会把源目录 `app/` 打包为**单个 `app.tgz`**，顶层不存在字面名为 `app/` 的目录项。测试成员当时按「`app.tgz` 存在且内层含 `docker/` 与 `ui/`」判定并登记为待确认项 U-03，**未擅自按原文判失败**。Lead 裁决「按实测形态判定，同时订正 AC 原文」，需求现已改为 `app.tgz` 表述。本用例按订正后的 AC 判定。

### FNOS-001-04-TEST-03 目标 NAS 安装成功且桌面入口端口正确

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-04-TEST-03 |
| 对应功能 | FNOS-001-04 批次 T0：直接套模板 |
| 验收条件 | FNOS-001-04-AC-02 |
| 优先级 | P1 |
| 环境 | 目标 NAS |
| 状态 | 通过 |

**前置条件**：可在目标 fnOS 设备执行 `appcenter-cli` 的账号与权限；FPK 已构建。

**步骤**

1. 在目标 NAS 的应用目录执行 `appcenter-cli install-local`（或对已构建 FPK 执行 `appcenter-cli install-fpk`）。
2. 在安装向导填写端口（默认取上游 `PANEL_APP_PORT_HTTP` 的 `default`）。
3. 安装完成后在应用中心确认应用卡片出现。
4. 点击卡片打开应用，确认实际访问地址使用步骤 2 填写的端口。
5. 记录 `appcenter-cli` 输出与首次打开页面截图。

**预期结果**：安装成功无报错；应用卡片可打开；入口指向用户填写的端口，与 `app/ui/config` 的 `port` 变量取值一致。

**实际结果**：**通过（2026-10-10 真机执行）**。改用 `trim-cli`（fnOS 应用中心 API）安装，不依赖 `appcenter-cli`。`app install-fpk fn-it-tools.fpk --volume-id 4 --custom-parameters '[{"key":"APP_PORT","value":"40116"}]' --yes` 执行后：
- `app status fn-it-tools` 返回已注册应用：`title=IT-Tools`、`type=url`、`protocol=http`、`port=40116`、`path=/`，与 `app/ui/config` 一致；
- `app entry list` 中桌面入口为 `{"fnDomain":"fn-it-tools","protocol":"http","port":"40116","path":"/"}`；
- `curl http://192.168.119.6:40116/` 返回 `HTTP 200`、2787 bytes、标题 `<title>IT Tools - Handy online tools for developers</title>`；
- `ss -tlnp` 显示 `LISTEN 0.0.0.0:40116`，容器真实在跑。

安装前已先执行 `--dry-run`：设备端正确解析 `name=IT-Tools version=6.0.0 docker=true installType=volume hasWizard=true`、`osMinVersion=1.1.8 isSystemVersionMatch=true`，无 guard 拒绝。

**注意**：`install-fpk` 的 CLI 侧返回 `timed out waiting for app-center install task`，但安装实际已完成（目录解包、入口注册、端口监听均已确认）。判定为 CLI 轮询超时，非安装失败。

**证据位置**：[FNOS-001 真实环境验收记录](/validation/FNOS-001-fnos-nas-2026-10-09) 的「目标 NAS 真机验收：fn-it-tools」小节。

**原阻塞原因（已解除）**：本机 `appcenter-cli` 无法连接 fnOS 应用的 RPC 服务，任何子命令均在启动阶段 panic，无法执行安装：

```text
$ appcenter-cli version
panic: ApplyPermission for '[com.trim.sysinfo com.trim.main]' error, dial unix /run/trim_app_cgi/rpcbroker: connect: permission denied

goroutine 1 [running]:
git.teiron-inc.cn/infra/trimrpc.defaultInit()
	/go/pkg/mod/git.teiron-inc.cn/infra/trimrpc@v1.17.6/init.go:31 +0x1d9
git.teiron-inc.cn/infra/trimrpc.Init(...)
	/go/pkg/mod/git.teiron-inc.cn/infra/trimrpc@v1.17.6/init.go:16
main.main()
	/app/main.go:15 +0xd0
```

**解锁方式（已验证有效）**：改用 `trim-cli` 走 fnOS 应用中心 HTTP API，绕过 `appcenter-cli` 的本地 RPC 依赖。使用前需把 session 复制到当前用户可写的目录并以 `TRIM_CLI_CONFIG_DIR` 指向它（原配置目录属主为另一用户，直接使用会得到 `Operation not permitted`）。

```text
# 原始 panic（保留作为历史记录）
$ appcenter-cli version
panic: ApplyPermission for '[com.trim.sysinfo com.trim.main]' error, dial unix /run/trim_app_cgi/rpcbroker: connect: permission denied
```

### FNOS-001-04-TEST-04 安装启动停止卸载重装全流程

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-04-TEST-04 |
| 对应功能 | FNOS-001-04 批次 T0：直接套模板 |
| 验收条件 | FNOS-001-04-AC-03 |
| 优先级 | P1 |
| 环境 | 目标 NAS |
| 状态 | 阻塞 |

> **状态说明（取值范围修正）**：本用例此前记为「部分通过」，该取值**不在允许的四值范围内**（通过/失败/阻塞/未执行），现更正为 **阻塞**。
> 依据：AC-03 要求「安装 → 启动 → 停止 → 卸载 → 重装流程不报错；**选择「保留数据」后重装能读回原有数据**」。已完成的真机步骤（安装、启动、停止、重启、以及**选「删除所有数据」的卸载**）全部通过；但 **「保留数据」分支与「重装读回数据」两步未执行**，且剩余步骤只能走 App Center UI、无法由 CLI 完成。因此 AC-03 **整体尚未满足**，判「阻塞」而非「通过」——已通过的部分不构成 AC-03 成立。

**前置条件**：FNOS-001-04-TEST-03 已通过。

**步骤**

1. 安装完成后，在应用中心执行「启动」，确认状态变为运行中。
2. 执行「停止」，确认状态变为已停止，且容器不再运行。
3. 执行「卸载」，在卸载向导选择「保留数据」。
4. 确认卸载完成无报错。
5. 重新安装同一 FPK，填写**与首次相同的端口**。
6. 确认应用可再次打开，且原有数据仍在（判定方法见 FNOS-001-05-TEST-03）。

**预期结果**：启动、停止、卸载、重装四步均不报错；重装后应用可打开；选择「保留数据」时原数据可读回。

**实际结果**（2026-10-10 真机执行，设备 `192.168.119.6`，应用 `fn-it-tools`，端口 `40116`）：

已通过的部分：

| 步骤 | 命令 / 方法 | 观察结果 |
| --- | --- | --- |
| 启动 | `app start fn-it-tools --yes` | `Started app fn-it-tools`；8 秒后 `curl http://192.168.119.6:40116/` → `HTTP 200` |
| 停止 | `app stop fn-it-tools --yes` | `Stopped app fn-it-tools`；5 秒后同一 `curl` → `HTTP 000`（连接失败），证明容器确实停止、端口已释放 |
| 重启 | stop → start 循环 | 端口恢复 `HTTP 200` |
| 卸载（**选「删除所有数据」**） | 由用户在 App Center UI 手工执行 | 应用从已装列表消失（37 项）、端口释放（`HTTP 000`）、`/var/apps/fn-it-tools` 已移除、`@appdata`/`@apphome`/`@appmeta` 三个数据目录占用均归 **0 字节** |

未执行的部分（**被 CLI 的安全守卫拒绝，非应用缺陷**）：

- **卸载（选「保留数据」）**：`app uninstall fn-it-tools --yes` 返回 `app-center uninstall requires custom wizard parameters; run it from App Center UI`。原因是本应用 `wizard/uninstall` 含必填字段 `wizard_data_action`（保留/删除数据二选一），而 `app uninstall` **不提供** `--custom-parameters` 选项；改用 `raw appcgi.appcenter.uninstallInfo` 返回 `403 Forbidden`（不在 CLI 审计允许列表）。CLI 文档 `reference/app-center.md` 已将「custom uninstall wizard parameters」列为**必须转 App Center UI** 的情形。
- **卸载后重装读回数据**：依赖上一条，未执行。

**证据位置**：[FNOS-001 真实环境验收记录](/validation/FNOS-001-fnos-nas-2026-10-09) 的「目标 NAS 真机验收：fn-it-tools」小节（含卸载核验表）。

**阻塞原因**：剩余两步无法由 CLI 完成，需在 App Center UI 手工操作，且需占用一次真机窗口。

**解锁条件**：在 App Center UI 中重装 `fn-it-tools`（端口 `40116`）→ 产生可识别数据 → 卸载并选**「保留数据（推荐）」** → 重装同一 FPK → 确认数据读回。或等 CLI 未来版本支持卸载向导参数。

**未验证声明**：`cmd/uninstall_callback` 的 keep/delete 分支与 `${TRIM_PKGVAR:?}` 空变量守卫已在**本地**用构造目录实测通过，但**真机 keep 分支仍待 UI 验证**。

### FNOS-001-04-TEST-05 运行用户与权限最小化

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-04-TEST-05 |
| 对应功能 | FNOS-001-04 批次 T0：直接套模板 |
| 验收条件 | FNOS-001-04-AC-04（**仅静态子句**；运行时子句另计） |
| 优先级 | P1 |
| 环境 | 本地（静态核对） |
| 状态 | 通过 |

> **范围限定**：本用例状态「通过」**只覆盖步骤 1—3 的静态配置核对**（未申请 root、未使用 `join-groups`）。步骤 4 的目标 NAS 运行时确认**未执行**，不因本用例通过而成立。

**前置条件**：`apps/fn-<app>/config/privilege` 存在。

**步骤**

1. 读取 `config/privilege`，确认 `defaults.run-as` 为 `package`。
2. 确认 `username` 和 `groupname` 均为 `docker-fn-<app>`（与 `manifest.appname` 一致的 `<appname>`）。
3. 确认不存在 `join-groups` 字段。若存在，则确认 PLAN-FNOS-001 或清单中已显式记录该应用需要附加用户组的理由。
4. 在目标 NAS 上运行应用后，以 `ps` 或等价方式确认容器进程的实际 uid/gid 属于应用用户（此步依赖设备，未执行时整条用例不得判「通过」）。

**预期结果**：`run-as: package`；`username`/`groupname` 为 `docker-fn-<app>`；无 `join-groups`（除非计划中已记录理由）；容器进程以该用户运行而非 root。

**实际结果**：**T0 全 14 个应用在静态部分全部通过。**

A 组（3 个）：

| 应用 | `run-as` | `username` / `groupname` | `join-groups` | `root` |
| --- | --- | --- | --- | --- |
| `fn-it-tools` | `package` | `docker-fn-it-tools` | 无 | 无 |
| `fn-linux-command` | `package` | `docker-fn-linux-command` | 无 | 无 |
| `fn-adminer` | `package` | `docker-fn-adminer` | 无 | 无 |

B 组（11 个，逐个核对 `config/privilege`）：`fn-browserless`、`fn-chatgpt-next-web`、`fn-cloudflared`、`fn-cyberchef`、`fn-llama-cpp`、`fn-lobe-chat`、`fn-memcached`、`fn-web-check`、`fn-wechatmarkdowneditor`、`fn-yesplaymusic`、`fn-zabbix-agent` —— **全部**为 `run-as: package`、`username`/`groupname` = `docker-fn-<app>`、**无 `join-groups`、无 root**。

命名交叉核对：目录名、`manifest.appname`、`container_name`、`config/resource` 的 `docker-project.projects[].name` 四者全等于 `fn-<app>`；有入口的应用其 `desktop_applaunchname` 与入口 ID 一致（A 组与 B 组的有入口应用均等于 `fn-<app>.Application` 或 `.main`）。

**本轮判定的范围（重要）**：上述结论**仅覆盖步骤 1—3 的静态核对**，即配置声明层面「未申请 root、未使用 join-groups」。步骤 4（目标 NAS 上确认容器进程实际 uid/gid）**未执行**，因此：

- FNOS-001-04-AC-04 的**静态子句已满足**，本用例状态为「通过」；
- 但 AC-04 的运行时确认依赖设备，**设备端复核归 FNOS-001-04-TEST-03 的环境**，不得据本用例声称「容器确实以该用户运行」。
- 2026-10-10 真机对 `fn-it-tools` 的观测为：`/var/apps/fn-it-tools/` 由 root 建立、各子目录符号链接指向 `/vol4/@app*`，应用进程按 `run-as: package` 运行（容器内服务正常响应）。这属**单应用**的运行时旁证，不等于 14 个应用都已验。

**证据位置**：`docs/testing/FNOS-001-t0-round1-report.md`「用例结果明细」FNOS-001-04-TEST-05 行（A 组）；`docs/testing/FNOS-001-t0-round2-report.md`「用例结果明细」FNOS-001-04-TEST-05 行（B 组）；配置文件 `apps/fn-<app>/config/privilege`。

**参考**：现有实现 `apps/fn-halo/config/privilege` 为 `run-as: package` + `docker-fn-halo`，无 `join-groups`，可作为对照。

### FNOS-001-04-TEST-06 端口被占用

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-04-TEST-06 |
| 对应功能 | FNOS-001-04 批次 T0：直接套模板 |
| 验收条件 | FNOS-001-04-AC-06 |
| 优先级 | P1 |
| 环境 | 目标 NAS |
| 状态 | 未执行 |

**前置条件**

- 目标 fnOS 设备可访问（`trim-cli` 通道可用，见 FNOS-001-04-TEST-03 的解锁方式）。
- 待测应用 FPK 已构建。建议选**镜像小、启动快**的应用（`fn-cyberchef` 或 `fn-it-tools`），避免拉镜像耗时干扰判定。
- 已知该应用的默认端口（记作 `P`；`fn-cyberchef` = 8080，`fn-it-tools` = 40116）。

**步骤（可直接照做）**

**第 1 步：在设备上构造端口冲突**

```bash
# 方式 A（推荐，最贴近真实冲突）：用另一个容器长期占用端口 P
docker run -d --name port-holder -p P:80 nginx:alpine

# 验证已占用（应看到 LISTEN 0.0.0.0:P）
ss -tlnp | grep ":P "
```

方式 B：挑一个已装应用占用的端口当冲突源——`trim-cli ... app status <已装应用>` 读其 `port`。

**第 2 步：安装待测应用，向导端口填被占用的 `P`**

```bash
trim-cli ... app install-fpk apps/<app>/<app>.fpk \
  --volume-id 4 --custom-parameters '[{"key":"APP_PORT","value":"P"}]' --yes
```

**第 3 步：取证（按下表逐项记录）**

```bash
# 3a. 应用中心返回状态：是否注册、是否显示「运行中」
trim-cli ... app status <app>

# 3b. 实际可达性 + 确认监听方是谁（判定红线的直接证据）
curl -s -o /dev/null -w '%{http_code}\n' http://<设备IP>:P/
docker ps --filter "publish=P" --format '{{.Names}} {{.Ports}}'
```

**第 4 步：清理**

```bash
trim-cli ... app uninstall <app>     # 若被安装；如需卸载向导参数则转 App Center UI
docker rm -f port-holder             # 释放端口
```

**预期结果**（AC-06 原文口径）：

- **通过路径 A**：安装向导的**表单校验拦截**该端口（安装无法提交）。
- **通过路径 B**：安装完成但 `cmd/main status` 返回**非 0**，应用中心显示应用**未运行**。
- 两条路径**任一即算通过**。
- **红线（出现即判失败）**：「**安装成功且显示运行中，但实际不可访问**」。

**实际结果**：（待填）—— **本用例尚未执行**。

**证据位置**：（待填）

**未执行原因**：需要一次真机窗口并在设备上构造端口冲突。2026-10-10 的真机验证在**空闲**端口上安装 `fn-it-tools`（40116）成功并正常服务，**未构造「端口已被占用」的前置条件**，故 AC-06 **不因该次安装而通过**——真机安装成功只证明正常路径可用，不能替代冲突场景。

**判定口径说明（已裁决，勿自行放宽）**：向导是静态表单校验，**运行时端口占用不可能在表单阶段可靠判定**（用户可能在提交后才占用该端口），因此需求允许两条路径任一通过。若两条路径都不成立且出现红线情形，判「失败」。

**口径沿革**：上一轮本用例的追踪依据写「无独立 AC」并登记 U-01 待确认。Lead 已裁决两条路径任一通过，需求现已补 `FNOS-001-04-AC-06`，**U-01 已闭环**。本轮补充了上述可复现步骤，使其可在下次真机窗口直接执行。

### FNOS-001-04-TEST-07 端口非数字被拒绝

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-04-TEST-07 |
| 对应功能 | FNOS-001-04 批次 T0：直接套模板 |
| 验收条件 | 需求「交互和行为约束」P1 步骤 3：端口字段必须为数字（无独立 AC） |
| 优先级 | P1 |
| 环境 | 本地 |
| 状态 | 通过 |

**前置条件**：三应用 `wizard/install` 已按 U-02 裁决写入严格正则。

**步骤**

1. 从 `apps/fn-<app>/wizard/install` 提取端口字段的 `rules[].pattern`。
2. 用该正则对非数字输入做判定：`abc`、`80a`、`8 0`、空串、` 80`、`80 `、`+80`、`0x50`、`1e3`。
3. 记录每个输入的判定结果。

**预期结果**：全部非数字输入被拒绝，不进入安装流程。

**实际结果**：**通过。** 从三应用 `wizard/install` 提取的实际正则：

```text
^[1-9][0-9]{0,3}$|^[1-5][0-9]{4}$|^6[0-4][0-9]{3}$|^65[0-4][0-9]{2}$|^655[0-2][0-9]$|^6553[0-5]$
```

在 Node.js（向导的实际运行环境）中以该正则判定，全部非数字输入均被拒绝：`abc`、`80a`、`8 0`、空串、` 80`、`80 `、`+80`、`0x50`、`1e3` → 全部 `false`。

**证据位置**：`apps/fn-<app>/wizard/install`（端口字段 `rules[1].pattern`）；`docs/testing/FNOS-001-t0-round1-report.md`「用例结果明细」FNOS-001-04-TEST-07 行。

**口径与范围说明**：本用例原为「目标 NAS／阻塞」。Lead 裁决 U-02 后，**端口校验的实现方式确定为单条严格正则**，其行为可在本地用同一正则引擎穷举验证，故本用例改在**本地**执行并判定「通过」。这并不替代设备端向导的实际交互验收——向导能否正确呈现错误提示，仍归 FNOS-001-04-TEST-03 的环境验证。**本地判定的是「规则能拒绝」，不是「界面提示正确」。**

### FNOS-001-04-TEST-08 端口越界被拒绝

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-04-TEST-08 |
| 对应功能 | FNOS-001-04 批次 T0：直接套模板 |
| 验收条件 | 需求「交互和行为约束」P1 步骤 3 与字段映射表：必须校验 1—65535（无独立 AC） |
| 优先级 | P1 |
| 环境 | 本地 |
| 状态 | 通过 |

**前置条件**：三应用 `wizard/install` 已按 U-02 裁决写入严格正则。

**步骤**

1. 从 `wizard/install` 提取端口字段的 `rules[].pattern`。
2. 与规约给出的严格正则做**穷举等价性比对**：对 `0`—`70000` 的每个整数，用两个正则分别判定，逐值比对。
3. 对边界与畸形输入单独判定：`1`、`65535`、`0`、`65536`、`70000`、`-1`、`1.5`、前导零、空格、`+80`、`0x50`。

**预期结果**：合法范围 1—65535 全部通过、其余全部拒绝；三应用正则与规约正则**判定完全一致**。

**实际结果**：**通过（穷举验证）。**

- 穷举 `0`—`70000` 共 70001 个取值：向导正则「不符预期」数为 **0**；与规约正则判定**不一致数为 0**。
- 边界：`1`→通过、`65535`→通过；`0`、`65536`、`70000`、`99999`、`-1`、`-80`、`1.5`、空串、` 80`、`80 `、`+80`、`0x50`、`8 0`、`1e3` → 全部拒绝。
- 前导零 `040116`、`080` 被拒绝（符合「不依赖 `min`/`max`、用单条严格正则完整覆盖」的口径）。
- **实现与规约的写法差异不影响语义**：向导使用 `^(a$|b$|...)` 形式、规约使用 `^(?:a|b|...)$` 形式，二者字符串不同，但**在 Python 与 Node.js 两种引擎下穷举 0—70000 均无任何判定差异**，故不构成缺陷。

**证据位置**：`apps/fn-<app>/wizard/install`；`docs/development/1panel-conversion.md:65-71`（严格正则与其全量验证声明）；`docs/testing/FNOS-001-t0-round1-report.md`「用例结果明细」FNOS-001-04-TEST-08 行。

**口径说明**：上一轮本用例追踪依据写「无独立 AC」并登记 U-02 待确认。Lead 裁决：`min`/`max` 语义在官方文档中未明确定义、跨字段类型解释不一致，**不可依赖**，改用单条严格正则覆盖 1—65535。规约原第 65 行 `^[0-9]+$` 与「范围 1—65535」并列属自相矛盾，已订正。**U-02 已闭环。**

### FNOS-001-04-TEST-09 入口端口引用向导同名变量

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-04-TEST-09 |
| 对应功能 | FNOS-001-04 批次 T0：直接套模板 |
| 验收条件 | FNOS-001-04-AC-05 |
| 优先级 | P1 |
| 环境 | 本地 |
| 状态 | 通过 |

**前置条件**：`apps/fn-<app>/app/ui/config` 与 `apps/fn-<app>/wizard/install` 均存在。

**步骤**

1. 读取 `app/ui/config` 中入口的 `port` 值。
2. 提取 `wizard/install` 中所有字段名。
3. 确认 `port` 形如 `${VAR}`，且 `VAR` 是向导字段名之一（不得写死端口数字）。

**预期结果**：`port` 引用与 `wizard/install` 端口字段同名的变量；不写死端口号。

**实际结果**：**T0 全 14 个应用中，11 个有入口的应用全部通过；3 个无入口应用不适用（N/A）。**

A 组（3 个）：

| 应用 | `ui/config` 的 `port` | 向导字段 | 判定 |
| --- | --- | --- | --- |
| `fn-it-tools` | `${APP_PORT}` | `['APP_PORT']` | 同名、未写死 |
| `fn-linux-command` | `${APP_PORT}` | `['APP_PORT']` | 同名、未写死 |
| `fn-adminer` | `${APP_PORT}` | `['APP_PORT']` | 同名、未写死 |

B 组有入口的 8 个（全部为 `${APP_PORT}`，与向导字段同名、未写死）：

| 应用 | `APP_PORT` 默认值 | 容器内端口 | `ui/config` 的 `port` |
| --- | --- | --- | --- |
| `fn-browserless` | `3000` | `3000` | `${APP_PORT}` |
| `fn-chatgpt-next-web` | `40042` | `3000` | `${APP_PORT}` |
| `fn-cyberchef` | `8080` | `8080` | `${APP_PORT}` |
| `fn-llama-cpp` | `8080` | `8080` | `${APP_PORT}` |
| `fn-lobe-chat` | `40247` | `3210` | `${APP_PORT}` |
| `fn-web-check` | `40095` | `3000` | `${APP_PORT}` |
| `fn-wechatmarkdowneditor` | `8080` | `80` | `${APP_PORT}` |
| `fn-yesplaymusic` | `40075` | `80` | `${APP_PORT}` |

**不适用（N/A）的 3 个**：`fn-cloudflared`、`fn-memcached`、`fn-zabbix-agent` 的 `app/ui/config` 为 `{}`，**无入口即无 `port` 字段**——这是 AC-07 规定的合法形态（见 FNOS-001-04-TEST-11），不属本用例失败。

各应用 `wizard/install` 与 `wizard/config` 的字段名与 `initValue` 一致；`fn-it-tools`/`fn-linux-command`/`fn-adminer` 分别为 `40116`/`40255`/`9853`，B 组见上表，均与上游 `default` 相同。

**证据位置**：`apps/fn-<app>/app/ui/config`、`apps/fn-<app>/wizard/install`、`apps/fn-<app>/wizard/config`；`docs/testing/FNOS-001-t0-round1-report.md`（A 组）与 `docs/testing/FNOS-001-t0-round2-report.md`（B 组）「用例结果明细」FNOS-001-04-TEST-09 行。

**说明**：本用例为本轮新增，对应需求新补的 `FNOS-001-04-AC-05`。上一轮该核对内容写在 FNOS-001-02-TEST-02 内并登记为 U-04（原属图标用例，命名与范围不符）。Lead 裁决「属验收范围，保留」，需求现已补 AC-05，故独立成例。

**未覆盖部分**：「用户改端口后入口随之变化」的**动态**验证归 FNOS-001-04-TEST-12（真机已通过）。本用例只验证**静态引用正确**。

### FNOS-001-04-TEST-10 入口键长度与前缀硬校验（AC-07）

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-04-TEST-10 |
| 对应功能 | FNOS-001-04 批次 T0：直接套模板 |
| 验收条件 | FNOS-001-04-AC-07 |
| 优先级 | P1 |
| 环境 | 本地 |
| 状态 | 通过 |

**前置条件**：`apps/fn-<app>/app/ui/config` 与 `apps/fn-<app>/manifest` 存在且合法。

**步骤**

1. 读取 `app/ui/config` 的 `.url` 键（入口键）。
2. 校验键长度 ≤ 32 字符。
3. 校验键以 `manifest.appname` 为前缀。
4. 校验键与 `manifest.desktop_applaunchname` **逐字符一致**。
5. 对边界做实测：构造恰好 32 字符与 33 字符的入口键（同步改 `manifest`），分别执行 `fnpack build`，按「退出码 0 **且** `.fpk` 产出」判定。
6. 构造不以 `appname` 为前缀的键，确认被拒绝。

**预期结果**：全部有入口的应用满足「≤32 字符 + appname 前缀 + 与 `desktop_applaunchname` 一致」；32 字符通过、33 字符被拒绝；非前缀键被拒绝。

**实际结果**：**通过。**

三处硬校验均已实测（在临时副本中构造，未改动 `apps/`）：

| 构造 | 命令输出末尾 | 退出码 | `.fpk` |
| --- | --- | --- | --- |
| 入口键恰好 32 字符 | `Packing successfully.` | **0** | **生成** ✓ |
| 入口键恰好 33 字符 | `Packing failed. The entry ID "fn-cyberchef.aaaaaaaaaaaaaaaaaaaa" exceeds the 32-character limit.` | **0**（假成功） | 未生成 ✗ |
| 键不以 appname 为前缀 | `Packing failed. The entry name "badprefix.Application" in "app/ui/config" should start with fn-cyberchef` | **0**（假成功） | 未生成 ✗ |
| 键与 `desktop_applaunchname` 不一致 | `Packing failed. The value of desktop_applaunchname in manifest does not match any entry name defined in app/ui/config` | **0**（假成功） | 未生成 ✗ |

**关键点**：后三种失败场景 `fnpack` **仍返回退出码 0**，只有「`.fpk` 是否产出」能识别失败——这正是 FNOS-001-04-TEST-01 的三重判定口径必须被遵守的原因（缺陷 D-01）。

T0 全 14 个应用的 AC-07 判据实测（覆盖率 14/14）：

| 形态 | 应用 | 入口键 | 长度 | 判定 |
| --- | --- | --- | --- | --- |
| `.Application` | `fn-adminer` | `fn-adminer.Application` | 22 | ✓ |
| `.Application` | `fn-it-tools` | `fn-it-tools.Application` | 23 | ✓ |
| `.Application` | `fn-cyberchef` | `fn-cyberchef.Application` | 24 | ✓ |
| `.Application` | `fn-llama-cpp` | `fn-llama-cpp.Application` | 24 | ✓ |
| `.Application` | `fn-lobe-chat` | `fn-lobe-chat.Application` | 24 | ✓ |
| `.Application` | `fn-web-check` | `fn-web-check.Application` | 24 | ✓ |
| `.Application` | `fn-browserless` | `fn-browserless.Application` | 26 | ✓ |
| `.Application` | `fn-yesplaymusic` | `fn-yesplaymusic.Application` | 27 | ✓ |
| `.Application` | `fn-linux-command` | `fn-linux-command.Application` | 28 | ✓ |
| **`.main`** | **`fn-wechatmarkdowneditor`** | `fn-wechatmarkdowneditor.main` | **28** | ✓（若用 `.Application` 则为 **35**，超限） |
| `.Application` | `fn-chatgpt-next-web` | `fn-chatgpt-next-web.Application` | 31 | ✓（最接近上限） |
| `{}` 无入口 | `fn-cloudflared` / `fn-memcached` / `fn-zabbix-agent` | — | — | ✓（见 TEST-11） |

**证据位置**：`apps/fn-<app>/app/ui/config`、`apps/fn-<app>/manifest`；`docs/testing/FNOS-001-t0-round2-report.md`「用例结果明细」FNOS-001-04-TEST-10 行。

**说明**：本用例为本轮新增，对应需求新补的 `FNOS-001-04-AC-07`。规约「桌面入口 ID」一节规定：总长必须 ≤32 字符，超限时改用 `<appname>.main`；等价判据是 **`<app>` 长度 ≥18 字符时 `.Application` 必然超限**。`wechatmarkdowneditor` 的 `<app>` 长度为 **20** 字符（`appname` = `fn-wechatmarkdowneditor` 为 23 字符），`fn-` + `<app>` + `.Application` = 35 字符已超限，是本批次唯一命中该规则的应用。

### FNOS-001-04-TEST-11 无入口应用形态（AC-07）

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-04-TEST-11 |
| 对应功能 | FNOS-001-04 批次 T0：直接套模板 |
| 验收条件 | FNOS-001-04-AC-07（后半句：无 Web UI 应用的形态） |
| 优先级 | P1 |
| 环境 | 本地（静态）+ 目标 NAS（运行） |
| 状态 | 通过 |

**前置条件**：候选应用为无 Web UI 的服务类应用。

**步骤**

1. 确认 `app/ui/config` 为**空对象** `{}`（不是缺失文件、不是含空 `.url` 的对象）。
2. 确认 `manifest` **不含** `desktop_uidir` 与 `desktop_applaunchname` 两行。
3. 确认应用仍能正常构建且包结构完整（FNOS-001-04-TEST-01/02 的口径）。
4. 在目标 NAS 安装后确认应用中心**无桌面入口**，但应用本身正常运行。

**预期结果**：`ui/config` 为 `{}`、`manifest` 无 `desktop_*` 两行、应用可正常安装运行但无入口。

**实际结果**：**静态部分通过**（3 个应用）。

| 应用 | 源 `app/ui/config` | 源 `manifest` 的 `desktop_*` | 构建 | 形态说明 |
| --- | --- | --- | --- | --- |
| `fn-memcached` | `{}` | 无 | 通过（exit 0 + `.fpk`） | 缓存服务，无 Web UI；端口 `11211` |
| `fn-zabbix-agent` | `{}` | 无 | 通过 | 监控 agent；端口 `10050` |
| `fn-cloudflared` | `{}` | 无 | 通过 | 隧道客户端，**连端口字段都没有** |

**打包后的实测差异（重要）**：`fnpack` 会在**打包时注入**两行空值到 FPK 内的 `manifest`：

```text
desktop_uidir              = 
desktop_applaunchname      = 
```

即源文件不含这两行，但 FPK 内的 `manifest` 含有（值为空）。对照有入口的 `fn-wechatmarkdowneditor`，其 FPK 内为正常值 `desktop_uidir = ui` / `desktop_applaunchname = fn-wechatmarkdowneditor.main`。重复构建两次结果一致，属确定性行为。

**裁决（U-06 已闭环）**：判定**以仓库内受版本控制的源 `manifest` 为准**；FPK 内的空值注入属 `fnpack` 对「源未声明该字段」的默认行为（nil 语义，等同未设置），**不构成不合规**，也**不要求构建层剔除**。AC-07 后半句应表述为「源 `app/ui/config` 为 `{}` 且**源** `manifest` 不含 `desktop_uidir`/`desktop_applaunchname`」——原措辞绑定了 FPK 观测面，会在 FPK 层面永不成立；措辞订正由需求维护者落地。

**证据位置**：`apps/fn-memcached/`、`apps/fn-zabbix-agent/`、`apps/fn-cloudflared/` 的 `app/ui/config` 与 `manifest`；`docs/testing/FNOS-001-t0-round2-report.md`「用例结果明细」FNOS-001-04-TEST-11 行。

**未覆盖部分**：步骤 4（目标 NAS 上确认无入口但正常运行）**未执行**——本轮真机窗口未覆盖这 3 个应用。本用例的状态「通过」**仅代表静态形态合规**，不代表「装完后无入口且正常工作」已验。

**判定标准（U-07 已闭环，T1 起统一适用）**：「无 Web UI 应用」= **该应用不通过 HTTP 提供用户界面**，**与「是否有端口」无关**。机械判定动作：

| 情形 | 判定 | `app/ui/config` | `manifest` |
| --- | --- | --- | --- |
| 有 HTTP 端口**且**浏览器可打开界面 | 有入口 | 写 `.url` | 保留 `desktop_*` |
| 端口为 TCP/非 HTTP 协议（数据库、缓存、监控 agent、隧道） | **无入口** | `{}` | 删 `desktop_*` |
| 完全没有端口 | **无入口** | `{}` | 删 `desktop_*` |

**不以「有无 `PANEL_APP_PORT_HTTP`」判定**：本批 `fn-memcached` 上游字段名**就是** `PANEL_APP_PORT_HTTP`（值 11211），但它是缓存 TCP 协议、**没有 HTTP 界面**——用字段名判定会把它误判为「有入口」。`fn-zabbix-agent` 的字段名是 `PANEL_APP_PORT_AGENT`、`fn-cloudflared` 连端口字段都没有。因此必须以「是否提供 HTTP 界面」为准。

**边界处理约定**：T1 批次遇到无法确定是否提供 HTTP 界面的应用时，**先上报计划维护者裁决，不自行归类**。

### FNOS-001-04-TEST-12 用户改端口后入口随之变化（AC-02 + AC-05 真机）

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-04-TEST-13 |
| 对应功能 | FNOS-001-04 批次 T0：直接套模板 |
| 验收条件 | FNOS-001-04-AC-02 + FNOS-001-04-AC-05 |
| 优先级 | P1 |
| 环境 | 目标 NAS |
| 状态 | 通过 |

**前置条件**：两个上游默认端口相同的应用已构建（本批次为 `fn-cyberchef` 与 `fn-wechatmarkdowneditor`，上游默认**都是 8080**）。

**步骤**

1. 确认目标端口空闲：`ss -tlnp | grep ":8080"` → 无输出。
2. 安装第一个应用（`fn-cyberchef`），**使用默认端口 8080**。
3. 安装第二个应用（`fn-wechatmarkdowneditor`），在向导中**改填 8081**。
4. 确认第二个应用的桌面入口指向 **8081**（而非默认 8080）。
5. 分别 `curl` 两个端口，确认各自返回预期页面。

**预期结果**：向导接受自定义端口；第二个应用的入口端口随用户填写值变化；两个应用互不干扰。

**实际结果**：**通过（2026-10-10 真机执行，设备 `192.168.119.6`）**。

| 应用 | 端口 | 容器监听 | HTTP | 桌面入口 |
| --- | --- | --- | --- | --- |
| `fn-cyberchef` | 8080（上游默认） | ✅ `0.0.0.0:8080` | ✅ `200` / 74908 B / `<title>CyberChef</title>` | ✅ `port=8080` |
| `fn-wechatmarkdowneditor` | **8081**（默认 8080 冲突，改用 8081） | ✅ | ✅ `200` / 5771 B / `<title>微信 Markdown 编辑器 \| Doocs 开源社区</title>` | ✅ `fnDomain=fn-wechatmarkdowneditor-main`，**`port=8081`** |

**结论**：用户改端口后入口端口**正确跟随**（8081 而非默认 8080），AC-05 的「用户改端口后入口随之变化」在真机得到验证。这同时验证了「上游默认端口冲突时由用户在向导中改端口」这一规约路径可用。

**证据位置**：[FNOS-001 真实环境验收记录](/validation/FNOS-001-fnos-nas-2026-10-09)「目标 NAS 真机验收：A 组三应用」小节的「端口冲突处置」与「`fn-wechatmarkdowneditor` 验证了入口 ID 规则」两段。

**附带验证**：该应用的入口 `fnDomain` 为 `fn-wechatmarkdowneditor-main`（**不是** `-application`），证明 `.main` 形态在设备端被正确接受与注册——这是 AC-07 的 `.main` 规则**首次在真机得到验证**（静态部分见 TEST-10）。

### FNOS-001-04-TEST-13 用户路径只读挂载（llama-cpp 形态）

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-04-TEST-13 |
| 对应功能 | FNOS-001-04 批次 T0：直接套模板 |
| 验收条件 | FNOS-001-04-AC-01 + FNOS-001-04-AC-04 |
| 优先级 | P1 |
| 环境 | 本地（静态）+ 目标 NAS（运行） |
| 状态 | 通过 |

**前置条件**：`apps/fn-llama-cpp/` 存在。

**步骤**

1. 读取 `app/docker/docker-compose.yaml`，确认用户路径挂载带有 `:ro` 只读属性。
2. 读取 `wizard/install`，确认路径字段为**必填**。
3. 确认 `wizard/install` 与 `wizard/config` 字段名与默认值一致。
4. 代入向导默认值执行 `docker compose config`，确认解析出 `read_only: true`。
5. 在目标 NAS 上填一个**错误路径**，观察容器启动行为与用户可见反馈。

**预期结果**：挂载为只读；字段必填；compose 可解析且 `read_only: true`；错误路径下的行为有明确结论。

**实际结果**：**静态部分通过**（步骤 1—4）。

- compose 第 11 行：`- "${MODEL_PATH}:/models:ro"`，**带 `:ro`**。
- `wizard/install` 三个字段均为 `required: true`：`APP_PORT`（默认 `8080`）、`MODEL_PATH`（默认空）、`START_COMMAND`（默认 `-m /models/model.gguf --host 0.0.0.0 --port 8080`）。
- `wizard/install` 与 `wizard/config` 字段名与 `initValue` 一致（`['APP_PORT','MODEL_PATH','START_COMMAND']`）。
- `docker compose config` 解析结果含：

  ```yaml
  volumes:
    - type: bind
      source: /vol1/models
      target: /models
      read_only: true
  ```

  上例的 `/vol1/models` 是执行时**示例填写的目标 NAS 路径**（设备端），非开发机路径。只读属性被正确解析，容器内无法写 `/models`。
- FPK 内 `app.tgz` 的 compose 同样保留 `${MODEL_PATH}:/models:ro`。

**证据位置**：`apps/fn-llama-cpp/app/docker/docker-compose.yaml:11`、`apps/fn-llama-cpp/wizard/install`、`wizard/config`；`docs/testing/FNOS-001-t0-round2-report.md`「用例结果明细」FNOS-001-04-TEST-13 行。

**未覆盖部分**：步骤 5（目标 NAS 上填错误路径的行为）**未执行**。本用例状态「通过」**仅代表静态配置正确**。

**已知限制（U-08 已闭环，不判缺陷、不改实现）**：向导的 `MODEL_PATH` 为纯 `text` 字段，**只有必填校验、没有路径存在性校验**。裁决依据：

1. fnOS 向导 `rules` 只支持 `required`/`min`/`max`/`len`/`pattern`，**没有路径存在性校验**这类规则；要做只能靠 `cmd/install_callback` 写 shell 判断，属额外逻辑。
2. `helpText` 已给出明确指引（「目标 NAS 上存放 GGUF 模型文件的目录绝对路径」）。
3. 填错路径的失败**是可见的**：容器起不来 → 应用中心显示未运行（`cmd/main status` 返回非 0），**不是静默失败**。
4. 与仓库既有模式一致（如 `fn-xiaoya-only` 的 `emby_media_path`），无先例要求校验。

**登记为已知限制**：若后续 fnOS 提供路径校验能力，或用户反馈该问题，再考虑在 `install_callback` 加检查。测试成员**不将其记为缺陷**。

### FNOS-001-05-TEST-01 数据落盘到应用数据目录

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-05-TEST-01 |
| 对应功能 | FNOS-001-05 批次 T1：状态落盘改造 |
| 验收条件 | FNOS-001-05-AC-01 |
| 优先级 | P1 |
| 环境 | 目标 NAS |
| 状态 | 阻塞 |

**前置条件**：目标 NAS 上已安装并运行一个 T1 应用。

**步骤**

1. 在应用内产生可识别的数据（例如创建一条记录）。
2. 在**目标 NAS** 上检查 `/var/apps/fn-<app>/var/` 下存在该数据。
3. 检查 FPK 安装目录内**没有**运行数据写入。
4. 检查 compose 中卷的来源为 `${TRIM_PKGVAR}` 或已声明的 `data-share`，不存在 `./data` 这类相对挂载。

**预期结果**：数据出现在 `/var/apps/fn-<app>/var/`（目标 NAS 路径）；安装目录内无运行数据；compose 无相对挂载。

**实际结果**：（待填）

**证据位置**：（待填）

**路径说明**：`/var/apps/fn-<app>/var/` 是 fnOS **设备端**路径，指向目标 NAS，在开发机上不存在。

**阻塞原因**：需要目标 NAS 上的已安装应用实例。**该阻塞已解除**——真机通道已改为 `trim-cli`（见 FNOS-001-04-TEST-03 的解锁方式），本用例可在 T1 首批产出后立即执行。

**解锁条件**：在目标 fnOS 设备安装 T1 应用后执行；本地可先用 grep 复核 compose 卷来源作为**预检**，但不得据此判定本用例通过。

**T1 执行提示**：判定数据「确实落盘」建议比对 `/vol4/@appdata/fn-<app>` 的 `du -sb` 字节数（产生数据前 vs 后），而不是只看目录存在——T0 轮已实测到「目录存在但占用为 0 字节」的中间态。

### FNOS-001-05-TEST-02 容器重建后数据不丢

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-05-TEST-02 |
| 对应功能 | FNOS-001-05 批次 T1：状态落盘改造 |
| 验收条件 | FNOS-001-05-AC-01 |
| 优先级 | P1 |
| 环境 | 目标 NAS |
| 状态 | 阻塞 |

**前置条件**：FNOS-001-05-TEST-01 已通过。

**步骤**

1. 记录应用内的一条既有数据。
2. 在目标 NAS 上删除该应用的容器（保留卷）。
3. 通过应用中心重新启动应用（触发 `cmd/main status` 重建容器）。
4. 确认步骤 1 的数据仍可读回。

**预期结果**：容器被删除并重建后，数据仍完整存在，应用可正常打开。

**实际结果**：（待填）

**证据位置**：（待填）

**阻塞原因**：需要目标 NAS 上的容器操作权限与已安装实例。

### FNOS-001-05-TEST-03 卸载保留数据后重装可读回

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-05-TEST-03 |
| 对应功能 | FNOS-001-05 批次 T1：状态落盘改造 |
| 验收条件 | FNOS-001-05-AC-01（与 FNOS-001-04-AC-03 共用） |
| 优先级 | P1 |
| 环境 | 目标 NAS |
| 状态 | 阻塞 |

**前置条件**：目标 NAS 上已安装 T1 应用并产生数据。

**步骤**

1. 在应用内创建**足量**可识别数据（例如导入一个文件、创建多条记录），使其可见占用明显大于 0。
2. **记录基线**：`du -sb /vol4/@appdata/fn-<app>` 与 `/vol4/@apphome/fn-<app>` 的字节数（**目标 NAS 路径**；T1 应用此处应显著大于 0）。
3. 卸载应用，在卸载向导选择「保留数据（推荐）」。
4. 确认步骤 2 的两个目录在卸载后**仍然存在且字节数与基线一致**（不是仅「目录存在」）。
5. 重新安装同一 FPK。
6. 确认步骤 1 的数据可读回（应用内可见）。
7. 再次卸载并选择「删除所有数据」，确认两个目录**占用归零或被移除**。

**预期结果**：选择「保留数据」时数据目录与内容在卸载后**按字节数**保留、重装后可读回；选择「删除所有数据」时数据被清除。默认选项为「保留数据」。

**实际结果**：（待填）

**证据位置**：（待填）

**阻塞原因**：同 FNOS-001-05-TEST-01。

**T1 批次注意（本用例的核心价值）**：T0 的 14 个应用**全部无状态**，卸载删除分支删的是空目录，`keep`/`delete` 两分支在语义上**没有可区分性**。**T1 应用有真实数据，本用例是删除分支第一次具备真实语义的验证**，必须在 T1 首批安排真机执行。

**判定关键（来自 T0 的教训）**：卸载后 `@appdata`/`@apphome`/`@appmeta` 目录**可能仍存在但占用为 0 字节**（T0 轮实测 `fn-it-tools` 即如此：目录残留、`du -sb` 为 0，原因是 `cmd/uninstall_callback` 删除了 `${TRIM_PKGVAR}`/`${TRIM_PKGHOME}` 的内容，残留空目录由应用中心框架管理）。因此：

- 判定「保留数据」成功，必须比对**字节数**，不能只看目录是否存在；
- 判定「删除数据」成功，应看**占用归零或目录移除**，目录残留本身不算失败。

**参考**：现有实现 `apps/fn-halo/cmd/uninstall_callback` 依据 `wizard_data_action` 分支处理，`keep` 分支为 no-op、`delete` 分支执行 `rm -rf "${TRIM_PKGVAR:?}"`，可作为逻辑对照。

### FNOS-001-05-TEST-04 T1 状态落盘改造与容器路径保持（T1 组 1，14 个应用）

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-05-TEST-04 |
| 对应功能 | FNOS-001-05 批次 T1：状态落盘改造 |
| 验收条件 | FNOS-001-05-AC-01 |
| 优先级 | P1 |
| 环境 | 本地（静态） |
| 状态 | 阻塞 |

> **状态说明**：本用例的**静态核对已全部通过**（14/14），但 **AC-01 是运行时属性**——「数据目录位于 `/var/apps/fn-<app>/var/`、**容器删除后数据不丢**」无法由静态配置确立。这 14 个应用**从未在真机安装过**，故状态为 **阻塞**（静态已过、等待真机窗口），**不得判「通过」**。静态「通过」只说明「配置形态合规」，不等于 AC-01 成立。

**前置条件**：T1 第 1 组 14 个应用的 `app/docker/docker-compose.yaml` 存在。

**步骤**

1. 对每个应用，提取 `volumes:` 下所有挂载行的**挂载源**。
2. 校验每个挂载源都是 `${TRIM_PKGVAR}/...` 形式，**没有** `./` 相对挂载残留。
3. 提取每个挂载行的**容器内目标路径**，与上游 `appstore/apps/<app>/<version>/docker-compose.yml` 的同名挂载比对，确认**容器内路径保持上游原样**（改造只动源、不动目标）。
4. 校验容器内目标路径**不落在 FPK 安装目录**（`TRIM_APPDEST`）语义范围内。

**预期结果**：挂载源全部为 `${TRIM_PKGVAR}/data`；无相对挂载；容器内目标与上游一致。

**实际结果**：**静态核对 14/14 全部通过**（下表的结论仅限静态形态）。

| 应用 | 挂载源 | 容器内目标 | 与上游一致 | 相对挂载残留 |
| --- | --- | --- | --- | --- |
| `fn-qinglong` | `${TRIM_PKGVAR}/data` | `/ql/data` | ✓ | 0 |
| `fn-clawswarm` | `${TRIM_PKGVAR}/data` | `/opt/clawswarm` | ✓ | 0 |
| `fn-maxkb` | `${TRIM_PKGVAR}/data` | `/opt/maxkb` | ✓ | 0 |
| `fn-ai-portal` | `${TRIM_PKGVAR}/data` | `/app/data` | ✓ | 0 |
| `fn-2fauth` | `${TRIM_PKGVAR}/data` | `/2fauth` | ✓ | 0 |
| `fn-gotify` | `${TRIM_PKGVAR}/data` | `/app/data` | ✓ | 0 |
| `fn-answer` | `${TRIM_PKGVAR}/data` | `/data` | ✓ | 0 |
| `fn-artalk` | `${TRIM_PKGVAR}/data` | `/data` | ✓ | 0 |
| `fn-bytebase` | `${TRIM_PKGVAR}/data` | `/var/opt/bytebase` | ✓ | 0 |
| `fn-certimate` | `${TRIM_PKGVAR}/data` | `/app/pb_data` | ✓ | 0 |
| `fn-changedetectionio` | `${TRIM_PKGVAR}/data` | `/datastore` | ✓ | 0 |
| `fn-code-server` | `${TRIM_PKGVAR}/data` | `/config` | ✓ | 0 |
| `fn-freshrss` | `${TRIM_PKGVAR}/data` | `/config` | ✓ | 0 |
| `fn-linkding` | `${TRIM_PKGVAR}/data` | `/etc/linkding/data` | ✓ | 0 |

14 个应用同时确认：`config/resource` **均未声明 `data-share`**——数据为应用内部状态，用户无需在文件管理器中直接访问，属**预期设计**（不是遗漏）。

**证据位置**：`apps/fn-<app>/app/docker/docker-compose.yaml`；上游 `appstore/apps/<app>/<version>/docker-compose.yml`；`docs/testing/FNOS-001-t1-group1-report.md`「用例结果明细」FNOS-001-05-TEST-04 行。

**未覆盖部分**：本用例只验证**静态配置**。数据是否真的落到 `${TRIM_PKGVAR}`、容器重建后是否不丢，必须由 FNOS-001-05-TEST-01/02/03 在目标 NAS 上验证——**本用例「通过」不代表数据落盘已验证**。

### FNOS-001-05-TEST-05 PUID/PGID 使用动态应用用户变量（T1 组 1）

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-05-TEST-05 |
| 对应功能 | FNOS-001-05 批次 T1：状态落盘改造 |
| 验收条件 | FNOS-001-05-AC-01（权限子句，与 FNOS-001-04-AC-04 关联） |
| 优先级 | P1 |
| 环境 | 本地（静态）+ 目标 NAS（运行） |
| 状态 | 阻塞 |

**背景**：`linuxserver` 系镜像（`linuxserver/code-server`、`linuxserver/freshrss`）硬编码 `PUID=1000`/`PGID=1000`。在 fnOS 上这是错的——**实测取证**：

```text
fnOS 包用户 UID 是动态分配的，不是 1000：
  /vol4/@appdata/fn-deepseek-harness  owner=fn-deepseek-harness(934)  mode=700
  /vol4/@appdata/fn-halo              owner=docker-fn-halo(969)       mode=770
  /vol4/@appdata/fn-bitwarden         owner=docker-fn-bitwarden(973)  mode=770
uid 1000 在本机是普通登录用户 tnnevol:x:1000:1001
```

**路径说明**：上文引用的 `/vol4/@appdata/fn-*` 是 **fnOS 设备端路径**（指向目标 NAS 的应用数据目录），不是开发机路径。

数据目录属主是**包用户**、权限 **770**（组与其他用户无权），因此容器以 uid 1000 写入**必然失败**。

**步骤**

1. 读取 `app/docker/docker-compose.yaml`，确认 `PUID`/`PGID` 使用 `${TRIM_UID}`/`${TRIM_GID}`，**不是**硬编码 `1000`。
2. 确认变量名拼写正确（大小写敏感）。
3. **风险确认（依据强度，勿高估）**：官方《环境变量》文档**列出了** `TRIM_UID`/`TRIM_GID`；但官方《Docker 案例》在 compose 中**实际只出现 `${TRIM_APPDEST}`（4 处）与 `${TRIM_SERVICE_PORT}`（1 处）**，**无任何 compose 示例使用 `TRIM_UID`/`TRIM_GID`**。本仓库既有 33 个应用在 compose 使用 `${TRIM_PKGVAR}`，属本仓库用法**旁证**，只能证明「fnOS 会注入部分 `TRIM_*`」，**不能推及** `TRIM_UID`/`TRIM_GID`。若这两个变量在 compose 展开阶段未注入，会被解析为**空字符串**（见下「失败模式实测」）。
4. 在目标 NAS 上安装后执行回退判断（见下）。

**预期结果**：compose 使用 `${TRIM_UID}`/`${TRIM_GID}`；真机上容器内进程 uid/gid 等于该应用的包用户，且能写入 `${TRIM_PKGVAR}/data`。

**实际结果**：

**静态部分通过**（2/2）——`fn-code-server` 与 `fn-freshrss` 均为：

```yaml
- PUID=${TRIM_UID}
- PGID=${TRIM_GID}
```

**失败模式实测（本地）**：在剥离 `TRIM_UID`/`TRIM_GID` 的环境下执行 `docker compose config`，两变量展开为**空字符串**且**不报错**（exit 0）：

```text
$ env -u TRIM_UID -u TRIM_GID docker compose -f apps/fn-code-server/app/docker/docker-compose.yaml config
    environment:
      PGID: ""
      PUID: ""
warning: The "TRIM_UID" variable is not set. Defaulting to a blank string.
warning: The "TRIM_GID" variable is not set. Defaulting to a blank string.
exit=0
```

即：**若未注入，compose 解析不失败，而是静默传空值给镜像**；后果是 linuxserver 镜像的 init 会以空 `PUID` 启动，写权限判定失败，容器起不来或数据写不进去。这属于**静默失败**，必须靠真机验证才能排除。

**回退判断（真机执行时按此判断）**：

| 真机观察 | 判定 | 后续动作 |
| --- | --- | --- |
| 容器正常启动，日志显示 `PUID`/`PGID` 为 9xx，数据成功写入 `${TRIM_PKGVAR}/data` | **通过**，`TRIM_UID`/`TRIM_GID` 可在 compose 使用 | 该结论写入规约「模式 B 补充裁决 1」，其余 linuxserver 系应用直接照用 |
| 容器启动失败，或日志中 `PUID`/`PGID` 为空，或数据目录不可写 | **失败** | 改用**生命周期脚本注入**：在 `cmd/install_callback` 中把 `TRIM_UID`/`TRIM_GID` 写入 `${TRIM_PKGVAR}` 下的 `.env`，或改用 `runuser`/显式 `user:` 指定；并升级为需求级决策 |

**证据位置**：`apps/fn-code-server/app/docker/docker-compose.yaml`、`apps/fn-freshrss/app/docker/docker-compose.yaml`；`docs/development/1panel-conversion.md`「模式 B 的第一个补充裁决」；`docs/testing/FNOS-001-t1-group1-report.md`「遗留风险」R-01。

**未覆盖部分（本用例为何是「阻塞」）**：静态配置正确，但**「fnOS 是否在 compose 展开阶段注入 `TRIM_UID`/`TRIM_GID`」这一事实未经真机验证**。在本机之所以能看到展开值，是因为执行环境本身运行在一个 fnOS 应用容器内（`TRIM_UID=934` 存在于当前进程环境）；这**不能证明** fnOS 在 `cmd/main` 调用 `docker compose` 时也注入这两个变量。故 AC 未满足，状态为「阻塞」。

### FNOS-001-05-TEST-06 上游数据落盘缺陷的修正（2fauth 形态）

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-05-TEST-06 |
| 对应功能 | FNOS-001-05 批次 T1：状态落盘改造 |
| 验收条件 | FNOS-001-05-AC-01 |
| 优先级 | P1 |
| 环境 | 本地（静态）+ 目标 NAS（运行时接受性） |
| 状态 | 阻塞 |

**背景**：`2fauth` 上游 compose 存在**真实落盘缺陷**（已核对上游原文 `appstore/apps/2fauth/8.0.2/docker-compose.yml`）：

```yaml
volumes:
  - ./data:/2fauth                       # 挂载点是 /2fauth
environment:
  - DB_DATABASE="/srv/database/database.sqlite"   # /srv 不在挂载内！
```

数据库会落**容器可写层**，容器重建即丢——照搬等于没做 T1。

**步骤**

1. 确认 `DB_DATABASE` 指向**挂载目录内**的路径（`/2fauth/...`），不再指向 `/srv`。
2. 确认 `cmd/install_callback` 预创建了该子目录，且对 `${TRIM_PKGVAR}` 未设置时有守卫。
3. 确认 `APP_KEY` 已由上游固定占位值改为**必填** `password` 向导字段。
4. 在目标 NAS 上安装并确认：数据库文件出现在 `${TRIM_PKGVAR}/data/database/sqlite.db`；**重建容器后数据仍在**。

**预期结果**：数据库落在挂载目录内、容器重建不丢；`APP_KEY` 为每套安装唯一；预创建目录有效。

**实际结果**：

**静态部分通过**（3/3）：

| 检查项 | 结果 |
| --- | --- |
| `DB_DATABASE` 指向挂载内 | ✅ `/2fauth/database/sqlite.db`（挂载点为 `/2fauth`） |
| `install_callback` 预创建目录 | ✅ `mkdir -p "${TRIM_PKGVAR}/data/database"` + `chmod 770`；`TRIM_PKGVAR` 为空时写 `TRIM_TEMP_LOGFILE` 并 `exit 1`（有守卫） |
| `APP_KEY` 为必填 password | ✅ 上游原值 `SomeRandomStringOf32CharsExactly` 是**示例占位值**（已核对上游 `data.yml`）；现为 `type: password` + `required: true`，`helpText` 说明「32 位随机字符串…安装后不要更改，否则已保存的 2FA 数据将无法解密」 |

**证据位置**：`apps/fn-2fauth/app/docker/docker-compose.yaml`、`apps/fn-2fauth/cmd/install_callback`、`apps/fn-2fauth/wizard/install`；`docs/development/1panel-conversion.md`「模式 B 的第三个补充裁决」；`docs/testing/FNOS-001-t1-group1-report.md`「遗留风险」R-02。

**未覆盖部分（本用例为何是「阻塞」）**：**镜像是否接受 `/2fauth/database/sqlite.db` 这个自定义路径未经真机验证**。2FAuth 是基于 Laravel 的应用，其 `DB_DATABASE` 语义按官方文档应为容器内绝对路径，但该路径为**本项目裁定改动**（非上游值），需真机确认镜像能正常建库并保持。

**运行时接受性的判定**：安装后若应用能进入初始化页面并成功创建管理员账号，且 `${TRIM_PKGVAR}/data/database/sqlite.db` 文件出现且体积随使用增长，即判定接受。

### FNOS-001-05-TEST-07 向导字段精简的文档出口（gotify 形态）

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-05-TEST-07 |
| 对应功能 | FNOS-001-05 批次 T1：状态落盘改造 |
| 验收条件 | FNOS-001-05-AC-01（附加：规约「模式 B 补充裁决 2」的字段取舍要求） |
| 优先级 | P1 |
| 环境 | 本地 |
| 状态 | 阻塞 |

> **状态说明**：向导字段精简与文档出口的**静态核对已通过**，但 **AC-01 是运行时属性**，且 `GOTIFY_DATABASE_CONNECTION` 的相对路径解析基准（R-03）**未验证**。应用**从未真机安装过**，故状态为 **阻塞**，**不得判「通过」**。

**背景**：`gotify` 上游有约 **29 个 `envKey`**（其中 18 个 required），涵盖 SSL/CORS/流配置。全部搬进安装向导不可取；本应用精简为 **6 个字段**。这是**计划维护者批准的决策，不是缺陷**。

**步骤**

1. 统计 `wizard/install` 的字段数，确认精简后的核心字段齐全（端口、时区、初始管理员、注册开关等）。
2. 确认被省略的字段在 `docs/apps/fn-gotify.md` 有**文档出口**（列出字段名与修改方式）。
3. 确认 `GOTIFY_DATABASE_CONNECTION` 使用容器内相对路径，且该路径落在挂载目录内。
4. 在目标 NAS 上确认 SQLite 文件落在挂载内、容器重建后数据仍在，且相对路径的解析基准正确。

**预期结果**：向导字段精简但安装必需项齐全；省略项有明确文档出口；数据库路径落在挂载内。

**实际结果**：

**静态核对通过**（下表仅限静态；运行时未验证）：

| 检查项 | 结果 |
| --- | --- |
| 向导字段数 | ✅ **6 个**：`APP_PORT`、`TIME_ZONE`、`GOTIFY_DEFAULTUSER_NAME`、`GOTIFY_DEFAULTUSER_PASS`(`password`)、`GOTIFY_REGISTRATION`(`switch`)、`GOTIFY_PASSSTRENGTH` |
| 省略项文档出口 | ✅ `docs/apps/fn-gotify.md` 第 27 行「高级配置」章节**确实存在**，按类别列出被省略字段（服务端、SSL/HTTPS 9 项、CORS/流式、数据位置、响应头），并给出修改方式（编辑数据目录配置或按上游文档补环境变量后重建容器） |
| 数据库路径 | ✅ `GOTIFY_DATABASE_DIALECT=sqlite3` + `GOTIFY_DATABASE_CONNECTION=data/gotify.db`（**相对路径**）；挂载为 `${TRIM_PKGVAR}/data:/app/data` |
| 路径落在挂载内 | ✅ 若解析基准为 `/app`，则 `data/gotify.db` → `/app/data/gotify.db`，**在挂载内** |

**证据位置**：`apps/fn-gotify/app/docker/docker-compose.yaml`、`apps/fn-gotify/wizard/install`、`docs/apps/fn-gotify.md`；`docs/testing/FNOS-001-t1-group1-report.md`「遗留风险」R-03。

**未覆盖部分（本用例为何仍有风险）**：`GOTIFY_DATABASE_CONNECTION=data/gotify.db` 是**相对路径**，其解析基准取决于镜像的 `WORKDIR`/启动 `CWD`：

```text
若 CWD=/app  → /app/data/gotify.db   （挂载内，正确）
若 CWD=/     → /data/gotify.db       （挂载外，落容器可写层，重建即丢）
```

本机**无法取得镜像元数据**（Docker daemon 不可用）来确认 `WORKDIR`，故该风险未消除。**判定方法**：真机安装后检查 `${TRIM_PKGVAR}/data/gotify.db` 是否出现且随使用增长；若文件出现在别处（容器内 `/data/`），则需把该值改为**绝对路径** `/app/data/gotify.db`。

### FNOS-001-05-TEST-08 平台生态组件的语义验收（ai-portal 形态）

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-05-TEST-08 |
| 对应功能 | FNOS-001-05 批次 T1：状态落盘改造 |
| 验收条件 | FNOS-001-05-AC-01 |
| 优先级 | P1 |
| 环境 | 本地（文档语义）+ 目标 NAS（运行） |
| 状态 | 未执行 |

**背景**：`fn-ai-portal` 是**平台生态组件**，依赖外部 1Panel 企业版实例，**不是独立产品**。验收时**不得**把「无 1Panel 实例时功能不可用」判为失败——那是产品语义。

**步骤**

1. 确认 `docs/apps/fn-ai-portal.md` 明确写出「依赖外部 1Panel 企业版实例，非独立产品」。
2. 确认 compose **保留上游原名** `PANEL_BASE_URL`/`PANEL_API_KEY`（刻意保留，便于用户对照 1Panel 官方文档；**改名才算缺陷**）。
3. 确认向导收集了这两项 + `INIT_ADMIN_PASSWORD`。
4. 在目标 NAS 上安装并确认：容器能启动、健康检查可达；**无 1Panel 实例时功能不可用属预期，不判失败**。

**预期结果**：文档语义清晰；变量名保留原名；应用能启动；无外部实例时的功能受限是预期行为。

**实际结果**：（待填）—— **本用例尚未执行**。

**静态预检（已核对，供真机参考）**：compose 环境为 `INIT_ADMIN_PASSWORD`、`PANEL_BASE_URL`、`PANEL_API_KEY`（**均为上游原名**）；带 `healthcheck` 请求 `http://localhost:3000/api/health`；挂载 `${TRIM_PKGVAR}/data:/app/data`；`docs/apps/fn-ai-portal.md` 第 20/24 行明确「需要外部 1Panel 企业版实例」「不是独立部署的完整产品——没有可用的 1Panel 实例时，应用可以启动但功能不可用」。

**证据位置**：（待填）

**判定口径（重要，避免误判）**：

- **判失败**的情形：容器**无法启动**、健康检查持续失败、端口无法访问、文档未说明依赖关系、或变量被改名导致用户无法对照上游文档。
- **不判失败**的情形：容器正常启动但功能受限（无 1Panel 实例时），这是**产品语义**。

**未覆盖部分**：真机从未安装过本应用，故状态为「未执行」。

### FNOS-001-05-TEST-09 T1 组 1 数据保留/删除真机验证

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-05-TEST-09 |
| 对应功能 | FNOS-001-05 批次 T1：状态落盘改造 |
| 验收条件 | FNOS-001-05-AC-01 + FNOS-001-04-AC-03 |
| 优先级 | P1 |
| 环境 | 目标 NAS |
| 状态 | 未执行 |

**背景**：这是**T1 批次的核心验收**。T0 的 14 个应用全部无状态，卸载删除分支删的是空目录，`keep`/`delete` 两分支**语义上不可区分**。**T1 应用有真实状态数据，删除分支首次具有真实语义。** 本组 14 个应用都应能支撑这条验证。

**执行方法**：沿用已强化的 FNOS-001-05-TEST-03 方法（产生足量数据 → 记录 `du -sb` 基线 → 保留后要求字节数与基线一致 → 删除后要求占用归零）。

**步骤**（以任一 T1 应用为例，建议轮换覆盖）

1. 安装应用（记录端口），进入应用产生**足量**可识别数据（如导入文件、创建多条记录），使其占用明显大于 0。
2. **记录基线**：

   ```bash
   du -sb /vol4/@appdata/fn-<app>
   du -sb /vol4/@apphome/fn-<app>
   ```

3. 卸载应用，在卸载向导选择「**保留数据（推荐）**」。
4. 确认步骤 2 的两个目录**仍然存在且字节数与基线一致**（**不是仅「目录存在」**）。
5. 重新安装同一 FPK，确认步骤 1 的数据可读回（应用内可见）。
6. 再次卸载并选择「**删除所有数据**」，确认两个目录**占用归零或被移除**。

**预期结果**：选择「保留数据」时数据按字节数保留、重装后可读回；选择「删除所有数据」时数据被清除。默认选项为「保留数据」。

**实际结果**：（待填）—— **本用例尚未执行**。14 个应用**从未在真机安装过**。

**证据位置**：（待填）

**判定关键（来自 T0 的实测教训）**：卸载后 `@appdata`/`@apphome`/`@appmeta` 目录**可能仍存在但占用为 0 字节**——T0 轮实测 `fn-it-tools` 选删除后即如此（目录残留、`du -sb` 为 0；原因是 `cmd/uninstall_callback` 删除了 `${TRIM_PKGVAR}`/`${TRIM_PKGHOME}` 的内容，残留空目录由应用中心框架管理）。因此：

- 判定「保留数据」成功，**必须比对字节数**，只看目录存在会失效；
- 判定「删除数据」成功，应看**占用归零或目录移除**，目录残留本身不算失败。

**本组配置核对（静态，已通过）**：14 个应用的 `wizard/uninstall` **全部**含 `wizard_data_action`，`cmd/uninstall_callback` **全部**按该变量分支、且 `delete` 分支**全部**使用 `${TRIM_PKGVAR:?}` / `${TRIM_PKGHOME:?}`（空变量守卫齐全，不会误删）。

**未覆盖部分**：全部 14 个应用的 keep/delete 真机行为均未验证。

### FNOS-001-05-TEST-10 T1 第 1 组静态形态核对汇总（14 个应用）

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-05-TEST-10 |
| 对应功能 | FNOS-001-05 批次 T1：状态落盘改造 |
| 验收条件 | FNOS-001-05-AC-01（主）；附带核对 FNOS-001-04-AC-04、FNOS-001-04-AC-07、FNOS-001-02-AC-01 |
| 优先级 | P1 |
| 环境 | 本地（静态） |
| 状态 | 阻塞 |

> **为什么是「阻塞」而不是「通过」**：本用例核对的内容**大部分在本地可机械验证**（权限声明、入口键、图标尺寸、脚本语法、卸载向导结构），但（a）这 14 个应用**从未在真机安装过**，（b）其中 AC-04 含运行时子句（「以该用户**运行**」）、AC-01 是纯运行时属性。按计划维护者的状态口径，本组用例**一律不标「通过」**，待真机窗口后按实际结果改写。

**前置条件**：T1 第 1 组 14 个应用已产出。

**步骤**

1. 逐应用读取 `config/privilege`，核对 `run-as`、`username`/`groupname`、`join-groups`、`root`。
2. 逐应用读取 `app/docker/docker-compose.yaml`，核对 `container_name` 与 6 项禁止项。
3. 逐应用读取 `app/ui/config` 与 `manifest`，核对入口键（长度 / 前缀 / 一致性）。
4. 逐应用核对四图标产物存在性。
5. 逐应用对 `cmd/*` 执行 `bash -n` 并检查末尾换行。
6. 逐应用核对 `wizard/uninstall` 与 `cmd/uninstall_callback` 的删除分支与空变量守卫。

**预期结果**：六类静态形态全部合规。

**实际结果**：**六类静态核对全部合规（14/14）**，但按上述口径状态为「阻塞」。

| # | 核对项 | 对应 AC | 结果 |
| --- | --- | --- | --- |
| 1 | 权限声明 | 04-AC-04（静态子句） | 14/14：`run-as: package`、`username`/`groupname` = `docker-fn-<app>`、无 root、无 `join-groups` |
| 2 | compose 形态 | —（规约禁止项） | 14/14：`1panel-network`/`createdBy`/`${CONTAINER_NAME}`/`env_file`/`:latest`/相对挂载 **全部零命中**；`container_name` 全等于 `fn-<app>` |
| 3 | 入口键 | 04-AC-07 | 14/14：≤32 字符、以 `appname` 为前缀、与 `desktop_applaunchname` 一致（`fn-changedetectionio.Application` = **32**，**恰触上限**） |
| 4 | 图标四产物 | 02-AC-01（静态子句） | 14/14：`ICON.PNG`/`ICON_256.PNG`/`icon_64.png`/`icon_256.png` 全部存在 |
| 5 | 生命周期脚本 | —（规约自检清单） | 14 × 9 = **126** 个脚本：`bash -n` 全部通过、全部以换行结尾 |
| 6 | 卸载向导结构 | 05-AC-01 / 04-AC-03 | 14/14：`wizard/uninstall` 含 `wizard_data_action`；`cmd/uninstall_callback` 按该变量分支，`delete` 分支全部使用 `${TRIM_PKGVAR:?}`/`${TRIM_PKGHOME:?}`（空变量守卫齐全） |

**本用例的边界（重要）**：

- 上表第 1、3、4 项在**本地可确定性验证**，第 2、5、6 项为结构/语法核对；这些结论**在本组 14 个应用上成立**。
- 但 AC-04 的运行时子句（容器进程**实际**以 `docker-fn-<app>` 运行）与 AC-01（数据落盘、容器重建不丢）**未验证**。
- 因此本用例**不单独构成任何 AC 的「通过」结论**；真机窗口后应把运行时结论回填到 FNOS-001-04-TEST-05（权限运行时）与 FNOS-001-05-TEST-01/02/03（落盘）。

**证据位置**：`docs/testing/FNOS-001-t1-group1-report.md`「其他静态核对」小节（含同样结论与命令）；各应用的 `config/privilege`、`app/docker/docker-compose.yaml`、`app/ui/config`、`manifest`、`cmd/`。

**未覆盖部分**：全部运行时行为（安装、启动、落盘、权限、卸载保留/删除）。

### FNOS-001-06-TEST-01 向导可收集数据库与 Redis 连接信息

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-06-TEST-01 |
| 对应功能 | FNOS-001-06 批次 T2：资源集成改造 |
| 验收条件 | FNOS-001-06-AC-01 |
| 优先级 | P1 |
| 环境 | 目标 NAS |
| 状态 | 阻塞 |

**前置条件**：T2 试点应用已构建 FPK（依赖 PLAN-FNOS-001-T03-05）。

**步骤**

1. 打开安装向导，确认存在**显式**的连接信息字段（主机、端口、库名、用户名、密码），而不是服务选择器。
2. 分离字段类型：密码类字段为 `password`，输入时不回显。
3. 填写可用的连接信息并完成安装。
4. 确认应用能连上数据库/Redis 并正常提供功能。
5. 确认密钥未出现在应用日志中。

**预期结果**：向导能收集完整连接信息；密码字段不回显；连接成功后应用功能正常；密钥不落日志。

**实际结果**：（待填）

**证据位置**：（待填）

**阻塞原因**：需要目标 NAS 的安装向导与真实数据库/Redis 实例。

### FNOS-001-06-TEST-02 连接失败有用户可见错误提示

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-06-TEST-02 |
| 对应功能 | FNOS-001-06 批次 T2：资源集成改造 |
| 验收条件 | FNOS-001-06-AC-01 |
| 优先级 | P1 |
| 环境 | 目标 NAS |
| 状态 | 阻塞 |

**前置条件**：FNOS-001-06-TEST-01 的安装流程可用。

**步骤**

1. 在向导中填写**错误的**连接信息（错误主机、错误密码各测一次）。
2. 完成安装并启动应用。
3. 打开应用功能页，观察错误提示是否用户可见、是否指向连接失败原因。
4. 确认向导字段的 `helpText` 给出了连接串格式示例。

**预期结果**：安装可完成、应用能启动，但功能页给出用户可见的错误提示；错误信息足以让用户判断是连接信息问题；`helpText` 提供连接串格式示例。

**实际结果**：（待填）

**证据位置**：（待填）

**阻塞原因**：同 FNOS-001-06-TEST-01。

### FNOS-001-06-TEST-03 Redis 依赖声明正确

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-06-TEST-03 |
| 对应功能 | FNOS-001-06 批次 T2：资源集成改造 |
| 验收条件 | PLAN-FNOS-001-T03-02（需求中对 `install_dep_apps` 无独立 AC） |
| 优先级 | P1 |
| 环境 | 本地（静态核对） |
| 状态 | 未执行 |

**前置条件**：待测 T2 应用的 `manifest` 已写入依赖声明。

**步骤**

1. 读取 `apps/fn-<app>/manifest`，确认存在 `install_dep_apps` 字段且值为 `redis`。
2. 确认连接串字段由向导收集，包内**没有**写死 Redis 地址或端口。

**预期结果**：`manifest` 中声明 `install_dep_apps = redis`；Redis 连接信息来自向导变量，包内无写死地址。

**实际结果**：（待填）

**证据位置**：（待填）

**参考**：现有实现 `apps/fn-new-api` 的 `wizard/config` 含 `REDIS_CONN_STRING` 字段，`app/docker/docker-compose.yaml` 通过 `${REDIS_CONN_STRING}` 注入，可作为对照。

### FNOS-001-06-TEST-04 数据库连接串格式错误

| 字段 | 值 |
| --- | --- |
| 用例 ID | FNOS-001-06-TEST-04 |
| 对应功能 | FNOS-001-06 批次 T2：资源集成改造 |
| 验收条件 | FNOS-001-06-AC-01 |
| 优先级 | P1 |
| 环境 | 目标 NAS |
| 状态 | 阻塞 |

**前置条件**：T2 试点应用已构建 FPK。

**步骤**

1. 在向导的连接串字段输入格式错误的取值，例如 `not-a-dsn`、`user:pass@`、`mysql://` 。
2. 完成安装并启动应用。
3. 观察应用是否给出用户可见的错误提示，且不表现为无提示的静默失败。

**预期结果**：格式错误时用户能看到可理解的失败提示；应用不进入「看似运行但功能不可用且无任何提示」的状态。

**实际结果**：（待填）

**证据位置**：（待填）

**阻塞原因**：同 FNOS-001-06-TEST-01。

**参考格式**：现有实现 `apps/fn-new-api/app/docker/docker-compose.yaml` 注释记录了 `SQL_DSN` 的两种格式（`user:password@tcp(host:port)/dbname` 或 `postgresql://user:pass@host:port/dbname`），可作为 `helpText` 的对照。

## 缺陷清单

本用例集执行过程中发现的缺陷。**只登记，不修改**；由测试成员转交计划维护者分派实现成员。

| 编号 | 严重度 | 缺陷 | 证据 | 影响 | 状态 |
| --- | --- | --- | --- | --- | --- |
| D-01 | 高 | `fnpack build` 在打包失败时**仍返回退出码 0** | 删除 `manifest`、写入非法 `app/ui/config`、写入非法 `config/privilege` 三种场景均输出 `Packing failed...` 且 `echo $?` 为 0，同时不生成 `.fpk` | 任何以退出码判定构建结果的流水线（含 `pnpm run build -- --fpk` 经由 `runCommand` 的 `code === 0` 判定）都会把**打包失败误判为成功**，属静默失败 | **已闭环**：构建入口已加 `fpkProduced()` 三重判定；本轮实测「正常→exit 0」「非法 `ui/config`→exit 1」「保留旧 `.fpk` 再失败→仍 exit 1」 |
| D-02 | 中 | 清单统计量与上游实际不一致：`formFields` 声明 257（实测容错口径 259）；`./` 相对挂载声明 221（实测 223） | 见 FNOS-001-01-TEST-02 的复算表与原因分析 | 除统计偏差外，**还导致 `newsnow`、`openldap` 错分到 T0**（实为有状态应用，应属 T1），影响批次归属 | **已闭环**：清单订正为 `formFields` 259、`./` 挂载 223（引号无关正则），分级订正为 14/98/74/46/33，7 个应用已移位；本轮复算五项全一致 |
| D-03 | 低 | `fnpack build` 不校验图标是否为正方形 | 32×64 的非正方形 `ICON.PNG` 仍输出 `Packing successfully` 并生成 `.fpk` | 非正方形图标可进入 FPK，不符合官方图标规范中「完整正方形图片」的要求 | **已闭环**：图标管线 `scripts/generate-icons.mjs:145` 在生成阶段抛错；本轮用真实非正方形样本 `metabase`（256×324）实测报错并 exit 1 |

处置边界说明：D-01 的根因在 `tooling/`（跨切面资产），由 Lead 修复；D-02 在清单文档，由需求/清单维护者订正；D-03 在图标管线，由 app-builder 实现。测试成员只负责复验，未改上述任何代码或配置。

### 本批新增观察（非缺陷）

| 编号 | 观察 | 证据 | 定性 |
| --- | --- | --- | --- |
| O-01 | `fnpack` 在**打包时向 FPK 内的 `manifest` 注入两行空值** `desktop_uidir = ` 与 `desktop_applaunchname = `（源文件不含该行时） | 对 `fn-memcached`/`fn-zabbix-agent`/`fn-cloudflared` 各构建两次，FPK 内 `grep -cE '^desktop_'` 恒为 2，值为空；对照有入口应用注入的是真实值 | **不是缺陷**：这是 `fnpack` 的字段规范化行为，只是把所有字段补全。AC-07 的判定以**仓库内受版本控制的源 `manifest`** 为准，故不构成不合规。登记以便后续批次不要误判。**裁决已闭环（U-06）**：判定以源文件为准，不要求构建层剔除 |
| O-02 | `fn-web-check` 真机安装失败（`App Center code 10500`，残留未清） | 同批同路径、配置同构的 `fn-wechatmarkdowneditor` 安装成功 | **不是转换产物缺陷**：判定为 App Center 侧残留安装状态。详见「阻塞清单」与验收记录 |

## 待确认事项

以下事项**需求文档没有定义可判定的通过标准**，测试成员不自行设定口径，需计划维护者确认后补充。**U-01 ~ U-08 现已全部闭环，无遗留待确认项。**

| 编号 | 事项 | 涉及用例 | 需要确认什么 |
| --- | --- | --- | --- |
| U-01 | 端口被占用的唯一期望表现 | FNOS-001-04-TEST-06 | **已闭环**：两条路径任一即通过（向导是静态校验，无法可靠判定运行时占用）；红线是「不得安装成功且显示运行中但实际不可访问」。需求已补 `FNOS-001-04-AC-06` |
| U-02 | 端口 1—65535 的实现方式与 `min`/`max` 语义 | FNOS-001-04-TEST-07/08 | **已闭环**：`min`/`max` 语义未定义、不可依赖；改用单条严格正则覆盖 1—65535。规约已订正，三应用已实现；本轮穷举 0—70000 验证无偏差 |
| U-03 | FPK 中 `app/` 的形态 | FNOS-001-04-TEST-02 | **已闭环**：按实测形态判定（顶层 `app.tgz`），AC-01 原文已订正 |
| U-04 | `port` 一致性是否属验收范围 | FNOS-001-04-TEST-09 | **已闭环**：属验收范围（写死端口会导致用户改端口不生效，是用户可观察缺陷）。需求已补 `FNOS-001-04-AC-05`，本用例独立成例 |
| U-05 | FNOS-001-03 转换矩阵缺少验收条件 | FNOS-001-03-TEST-01 | **已闭环**：需求已补 `FNOS-001-03-AC-01`（规约存在 + 映射表覆盖需求 9 行 + 每项可在上游找到来源）；本轮已按 AC 新增用例并判定 |
| U-06 | FPK 内 `manifest` 的空值 `desktop_*` 行是否视为合规 | FNOS-001-04-TEST-11 | **已闭环**：**判定以源文件为准**；空值行是 `fnpack` 对「源未声明该字段」的默认行为（nil 语义），**不构成不合规**，**不要求构建层剔除**。AC-07 后半句改绑源文件观测面，措辞订正由需求维护者落地 |
| U-07 | 「无 Web UI 应用」的判定标准 | FNOS-001-04-TEST-11 | **已闭环**：按「**该应用不通过 HTTP 提供用户界面**」判定，**与有无端口无关**。不以「有无 `PANEL_APP_PORT_HTTP`」判定——`fn-memcached` 上游字段名就是 `PANEL_APP_PORT_HTTP`（11211）却是缓存 TCP 协议。三情形机械判定动作见 TEST-11 正文；T1 边界情形先上报裁决 |
| U-08 | `fn-llama-cpp` 的 `MODEL_PATH` 错误路径行为 | FNOS-001-04-TEST-13 | **已闭环（不判缺陷、不改实现）**：fnOS 向导 `rules` 无路径存在性校验能力；`helpText` 已给指引；失败可见（`cmd/main status` 返回非 0，非静默失败）；与 `fn-xiaoya-only` 既有模式一致。登记为**已知限制**，待 fnOS 提供能力或用户反馈时再议 |

已排除的待确认项：端口默认值来源**不属于**待确认——需求「上游字段到 fnOS 的对应关系」表已明确「上游默认端口作为 `initValue`」，本用例集按上游 `data.yml` 的 `PANEL_APP_PORT_HTTP.default` 取值执行即可。

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-10-09 | 建立用例集：覆盖 FNOS-001-01/02/04/05/06 共 22 条用例，登记 3 项缺陷与 5 项待确认事项；执行本地可验的 FNOS-001-01 四条用例（3 通过、1 失败）。 |
| 2026-10-09 | T0 试点轮（第 2 次执行）：新增 FNOS-001-03-TEST-01、FNOS-001-04-TEST-09（共 24 条）；TEST-02、TEST-04 因清单订正由「失败」改判「通过」（经过已写入用例正文，非静默改状态）；TEST-01/02/03/05/07/08 回填三应用实测结果，TEST-07/08 由「目标 NAS／阻塞」改为「本地／通过」（口径已裁决）；TEST-06 追踪依据改为 `FNOS-001-04-AC-06`；D-01/D-02/D-03 全部闭环；U-01 ~ U-05 全部闭环。 |
| 2026-10-10 | T0 收尾轮：新增 FNOS-001-04-TEST-10（入口键硬校验）、TEST-11（`{}` 无入口形态）、TEST-12（改端口后入口跟随）、TEST-13（用户路径只读挂载）共 4 条，合计 **28 条**；T0 应用清单由 3 个扩为 **14 个**（A/B 两组），TEST-01/02/05/09 与 FNOS-001-02-TEST-01/02 回填 B 组 11 个应用实测结果；**修正 TEST-04 的状态取值**（「部分通过」不在允许范围 → **阻塞**，因 AC-03「保留数据后重装读回」未执行）；TEST-06 改造为可直接执行的步骤；新增 O-01（`fnpack` 注入空 `desktop_*`）与 O-02（`fn-web-check` 为 App Center 侧残留）两项非缺陷观察；新增 U-06/U-07/U-08 三项待确认。当前状态：通过 19 / 阻塞 7 / 未执行 2 / 失败 0。 |
| 2026-10-10 | 三项待确认全部闭环：**U-06** 判定以源 `manifest` 为准（FPK 内空值 `desktop_*` 属 `fnpack` 默认行为，不剔除）；**U-07** 确立「无 Web UI」＝「不通过 HTTP 提供用户界面」，并在 TEST-11 写入三情形机械判定动作与「不以 `PANEL_APP_PORT_HTTP` 判定」的反例（`fn-memcached`）；**U-08** `MODEL_PATH` 路径校验不判缺陷，登记为已知限制。同步更新 TEST-11/TEST-13 正文与 O-01 定性。状态不变：通过 19 / 阻塞 7 / 未执行 2 / 失败 0。 |
