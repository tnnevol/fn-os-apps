---
title: FNOS-001 T0 收尾批次测试报告（11 个应用）
description: fn-browserless 等 11 个 T0 收尾应用的构建、规范核对与真机验收回填报告。
lastVerified: 2026-10-10
---

# FNOS-001 T0 收尾批次测试报告（11 个应用）

本报告记录 [FNOS-001 1Panel 应用商店应用转换](/requirements/FNOS-001-1panel-app-conversion) T0 批次**收尾 11 个应用**的测试执行结果，并回填 2026-10-10 的真机验收证据。用例定义与编号规则见 [FNOS-001 1Panel 应用转换测试用例](/testing/FNOS-001-test-cases) 与[测试用例规范](/testing/index)。

第 1 轮（A 组 3 个应用）的报告见 [FNOS-001 T0 试点批次第 1 轮测试报告](/testing/FNOS-001-t0-round1-report)。

## 本报告要纠正的问题

维护者此前在需求与计划中写「14 个应用全部产出并**本地验收通过**」，但用例集里 **11 个新应用名一个都没有出现**——即「构建通过」被当成了「验收通过」。本报告补齐这 11 个应用的真实用例覆盖，并把「本地验证」与「真机验收」严格分开陈述。

**本轮起，报告与用例的措辞纪律**：

- 「构建通过」只写「构建通过」，**不写**「验收通过」「已完成」；
- 「本地通过」明确标注为**静态/本地范围**，并列出未覆盖的运行时部分；
- 只有真机取证过的结论才写「真机通过」。

## 执行范围

| 应用 | 目录 | 形态特征 |
| --- | --- | --- |
| `fn-browserless` | `apps/fn-browserless/` | 常规入口；上游默认端口 3000 |
| `fn-chatgpt-next-web` | `apps/fn-chatgpt-next-web/` | 常规入口；入口键 31 字符（最接近 32 上限） |
| `fn-cloudflared` | `apps/fn-cloudflared/` | **`{}` 无入口**，上游无端口字段 |
| `fn-cyberchef` | `apps/fn-cyberchef/` | 常规入口；真机已验证（端口 8080） |
| `fn-llama-cpp` | `apps/fn-llama-cpp/` | **用户路径只读挂载** `${MODEL_PATH}:/models:ro` |
| `fn-lobe-chat` | `apps/fn-lobe-chat/` | 常规入口 |
| `fn-memcached` | `apps/fn-memcached/` | **`{}` 无入口**；端口 11211 |
| `fn-web-check` | `apps/fn-web-check/` | 常规入口；真机安装失败（定性见下） |
| `fn-wechatmarkdowneditor` | `apps/fn-wechatmarkdowneditor/` | **`.main` 入口**（`.Application` 为 35 字符，超 32 上限） |
| `fn-yesplaymusic` | `apps/fn-yesplaymusic/` | 常规入口 |
| `fn-zabbix-agent` | `apps/fn-zabbix-agent/` | **`{}` 无入口**；上游用 `PANEL_APP_PORT_AGENT` |

## 环境与命令

| 项 | 值 |
| --- | --- |
| 仓库 | `fn-os-apps/`（工作区根为 `fn-os-apps/` 的上一级） |
| Node.js | v24.15.0 |
| fnpack | 1.2.4（由 `PATH` 解析） |
| Docker Compose | v5.1.0（仅用于 `config` 解析，无 daemon） |
| 目标 fnOS 设备 | `${FNOS_HOST}:5666`，fnOS `1.2.0800`，kernel `6.18.18.c1126-trim`，x86_64（真机部分） |
| 构建目录 | 临时目录下的源目录副本（本轮用 `mktemp -d`），避免把 `.fpk` 写入受版本控制目录 |

主要命令：

```bash
# 0) 准备构建目录：复制到临时目录，避免污染 apps/
BUILD="$(mktemp -d)"
for a in fn-browserless fn-chatgpt-next-web fn-cloudflared fn-cyberchef fn-llama-cpp \
         fn-lobe-chat fn-memcached fn-web-check fn-wechatmarkdowneditor \
         fn-yesplaymusic fn-zabbix-agent; do
  cp -r "apps/$a" "$BUILD/"
done

# 1) 构建（逐应用，三重判定：exit 0 且 .fpk 存在 且 mtime ≥ 构建开始）
cd "$BUILD/<app>" && fnpack build

# 2) 包结构
tar tzf <app>.fpk
tar xzOf <app>.fpk app.tgz | tar tz

# 3) compose 静态解析（代入向导默认值）
docker compose -f apps/<app>/app/docker/docker-compose.yaml config

# 4) 生命周期脚本语法与末尾换行
for f in apps/<app>/cmd/*; do bash -n "$f"; done

# 5) 窗口校验
pnpm run check -- --all && pnpm run lint && git diff --check
```

