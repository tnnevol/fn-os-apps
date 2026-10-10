---
title: FNOS-001 T0 试点批次第 1 轮测试报告
description: fn-it-tools / fn-linux-command / fn-adminer 三个 T0 试点应用的构建、规范核对与阻塞项报告。
lastVerified: 2026-10-09
---

# FNOS-001 T0 试点批次第 1 轮测试报告

本报告记录 [FNOS-001 1Panel 应用商店应用转换](/requirements/FNOS-001-1panel-app-conversion) T0 批次 3 个试点应用的测试执行结果。用例定义与编号规则见 [FNOS-001 1Panel 应用转换测试用例](/testing/FNOS-001-test-cases) 与[测试用例规范](/testing/index)。

## 执行范围

| 应用 | 目录 | 上游版本目录 | 上游主镜像 |
| --- | --- | --- | --- |
| IT-Tools | `apps/fn-it-tools/` | `appstore/apps/it-tools/2024.10.22-7ca5933/` | `corentinth/it-tools:2024.10.22-7ca5933` |
| Linux Command | `apps/fn-linux-command/` | `appstore/apps/linux-command/1.22.0/` | `wcjiang/linux-command:1.22.0` |
| Adminer | `apps/fn-adminer/` | `appstore/apps/adminer/6.1.1-standalone/` | `adminer:6.1.1-standalone` |

覆盖用例 24 条（含本轮新增 2 条），对应 14 个验收条件中的本批次可执行部分。

## 环境与命令

| 项 | 值 |
| --- | --- |
| 仓库 | `fn-os-apps/`（工作区根为 `fn-os-apps/` 的上一级） |
| Node.js | v24.15.0 |
| fnpack | 1.2.4（由 `PATH` 解析） |
| Docker Compose | v5.1.0（仅用于 `config` 解析，无 daemon） |
| **目标 fnOS 设备** | **不可用**（见「阻塞清单」） |
| 构建目录 | 任意临时目录下的源目录副本（本轮用 `${TMPDIR:-/tmp}/t0round1/`），避免把 `.fpk` 写入受版本控制目录。下文用 `<BUILD>` 指代该目录，第三方可自行选定 |

主要命令：

```bash
# 0) 准备构建目录：把三个应用复制到临时目录，避免污染 apps/
BUILD="$(mktemp -d)"; WS="$(cd "$(dirname "$(pwd)")" && pwd)"
for a in fn-it-tools fn-linux-command fn-adminer; do cp -r "$WS/fn-os-apps/apps/$a" "$BUILD/"; done

# 1) 构建（在副本目录，逐应用）
cd "$BUILD/<app>" && fnpack build

# 2) 包结构
tar tzf <app>.fpk
tar xzOf <app>.fpk app.tgz | tar tz

# 3) compose 静态解析（代入向导默认端口）
APP_PORT=<默认端口> docker compose -f apps/fn-<app>/app/docker/docker-compose.yaml config

# 4) 生命周期脚本语法
for f in apps/fn-<app>/cmd/*; do bash -n "$f"; done

# 5) 窗口校验
cd fn-os-apps && pnpm run check -- --all && pnpm run lint && git diff --check
```

## 逐条结果汇总

