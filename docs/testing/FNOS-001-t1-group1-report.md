---
title: FNOS-001 T1 批次第 1 组测试报告（14 个应用）
description: fn-qinglong 等 14 个 T1 应用的构建、状态落盘、权限与向导字段核对报告。
lastVerified: 2026-10-10
---

# FNOS-001 T1 批次第 1 组测试报告（14 个应用）

本报告记录 [FNOS-001 1Panel 应用商店应用转换](/requirements/FNOS-001-1panel-app-conversion) **T1 批次第 1 组 14 个应用**的测试执行结果。用例定义见 [FNOS-001 1Panel 应用转换测试用例](/testing/FNOS-001-test-cases) 与[测试用例规范](/testing/index)。

前序报告：[T0 试点批次第 1 轮](/testing/FNOS-001-t0-round1-report)、[T0 收尾批次](/testing/FNOS-001-t0-round2-report)。

## 本组与 T0 的本质差异

| 维度 | T0（14 个） | T1 第 1 组（14 个） |
| --- | --- | --- |
| 状态数据 | **全部无状态**，无 `volumes` | **全部有真实状态数据**，挂载 `${TRIM_PKGVAR}/data` |
| 落盘改造 | 不需要 | **本批次的核心工作**：`./data` → `${TRIM_PKGVAR}/data` |
| 卸载删除分支 | 删空目录，keep/delete **语义不可区分** | **首次具有真实语义**，是本组核心验收项 |
| 新增形态 | — | `TRIM_UID`/`TRIM_GID`、落盘缺陷修正、向导字段精简、平台生态组件 |

**纪律声明**：本组 14 个应用**从未在真机上安装过**。凡未真机取证的用例，状态只能是「未执行」或「阻塞」，**没有一条被标为「通过」**。本地静态「通过」仅代表配置形态合规，**不代表落盘、权限与卸载行为已验证**。

## 执行范围

| 应用 | 目录 | 本组特有形态 |
| --- | --- | --- |
| `fn-qinglong` | `apps/fn-qinglong/` | 状态落盘 |
| `fn-clawswarm` | `apps/fn-clawswarm/` | 状态落盘 |
| `fn-maxkb` | `apps/fn-maxkb/` | 状态落盘 |
| `fn-ai-portal` | `apps/fn-ai-portal/` | **平台生态组件语义** |
| `fn-2fauth` | `apps/fn-2fauth/` | **上游落盘缺陷修正** |
| `fn-gotify` | `apps/fn-gotify/` | **向导字段精简（29→6）** |
| `fn-answer` | `apps/fn-answer/` | 状态落盘 |
| `fn-artalk` | `apps/fn-artalk/` | 状态落盘 |
| `fn-bytebase` | `apps/fn-bytebase/` | 状态落盘 |
| `fn-certimate` | `apps/fn-certimate/` | 状态落盘 |
| `fn-changedetectionio` | `apps/fn-changedetectionio/` | 状态落盘；入口键恰 32 字符（上限） |
| `fn-code-server` | `apps/fn-code-server/` | **`TRIM_UID`/`TRIM_GID`** |
| `fn-freshrss` | `apps/fn-freshrss/` | **`TRIM_UID`/`TRIM_GID`** |
| `fn-linkding` | `apps/fn-linkding/` | 状态落盘 |

## 环境与命令

| 项 | 值 |
| --- | --- |
| 仓库 | `fn-os-apps/`（工作区根为 `fn-os-apps/` 的上一级） |
| Node.js | v24.15.0 |
| fnpack | 1.2.4（由 `PATH` 解析） |
| Docker Compose | v5.1.0（仅用于 `config` 解析，**无 daemon**） |
| 目标 fnOS 设备 | **未使用**（本组无真机窗口） |
| 构建目录 | 临时目录下的源目录副本（`mktemp -d`），避免污染 `apps/` |

