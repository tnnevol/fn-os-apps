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

  it('抽屉挂在面板上（关闭由抽屉自身的 ✕ 触发）', () => {
    expect(PANEL).toContain('<GrowthRunDrawer')
    expect(PANEL).toMatch(/onClose=\{\(\) => \{ setLogOpen\(false\) \}\}/)
  })

  it('动作区不再有手动的「执行日志」按钮（抽屉只由「完成任务」唤起）', () => {
    // 曾经在动作区加过一个手动入口，用户要求去掉：抽屉改为只在点击
    // 「完成任务」时自动展开，避免动作区控件过多。
    expect(PANEL).not.toContain("t('growthLogOpen')")
    const actionsAt = PANEL.indexOf('dsh-codebuddy-accounts-head-actions')
    const actionsEnd = PANEL.indexOf('</div>', PANEL.indexOf('dsh-codebuddy-panel-section-head'))
    const actions = PANEL.slice(actionsAt, actionsEnd)
    expect(actions).not.toContain('setLogOpen(true)')
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

/**
 * 签到与旅行已并入「完成任务」。
 *
 * 合并的三条硬约束（都是用户明确要求或事实依赖）：
 *  1. 领养（first_buddy）必须先于旅行——它产出的 Buddy 是派发前提；
 *  2. 签到/旅行各自「执行中或已执行则跳过」，不重复执行；
 *  3. 动作区不再有独立「一键签到」按钮（避免同一件事两个入口）。
 */
describe('签到与旅行并入成长任务流程', () => {
  const HOST = readFileSync(`${ROOT}/host/auth-service.ts`, 'utf8')

  it('growthRunAll 串入签到与旅行步骤', () => {
    const start = HOST.indexOf('async growthRunAll')
    const body = HOST.slice(start, start + 9000)
    expect(body).toContain('checkinOneAccount')
    expect(body).toContain('travelOneAccount')
    // 日志里能看到这两步（抽屉据此展示）。
    expect(body).toContain("code: '签到'")
    expect(body).toContain("code: '旅行'")
  })

  it('任务按依赖序执行：领安排在最前', () => {
    const start = HOST.indexOf('async growthRunAll')
    const body = HOST.slice(start, start + 2000)
    expect(body).toContain('sortGrowthTasksByOrder')
  })

  it('旅行在领养之后（领养产出 Buddy 才能派发）', () => {
    const start = HOST.indexOf('async growthRunAll')
    const body = HOST.slice(start, start + 9000)
    // 领养在任务循环内（sortGrowthTasksByOrder 已保证），旅行在循环之后。
    const loopEnd = body.indexOf('签到与旅行收尾')
    expect(loopEnd).toBeGreaterThan(-1)
    expect(body.indexOf('travelOneAccount')).toBeGreaterThan(loopEnd)
  })

  it('签到已签到即跳过，不重复提交', () => {
    const start = HOST.indexOf('private async checkinOneAccount')
    const body = HOST.slice(start, start + 1200)
    expect(body).toContain('status.todayCheckedIn) return { id, name, result: \'already\' }')
  })

  it('旅行在途或今日已旅行即跳过，不重复派发', () => {
    const start = HOST.indexOf('private async travelOneAccount')
    const body = HOST.slice(start, start + 1600)
    expect(body).toContain("status.state === 'traveling') return { id, name, result: 'traveling' }")
    expect(body).toContain("return { id, name, result: 'daily-limit' }")
  })

  it('企业账号签到与旅行都跳过', () => {
    for (const method of ['checkinOneAccount', 'travelOneAccount']) {
      const start = HOST.indexOf(`private async ${method}`)
      const body = HOST.slice(start, start + 600)
      expect(body).toContain("identity.enterpriseId !== undefined")
      expect(body).toContain("result: 'skipped'")
    }
  })
})