| 用例 ID | 验收条件 | 环境 | 状态 | 结论摘要 |
| --- | --- | --- | --- | --- |
| FNOS-001-01-TEST-01 | 01-AC-01 | 本地 | 通过 | 清单 265 行 = 上游 265 目录，集合完全一致，无缺列 |
| FNOS-001-01-TEST-02 | 01-AC-02 | 本地 | 通过 | 五项统计全一致（265 / 259 / 257 / 223 / 2）。**由「失败」改判，经过见正文** |
| FNOS-001-01-TEST-03 | 01-AC-03 | 本地 | 通过 | `pnpm run check -- --all` 退出码 0 |
| FNOS-001-01-TEST-04 | 01-AC-04 | 本地 | 通过 | 14+98+74+46+33=265，唯一归属，无人工解释分歧 |
| FNOS-001-02-TEST-01 | 02-AC-01 | 本地 | 通过 | 三应用四产物均正方形 PNG，最大 55.2 KB |
| FNOS-001-02-TEST-02 | 02-AC-01 | 本地 | 通过 | `icon` 为 `images/icon_{0}.png`，两个目标文件均存在 |
| FNOS-001-02-TEST-03 | 02-AC-01 | 本地 | 通过 | 真实非正方形样本 `metabase` 256×324 被管线拒绝（exit 1） |
| FNOS-001-03-TEST-01 | 03-AC-01 | 本地 | 通过 | 规约覆盖需求 9/9 行；9 项均可在上游找到来源 |
| FNOS-001-04-TEST-01 | 04-AC-01 | 本地 | 通过 | 三应用 exit 0 且 `.fpk` 生成，mtime ≥ 构建开始 |
| FNOS-001-04-TEST-02 | 04-AC-01 | 本地 | 通过 | 顶层 21 条目 + `app.tgz` 内层结构，无 `.DS_Store` |
| FNOS-001-04-TEST-03 | 04-AC-02 | 目标 NAS | 阻塞 | `appcenter-cli` panic，无法安装 |
| FNOS-001-04-TEST-04 | 04-AC-03 | 目标 NAS | 阻塞 | 同上 |
| FNOS-001-04-TEST-05 | 04-AC-04 | 本地 | 通过 | 三应用 `package` + `docker-fn-<app>`，无 root / 无 `join-groups`（仅静态子句） |
| FNOS-001-04-TEST-06 | 04-AC-06 | 目标 NAS | 阻塞 | 需设备端占用端口实测 |
| FNOS-001-04-TEST-07 | 无独立 AC | 本地 | 通过 | 非数字输入全部被严格正则拒绝 |
| FNOS-001-04-TEST-08 | 无独立 AC | 本地 | 通过 | 穷举 0—70000，与规约正则判定零偏差 |
| FNOS-001-04-TEST-09 | 04-AC-05 | 本地 | 通过 | `port` = `${APP_PORT}`，与向导字段同名，未写死 |
| FNOS-001-05-TEST-01 | 05-AC-01 | 目标 NAS | 阻塞 | 需设备端数据目录实测 |
| FNOS-001-05-TEST-02 | 05-AC-01 | 目标 NAS | 阻塞 | 同上 |
| FNOS-001-05-TEST-03 | 05-AC-01 | 目标 NAS | 阻塞 | 同上 |
| FNOS-001-06-TEST-01 | 06-AC-01 | 目标 NAS | 阻塞 | 需 T2 试点，未开始 |
| FNOS-001-06-TEST-02 | 06-AC-01 | 目标 NAS | 阻塞 | 同上 |
| FNOS-001-06-TEST-03 | 计划 T03-02 | 本地 | 未执行 | T2 应用尚未产出，无对象可测 |
| FNOS-001-06-TEST-04 | 06-AC-01 | 目标 NAS | 阻塞 | 同上 |

**统计：通过 14 / 阻塞 9 / 未执行 1 / 失败 0。**

## 用例结果明细

### FNOS-001-01-TEST-02 统计复算（本轮由失败改判通过）

上游提交 `3b142d2`，独立复算五项：

| 指标 | 清单声明 | 复算结果 | 结论 |
| --- | --- | --- | --- |
| 应用总数 | 265 | 265 | 一致 |
| 有 `formFields` | 259 | 259 | 一致 |
| 使用 `1panel-network` | 257 | 257 | 一致 |
| 使用 `./` 相对挂载 | 223 | 223 | 一致 |
| 使用外部命名卷 | 2（`maddy-mail`、`synapse`） | 2 | 一致 |

**改判经过（不静默改状态）**：上一轮本用例判定「失败」——当时清单声明 `formFields` 257、`./` 挂载 221，实测 259 与 223。定位根因后由清单维护者订正口径与数字，本轮重跑五项全一致，故改判「通过」。上一轮的偏差**真实存在过**，已作为 D-02 记录并闭环。

### FNOS-001-02-TEST-01 / 02 图标与入口

| 应用 | ICON.PNG | ICON_256.PNG | icon_64.png | icon_256.png | `docs/public/icons/` |
| --- | --- | --- | --- | --- | --- |
| `fn-it-tools` | 64×64, 1017 B | 256×256, 7831 B | 64×64, 1017 B | 256×256, 7831 B | 256×256, 7831 B |
| `fn-linux-command` | 64×64, 5654 B | 256×256, 56536 B | 64×64, 5654 B | 256×256, 56536 B | 256×256, 56536 B |
| `fn-adminer` | 64×64, 3200 B | 256×256, 18238 B | 64×64, 3200 B | 256×256, 18238 B | 256×256, 18238 B |

同一应用内 `ICON.PNG` 与 `icon_64.png` SHA-256 相同、`ICON_256.PNG` 与 `icon_256.png` 及 `docs/public/icons/fn-<app>.png` 相同，即四处图标字节级一致，不存在版本漂移。

### FNOS-001-04-TEST-01 构建（三重判定）

| 应用 | 退出码 | `.fpk` 大小 | mtime ≥ 构建开始 |
| --- | --- | --- | --- |
| `fn-it-tools` | 0 | 19864 B | 是 |
| `fn-linux-command` | 0 | 126453 B | 是 |
| `fn-adminer` | 0 | 46434 B | 是 |

