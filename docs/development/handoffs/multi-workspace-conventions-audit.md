# 交接：fn-os-apps 多包工程规范审计

> **性质**：一次性工作交接文档，不是需求/计划。放在 `development/handoffs/` 而非
> `docs/plans/`——后者有强制命名约定（`PLAN-FNOS-###-主题.md` 且必须链接对应
> `docs/requirements/FNOS-###`），本文件不属于任何需求。
>
> **用法**：复制本文件全文到新会话即可开始。本文件是**唯一交接载体**，不依赖上一
> 会话上下文。审计完成后可删除本文件，或把结论沉淀进 `docs/guide/`。
>
> **数据时点**：所有计数（ESLint 45 errors、未使用项 12 处、各包测试基线）均为
> 交付时刻实测值；新会话开工前应重跑一次确认没被别的改动改变。

## 一、任务

对 monorepo 中**除 `dsh-codebuddy-plugin` 之外**的 workspace 做四类规范审计并修复：

1. **未使用代码** — 死变量 / 死函数 / 死 import / 零引用导出
2. **单元测试规范** — 正向 + 反向 + 异常路径覆盖；区分行为测试与文本扫描测试；弱断言
3. **目录结构规范** — 各包结构是否一致，不一致是否有正当理由
4. **类型规范** — `.d.ts` 集中度、类型与实现混放、**本地类型比真实契约宽松**导致的静默故障

`dsh-codebuddy-plugin` 已在上一轮完成同类清理（见文末"参考先例"），**本次不重复审计它**，只把它当标准参照。

## 二、仓库与命令

- 仓库根：`/Users/tnnevol/workspace/fn-packages/fn-os-apps`
- workspace：`apps/*`、`docs`、`packages/*`、`plugins/*`、`tooling/*`

**每条命令都要带 PATH 前缀**（否则 `pnpm exec` 会报 `spawn sandbox-exec ENOENT`）：

```bash
PATH=/Users/tnnevol/.nvm/versions/node/v24.17.0/bin:$PATH pnpm exec <cmd>
```

提交时需绕过 hooks（否则 lefthook 会跑全仓库 check）：

```bash
git -c core.hooksPath=/dev/null -c commit.gpgsign=false commit -m "..."
```

**注意**：`timeout` 命令在本机不存在，不要用。

## 三、审计范围（7 个 workspace）

| workspace | src 文件 | spec 文件 | it() 数 | 备注 |
| --- | --- | --- | --- | --- |
| `plugins/dsh-codex-auth-plugin` | 18 | 11 | 47 | tests 有 client/contracts/host 子目录 |
| `plugins/dsh-fnos-plugin` | 39 | 15 | 83 | tests 多一层 input-references/ |
| `plugins/dsh-semi-ui-showcase-plugin` | 27 | 2 | 39 | 无 components/contracts/host |
| `packages/dsh-semi-ui` | 4 | 2 | 4 | 测试覆盖最薄 |
| `packages/fnos-gateway` | 19 | 11 | 33 | 反向断言仅 7 条 |
| `tooling/fn-os-apps-cli` | 22 | 1 | 5 | 测试覆盖最薄 |
| ~~`plugins/dsh-codebuddy-plugin`~~ | 85 | 47 | 554 | **本次跳过**（已清理完毕） |

**基线全绿**（已实测，修复后必须仍全绿）：

```
codex-auth    11 files /  47 tests
fnos          15 files /  83 tests
showcase       2 files /  39 tests
dsh-semi-ui    2 files /   4 tests
fnos-gateway  11 files /  33 tests
fn-os-apps-cli 1 file  /   5 tests
```

## 四、已探明的具体问题（按严重度排序）

### P1 · 未使用代码（`tsc --noUnusedLocals --noUnusedParameters` 实测）

跑法：

```bash
cd <workspace> && PATH=/Users/tnnevol/.nvm/versions/node/v24.17.0/bin:$PATH \
  pnpm exec tsc -p tsconfig.json --noUnusedLocals --noUnusedParameters
```

