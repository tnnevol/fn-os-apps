import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 任务执行日志抽屉（方案 A：底部 SideSheet + CodeHighlight）。
 *
 * 这组用例守住「点完成任务能看到具体日志」这条链路的几个关键接缝：
 *  1. 抽屉用 `placement="bottom"`（日志是横向长行，左右抽屉会折行）；
 *  2. 用 `CodeHighlight` 展示等宽原始日志；
 *  3. 展开且执行中才轮询宿主，跑完停止（不空转）；
 *  4. 点「完成任务」自动展开抽屉；
 *  5. 面板仍有手动入口，跑完可回看。
 */
const ROOT = '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src'
const DRAWER = readFileSync(`${ROOT}/client/ui/growth-run-drawer.tsx`, 'utf8')
const PANEL = readFileSync(`${ROOT}/client/panel.tsx`, 'utf8')
const STORE = readFileSync(`${ROOT}/client/store/growth-run.ts`, 'utf8')
const HOST_RUN = readFileSync(`${ROOT}/host/growth-run.ts`, 'utf8')
const COMPONENTS = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/packages/dsh-semi-ui/src/components.ts',
  'utf8',
)

describe('日志抽屉组件', () => {
  it('用底部 SideSheet（横向长日志不该塞进左右抽屉）', () => {
    expect(DRAWER).toContain('<DshSideSheet')
    expect(DRAWER).toMatch(/placement="bottom"/)
  })

  it('用 CodeHighlight 展示等宽日志，语言为自定义 log', () => {
    expect(DRAWER).toContain('<DshCodeHighlight')
    expect(DRAWER).toMatch(/language="log"/)
    // 行号便于对照「第几条」，与 Semi 默认一致但显式写出更清楚。
    expect(DRAWER).toMatch(/lineNumber/)
  })

  it('只在展开且执行中轮询，跑完与收起都要停', () => {
    // 轮询条件同时看 visible 与 running。
    expect(DRAWER).toMatch(/if \(!visible \|\| !running\.running\) return/)
    // effect 必须返回清理函数，否则收起后定时器继续跑。
    expect(DRAWER).toMatch(/clearInterval\(timer\)/)
    // 间隔复用 store 的常量，避免两处各写一个数字。
    expect(DRAWER).toContain('GROWTH_RUN_POLL_MS')
  })

  it('展开时立刻拉一次，不干等第一个轮询周期', () => {
    expect(DRAWER).toMatch(/if \(!visible\) return/)
    expect(DRAWER).toContain('hydrateGrowthRunState(rpc)')
  })
})

describe('抽屉与面板的接线', () => {
  it('点「完成任务」自动展开抽屉', () => {
    const start = PANEL.indexOf('const runAllGrowth = async')
    expect(start).toBeGreaterThan(-1)
    const body = PANEL.slice(start, start + 700)
    expect(body).toContain('setLogOpen(true)')
  })

  it('面板保留手动入口，跑完可回看最近一轮', () => {
    expect(PANEL).toContain('setLogOpen(true)')
    expect(PANEL).toContain("t('growthLogOpen')")
    expect(PANEL).toContain('<GrowthRunDrawer')
  })

  it('两侧都在 dsh-semi-ui 中导出（面板不能直接依赖 semi-ui 内部路径）', () => {
    expect(COMPONENTS).toContain('DshSideSheet')
    expect(COMPONENTS).toContain('DshCodeHighlight')
  })
})

describe('宿主持久化日志', () => {
  it('提供追加接口并设上限', () => {
    expect(HOST_RUN).toContain('export async function appendGrowthRunLog')
    expect(HOST_RUN).toContain('MAX_LOG_ENTRIES')
  })

  it('追加走串行队列：账号并发处理时读-改-写会互相覆盖', () => {
    expect(HOST_RUN).toContain('SerialQueue')
    expect(HOST_RUN).toMatch(/logQueue\.runExclusive/)
  })

  it('begin 清空上一轮日志，finish 保留本轮日志', () => {
    const begin = HOST_RUN.slice(HOST_RUN.indexOf('export async function beginGrowthRun'), HOST_RUN.indexOf('export async function appendGrowthRunLog'))
    expect(begin).toContain('log: []')
    const finish = HOST_RUN.slice(HOST_RUN.indexOf('export async function finishGrowthRun'))
    expect(finish).toContain('log: previous.log')
  })

  it('客户端把日志格式化成等宽文本', () => {
    expect(STORE).toContain('export function formatGrowthRunLog')
    // code 列补齐，让状态列对齐。
    expect(STORE).toMatch(/padEnd\(codeWidth/)
  })
})