源目录构建前后内容哈希一致（`a0c98193c7551693` / `0a894f97488008f8` / `049cf85a1b43a00c`），构建未污染 `apps/`；本轮测试对 `apps/`、`scripts/` 零写入。

### FNOS-001-04-TEST-02 包结构

三应用结构一致。顶层 21 条目：`app.tgz`、`cmd/`（9 脚本）、`config/`（`privilege`、`resource`）、`wizard/`（`install`、`config`、`uninstall`）、`manifest`、`ICON.PNG`、`ICON_256.PNG`。`app.tgz` 内层：`docker/docker-compose.yaml`、`ui/config`、`ui/images/icon_{64,256}.png`、`config/{privilege,resource}`。两个层级 `.DS_Store` 计数均为 0。

### FNOS-001-04-TEST-05 / 09 权限与端口引用

`config/privilege` 三应用均为 `run-as: package`，`username`/`groupname` = `docker-fn-<app>`，无 `join-groups`、无 root。命名五者交叉一致：目录名 = `appname` = `container_name` = `config/resource` 项目名 = `fn-<app>`；`desktop_applaunchname` = 入口 ID = `fn-<app>.Application`。

`app/ui/config` 的 `port` = `${APP_PORT}`，与 `wizard/install` 字段同名；三应用 `wizard/install` 与 `wizard/config` 字段名与 `initValue` 完全一致（`40116` / `40255` / `9853`，与上游 `default` 相同）。

### FNOS-001-04-TEST-07 / 08 端口校验（穷举）

三应用 `wizard/install` 端口字段正则：

```text
^[1-9][0-9]{0,3}$|^[1-5][0-9]{4}$|^6[0-4][0-9]{3}$|^65[0-4][0-9]{2}$|^655[0-2][0-9]$|^6553[0-5]$
```

穷举 `0`—`70000` 共 70001 个取值，在 Python 与 Node.js 两种正则引擎下：不符预期数 **0**，与规约正则判定不一致数 **0**。边界 `1`、`65535` 通过；`0`、`65536`、`70000`、`-1`、`1.5`、空串、` 80`、`80 `、`+80`、`0x50`、`1e3`、前导零 `040116` 全部拒绝。

**实现写法与规约不同但语义等价**：向导用 `^(a$|b$|...)`，规约用 `^(?:a|b|...)$`。字符串不同，判定零差异，**不构成缺陷**。

作为对照：既有应用 `apps/fn-new-api/wizard/config` 的端口校验为 `^[0-9]+$`，**不挡越界**（`99999` 会通过）。该既有应用不在本轮范围。

### FNOS-001-03-TEST-01 规约映射覆盖

需求「上游字段到 fnOS 的对应关系」表数据行 9 行，规约 6 张映射表覆盖 9/9。子句 2（每项可在上游找到来源）：扫描上游 1013 个 YAML 文件，9 项全部命中真实来源（`PANEL_APP_PORT_HTTP` 676 文件、`./` 挂载 325、`${CONTAINER_NAME}` 371、`1panel-network` 363、`labelEn` 324、`PANEL_DB_*` 188、`TZ` 72、`PANEL_REDIS_*` 46、`PANEL_APP_PORT_HTTPS` 25）。

### 既有缺陷复验（D-01 / D-03）

**D-01（`fnpack build` 假成功）——复验通过，已闭环。** 本轮独立在三处验证构建入口的兜底判定：

| 场景 | 期望 | 实测 |
| --- | --- | --- |
| 正常构建 `fn-it-tools` | 成功 | `Packing successfully`，exit **0** |
| `app/ui/config` 写入非法 JSON | 失败 | 打印 `Packing failed...` 且追加 `fnpack reported success but fn-it-tools.fpk was not produced; treating as build failure.`，exit **1** |
| 保留一个旧 `.fpk`（mtime 改为 2020）后再制造失败 | 仍判失败 | exit **1**（mtime 守卫生效，未把残留产物当成本次结果） |

修复位置：`tooling/fn-os-apps-cli/src/commands/build.ts:20-28` 的 `fpkProduced()`（`statSync(fpkPath).mtimeMs >= startedAt`），已在构建产物 `tooling/fn-os-apps-cli/lib/index.mjs` 中生效。

**D-03（`fnpack` 不校验图标正方形）——复验通过，已闭环。** 上游 265 个 `logo.png` 中 **26 个不是正方形**（如 `metabase` 256×324、`mongodb` 256×192、`go` 1061×938），5 个 < 64px，另有 6 个不是 PNG。用真实非正方形样本执行管线：

```text
$ node scripts/generate-icons.mjs metabase
generate-icons 失败: 上游图标不是正方形: 256×324
EXIT=1
```