```bash
BUILD="$(mktemp -d)"
for a in fn-qinglong fn-clawswarm fn-maxkb fn-ai-portal fn-2fauth fn-gotify fn-answer \
         fn-artalk fn-bytebase fn-certimate fn-changedetectionio fn-code-server \
         fn-freshrss fn-linkding; do cp -r "apps/$a" "$BUILD/"; done

# 构建（三重判定：exit 0 且 .fpk 存在 且 mtime ≥ 构建开始）
cd "$BUILD/<app>" && fnpack build

# compose 解析（代入向导默认值 + TRIM 变量）
docker compose -f apps/<app>/app/docker/docker-compose.yaml config
```

## 逐条结果汇总

本组新增 6 条用例（TEST-04 ~ TEST-09）。

| 用例 ID | 验收条件 | 环境 | 状态 | 覆盖形态 |
| --- | --- | --- | --- | --- |
| FNOS-001-05-TEST-04 | 05-AC-01 | 本地 | **阻塞** | 形态 1：状态落盘改造（14/14 静态合规） |
| FNOS-001-05-TEST-05 | 05-AC-01 + 04-AC-04 | 本地 + 目标 NAS | **阻塞** | 形态 2：`TRIM_UID`/`TRIM_GID`（最高风险） |
| FNOS-001-05-TEST-06 | 05-AC-01 | 本地 + 目标 NAS | **阻塞** | 形态 3：2fauth 落盘缺陷修正 |
| FNOS-001-05-TEST-07 | 05-AC-01 | 本地 | **阻塞** | 形态 4：gotify 字段精简 + 文档出口 |
| FNOS-001-05-TEST-08 | 05-AC-01 | 本地 + 目标 NAS | 未执行 | 形态 5：ai-portal 平台生态语义 |
| FNOS-001-05-TEST-09 | 05-AC-01 + 04-AC-03 | 目标 NAS | 未执行 | 形态 6：数据保留/删除真机验证 |

用例集整体统计（**34 条**）：**通过 19 / 阻塞 11 / 未执行 4 / 失败 0**。

> **本组 6 条新用例无一标「通过」**：这 14 个应用从未真机安装过，状态只取「阻塞」或「未执行」（遵守计划维护者的状态口径）。

## 用例结果明细

### FNOS-001-05-TEST-04 状态落盘改造（14/14 静态合规 → 阻塞）

**构建**（三重判定，14/14 全部满足退出码 0 + `.fpk` 存在 + mtime ≥ 构建开始）：

| 应用 | `.fpk` | 应用 | `.fpk` | 应用 | `.fpk` |
| --- | --- | --- | --- | --- | --- |
| `fn-qinglong` | 240821 B | `fn-gotify` | 108627 B | `fn-changedetectionio` | 67188 B |
| `fn-clawswarm` | 93093 B | `fn-answer` | 18011 B | `fn-code-server` | 31900 B |
| `fn-maxkb` | 78994 B | `fn-artalk` | 24235 B | `fn-freshrss` | 50746 B |
| `fn-ai-portal` | 124652 B | `fn-bytebase` | 51339 B | `fn-linkding` | 114423 B |
| `fn-2fauth` | 47270 B | `fn-certimate` | 38967 B | — | — |

**挂载源与容器内目标**（14/14 全部为 `${TRIM_PKGVAR}/data`，**相对挂载残留 0**）：

| 应用 | 容器内目标 | 与上游一致 | 应用 | 容器内目标 | 与上游一致 |
| --- | --- | --- | --- | --- | --- |
| `fn-qinglong` | `/ql/data` | ✓ | `fn-answer` | `/data` | ✓ |
| `fn-clawswarm` | `/opt/clawswarm` | ✓ | `fn-artalk` | `/data` | ✓ |
| `fn-maxkb` | `/opt/maxkb` | ✓ | `fn-bytebase` | `/var/opt/bytebase` | ✓ |
| `fn-ai-portal` | `/app/data` | ✓ | `fn-certimate` | `/app/pb_data` | ✓ |
| `fn-2fauth` | `/2fauth` | ✓ | `fn-changedetectionio` | `/datastore` | ✓ |
| `fn-gotify` | `/app/data` | ✓ | `fn-code-server` | `/config` | ✓ |
| — | — | — | `fn-freshrss` | `/config` | ✓ |
| — | — | — | `fn-linkding` | `/etc/linkding/data` | ✓ |