## 逐条结果汇总

本轮新增 4 条用例（TEST-10~13），并把 11 个应用的回填并入既有用例。

| 用例 ID | 验收条件 | 环境 | 状态 | 本轮变化 |
| --- | --- | --- | --- | --- |
| FNOS-001-04-TEST-01 | 04-AC-01 | 本地 | 通过 | 回填 B 组 11 个应用的构建结果 |
| FNOS-001-04-TEST-02 | 04-AC-01 | 本地 | 通过 | 回填 B 组 11 个应用的包结构 |
| FNOS-001-04-TEST-03 | 04-AC-02 | 目标 NAS | 通过 | 补充 `fn-cyberchef`/`fn-wechatmarkdowneditor` 真机证据 |
| FNOS-001-04-TEST-04 | 04-AC-03 | 目标 NAS | **阻塞** | **状态取值修正**（原记「部分通过」，不在允许范围） |
| FNOS-001-04-TEST-05 | 04-AC-04 | 本地 | 通过 | 回填 11 个应用的权限静态核对 |
| FNOS-001-04-TEST-06 | 04-AC-06 | 目标 NAS | 未执行 | **改造为可直接执行的步骤** |
| FNOS-001-04-TEST-09 | 04-AC-05 | 本地 | 通过 | 回填 B 组有入口应用 |
| FNOS-001-02-TEST-01 | 02-AC-01 | 本地 | 通过 | 回填 11 个应用图标 |
| FNOS-001-02-TEST-02 | 02-AC-01 | 本地 | 通过 | 回填；标注 3 个无入口应用为 N/A |
| **FNOS-001-04-TEST-10** | **04-AC-07** | 本地 | 通过 | **新增**：入口键长度/前缀/一致性三维硬校验 + 边界实测 |
| **FNOS-001-04-TEST-11** | **04-AC-07** | 本地 | 通过 | **新增**：`{}` 无入口形态（3 个应用） |
| **FNOS-001-04-TEST-12** | **04-AC-02 + AC-05** | 目标 NAS | 通过 | **新增**：改端口后入口跟随（真机已验证） |
| **FNOS-001-04-TEST-13** | **04-AC-01 + AC-04** | 本地 | 通过 | **新增**：用户路径只读挂载 |

用例集整体统计（28 条）：**通过 19 / 阻塞 7 / 未执行 2 / 失败 0**。

## 用例结果明细

### FNOS-001-04-TEST-01 构建（11 个应用逐项）

全部满足三重判定（退出码 0 + `.fpk` 存在 + mtime ≥ 构建开始）：

| 应用 | 退出码 | `.fpk` 大小 | 应用 | 退出码 | `.fpk` 大小 |
| --- | --- | --- | --- | --- | --- |
| `fn-browserless` | 0 | 27887 B | `fn-memcached` | 0 | 78708 B |
| `fn-chatgpt-next-web` | 0 | 94975 B | `fn-web-check` | 0 | 150218 B |
| `fn-cloudflared` | 0 | 105686 B | `fn-wechatmarkdowneditor` | 0 | 34935 B |
| `fn-cyberchef` | 0 | 79598 B | `fn-yesplaymusic` | 0 | 105040 B |
| `fn-llama-cpp` | 0 | 17662 B | `fn-zabbix-agent` | 0 | 33467 B |
| `fn-lobe-chat` | 0 | 183763 B | — | — | — |

### FNOS-001-04-TEST-02 包结构（11 个应用逐项）

全部：顶层 **21** 个非目录条目、`cmd/` **9** 个脚本、`wizard/` **3** 个文件、`app.tgz` 内 `ui/config` 存在、`.DS_Store` 计数 **0**。

### FNOS-001-04-TEST-10 入口 ID 硬校验（新增，AC-07）

**三处硬校验实测**（在临时副本中构造，未改动 `apps/`）：