即 `scripts/generate-icons.mjs:145` 的 `if (width !== height) throw` 在生成阶段即拒绝，不依赖 `fnpack`。

## 阻塞清单

**9 条用例阻塞，全部因同一原因：目标 fnOS 设备不可用。**

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

受影响的验收条件：**FNOS-001-04-AC-02、04-AC-03、04-AC-06、05-AC-01、06-AC-01** 全部**未验证**。

**解锁条件**（满足任一）：① 在具备 `/run/trim_app_cgi/rpcbroker` 访问权限的目标 fnOS 设备上以有应用中心权限的账号执行；② 由设备管理员为当前执行环境授予该 socket 访问权限；③ 由设备侧操作人代为执行并回传输出与截图（须注明操作人与采集时间）。

**纪律声明**：本报告**没有把任何本地构建结果写成「真机通过」或「已完成」**。本地通过只说明产物结构与静态规范成立，不构成设备端安装、启动、数据持久化或卸载保留数据的结论。

## 缺陷清单

| 编号 | 严重级 | 状态 | 说明 |
| --- | --- | --- | --- |
| D-01 | 高 | **已闭环** | `fnpack build` 失败仍返回退出码 0（静默失败）。构建入口已加 `fpkProduced()` 三重判定，本轮三场景复验通过 |
| D-02 | 中 | **已闭环** | 清单统计偏差并导致 `newsnow`、`openldap` 错分 T0。清单订正为 259/223 与 14/98/74/46/33，7 应用移位，本轮五项复算一致 |
| D-03 | 低 | **已闭环** | `fnpack` 不校验图标正方形。图标管线已在生成阶段拒绝，本轮真实样本复验通过 |

**本轮未发现新缺陷。** 测试成员未修改任何 `apps/`、`scripts/`、`tooling/`、`docs/development/` 代码或配置。

### 供计划维护者参考的两项观察（非缺陷）

1. **既有应用 `fn-new-api` 的端口校验为 `^[0-9]+$`**，不挡越界值，与规约「1—65535 用单条严格正则完整覆盖」不一致。该应用不在 FNOS-001 转换范围（属「不重写已有 14 个应用」），但若后续统一口径需单独排期。
2. **`fnpack create --template docker` 生成的模板自带 `.DS_Store` 文件**，且部分会被打进 FPK。实测模板源目录有 5 个（`app/`、`app/ui/`、`app/ui/images/`、`cmd/`、`config/` 各一），构建后 FPK **顶层出现 2 个**（`cmd/.DS_Store`、`config/.DS_Store`），其余随 `app/` 进入 `app.tgz`。

   ```text
   $ tar tzf fn-permchk.fpk | grep -c DS_Store
   2
   ```

   本项目三个试点应用**未受影响**（构建产物 `.DS_Store` 计数为 0，已在 FNOS-001-04-TEST-02 中核对）。但后续批量转换时需在自检清单中确认排除。另注意规约禁止项第 1 条要求「不得删除 fnpack 模板自带文件」，与清理 `.DS_Store` 存在张力——建议明确 `.DS_Store` 属系统垃圾文件、不属「模板自带文件」，或在图标/构建管线中统一过滤。

## 结论与建议

**结论**：T0 试点三应用在**本地可执行范围内全部通过**——FPK 构建、包结构、图标规范、命名一致性、权限配置、端口校验、入口引用、规约映射覆盖均符合订正后的验收条件。三个此前登记的缺陷全部闭环并复验。

**但 FNOS-001 的 T0 批次不具备「已完成」条件**：11 个验收条件中，**5 个（04-AC-02/03/06、05-AC-01、06-AC-01）依赖目标 fnOS 设备，全部未验证**。因此：

- 需求与计划的 T0 批次状态**不得标记为「已完成」**；
- 目标环境结论须在设备解锁后写入 [FNOS-001 真实环境验收记录](/validation/FNOS-001-fnos-nas-2026-10-09) 并回填对应小节。

**建议**：

1. **优先解锁设备**：5 个未验证 AC 全部卡在同一权限问题上，这是当前唯一的批次级阻断项。
2. 解锁后按 `docs/validation/FNOS-001-fnos-nas-2026-10-09.md` 的「目标 NAS 用例」小节逐项回填，不要新开重复记录。
3. T1 批次启动前，把 `newsnow`、`openldap` 这类带引号挂载的写法纳入批量扫描自检，避免同类漏判。
4. 批量转换时在自检清单补两条：`.DS_Store` 必须排除；端口字段必须使用严格正则而非 `^[0-9]+$`。

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-10-09 | 建立报告：T0 试点三应用本地验证 14 通过 / 9 阻塞 / 1 未执行；D-01/D-02/D-03 复验闭环；5 个 AC 因设备不可用未验证。 |
