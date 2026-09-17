import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'

/**
 * 成长任务 UI 的位置与状态约束。
 *
 * 这些是**用户点得出来的**要求，且都在源码里可判定：
 *  - 个人详情收拢到账号信息弹框的「成长任务」Tab（不再有页面级成长任务区块）；
 *  - 「完成任务」按钮紧贴「添加账号」右侧、间距 10px，文案为「完成任务」；
 *  - 点击是 loading 而不是禁用；
 *  - 运行态落盘宿主，刷新后仍恢复 loading；
 *  - 刷新按钮在成长任务 Tab 内部。
 */
const ROOT = '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src'
const PANEL = readFileSync(`${ROOT}/client/panel.tsx`, 'utf8')
const MODAL = readFileSync(`${ROOT}/client/ui/account-resources-modal.tsx`, 'utf8')
const LIST = readFileSync(`${ROOT}/client/ui/growth-task-list.tsx`, 'utf8')
const STORE = readFileSync(`${ROOT}/client/store/growth-run.ts`, 'utf8')
const HOST_RUN = readFileSync(`${ROOT}/host/growth-run.ts`, 'utf8')
const ACCOUNTS_SCSS = readFileSync(`${ROOT}/styles/accounts.scss`, 'utf8')
const ZH = readFileSync(`${ROOT}/client/locales/zh.ts`, 'utf8')