| 文件:行 | 内容 |
| --- | --- |
| `codex-auth/src/index.ts:11` | `CODEX_AUTH_FILENAME`、`CODEX_PROVIDER`、`codexAuthPath` 三个 import 未使用 |
| `codex-auth/tests/host/host-settings.spec.ts:7` | `client` 未使用 |
| `fnos/src/client/index.ts:40` | `FnosTheme` 类型未使用 |
| `fnos/src/client/input-references/fnos-command-source.ts:166` | `segment` 未使用 |
| `fnos/src/components/AuthorizedDirectoriesCard.tsx:14` | `FNOS_AUTHORIZED_DIRECTORIES_PATH` import 未使用 |
| `fnos/src/components/FnosAuthorizedPathPicker.tsx:16` | `Translate` 类型未使用 |
| `fnos/src/components/FnosSessionLogHeaderAction.tsx:12` | `Translate` 类型未使用 |
| `fnos/tests/client/path-opener.spec.ts:2` | `installFnosRemotePathOpener` 未使用 |
| `fnos-gateway/src/middleware/content-rewrite.ts:30` | `match` 未使用 |
| `fn-os-apps-cli/src/commands/version.ts:249` | `versionArgs` 未使用 |
| `fn-os-apps-cli/src/commands/version.ts:292` | `versionArgs` 未使用 |
| `fn-os-apps-cli/src/config/workspace.ts:25` | `GatewayAppConfig` 类型未使用 |

**顺手要做**：给每个包的 `tsconfig.json` 加 `"noUnusedLocals": true` 与 `"noUnusedParameters": true`，让这类问题在 CI/typecheck 阶段就暴露（codebuddy 也是靠这个才清干净的）。

### P1 · ESLint（全仓库 45 errors / 56 warnings）

**按 workspace 分布**（`eslint <path> -f json` 逐个统计，加总 = 45）：

| workspace | errors |
| --- | --- |
| `plugins/dsh-codebuddy-plugin` | **0** ✅（参照标准） |
| `plugins/dsh-codex-auth-plugin` | **31** ← 主战场 |
| `plugins/dsh-fnos-plugin` | 8 |
| `plugins/dsh-semi-ui-showcase-plugin` | 3 |
| `packages/fnos-gateway` | 2 |
| `tooling/fn-os-apps-cli` | 1 |
| `packages/dsh-semi-ui` | **0** ✅ |

> 统计口径提示：`npx eslint plugins packages tooling` 的**纯文本**汇总行会给出与 JSON 不同的数字（实测 36 vs 45）。**以 `-f json` 逐个 workspace 统计为准**，否则会漏算。

按规则聚合：

| 数量 | 规则 | 说明 |
| --- | --- | --- |
| 25 | `dot-notation` | 其中 **15 条集中在 `codex-auth/src/host/usage.ts`**（第 66–106 行）。实测这些读的是**服务端 snake_case 线路字段**（`source['used_percent']` / `source['remaining_percent']` / `source['limit_window_seconds']` …），`source` 的类型是 `Record<string, unknown>`——**这类是协议字面量，机械改点号会误导读者**（看起来像本地对象属性）。正确处理：加**文件级或块级**豁免并写明「读的是服务端线路字段」，**不要** `--fix` 掉 |
| 6 | `unused-imports/no-unused-imports` | 同 P1 未使用代码 |
| 5 | `unused-imports/no-unused-vars` | 同上 |
| 2 | `object-shorthand` | 可 `--fix` |
| 2 | `no-new-func` | 两个 `tests/client/client-bundle.spec.ts` 用 `new Function(source)()` 加载 bundle **产物**，是刻意的沙箱加载手法——**加豁免 + 说明**，不要改 |
| 1 | `no-alert` | `fnos/src/components/AuthorizedDirectoriesCard.tsx:213` 的 `window.confirm(t('deleteConfirm'))` —— **真实 UX 问题**：原生 confirm 与 Semi 风格不一致、按钮文案无法本地化。建议改用 `DshModal`（codebuddy 的删除确认就是这么做的） |
| 1 | `no-template-curly-in-string` | `showcase/.../FeedbackSections.tsx:41` —— **误报**：那是 `source={'<DshProgress ... format={percent => \`${percent} / 100\`} />'}`，即 demo 卡片要**展示的 JSX 源码文本**（本来就是字符串字面量）。加豁免 + 说明，不要改 |
| 1 | `unicorn/prefer-type-error` / `unicorn/no-new-array` / `unicorn/new-for-builtins` | 单点，逐个判断 |