容器内路径逐项与上游 `appstore/apps/<app>/<version>/docker-compose.yml` 比对一致——改造**只动了挂载源、未动容器内目标**，符合「容器内目标路径保持上游原样」的要求。

**`config/resource`**：14 个应用**均未声明 `data-share`**。数据为应用内部状态，用户无需在文件管理器中直接访问，属**预期设计**（已与任务描述核对一致）。

**FPK 结构**：14/14 均为顶层 21 条目、`cmd/` 9 个、`wizard/` 3 个、`.DS_Store` 计数 **0**。

### 其他静态核对（14/14 静态形态合规，**不构成 AC 结论**）

| 检查项 | 结果 |
| --- | --- |
| 权限（AC-04） | 14/14：`run-as: package`、`username`/`groupname` = `docker-fn-<app>`、无 root、无 `join-groups` |
| compose 禁止项 | 14/14：`1panel-network`/`createdBy`/`${CONTAINER_NAME}`/`env_file`/`:latest`/相对挂载 **全部零命中**；`container_name` 全等于 `fn-<app>` |
| compose 解析 | 14/14 `docker compose config` exit 0（代入向导默认值 + `TRIM_*`） |
| 入口键（AC-07） | 14/14 ≤32 字符、以 `appname` 为前缀、与 `desktop_applaunchname` 一致 |
| 图标（AC-07） | 14/14 四产物齐备 |
| 生命周期脚本 | 14 × 9 = 126 个脚本：`bash -n` 全部通过、全部以换行结尾 |
| 卸载向导 | 14/14 含 `wizard_data_action`；`cmd/uninstall_callback` 全部按该变量分支，`delete` 分支全部使用 `${TRIM_PKGVAR:?}`/`${TRIM_PKGHOME:?}`（空变量守卫齐全） |

> **本节的定性**：以下各项均为**静态形态合规**的支撑证据，**不是** AC 成立的结论。相关 AC（-04-AC-04、-04-AC-07、-02-AC-01）在本组 14 个应用上仍需真机确认——应用从未安装过，故这些核对**不单独构成「通过」**。

**入口键长度注意**：`fn-changedetectionio.Application` = **32 字符**，**正好触及上限**。若该应用名再加长 1 字符即会超限，届时须改用 `.main`。本组无应用实际超限（`wechatmarkdowneditor` 是 T0 的唯一案例）。

### FNOS-001-05-TEST-05 `TRIM_UID`/`TRIM_GID`（阻塞 —— 本组最高风险）

**静态部分通过**：`fn-code-server`、`fn-freshrss` 均为 `PUID=${TRIM_UID}` / `PGID=${TRIM_GID}`。

**本地取证（确认「为什么不能硬编码 1000」）**：

```text
/vol4/@appdata/fn-deepseek-harness  owner=fn-deepseek-harness(934)  mode=700
/vol4/@appdata/fn-halo              owner=docker-fn-halo(969)       mode=770
/vol4/@appdata/fn-bitwarden         owner=docker-fn-bitwarden(973)  mode=770
uid 1000 = tnnevol:x:1000:1001（普通登录用户）
```

**路径说明**：上文表格中的 `/vol4/@appdata/fn-*` 是 **fnOS 设备端路径**（指向目标 NAS 的应用数据目录），不是开发机路径。

包用户 UID 是**动态分配**的（934/969/973），数据目录属主为包用户且 `mode=770` → 容器以 uid 1000 写入**必然失败**。改造方向正确。

**失败模式实测（本地）**——这是本报告新增的关键证据：

```text
$ env -u TRIM_UID -u TRIM_GID docker compose -f apps/fn-code-server/app/docker/docker-compose.yaml config
    environment:
      PGID: ""
      PUID: ""
warning: The "TRIM_UID" variable is not set. Defaulting to a blank string.
exit=0
```

**若未被注入，compose 解析不失败，而是静默传空值给镜像** → linuxserver 的 init 以空 `PUID` 启动，写权限判定失败。**属静默失败**，只能靠真机排除。