/**
 * 去掉注释后的源码。
 *
 * 「不得出现某个写法」这类断言必须用去注释版本：我们常把**被否决的旧写法**写进
 * 注释里解释原因（例如 `disabled={loading}` 为什么不这么写），直接扫原文会把
 * 这些说明文字当成真实代码，假失败。
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}
const LIST_CODE = stripComments(LIST)
const PANEL_CODE = stripComments(PANEL)

describe('成长任务收拢到账号信息弹框', () => {
  it('弹框有 growth Tab，并渲染单账号成长任务列表', () => {
    expect(MODAL).toContain('itemKey="growth"')
    expect(MODAL).toContain('<GrowthTaskList')
    // 只传当前 row 的 id：个人详情，不是全账号视图。
    expect(MODAL).toMatch(/accountId=\{row\.id\}/)
  })

  it('弹框尺寸加大一档（Semi size=large）且窄屏仍受 92vw 约束', () => {
    expect(MODAL).toMatch(/size="large"/)
    const block = /\.dsh-codebuddy-resource-modal\s*\{([^}]*)\}/.exec(ACCOUNTS_SCSS)?.[1] ?? ''
    expect(block).toMatch(/920px/)
    expect(block).toMatch(/92vw/)
  })

  it('页面级成长任务区块已移除（避免与弹框内的个人详情重复）', () => {
    expect(PANEL).not.toContain('<GrowthTasksPanel')
    expect(existsSync(`${ROOT}/client/ui/growth-tasks.tsx`)).toBe(false)
  })

  it('刷新按钮在成长任务列表内部，不在页面区块头', () => {
    expect(LIST).toContain('dsh-codebuddy-growth-task-toolbar')
    expect(LIST).toMatch(/onClick=\{\(\) => \{ void reload\(\) \}\}/)
    // 页面级区块头不再有成长任务专属刷新入口。
    expect(PANEL).not.toContain('growthTasksRefresh')
  })

  it('列表内部再分未完成 / 已完成两栏，且默认停在未完成', () => {
    // 二级 Tab 用 button 型，与「用量信息」下的资源状态 Tab 同一形态。
    expect(LIST).toContain('<DshTabs')
    expect(LIST_CODE).toMatch(/type="button"/)
    expect(LIST).toContain('itemKey="pending"')
    expect(LIST).toContain('itemKey="done"')
    // 默认页是未完成——那才是要动手的一栏。
    expect(LIST).toMatch(/useState<GrowthTabKey>\('pending'\)/)
    // 两栏各自带数量。
    expect(LIST).toMatch(/groups\.pending\.length/)
    expect(LIST).toMatch(/groups\.done\.length/)
  })

  it('两栏各自有空态文案，不共用一句', () => {
    expect(LIST).toContain("renderRows(groups.pending, 'growthTasksEmpty')")
    expect(LIST).toContain("renderRows(groups.done, 'growthTasksDoneEmpty')")
    for (const LOCALE of [readFileSync(`${ROOT}/client/locales/zh.ts`, 'utf8'), readFileSync(`${ROOT}/client/locales/en.ts`, 'utf8')]) {
      expect(LOCALE).toContain('growthTasksDoneEmpty')
      expect(LOCALE).toContain('growthTabPending')
      expect(LOCALE).toContain('growthTabDone')
    }
  })

  it('任务列表有固定高度上限并在超出时滚动（与用量信息同一口径）', () => {
    const GROWTH_SCSS = readFileSync(`${ROOT}/styles/growth-tasks.scss`, 'utf8')
    const body = /\.dsh-codebuddy-growth-task-body\s*\{([^}]*)\}/.exec(GROWTH_SCSS)?.[1] ?? ''
    expect(body).toMatch(/max-height:\s*min\(52vh,\s*620px\)/)
    expect(body).toMatch(/overflow-y:\s*auto/)
    // 滚动容器必须真的包住任务行；工具栏留在容器外，滚动时刷新按钮不跟着跑。
    expect(LIST).toContain('dsh-codebuddy-growth-task-body')
    expect(LIST.indexOf('dsh-codebuddy-growth-task-body'))
      .toBeGreaterThan(LIST.indexOf('dsh-codebuddy-growth-task-toolbar'))
    // 与用量信息列表使用同一组数值：任一处改动都会在这条断言上暴露。
    const usage = /\.dsh-codebuddy-resource-list\s*\{([^}]*)\}/.exec(ACCOUNTS_SCSS)?.[1] ?? ''
    expect(usage).toMatch(/max-height:\s*min\(52vh,\s*620px\)/)
    expect(usage).toMatch(/overflow-y:\s*auto/)
  })
})

describe('单个任务按钮互不影响', () => {
  it('每个任务行只按自己的在跑状态决定 loading', () => {
    // 逐任务判断：不能用全局 running 决定所有任务按钮。
    expect(LIST).toContain('isGrowthTaskRunning(inFlight, running, accountId, task.taskCode, accountInFlight)')
    expect(LIST).toMatch(/taskRunning \? \{ loading: true \}/)
  })

  it('单项按钮的禁用只看本任务与本账号，不因别的账号在跑而禁用', () => {
    // 规则抽到 store 的纯函数里（`isGrowthTaskDisabled`），因此这里只断言组件
    // 用的是那个函数，而不是自己写一套条件——把规则写在组件里就没人能单测它。
    // 断言必须**限定在单项按钮**上：工具栏的一键完成/刷新按钮另有自己的条件，
    // 对整个文件断言会把它误判为违规。
    // 从「本任务的禁用判定」取到按钮的属性组（跨过 title/code/标签的一段）。
    const at = LIST_CODE.indexOf('const taskDisabled = isGrowthTaskDisabled(')
    expect(at).toBeGreaterThan(-1)
    const end = LIST_CODE.indexOf('{t(\'growthRunOne\')}', at)
    expect(end).toBeGreaterThan(at)
    const button = LIST_CODE.slice(at, end)
    expect(button).toContain('disabled: taskDisabled')
    expect(button).toContain('isGrowthTaskDisabled(inFlight, running, accountId, task.taskCode, accountInFlight)')
  })

  it('禁用规则是 store 里的纯函数，可被单测直接覆盖', () => {
    // 三条规则各有专门用例（见 growth-run.spec.ts 的「禁用范围以账号为界」）。
    expect(STORE).toContain('export function isGrowthTaskDisabled')
    expect(STORE).toContain('export function isAccountRunDisabled')
    expect(STORE).toContain('export function isRunAllDisabled')
    expect(LIST_CODE).toContain('isGrowthTaskDisabled(inFlight, running, accountId, task.taskCode, accountInFlight)')
    expect(LIST_CODE).toContain('isAccountRunDisabled(running, accountId ?? \'\', accountInFlight)')
    expect(PANEL_CODE).toContain('isRunAllDisabled(growthRun, accountInFlight)')
  })

  it('store 用集合记录逐任务在跑状态，而非单个全局标记', () => {
    expect(STORE).toContain('$growthTaskInFlight')
    expect(STORE).toContain('markGrowthTaskRunning')
    expect(STORE).toContain('clearGrowthTaskRunning')
  })

  it('单个任务结束后只清自己那一项', () => {
    const start = LIST.indexOf('const runOne')
    // 窗口取到 runOne 结束：函数体随日志/禁用逻辑增长，写死过小会假失败。
    const body = LIST.slice(start, LIST.indexOf('const groups', start))
    expect(body).toContain('clearGrowthTaskRunning(accountId, taskCode)')
  })

  it('收尾顺序：先解 loading，再以宿主为准，最后清乐观记录', () => {
    // 收尾抽到 settle（单项与一键完成共用），顺序在它内部。
    const settleAt = LIST.indexOf('const settle = useCallback')
    expect(settleAt).toBeGreaterThan(-1)
    const settle = LIST.slice(settleAt, LIST.indexOf('const runOne', settleAt))
    const hydrateAt = settle.indexOf('await hydrateGrowthRunState(rpc)')
    const optimisticAt = settle.indexOf('clearGrowthOptimistic()', hydrateAt)
    expect(hydrateAt).toBeGreaterThan(-1)
    // hydrate 会自己清乐观记录；提前清会让抽屉闪一下上一轮的旧日志。
    expect(optimisticAt).toBeGreaterThan(hydrateAt)
    // runOne 里先解本行 loading，再调用 settle。
    const start = LIST.indexOf('const runOne')
    const body = LIST.slice(start, LIST.indexOf('const runAccount', start))
    const clearAt = body.indexOf('clearGrowthTaskRunning(accountId, taskCode)')
    const callAt = body.indexOf('await settle()')
    expect(clearAt).toBeGreaterThan(-1)
    expect(callAt).toBeGreaterThan(clearAt)
  })

  it('点下按钮立刻记本地乐观日志（宿主落盘前就有内容）', () => {
    const start = LIST.indexOf('const runOne')
    const body = LIST.slice(start, LIST.indexOf('const groups', start))
    const optimisticAt = body.indexOf('markGrowthOptimistic(')
    const rpcAt = body.indexOf("'growthRun'")
    expect(optimisticAt).toBeGreaterThan(-1)
    expect(rpcAt).toBeGreaterThan(optimisticAt)
  })

  it('单项按钮自己挡重入（Semi 的 loading 不拦点击）', () => {
    const start = LIST.indexOf('const runOne')
    const body = LIST.slice(start, start + 400)
    expect(body).toMatch(/if \(inFlight\.includes\(growthTaskKey\(accountId, taskCode\)\)\) return/)
  })
})

describe('loading 与 disabled 共存', () => {
  it('两个属性各表达一件事，而不是二选一', () => {
    // 「完成任务」是**执行**动作，两个属性并存且条件不同：
    //   loading  = 本入口触发的那一轮在跑（mode 'all'）；
    //   disabled = 无账号可操作，或已有账号在跑成长任务（全账号范围不该重叠）。
    const clickAt = PANEL_CODE.indexOf('void runAllGrowth()')
    const button = PANEL_CODE.slice(Math.max(0, clickAt - 500), clickAt)
    expect(button).toMatch(/loading=\{runAllRunning\}/)
    expect(button).toMatch(/disabled=\{rows\.length === 0 \|\| \(runAllDisabled && !runAllRunning\)\}/)
    // loading 与 disabled 由不同条件喂入，不存在 disabled 吃掉 loading 的问题。
    expect(button).not.toMatch(/disabled=\{runAllRunning\}/)
  })

  it('禁用依据是宿主状态（刷新页面后依旧禁用）', () => {
    // 只凭本页组件 state 会让刷新页面后出现「实际在跑却可点」。
    expect(PANEL).toContain('useStore($growthRunning)')
    expect(PANEL_CODE).toContain('isRunAllDisabled(growthRun, accountInFlight)')
    // 本入口的 loading 标记取自宿主 mode 'all'，不是本地 state。
    expect(PANEL_CODE).toMatch(/growthRun\.mode === 'all'/)
  })

  it('成长任务刷新只给 loading：只读取数没有需要禁用的状态', () => {
    const toolbar = LIST_CODE.slice(LIST_CODE.indexOf('dsh-codebuddy-growth-task-toolbar'), LIST_CODE.indexOf('growth-task-body'))
    expect(toolbar).toMatch(/loading=\{loading\}/)
    // 不叠 disabled：刷新在别的任务跑着时反而更有用，且 Semi 的 disabled 会吃掉转圈。
    expect(toolbar).not.toMatch(/disabled=/)
  })

  it('签到已并入「完成任务」：动作区不再有独立的一键签到按钮', () => {
    // 用户要求把签到合并进成长任务流程，动作区因此去掉独立按钮，避免同一件事
    // 两个入口。手动签到仍保留在账号卡片菜单里（`checkin` RPC）。
    expect(PANEL).not.toContain("onClick={() => { void checkinAll() }}")
    expect(PANEL).not.toContain("t('checkinAll')")
    expect(PANEL).not.toContain('checkinButtonState')
    // 卡片菜单的单账号签到入口仍在。
    expect(PANEL).toContain('onCheckin')
  })

  it('签到状态模型已随独立按钮一起移除（不留死代码）', () => {
    expect(existsSync(`${ROOT}/client/checkin-state.ts`)).toBe(false)
    // 合并后不再需要判断一键签到按钮的启用态。
  })

  it('刷新按钮的重入由处理函数自己挡', () => {
    expect(LIST).toContain('reloadingRef')
    const start = LIST.indexOf('const reload = useCallback')
    expect(LIST.slice(start, start + 700)).toMatch(/if \(reloadingRef\.current\) return/)
  })

  it('一键完成的重入也由处理函数自己挡（loading 不拦点击）', () => {
    expect(LIST).toContain('runAccountRef')
    const start = LIST.indexOf('const runAccount = async')
    expect(start).toBeGreaterThan(-1)
    const body = LIST.slice(start, start + 400)
    expect(body).toMatch(/if \(runAccountRef\.current\) return/)
  })
})

describe('执行动作统一用 loading 而非禁用', () => {
  it('账号页刷新按钮用 loading', () => {
    expect(PANEL).toMatch(/icon=\{<DshIconRefresh \/>\} loading=\{loading\}/)
  })

  it('「完成任务」按钮用 loading', () => {
    const clickAt = PANEL.indexOf('void runAllGrowth()')
    const button = PANEL.slice(Math.max(0, clickAt - 500), clickAt)
    // loading 只表达「本入口触发的那一轮在跑」；disabled 表达「已有账号在跑」。
    // 两个条件必须不同：同一条件喂两者时 Semi 的 disabled 会吃掉转圈。
    expect(button).toMatch(/loading=\{runAllRunning\}/)
    expect(button).toMatch(/disabled=\{rows\.length === 0 \|\| \(runAllDisabled && !runAllRunning\)\}/)
  })
})

describe('完成任务按钮', () => {
  it('位于「添加账号」右侧的同一主操作组内', () => {
    const primary = PANEL.slice(PANEL.indexOf('dsh-codebuddy-accounts-head-primary'))
    const addAt = primary.indexOf('onClick={onAddAccount}')
    const growthAt = primary.indexOf('runAllGrowth')
    expect(addAt).toBeGreaterThan(-1)
    // 「添加账号」在前，「完成任务」紧跟其后。
    expect(growthAt).toBeGreaterThan(addAt)
    // 并且仍在右端次级动作区之前（自动切换/一键签到/刷新）。
    expect(primary.indexOf('dsh-codebuddy-accounts-head-actions')).toBeGreaterThan(growthAt)
  })

  it('主操作组间距为 10px', () => {
    const block = /\.dsh-codebuddy-accounts-head-primary\s*\{([^}]*)\}/.exec(ACCOUNTS_SCSS)?.[1] ?? ''
    expect(block).toMatch(/gap:\s*10px/)
  })

  it('文案为「完成任务」', () => {
    expect(ZH).toMatch(/growthRunAll:\s*'完成任务'/)
  })

  it('颜色风格与「添加账号」一致（同为 solid + primary 主操作）', () => {
    // 同组两个按钮必须同一视觉层级：一个是 solid/primary、另一个是 light，
    // 会让「完成任务」看起来像次级动作。
    const primary = PANEL.slice(PANEL.indexOf('dsh-codebuddy-accounts-head-primary'))
    const addButton = primary.slice(0, primary.indexOf('onAddAccount'))
    const growthClickAt = primary.indexOf('void runAllGrowth()')
    const growthButton = primary.slice(Math.max(0, growthClickAt - 900), growthClickAt)
    expect(addButton).toMatch(/theme="solid"/)
    expect(addButton).toMatch(/type="primary"/)
    expect(growthButton).toMatch(/theme="solid"/)
    expect(growthButton).toMatch(/type="primary"/)
    // 不允许退回次级样式。
    expect(growthButton).not.toMatch(/theme="light"/)
  })

  it('点击进入 loading，而不是 disabled', () => {
    // 用带 `= async` 的锚点：`const runAllGrowth` 也会匹配到 `runAllGrowthRef`
    // 的声明，用短锚点会取错位置（这条断言曾因此假失败）。
    const start = PANEL_CODE.indexOf('const runAllGrowth = async')
    expect(start).toBeGreaterThan(-1)
    const body = PANEL_CODE.slice(start, start + 600)
    expect(body).toContain('markGrowthRunning')
    // 按钮 JSX 从 onClick 绑定处向前取，包含它的属性组（必须用去注释源码，
    // 否则注释里的示例写法会挤占窗口）。
    const clickAt = PANEL_CODE.indexOf('void runAllGrowth()')
    const growthButton = PANEL_CODE.slice(Math.max(0, clickAt - 500), clickAt)
    expect(growthButton).toContain('loading={runAllRunning}')
    // 不得用「本轮在跑」这一个条件同时喂 loading 与 disabled。
    expect(growthButton).not.toMatch(/disabled=\{runAllRunning\}/)
  })

  it('运行中重复点击被挡住（loading 不拦点击，靠 ref guard）', () => {
    // 执行态只给 loading，Semi 的 loading 不会阻止 onClick，所以必须有重入判断。
    expect(PANEL_CODE).toMatch(/if \(runAllGrowthRef\.current \|\| growthRun\.running\) return/)
  })
})

describe('运行态持久化', () => {
  it('运行态写盘（宿主侧 begin/finish），不是只放组件 state', () => {
    expect(HOST_RUN).toContain('saveGrowthRunState')
    expect(HOST_RUN).toContain('loadGrowthRunState')
    expect(HOST_RUN).toContain('STALE_RUN_MS')
  })

  it('客户端 mount 时从宿主采纳状态，刷新后恢复 loading', () => {
    expect(STORE).toContain("'growthRunStatus'")
    expect(PANEL).toContain('hydrateGrowthRunState')
    // 采纳发生在 effect 里（mount 时执行）。
    expect(PANEL).toMatch(/useEffect\(\(\) => \{ void hydrateGrowthRunState\(rpc\) \}/)
  })

  it('执行结束以宿主状态收尾，避免永久 loading', () => {
    // 两条路径（单项、一键完成）都经 settle → hydrateGrowthRunState。
    const start = LIST.indexOf('const settle = useCallback')
    expect(start).toBeGreaterThan(-1)
    expect(LIST.slice(start, start + 300)).toContain('hydrateGrowthRunState')
    const runOne = LIST.indexOf('const runOne')
    const runAccount = LIST.indexOf('const runAccount = async')
    expect(LIST.slice(runOne, runAccount)).toContain('await settle()')
    expect(LIST.slice(runAccount, LIST.indexOf('const groups', runAccount))).toContain('await settle()')
  })
})