**先 `--fix` 一遍**（21 条可自动修），再人工处理剩余：

```bash
PATH=/Users/tnnevol/.nvm/versions/node/v24.17.0/bin:$PATH \
  npx eslint plugins packages tooling --fix
```

`--fix` 后**必须跑 tsc**——上一轮就出现过 `--fix` 把 `Array.from({length}, () => x)` 改成 `.fill(x)` 导致推断成 `unknown[]`、测试全绿但 tsc 报错的情况。

### P2 · `eslint-disable` 指令

**全仓库当前为 0** ✅（已实测）。新加豁免必须同时写理由，且优先"真修"而不是屏蔽——参照 codebuddy 的先例。

### P2 · 目录结构不一致

`src/` 一级子目录实测：

| workspace | src 下 |
| --- | --- |
| codebuddy | `client components contracts host styles types` ← **完整参考** |
| codex-auth | `client components contracts host styles` |
| fnos | `api client components contracts host styles` |
| showcase | `client` |
| dsh-semi-ui | *（无子目录，4 个文件平铺）* |
| fnos-gateway | `client config constants middleware server types` |
| fn-os-apps-cli | `commands config core sdd ui` |

**判断要求**：不要强行统一。逐个回答"这个差异是否由包的性质决定"：

- `showcase` 只有 `client` —— 它是纯前端 demo 插件，合理
- `dsh-semi-ui` 4 个文件平铺 —— 是 facade 包，合理
- `fnos-gateway` / `fn-os-apps-cli` 不是 DSH 插件（是服务/CLI），命名自成体系，合理
- `codex-auth` 缺 `types/` 而 codebuddy 有 —— **需要判断**：codex-auth 的类型是否该按 codebuddy 的方式集中到 `types/`

`tests/` 布局也不一致：

| workspace | tests 布局 |
| --- | --- |
| codebuddy / dsh-semi-ui / fnos-gateway / fn-os-apps-cli | 平铺 `tests/*.spec.ts` |
| codex-auth | `tests/{client,contracts,host}/` |
| fnos | `tests/{client,contracts,host,input-references}/` |

**要求**：判断是否需要统一。若保持两套，在 `docs/contributing.md` 或相应 README 写明"何时用平铺、何时用分组"。

### P2 · 类型规范

`.d.ts` 分布：

| workspace | src 文件 | `.d.ts` | 位置 |
| --- | --- | --- | --- |
| codebuddy | 85 | **33** | 全部在 `src/types/**` |
| fnos-gateway | 19 | 1 | `src/types/` |
| dsh-semi-ui | 4 | 1 | 根 |
| codex-auth / fnos / showcase / fn-os-apps-cli | 18/39/27/22 | **0** | 无 |

codebuddy 采取「类型集中到 `src/types/`、用 `.d.ts` 后缀」的策略（`152d504` 引入）。**要求**：判断其余包是否该跟进，并注意 `.d.ts` 的硬约束——**不允许含 `export function` / `export const` 等运行时值**，所以带运行时函数的「类型文件」必须拆成 `.ts`（实现）+ `.d.ts`（类型）。

**重点检查"宽松本地类型漂移"**（这是上一轮真实事故的成因）：

`dsh-codebuddy-plugin/src/types/client/rpc.d.ts` 曾把 `ConnectionRpc.call` 的 `payload` 声明为**可选**，而 DSH 真实契约是**必填**。结果有人省略该参数时 tsc 不报错、测试也照过，直到真实联调才发现——host 用 zod 校验信封，缺键直接拒收整个请求。

```ts
// 真实契约（@deepseek-ai/dsh-client-connection/lib/types/rpc.d.ts）
call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal)
```