| 构造 | `fnpack build` 输出 | 退出码 | `.fpk` |
| --- | --- | --- | --- |
| 入口键恰好 **32** 字符 | `Packing successfully.` | 0 | **生成** ✓ |
| 入口键恰好 **33** 字符 | `Packing failed. The entry ID "fn-cyberchef.aaaaaaaaaaaaaaaaaaaa" exceeds the 32-character limit.` | **0** | 未生成 ✗ |
| 键**不以 appname 为前缀** | `Packing failed. The entry name "badprefix.Application" in "app/ui/config" should start with fn-cyberchef` | **0** | 未生成 ✗ |
| 键与 `desktop_applaunchname` **不一致** | `Packing failed. The value of desktop_applaunchname in manifest does not match any entry name defined in app/ui/config` | **0** | 未生成 ✗ |

**关键发现**：后三种失败场景 `fnpack` **仍返回退出码 0**，只有「`.fpk` 是否产出」能识别失败。这再次印证 FNOS-001-04-TEST-01 的三重判定口径是必需的（缺陷 D-01）。

**14 个应用入口键全量核对**（覆盖率 14/14）：

| 形态 | 应用 | 入口键 | 长度 |
| --- | --- | --- | --- |
| `.Application` | `fn-adminer` | `fn-adminer.Application` | 22 |
| `.Application` | `fn-it-tools` | `fn-it-tools.Application` | 23 |
| `.Application` | `fn-cyberchef` / `fn-llama-cpp` / `fn-lobe-chat` / `fn-web-check` | `fn-<app>.Application` | 24 |
| `.Application` | `fn-browserless` | `fn-browserless.Application` | 26 |
| `.Application` | `fn-yesplaymusic` | `fn-yesplaymusic.Application` | 27 |
| `.Application` | `fn-linux-command` | `fn-linux-command.Application` | 28 |
| **`.main`** | `fn-wechatmarkdowneditor` | `fn-wechatmarkdowneditor.main` | **28** |
| `.Application` | `fn-chatgpt-next-web` | `fn-chatgpt-next-web.Application` | 31 |
| `{}` | `fn-cloudflared` / `fn-memcached` / `fn-zabbix-agent` | — | N/A |

`wechatmarkdowneditor` 的 `<app>` 长度为 **20** 字符（`appname` = `fn-wechatmarkdowneditor` 为 23 字符），`.Application` 形式合计 **35** 字符超限，故按规约改用 `.main`（28 字符）。等价判据：**`<app>` ≥ 18 字符时 `.Application` 必然超限**。

### FNOS-001-04-TEST-11 无入口形态（新增，AC-07）

| 应用 | `app/ui/config` | 源 `manifest` 的 `desktop_*` | 构建 |
| --- | --- | --- | --- |
| `fn-memcached` | `{}` | 无 | 通过 |
| `fn-zabbix-agent` | `{}` | 无 | 通过 |
| `fn-cloudflared` | `{}` | 无 | 通过 |

**`fnpack` 的注入行为（新观察 O-01）**：源 `manifest` 不含 `desktop_*` 两行时，`fnpack` 会在**打包时向 FPK 内的 `manifest` 注入两行空值**：

```text
desktop_uidir              = 
desktop_applaunchname      = 
```

对 `fn-cloudflared` 重复构建两次，FPK 内 `grep -cE '^desktop_'` 恒为 **2**（确定性行为）。对照有入口的 `fn-wechatmarkdowneditor`，FPK 内为真实值。

**判定**：AC-07 说「`manifest` 不含 `desktop_uidir`/`desktop_applaunchname`」，指的是**仓库内受版本控制的源文件**——源文件确实不含。FPK 内空值属 `fnpack` 的字段规范化，**不构成违规**。该现象登记为 U-06，**已裁决闭环**：判定以源 `manifest` 为准，空值行属 `fnpack` 默认行为（nil 语义），不要求构建层剔除。

### FNOS-001-04-TEST-12 改端口后入口跟随（新增，真机）

| 应用 | 端口 | 容器监听 | HTTP | 桌面入口 |
| --- | --- | --- | --- | --- |
| `fn-cyberchef` | 8080（上游默认） | ✅ `0.0.0.0:8080` | ✅ `200` / 74908 B / `<title>CyberChef</title>` | ✅ `port=8080` |
| `fn-wechatmarkdowneditor` | **8081**（默认 8080 冲突） | ✅ | ✅ `200` / 5771 B / `<title>微信 Markdown 编辑器 \| Doocs 开源社区</title>` | ✅ `fnDomain=fn-wechatmarkdowneditor-main`，**`port=8081`** |