**为什么本地「能看到展开值」不足以证明安全**：本机执行环境下 `TRIM_UID=934` 存在，是因为**当前进程本身就运行在一个 fnOS 应用容器内**（`fn-deepseek-harness`）。这只能证明「该变量在这个上下文里存在」，**不能证明** fnOS 在 `cmd/main` 调用 `docker compose` 时也注入它们。

**回退判断**（真机执行时按此判定，已写入用例）：容器启动失败或 `PUID` 为空 → 改用生命周期脚本注入（`install_callback` 写 `.env`）或显式 `user:`，并升级为需求级决策。

### FNOS-001-05-TEST-06 `2fauth` 落盘缺陷修正（阻塞）

**上游缺陷已核对原文**（`appstore/apps/2fauth/8.0.2/docker-compose.yml`）：

```yaml
volumes:
  - ./data:/2fauth                                 # 挂载点 /2fauth
environment:
  - DB_DATABASE="/srv/database/database.sqlite"    # /srv 不在挂载内 → 落容器可写层，重建即丢
```

**静态修正核对通过（3/3）**：

| 检查项 | 结果 |
| --- | --- |
| `DB_DATABASE` | ✅ `/2fauth/database/sqlite.db`（在挂载点 `/2fauth` 内） |
| `install_callback` 预创建 | ✅ `mkdir -p "${TRIM_PKGVAR}/data/database"` + `chmod 770`；`TRIM_PKGVAR` 为空时写 `TRIM_TEMP_LOGFILE` 并 `exit 1` |
| `APP_KEY` | ✅ 上游 `default: SomeRandomStringOf32CharsExactly` 是**示例占位值**（已核对上游 `data.yml`）；现为 `password` + `required: true`，`helpText` 说明「32 位随机字符串…安装后不要更改，否则已保存的 2FA 数据将无法解密」 |

**未验证**：**镜像是否接受 `/2fauth/database/sqlite.db` 这个自定义路径**。该路径是**本项目裁定改动**（非上游值），需真机确认镜像能建库并保持。

### FNOS-001-05-TEST-07 `gotify` 向导字段精简（静态合规 → 阻塞，含未消除风险）

**静态核对通过**：

| 检查项 | 结果 |
| --- | --- |
| 向导字段 | ✅ **6 个**：`APP_PORT`、`TIME_ZONE`、`GOTIFY_DEFAULTUSER_NAME`、`GOTIFY_DEFAULTUSER_PASS`(`password`)、`GOTIFY_REGISTRATION`(`switch`)、`GOTIFY_PASSSTRENGTH` |
| 文档出口 | ✅ `docs/apps/fn-gotify.md:27` 的**「高级配置」章节确实存在**，按类别列出被省略字段（服务端、SSL/HTTPS 9 项、CORS/流式、数据位置、响应头）并给出修改方式 |
| 数据库路径 | ✅ `GOTIFY_DATABASE_DIALECT=sqlite3` + `GOTIFY_DATABASE_CONNECTION=data/gotify.db`，挂载 `${TRIM_PKGVAR}/data:/app/data` |

**结论**：字段精简 *不是缺陷*——**文档出口真实存在**，省略项可被用户找到。

**未消除风险**：`data/gotify.db` 是**相对路径**，解析基准取决于镜像 `WORKDIR`：

```text
CWD=/app → /app/data/gotify.db   （挂载内，正确）
CWD=/    → /data/gotify.db       （挂载外，重建即丢）
```

本机**无法取得镜像元数据**（Docker daemon 不可用）确认 `WORKDIR`。判定方法：真机检查 `${TRIM_PKGVAR}/data/gotify.db` 是否出现；若文件出现在容器内 `/data/`，须把该值改为绝对路径 `/app/data/gotify.db`。

### FNOS-001-05-TEST-08 `ai-portal` 平台生态语义（未执行）

**为什么不能判失败**：`fn-ai-portal` 依赖外部 1Panel 企业版实例，**不是独立产品**。`docs/apps/fn-ai-portal.md:20,24` 已明确写出该依赖；compose 环境 `PANEL_BASE_URL`/`PANEL_API_KEY` 保留上游原名是**刻意决策**（改名会让用户无法对照 1Panel 官方文档）。

