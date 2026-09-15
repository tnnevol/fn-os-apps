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

  it('动作区有「查看日志」按钮，且刻意不带 loading/disabled', () => {
    // 用户要求：按钮随时可点，用来查看上一轮或正在执行的日志，
    // 因此不得加 loading / disabled（那会让人以为不能点）。
    expect(PANEL).toContain("t('growthLogOpen')")
    // 从 <DshButton 起切到该按钮的 onClick，才是这个按钮自己的属性组；
    // 向前取窗口会把上一个「刷新」按钮的 loading 也框进来（实测假失败）。
    const openAt = PANEL.indexOf("icon={<DshIconList />}")
    expect(openAt).toBeGreaterThan(-1)
    const buttonStart = PANEL.lastIndexOf('<DshButton', openAt)
    const button = PANEL.slice(buttonStart, PANEL.indexOf('setLogOpen(true) }}', openAt))
    expect(button).not.toContain('loading=')
    expect(button).not.toContain('disabled=')
  })
})

describe('抽屉观感与滚动', () => {
  it('抽屉占屏幕下半部分（50vh），上半部分留给面板', () => {
    expect(DRAWER).toMatch(/DRAWER_HEIGHT = '50vh'/)
    expect(DRAWER).toMatch(/height=\{DRAWER_HEIGHT\}/)
  })

  it('上半部分蒙层是半透明磨砂（backdrop-filter blur）', () => {
    expect(DRAWER).toContain('maskStyle')
    expect(DRAWER).toMatch(/backdropFilter: 'blur/)
    // Safari 需要 -webkit- 前缀，否则磨砂不生效。
    expect(DRAWER).toMatch(/WebkitBackdropFilter/)
  })

  it('蒙层用 DSH 的 mask token，而不是 Semi 的 overlay 色', () => {
    // 主题桥把 --semi-color-overlay-bg 映射成不透明的 --dsw-alias-bg-base，
    // 用它会把上半屏压成实心、失去半透明效果。必须用真正半透明的
    // --dsw-alias-bg-mask-1（浅色 #0000003d）。
    // 断言用去注释源码：上面这段解释本身就包含被否决的 token 名。
    const DRAWER_CODE = DRAWER.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
    expect(DRAWER_CODE).toContain('--dsw-alias-bg-mask-1')
    expect(DRAWER_CODE).not.toContain('--dsw-alias-bg-mask,')
    expect(DRAWER_CODE).not.toContain('--semi-color-overlay-bg')
  })

  it('日志区固定高度 + 内部滚动，抽屉本身不整体滚动', () => {
    const GROWTH_SCSS = readFileSync(`${ROOT}/styles/growth-tasks.scss`, 'utf8')
    const scroll = /\.dsh-codebuddy-growth-log-scroll\s*\{([^}]*)\}/.exec(GROWTH_SCSS)?.[1] ?? ''
    expect(scroll).toMatch(/flex:\s*1/)
    // min-height: 0 是 flex 子项内部滚动生效的前提（默认 auto 会被内容撑开）。
    expect(scroll).toMatch(/min-height:\s*0/)
    expect(scroll).toMatch(/overflow-y:\s*auto/)
    const body = /\.dsh-codebuddy-growth-log-body\s*\{([^}]*)\}/.exec(GROWTH_SCSS)?.[1] ?? ''
    expect(body).toMatch(/min-height:\s*0/)
    // 外层不该自己滚动——否则标题与状态行会被一起滚走。
    expect(body).not.toMatch(/overflow-y:\s*auto/)
    expect(DRAWER).toContain('dsh-codebuddy-growth-log-scroll')
  })

  it('内容区用 border-box，避免「内容没超出也出滚动条」', () => {
    const GROWTH_SCSS = readFileSync(`${ROOT}/styles/growth-tasks.scss`, 'utf8')
    const body = /\.dsh-codebuddy-growth-log-body\s*\{([^}]*)\}/.exec(GROWTH_SCSS)?.[1] ?? ''
    // 本仓库没有全局 border-box 重置，而 Semi 的 .semi-sidesheet-body 自带
    // overflow: auto：按 content-box 算时 height:100% + 8px padding 会比容器高
    // 8px，于是内容很短也冒出滚动条。
    expect(body).toMatch(/box-sizing:\s*border-box/)
    // 再兜一层：真出现高度溢出也不让外层滚（该滚的是日志区）。
    expect(body).toMatch(/overflow:\s*hidden/)
  })

  it('不再有「准备中」空态：状态行直接说正在执行', () => {
    expect(DRAWER).not.toContain('growthLogWaiting')
    expect(DRAWER).toContain("t('growthLogRunning')")
    const ZH = readFileSync(`${ROOT}/client/locales/zh.ts`, 'utf8')
    expect(ZH).not.toContain('growthLogWaiting')
  })
})

describe('展开时的日志接线', () => {
  it('点「完成任务」自动展开抽屉', () => {
    const start = PANEL.indexOf('const runAllGrowth = async')
    expect(start).toBeGreaterThan(-1)
    const body = PANEL.slice(start, start + 700)
    expect(body).toContain('setLogOpen(true)')
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