**要求**：逐个包检查本地 `ConnectionRpc` / 宿主接缝类型是否比上游宽松。若有，收紧成必填/非空，并补一条测试钉住。

### P3 · 测试规范

信号对比（`读源码` = 用 `readFileSync` 断言源码文本；`反向断言` = `toThrow`/`rejects`/`not.to*` 等）：

| workspace | spec | it | 读源码 | 引业务代码 | 反向断言 |
| --- | --- | --- | --- | --- | --- |
| codex-auth | 11 | 47 | 1 | 8 | **53** |
| fnos | 15 | 83 | 1 | 13 | **70** |
| showcase | 2 | 39 | 0 | 2 | 18 |
| dsh-semi-ui | 2 | 4 | 1 | 1 | 3 |
| fnos-gateway | 11 | 33 | 1 | **11** | **7** ← 反向断言偏少 |
| fn-os-apps-cli | 1 | 5 | 0 | 1 | 5 |

**要求**：

1. **区分三类测试**并说明取舍：行为测试（调真实代码）/ 文本扫描测试（读源码断言，只适合无法渲染的结构如 JSX 属性、CSS 高度对齐）/ 快照测试。文本扫描测试**不能捕获逻辑错误**，若大量存在必须写明理由。
2. **异常路径必须有反向测试**。已实测的最大缺口是 `packages/fnos-gateway`：

   ```
   11 个 spec / 33 个 it，反向断言仅 7 条，且**全仓库该包没有任何 toThrow / rejects**
   ```

   而网关恰恰是错误路径最多的包（请求拒绝、路径校验失败、进程启动失败、文档损坏）。具体文件分布：

   | 文件 | it 数 | 反向断言 |
   | --- | --- | --- |
   | `bridge-source.spec.ts` | 7 | 1 |
   | `content-rewrite.spec.ts` | 2 | 0 |
   | `dsh-web-args.spec.ts` | 1 | 0 |
   | `path-allowlist-events.spec.ts` | 1 | 0 |
   | `path-allowlist.spec.ts` | 3 | 2 |
   | `path-rewrite.spec.ts` | 4 | 0 |
   | `recovery-page.spec.ts` | 1 | 0 |
   | `request-headers.spec.ts` | 2 | 0 |
   | `response-headers.spec.ts` | 3 | 0 |
   | `server.spec.ts` | 6 | 0 |
   | `web-process.spec.ts` | 3 | 3 |

   可优先补的异常路径：请求被拒（401/403）、路径不在白名单、上游不可达、web 进程启动失败/超时、损坏的配置文档。

3. **新增测试要做 mutation 验证**——把被测逻辑改坏，确认测试会红。上一轮的实践：改了 3 处实现，各自 mutation 后被对应用例捕获。**只看到测试绿不足以证明测试有效**。
4. 覆盖最薄的 `dsh-semi-ui`（4 条）与 `fn-os-apps-cli`（5 条）需判断是否该补。`fn-os-apps-cli` 的 `version.ts` 有两个未使用参数（见 P1），说明该文件可能缺少测试。

## 五、工作方式（重要，上一轮的教训）

### 1. 顺序：先验业务，再查测试

> **用户原话**：「单元测试无法同步不要一味的适配test，需要检查是否真实存在业务问题。」

不要为了让测试变绿而改测试。每个失败用例先问：**是测试过时了，还是实现真的坏了？** 上一轮就靠这个原则抓出两个真实回归：

- `AccountsPage` 的 toggle `onChange` 漏调 `$autoX.set(checked)` → 面板 UI 与 host 永久不一致
- `usePanelData` 漏传 RPC payload → 账号页整页空白（见下）

### 2. 改测试时断言"意图"而不是"字面量"

上一轮 `auto-switch-toggle.spec.ts` 断言了 `if (!autoSwitchAllowed()) throw lastError as LlmError` 这个**完整字符串**，实现改成显式判空后测试误报。正确做法是断言**意图**（先判开关、再抛错、顺序在切换之前）。