**判定口径**：

- **判失败**：容器无法启动、健康检查持续失败、端口不可达、文档未说明依赖、变量被改名。
- **不判失败**：容器正常启动但功能受限（无 1Panel 实例时）——这是**产品语义**。

**静态预检**：compose 带 `healthcheck`（`http://localhost:3000/api/health`）；挂载 `${TRIM_PKGVAR}/data:/app/data`；向导 4 字段含 `INIT_ADMIN_PASSWORD`、`PANEL_BASE_URL`、`PANEL_API_KEY`。

### FNOS-001-05-TEST-09 数据保留/删除真机验证（未执行 —— T1 核心验收）

**这是 T1 批次的核心验收项**：T0 全无状态，keep/delete 语义不可区分；**T1 应用有真实数据，删除分支首次具有真实语义**。

**方法**（沿用已强化的 TEST-03）：产生足量数据 → 记录 `du -sb` 基线 → 保留后要求**字节数与基线一致** → 删除后要求**占用归零**。

**静态前置已就绪**：14/14 的 `wizard/uninstall` 含 `wizard_data_action`，`uninstall_callback` 全部按变量分支且 `delete` 分支守卫齐全。

**判定关键（T0 实测教训）**：卸载后目录**可能仍存在但 `du -sb` 为 0**——T0 轮 `fn-it-tools` 即如此。「目录存在」这个判定**在 T1 会失效**，必须比对字节数。

## 遗留风险清单

按优先级排列。**以下 3 项均未在真机验证，不得写成「已验证」。**

| 编号 | 优先级 | 风险 | 涉及应用 | 风险性质与后果 | 判定/回退方法 |
| --- | --- | --- | --- | --- | --- |
| **R-01** | **最高** | `TRIM_UID`/`TRIM_GID` 的 **compose 注入未验证** | `fn-code-server`、`fn-freshrss` | 官方文档列出这两个变量，但**未逐字声明可用于 compose**；实测未注入时 compose **静默传空值**（exit 0，不报错）→ 容器可能起不来或数据写不进去。**静默失败** | 真机看容器日志中 `PUID`/`PGID` 是否为 9xx、数据是否写入 `${TRIM_PKGVAR}/data`；失败则改用生命周期脚本注入或显式 `user:` |
| **R-02** | **最高** | `2fauth` 的 `DB_DATABASE=/2fauth/database/sqlite.db` 为**裁定改动**，**镜像接受性未验证** | `fn-2fauth` | 该路径非上游值，由本项目裁定修改。若镜像不接受，2FAuth 可能无法建库或启动失败 | 真机安装后确认能进初始化页面、创建管理员、且 `${TRIM_PKGVAR}/data/database/sqlite.db` 文件出现并增长 |
| **R-03** | **高** | `gotify` 的 SQLite **相对路径解析基准未验证** | `fn-gotify` | `data/gotify.db` 可能相对 CWD 而非 `/app`；本机无 Docker daemon 无法确认镜像 `WORKDIR`。若基准是 `/` → 落容器可写层，**重建即丢** | 真机检查 `${TRIM_PKGVAR}/data/gotify.db` 是否出现；否则改为绝对路径 `/app/data/gotify.db` |
| R-04 | 中 | 全部 14 个应用的**数据落盘、保留/删除行为**未真机验证 | 14/14 | T1 的价值就在落盘，静态合规不等于运行时正确 | 按 TEST-09 方法执行；这是本组唯一能证明 T1 目标达成的验证 |
| R-05 | 低 | ~~`TRIM_UID`/`TRIM_GID` 的文档依据不完整~~ | 规约「模式 B 补充裁决 1」 | **已闭环**：原规约把 `${TRIM_PKGVAR}` 误算入官方案例；经复核，官方 Docker 案例实际只出现 `${TRIM_APPDEST}`（4 处）与 `${TRIM_SERVICE_PORT}`（1 处），**`TRIM_UID`/`TRIM_GID` 无任何 compose 示例**。规约已订正为「文档列出但无 compose 示例」，补入「本仓库 33 个应用使用 `${TRIM_PKGVAR}` 仅为旁证、不能推及 `TRIM_UID`/`TRIM_GID`」的依据强度说明，并原样收录本报告实测的静默空值输出，优先级标为「最高」 | 已由计划维护者订正落地 |