两个应用上游默认端口**都是 8080**。安装第一个用默认值、第二个改 8081，入口端口**正确跟随**（8081 而非 8080）。这证明「端口冲突由用户在向导里改」的路径可用，也是 `.main` 形态**首次在真机验证**。

### FNOS-001-04-TEST-13 用户路径只读挂载（新增）

- compose 第 11 行：`- "${MODEL_PATH}:/models:ro"`，**带 `:ro`**。
- `wizard/install` 三个字段均 `required: true`：`APP_PORT`（`8080`）、`MODEL_PATH`（空）、`START_COMMAND`（`-m /models/model.gguf --host 0.0.0.0 --port 8080`）。
- `wizard/config` 字段与 `install` 一致。
- `docker compose config` 解析出 `read_only: true`：

  ```yaml
  volumes:
    - type: bind
      source: /vol1/models
      target: /models
      read_only: true
  ```

  上例的 `/vol1/models` 是执行时**示例填写的目标 NAS 路径**（设备端），非开发机路径。

**未覆盖**：目标 NAS 上填**错误路径**的行为未验证。**U-08 已裁决闭环**：fnOS 向导 `rules` 无路径存在性校验能力，`helpText` 已给指引，且失败可见（`cmd/main status` 返回非 0），**不判缺陷、不改实现**，登记为已知限制。

### 其他覆盖确认

- **权限（TEST-05）**：11 个应用全部 `run-as: package`、`username`/`groupname` = `docker-fn-<app>`、无 `join-groups`、无 root。
- **compose 禁止项（全 11 个）**：`1panel-network`/`createdBy`/`${CONTAINER_NAME}`/`env_file`/`:latest`/相对挂载 —— **全部零命中**；`container_name` 全等于 `fn-<app>`。
- **图标（TEST-01/02）**：11 个应用四产物均为正方形 PNG、尺寸正确、≤1024 KB；`docs/public/icons/fn-<app>.png` 全部存在。
- **生命周期脚本**：11 个应用 × 9 个脚本，`bash -n` 语法全部通过、**全部以换行结尾**。
- **端口正则（TEST-07/08）**：沿用规约的单条严格正则，回归确认无偏差。

## 阻塞清单

| 项 | 状态 | 原因 / 说明 |
| --- | --- | --- |
| FNOS-001-04-AC-03「保留数据后重装读回」 | **未满足** | `app uninstall` 不提供 `--custom-parameters`，卸载向导含必填 `wizard_data_action`，必须转 App Center UI；需占用一次真机窗口 |
| FNOS-001-04-AC-06 端口占用 | **未执行** | 需在设备上构造端口冲突；步骤已可执行化（TEST-06），待下次真机窗口 |
| FNOS-001-05-AC-01 数据落盘与容器重建 | **未执行** | T0 应用无状态落盘，需 T1 批次应用 |
| FNOS-001-06-AC-01 数据库连接信息 | **未执行** | 依赖 T2 批次应用，尚未产出 |
| FNOS-001-04-AC-04 运行时 uid/gid | **部分** | 14 个应用的**静态**声明已核对；逐应用运行时复核未做（`fn-it-tools` 有旁证） |
| FNOS-001-04-AC-07 无入口形态的运行验证 | **部分** | 3 个无入口应用仅完成本地静态核对，**未在真机确认「无入口但正常工作」** |
| `fn-web-check` 真机可用性 | **未验证** | 见下 |

### `fn-web-check` 安装失败定性（如实记录，不计为应用缺陷）

**现象**：`app install-fpk` 返回 `timed out waiting for app-center install task`；核查发现 `/var/apps/fn-web-check/` 目录**已完整解包**（`cmd`/`config`/`manifest`/`wizard`/`ICON*.PNG` 齐全，`target` 指向 `/vol4/@appcenter/fn-web-check` 且内含 `config`/`docker`/`ui`），但应用**未出现在已装列表**，端口 40095 未监听。

**重试**：再次 `install-fpk` → `App Center code 10500: status operation is not supported for the app in its current state`。

**处置尝试**：`app install-cancel <taskId>` 返回 `Canceled app-center install task fn-web-check`，但**残留状态未被清除**，重试仍报 10500。