### 3. 不要用注释屏蔽问题

> **用户原话**：「`// eslint-disable` 去除这种注释，并解决问题，不要通过注释屏蔽问题。」

上一轮把 3 处 disable 全部真修掉，其中一处（台账 `ledgerTick`）的根治方式是**把外部可变状态变成 React 看得见的依赖**（导出 atom + `useStore` 订阅 + 纯函数读取），从而 `ledgerTick` state 与豁免一起消失。优先找这种根治方案。

例外：协议字面量（如 HTTP 头名、服务端 snake_case 字段）确实需要索引访问时，可加豁免，但**必须写明理由**。

### 4. 提交纪律

- 一个逻辑改动一个 commit，message 用 conventional commits（`fix(...)` / `refactor(...)` / `chore(...)` / `docs(...)`）
- commit message 要写**根因 + 为什么之前没被发现**，不只是"改了什么"
- 工作区保持干净；默认**不 push**（除非用户明确要求）

## 六、验收标准

每个 workspace 都要满足：

- [ ] `tsc -p tsconfig.json --noUnusedLocals --noUnusedParameters` 无输出
- [ ] `npx eslint <pkg>` **0 errors**（warnings 可接受，但要能解释）
- [ ] `pnpm exec vitest run --config vitest.config.ts` 全绿，且**用例数不低于基线**
- [ ] 新增/修改的断言做过 mutation 验证
- [ ] `eslint-disable` 数量不增加（当前为 0）
- [ ] `pnpm run build` 成功（适用时）
- [ ] 未使用项清理后，对应的 `tsconfig` 已开启 `noUnusedLocals`/`noUnusedParameters` 防复发

全仓库最终状态：

- [ ] 全仓库 ESLint 0 errors
- [ ] `python3 -c` 或 grep 确认 `eslint-disable` 仍为 0（除有理由的协议字面量豁免）
- [ ] 目录结构差异在 `docs/` 中有书面依据

## 七、参考先例（codebuddy 上一轮的做法）

出问题/解决方式时可对照这个已完成的标准案例：

| 问题 | 做法 |
| --- | --- |
| 文本扫描测试与实现耦合 | 测试改为读**新文件位置**；断言"意图"而非字面量；修掉一个 `slice(start, -1)` 静默切错边界的隐患 |
| 死代码 | `tsc --noUnusedLocals` 归零；删除 `StatusRow` 死组件及其孤儿 CSS；清掉 `void remembered` 这类"为消 lint 警告"的补丁 |
| `eslint-disable` | 3 处全删，各自根治：① 台账改订阅式依赖 ② HTTP 头读取抽 `header(name)` ③ 成对常量拆开声明 |
| 宽松类型导致静默故障 | 收紧 `ConnectionRpc.call` 的 `payload` 为必填；补 4 条测试；mutation 后 tsc 直接报 `TS2554` |
| 超长窗口截断口径分叉 | 逐日行改为从 `clientEnd` 往回铺；totals 下界与逐日行对齐；新增 4 条测试并 mutation 验证 |
| 文案可读性 | 「今日已结束」→「今日已旅行」（主语不明 → 完成态，与同族状态词同构） |
| `--fix` 引入类型错误 | 测试全绿但 tsc 报 `unknown[]`，加显式类型参数修回——**`--fix` 后必跑 tsc** |

## 八、当前仓库状态

```
分支   main
提交   领先 origin/main 25 个提交（未 push）
工作区 干净
```

相关文档：
- `docs/guide/sdd-workflow.md` — SDD 维护模式（本仓库要求先更新 `docs/requirements/`，再在 `docs/plans/` 建计划）
- `docs/plans/PLAN-FNOS-00X-*.md` — 既有计划格式（frontmatter + 表格 + FlowGrid）
- `AGENTS.md` — 仓库开发约定

> **提示**：按本仓库 SDD 约定，若本次审计改变用户可见行为（如删除确认从 `confirm` 改成 Modal、RPC 契约收紧），应先更新 `docs/requirements/` 再动手。纯内部清理（死代码、lint）不需要。