**已确认非缺陷的两项**（避免后续误判）：

- **`fn-ai-portal` 无 1Panel 实例时功能不可用** → 产品语义，见 TEST-08。
- **`fn-gotify` 向导 29→6 字段精简** → 计划维护者批准的决策，**文档出口真实存在**（`docs/apps/fn-gotify.md:27`），见 TEST-07。

**另需记录**：本组 14 个应用**均未声明 `data-share`**，用户无法在文件管理器中直接看到这些数据。这是**预期设计**（数据为应用内部状态），非遗漏。

## 缺陷清单

**本组未发现转换产物缺陷。**

| 编号 | 严重级 | 状态 | 说明 |
| --- | --- | --- | --- |
| D-01 | 高 | 已闭环（T0 轮） | `fnpack build` 失败仍返回退出码 0。本组构建全部采用三重判定 |
| D-02 | 中 | 已闭环（T0 轮） | 清单统计偏差 |
| D-03 | 低 | 已闭环（T0 轮） | `fnpack` 不校验图标正方形 |

**说明**：R-01 ~ R-03 是**未验证项**（unknown），不是缺陷（defect）。在真机取证前，不得把它们记为缺陷，也不得记为已验证。若真机确认失败，再按缺陷流程登记并转实现成员。

## 结论与建议

**结论**：T1 第 1 组 14 个应用在**本地静态范围内全部合规**——构建（14/14 三重判定）、状态落盘改造（14/14 挂载源合规、容器内路径保持上游原样、零相对挂载）、权限、compose 禁止项、入口键、图标、生命周期脚本、卸载向导共 9 类核对均合规。

**但本组不具备「验收通过」条件**：

- 14 个应用**从未在真机安装过**；
- **R-01、R-02 两项最高风险未验证**，且都可能导致容器启动失败或数据丢失；
- **本组核心目标（数据落盘 + 卸载保留/删除）完全未验证**（R-04）。

因此 **FNOS-001-05（T1 批次）状态不得标记为「已完成」，14 个应用均不得标「通过真机验证」**。

**建议（按优先级）**：

1. **下一个真机窗口优先验证 R-01**（`fn-code-server` 或 `fn-freshrss`）：它决定 `linuxserver` 系镜像在 fnOS 上能否工作，且影响 T1 后续批次中所有同类应用。验证方法简单——装一个、看日志里的 `PUID`、看数据能否写入。
2. **同批验证 R-02**（`fn-2fauth`）与 **R-03**（`fn-gotify`）：两者都是「数据可能落错位置」，与 T1 目标直接相关。
3. **安排 TEST-09**（数据保留/删除，14 个应用轮换覆盖）：这是唯一能证明 T1 目标达成的验证，务必用 `du -sb` 字节数判定，不要用「目录存在」。
4. ~~R-01 通过后回写规约（R-05）~~ **R-05 已闭环**：规约已订正依据强度说明（官方无 compose 示例 + 本仓库 33 个应用仅为旁证），后续批次直接引用订正后的表述即可；**R-01 本身的真机结论仍待取得**。

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-10-10 | 建立报告：T1 第 1 组 14 个应用本地静态核对（9 类全通过），新增 6 条用例覆盖 6 类 T1 特有形态；登记 3 项遗留风险（R-01/R-02 最高）；确认 2 项非缺陷；14 个应用真机状态为「未执行/阻塞」。 |
| 2026-10-10 | R-05 闭环：计划维护者已订正规约（官方 Docker 案例实为 `${TRIM_APPDEST}` ×4、`${TRIM_SERVICE_PORT}` ×1，`TRIM_UID`/`TRIM_GID` 无 compose 示例），并收录本报告实测的静默空值输出；R-01 仍待真机验证。 |