**定性依据**：同一批次、同一路径、配置与 `fn-cyberchef` 完全同构的 `fn-wechatmarkdowneditor` **安装成功**。因此判定为 **App Center 侧的残留安装状态，不是 FPK 或转换产物的问题**。

**本轮已确认的本地事实**：`fn-web-check` 的 11 项本地检查（构建、包结构、图标、权限、compose、端口正则、入口键 24 字符合规）**全部通过**。

**结论**：`fn-web-check` 的**真机可用性未验证**，需先在 App Center UI 清理残留状态后重装。**不得据此判定转换质量有问题，也不得记为应用缺陷。**

## 缺陷清单

| 编号 | 严重级 | 状态 | 说明 |
| --- | --- | --- | --- |
| D-01 | 高 | 已闭环（第 1 轮） | `fnpack build` 失败仍返回退出码 0。本轮 TEST-10 又实测到 3 种同类场景，印证三重判定口径必要 |
| D-02 | 中 | 已闭环（第 1 轮） | 清单统计偏差并导致 2 个应用错分级 |
| D-03 | 低 | 已闭环（第 1 轮） | `fnpack` 不校验图标正方形；管线已强制 |

**本轮未发现新的转换产物缺陷。**

### 本轮新增观察（非缺陷）

| 编号 | 观察 | 定性 |
| --- | --- | --- |
| O-01 | `fnpack` 打包时向 FPK 内 `manifest` 注入两行空值 `desktop_*` | `fnpack` 的字段规范化行为，非违规；判定以源文件为准。**U-06 已闭环**，不要求构建层剔除 |
| O-02 | `fn-web-check` 真机安装失败 `code 10500`，残留未清 | App Center 侧残留状态，非转换产物缺陷 |

### 既有应用观察（非本轮范围）

- `apps/fn-new-api/wizard/config` 的端口校验为 `^[0-9]+$`，**不挡越界值**，与规约「1—65535 用单条严格正则完整覆盖」不一致。该应用属「不重写已有 14 个应用」范围，若后续统一口径需单独排期。

## 结论与建议

**结论**：T0 收尾 11 个应用在**本地可执行范围内全部通过**——构建、包结构、图标、权限静态子句、compose 规范、端口校验、入口引用、入口 ID 规则、无入口形态、只读挂载共 10 类核对均符合订正后的验收条件。真机侧新增 **AC-02、AC-05 转「通过」，AC-07 的 `.main` 规则得到真机验证**。

**但 T0 批次仍不具备「已完成」条件**：

- **FNOS-001-04-AC-03 未满足**（「保留数据后重装读回」未执行）；
- **04-AC-06、05-AC-01、06-AC-01 未执行**；
- 因此需求与计划的 T0 批次状态**不得标记为「已完成」**。

**建议**：

1. **下一次真机窗口的优先级**：① AC-03 的保留数据重装读回；② AC-06 的端口占用（步骤已就绪）；③ `fn-web-check` 清理残留后重装；④ 3 个无入口应用的「无入口但正常工作」确认。
2. **T1 批次（93 个应用）开工前**把本轮沉淀的自检项写入批量检查：入口键 ≤32 字符（`<app>` ≥18 时用 `.main`）、无 Web UI 应用用 `{}` + 删 `desktop_*`、用户路径挂载必须带 `:ro`、`.DS_Store` 排除、端口字段用严格正则。
3. ~~请维护者裁决 U-06/U-07/U-08~~ **已全部裁决闭环**（见用例集「待确认事项」）：
   - **U-06**：判定以源 `manifest` 为准，FPK 内空值 `desktop_*` 不构成违规；
   - **U-07**：「无 Web UI 应用」＝**不通过 HTTP 提供用户界面**（与有无端口无关）。T1 起统一适用，边界情形先上报裁决；
   - **U-08**：`MODEL_PATH` 无路径校验**不判缺陷**，登记为已知限制。

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-10-10 | 建立报告：补齐 11 个 T0 收尾应用的用例覆盖（新增 4 条），回填真机 A 组三应用结果，改造 AC-06 用例为可执行步骤；修正 TEST-04 的状态取值（「部分通过」→「阻塞」）；无新增转换缺陷。 |
| 2026-10-10 | U-06/U-07/U-08 三项裁决闭环后同步本报告：U-06 判定以源文件为准；U-07 确立「无 Web UI」判定标准（T1 起适用）；U-08 登记为已知限制。 |
