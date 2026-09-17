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

  it('自己渲染逐行（CodeHighlight 无法按段着色）', () => {
    // Semi 只注册 Prism core、没加载任何语言词法（连 log 都没有），且
    // CodeHighlight 只接收纯字符串、无法注入分段标记；要按「时间/账号/状态」
    // 分段上色只能自己渲染。
    expect(DRAWER).not.toContain('<DshCodeHighlight')
    expect(DRAWER).toContain('growthLogLines')
    expect(DRAWER).toContain('dsh-codebuddy-growth-log-line')
  })

  it('时间、账号、任务、状态各是一个可独立着色的元素', () => {
    for (const cls of [
      'dsh-codebuddy-growth-log-time',
      'dsh-codebuddy-growth-log-account',
      'dsh-codebuddy-growth-log-code',
      'dsh-codebuddy-growth-log-status',
      'dsh-codebuddy-growth-log-message',
    ]) {
      expect(DRAWER).toContain(cls)
    }
    // 色调由逐行数据给出（已结合进度算出「没开始/做了一半」），组件不再自行判断。
    // 列 render 拿不到行对象以外的信息，所以从 record 上取 tone。
    expect(DRAWER).toMatch(/is-\$\{record\.tone\}/)
    expect(DRAWER).not.toContain('statusTone(line')
  })

  it('只在展开且执行中轮询，跑完与收起都要停', () => {
    // 轮询条件是 visible 且（宿主在跑 **或** 本地有乐观起点）。
    // 乐观态下宿主可能还没置 running，不轮询就永远拉不到后续日志。
    expect(DRAWER).toMatch(/if \(!visible \|\| \(!running\.running && optimistic === undefined\)\) return/)
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

  it('日志区固定高度，滚动交给 Semi Table 虚拟化', () => {
    const GROWTH_SCSS = readFileSync(`${ROOT}/styles/growth-tasks.scss`, 'utf8')
    const terminal = /\.dsh-codebuddy-growth-log-terminal\s*\{([^}]*)\}/.exec(GROWTH_SCSS)?.[1] ?? ''
    expect(terminal).toMatch(/flex:\s*1/)
    // min-height: 0 是 flex 子项能被压缩的前提（默认 auto 会被内容撑开，抽屉被顶高）。
    expect(terminal).toMatch(/min-height:\s*0/)
    // 滚动容器现在是 Semi Table 自己的 body，我们不再自己 overflow: auto。
    expect(terminal).toMatch(/overflow:\s*hidden/)
    const body = /\.dsh-codebuddy-growth-log-body\s*\{([^}]*)\}/.exec(GROWTH_SCSS)?.[1] ?? ''
    expect(body).toMatch(/min-height:\s*0/)
    expect(body).not.toMatch(/overflow-y:\s*auto/)
    // 组件必须把虚拟化三件套交给 Table：virtualized / scroll.y / style.width。
    expect(DRAWER).toMatch(/virtualized:\s*\{\s*itemSize/)
    expect(DRAWER).toMatch(/scroll:\s*\{\s*y:\s*height/)
    expect(DRAWER).toMatch(/style:\s*\{\s*width\s*\}/)
  })

  it('虚拟化所需的高度与宽度是实测数字（Semi 只接受 number）', () => {
    // Semi 虚拟化要求 scroll.y(number) 与 style.width(number)，不接受 vh/% 这类相对值。
    expect(DRAWER).toContain('ResizeObserver')
    expect(DRAWER).toMatch(/element\.clientWidth|clientHeight/)
    // 测量不到（尚未布局）时退化为普通表格，而不是渲染空白。
    expect(DRAWER).toMatch(/height > 0 && width > 0/)
  })

  it('虚拟化行宽跟随终端宽度，避免右侧露出裸背景', () => {
    expect(DRAWER).toMatch(/const tableWidth = Math\.max\(MIN_TABLE_WIDTH, width\)/)
    expect(DRAWER).toMatch(/createLogColumns\(Math\.max\(COLUMN_WIDTH\.message, tableWidth - FIXED_COLUMN_WIDTH\)\)/)
    expect(DRAWER).toMatch(/scroll:\s*\{\s*y:\s*height,\s*x:\s*tableWidth\s*\}/)
    const GROWTH_SCSS = readFileSync(`${ROOT}/styles/growth-tasks.scss`, 'utf8')
    // wrapper 与虚拟化内部 fixed row 都必须是终端深色；默认 Semi 背景不能泄漏。
    expect(GROWTH_SCSS).toContain('background-color: #11151c !important')
    expect(GROWTH_SCSS).toContain('background-color: transparent !important')
    expect(GROWTH_SCSS).toContain('padding: 0 8px !important')
  })

  it('Table 选择器是后代选择器（className 落在最外层 wrapper 上）', () => {
    const GROWTH_SCSS = readFileSync(`${ROOT}/styles/growth-tasks.scss`, 'utf8')
    // Semi Table 把 className 放在最外层 `.semi-table-wrapper`，不在 `.semi-table` 根上，
    // 所以 `.xxx.semi-table` 这种同元素组合永远匹配不到——必须用后代选择器。
    expect(GROWTH_SCSS).not.toMatch(/\.dsh-codebuddy-growth-log-table\.semi-table/)
    expect(GROWTH_SCSS).toMatch(/\.dsh-codebuddy-growth-log-table \.semi-table-row-cell/)
    // 单元格高度要与虚拟化的 itemSize 一致，否则滚动位置与内容错位。
    expect(GROWTH_SCSS).toMatch(/\.dsh-codebuddy-growth-log-table \.semi-table-row-cell \{[^}]*height: 24px/)
  })

  it('Tabs 只做轮次切换，内容区不占位', () => {
    const GROWTH_SCSS = readFileSync(`${ROOT}/styles/growth-tasks.scss`, 'utf8')
    // Tabs 的 pane 是空的（日志在 Tabs 外面），默认 padding 会在抽屉里留一条空档。
    expect(GROWTH_SCSS).toMatch(/\.dsh-codebuddy-growth-log-sheet \.semi-tabs-content/)
    // 没有上一轮时不渲染页签（避免一个永远空着的入口）。
    expect(DRAWER).toMatch(/hasPrevious\s*\n?\s*\?/)
    expect(DRAWER).toContain('growthLogRoundCurrent')
    expect(DRAWER).toContain('growthLogRoundPrevious')
  })

  it('虚拟化的行高是固定常量（按 itemSize 算可视区间）', () => {
    expect(DRAWER).toMatch(/const LOG_ROW_HEIGHT = \d+/)
    expect(DRAWER).toMatch(/itemSize:\s*LOG_ROW_HEIGHT/)
    // 单元格高度必须与 itemSize 一致，否则滚动位置与内容错位。
    const GROWTH_SCSS = readFileSync(`${ROOT}/styles/growth-tasks.scss`, 'utf8')
    expect(GROWTH_SCSS).toMatch(/height:\s*24px/)
  })

  it('滚动条与深色背景同在一层（避免滚动条看起来「溢出」）', () => {
    const GROWTH_SCSS = readFileSync(`${ROOT}/styles/growth-tasks.scss`, 'utf8')
    // 底色在外壳、滚动在子元素，两者同属一块视觉面板；不复用 Semi 代码块那种
    // 「外层滚动 + 内层 pre 变色」的分离结构（正是上次问题的成因）。
    const terminal = /\.dsh-codebuddy-growth-log-terminal\s*\{([^}]*)\}/.exec(GROWTH_SCSS)?.[1] ?? ''
    expect(terminal).toMatch(/background:\s*#11151c/)
    expect(terminal).toMatch(/scrollbar-color/)
    // 虚拟化后滚动容器是 Semi Table 的 body，所以滚动条样式用后代选择器覆盖
    // 终端内的所有滚动元素；选择器仍限定在本插件命名空间，不污染其它滚动区。
    expect(GROWTH_SCSS).toMatch(/\.dsh-codebuddy-growth-log-terminal ::-webkit-scrollbar/)
    expect(GROWTH_SCSS).not.toMatch(/^\s*\.semi-codeHighlight\s*\{/m)
  })

  it('配色是深底亮字：背景深、前景亮', () => {
    const GROWTH_SCSS = readFileSync(`${ROOT}/styles/growth-tasks.scss`, 'utf8')
    const terminal = /\.dsh-codebuddy-growth-log-terminal\s*\{([^}]*)\}/.exec(GROWTH_SCSS)?.[1] ?? ''
    // 深底
    expect(terminal).toMatch(/background:\s*#11151c/)
    // 亮字（前景明显偏亮）
    const fg = /color:\s*#([0-9a-f]{6})/i.exec(terminal)?.[1] ?? ''
    const channels = [0, 2, 4].map(i => Number.parseInt(fg.slice(i, i + 2), 16))
    const avg = channels.reduce((sum, value) => sum + value, 0) / channels.length
    expect(avg).toBeGreaterThan(150)
    // 时间与账号必须是**不同**颜色（用户点名要求）。
    const time = /\.dsh-codebuddy-growth-log-time\s*\{\s*color:\s*(#[0-9a-f]{6})/i.exec(GROWTH_SCSS)?.[1] ?? ''
    const account = /\.dsh-codebuddy-growth-log-account\s*\{\s*color:\s*(#[0-9a-f]{6})/i.exec(GROWTH_SCSS)?.[1] ?? ''
    expect(time).not.toBe('')
    expect(account).not.toBe('')
    expect(time).not.toBe(account)
  })

  it('抽屉底部留 15px（作用在 .semi-sidesheet-body 上）', () => {
    const GROWTH_SCSS = readFileSync(`${ROOT}/styles/growth-tasks.scss`, 'utf8')
    // 必须用后代选择器且限定在本组件的 sheet 类下：className 落在 .semi-sidesheet
    // 外壳上，body 是其后代；不加限定会污染其它使用 SideSheet 的地方。
    const rule = /\.dsh-codebuddy-growth-log-sheet\s+\.semi-sidesheet-body\s*\{([^}]*)\}/.exec(GROWTH_SCSS)?.[1] ?? ''
    expect(rule).toMatch(/padding-bottom:\s*15px/)
    // 只补下边距，不覆盖 Semi 的左右 24px。
    expect(rule).not.toMatch(/padding:\s*0/)
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

  it('只有最后一行且仍在执行时才标 live（历史行不闪）', () => {
    // running/waiting 是过程标记，后续行一出现就说明它过去了；
    // 给历史行加呼吸动画会让整屏一直闪。
    // 用合并后的 view.running（含本地乐观态），否则点下按钮的瞬间不算「在执行」。
    expect(DRAWER).toMatch(/live: running && line\.tone === 'info' && index === lines\.length - 1/)
    expect(DRAWER).toMatch(/is-live/)
    // 上一轮永远不是 live（它已经结束了）。
    expect(DRAWER).toMatch(/round === 'current' && view\?\.running === true/)
  })

  it('live 行有呼吸与跳动小点的样式，并尊重减少动效偏好', () => {
    const GROWTH_SCSS = readFileSync(`${ROOT}/styles/growth-tasks.scss`, 'utf8')
    // 背景要落在单元格上：虚拟化表格的 td 自带底色，只给 tr 上色会被盖住。
    expect(GROWTH_SCSS).toMatch(/\.semi-table-row\.is-live \.semi-table-row-cell/)
    expect(GROWTH_SCSS).toMatch(/@keyframes dsh-codebuddy-log-pulse/)
    expect(GROWTH_SCSS).toMatch(/@keyframes dsh-codebuddy-log-dots/)
    // prefers-reduced-motion 下必须关掉动画。
    expect(GROWTH_SCSS).toMatch(/prefers-reduced-motion: reduce/)
  })

  it('不再有「准备中」空态：状态行直接说正在执行', () => {
    expect(DRAWER).not.toContain('growthLogWaiting')
    expect(DRAWER).toContain("t('growthLogRunning')")
    const ZH = readFileSync(`${ROOT}/client/locales/zh.ts`, 'utf8')
    expect(ZH).not.toContain('growthLogWaiting')
  })
})

describe('单项任务也复用同一份日志', () => {
  it('单项「完成」执行时打开抽屉，且复用同一份日志', () => {
    const LIST = readFileSync(`${ROOT}/client/ui/growth-task-list.tsx`, 'utf8')
    // 打开抽屉必须在发起 RPC **之前**：单项里也有耗时的（领养、专家链），
    // 等 RPC 回来再打开就只剩结果、看不到过程。
    const openAt = LIST.indexOf('onOpenLog?.()')
    const callAt = LIST.indexOf("'growthRun'")
    expect(openAt).toBeGreaterThan(-1)
    expect(callAt).toBeGreaterThan(-1)
    expect(openAt).toBeLessThan(callAt)
  })

  it('onOpenLog 由面板经弹框透传（抽屉挂在面板层，不在弹框内）', () => {
    const LIST = readFileSync(`${ROOT}/client/ui/growth-task-list.tsx`, 'utf8')
    const MODAL = readFileSync(`${ROOT}/client/ui/account-resources-modal.tsx`, 'utf8')
    // 列表接收回调；弹框接收并继续透传；面板提供实现（setLogOpen）。
    expect(LIST).toContain('onOpenLog?: () => void')
    expect(MODAL).toContain('onOpenLog?: () => void')
    expect(MODAL).toContain('onOpenLog')
    expect(PANEL).toMatch(/onOpenLog=\{\(\) => \{ setLogOpen\(true\) \}\}/)
  })

  it('抽屉层级高于 Semi Modal，避免被弹框盖住', () => {
    // 两者默认 zIndex 都是 1000，同层时会由挂载顺序决定谁在上、并不稳定。
    expect(DRAWER).toMatch(/const DRAWER_Z_INDEX = 1010/)
    expect(DRAWER).toMatch(/zIndex=\{DRAWER_Z_INDEX\}/)
  })
})

describe('展开时的日志接线', () => {
  it('点「完成任务」自动展开抽屉', () => {
    const start = PANEL.indexOf('const runAllGrowth = async')
    expect(start).toBeGreaterThan(-1)
    const body = PANEL.slice(start, start + 700)
    expect(body).toContain('setLogOpen(true)')
  })

  it('SideSheet 经 dsh-semi-ui 导出（面板不直接依赖 semi-ui 内部路径）', () => {
    expect(COMPONENTS).toContain('DshSideSheet')
  })
})

describe('宿主持久化日志', () => {
  it('提供追加接口，并按轮次保留（不再按条数裁剪）', () => {
    expect(HOST_RUN).toContain('export async function appendGrowthRunLog')
    // 条数上限会静默丢掉早期账号的日志，改为「本次 + 上次」两轮。
    expect(HOST_RUN).toContain('RETAINED_LOG_ROUNDS')
    expect(HOST_RUN).toContain('previousLog')
    expect(HOST_RUN).not.toContain('MAX_LOG_ENTRIES')
  })

  it('追加走串行队列：账号并发处理时读-改-写会互相覆盖', () => {
    expect(HOST_RUN).toContain('SerialQueue')
    expect(HOST_RUN).toMatch(/logQueue\.runExclusive/)
  })

  it('begin 清空上一轮日志，finish 保留本轮日志', () => {
    const begin = HOST_RUN.slice(HOST_RUN.indexOf('export async function beginGrowthRun'), HOST_RUN.indexOf('export async function appendGrowthRunLog'))
    // 滚动轮次时清空本轮日志；并行账号加入时不滚动（见 rollRound 的说明）。
    expect(begin).toContain('log: rollRound ? [] : previous?.log ?? []')
    expect(begin).toContain('const rollRound = growthRunRegistry.ids().length <= 1')
    const finish = HOST_RUN.slice(HOST_RUN.indexOf('export async function finishGrowthRun'))
    expect(finish).toContain('log: previous.log')
  })

  it('客户端把日志格式化成等宽文本', () => {
    expect(STORE).toContain('export function formatGrowthRunLog')
    // 渲染改由 log-presentation 的逐行数据驱动，纯文本只是它的拼接结果。
    expect(STORE).toContain('growthLogLines')
    // code 列补齐，让状态列对齐。
    // 补齐在 log-presentation.ts（渲染与纯文本共用同一份逐行数据）。
    const PRESENTATION = readFileSync(`${ROOT}/client/log-presentation.ts`, 'utf8')
    expect(PRESENTATION).toMatch(/padEnd\(codeWidth/)
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
    const body = HOST.slice(start, start + 14000)
    expect(body).toContain('checkinOneAccount')
    expect(body).toContain('travelOneAccount')
    // 日志里能看到这两步（抽屉据此展示）。
    expect(body).toContain("code: '签到'")
    expect(body).toContain("code: '旅行'")
  })

  it('长请求有等待日志，不出现静默期', () => {
    // 任务循环已抽到 runGrowthTasks（单账号执行的核心），等待/回读日志在那里。
    const start = HOST.indexOf('private async runGrowthTasks')
    const body = HOST.slice(start, start + 6000)
    // 任务动作前后都落日志，回读等待期间也落一条。
    expect(body).toContain("status: 'waiting'")
    expect(body).toMatch(/等待上游计分/)
    // 签到与旅行各自先记「开始」再记结果（仍在 growthRunAll 内，因为它还要
    // 按账号加锁，签到/旅行属于「全量」收尾）。
    const runAll = HOST.slice(HOST.indexOf('async growthRunAll'), HOST.indexOf('async growthRunAll') + 14000)
    expect(runAll).toMatch(/查询签到状态/)
    expect(runAll).toMatch(/确认猫猫档案/)
  })

  it('进度写进结构化字段，供前端区分「没开始」与「做了一半」', () => {
    const start = HOST.indexOf('private async runGrowthTasks')
    const body = HOST.slice(start, start + 6000)
    // pending 分支必须同时带 current/target，否则前端无法上色。
    const pendingAt = body.indexOf("status: 'pending'")
    expect(pendingAt).toBeGreaterThan(-1)
    const chunk = body.slice(pendingAt, pendingAt + 300)
    expect(chunk).toContain('current:')
    expect(chunk).toContain('target:')
  })

  it('任务按依赖序执行：领安排在最前', () => {
    // 排序在单账号执行核心（runGrowthForAccount）里，单项与全量两条路径共用。
    const start = HOST.indexOf('private async runGrowthForAccount')
    const body = HOST.slice(start, start + 6000)
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
    const body = HOST.slice(start, start + 2600)
    // 返回结果现在带 adopted 标记，因此只断言状态本身。
    expect(body).toContain("result: 'traveling'")
    expect(body).toContain("result: 'daily-limit'")
  })

  it('旅行前先确认有无猫猫，没有就先领养再旅行', () => {
    const start = HOST.indexOf('private async travelOneAccount')
    const body = HOST.slice(start, start + 2600)
    // 顺序必须是：探猫 → （无猫时）领养 → 再走旅行状态机。
    const buddyAt = body.indexOf('hasBuddy(')
    const adoptAt = body.indexOf('adoptBeforeTravel(')
    const statusAt = body.indexOf('fetchTravelStatus(')
    expect(buddyAt).toBeGreaterThan(-1)
    expect(adoptAt).toBeGreaterThan(buddyAt)
    expect(statusAt).toBeGreaterThan(adoptAt)
    // 领养没成就直接返回，不派发。
    expect(body).toMatch(/adopt\.result !== 'adopted'/)
  })

  it('自动旅行周期同样先领养再旅行', () => {
    const start = HOST.indexOf('private async runTravelPass')
    const body = HOST.slice(start, start + 2600)
    const buddyAt = body.indexOf('hasBuddy(')
    const adoptAt = body.indexOf('adoptBeforeTravel(')
    expect(buddyAt).toBeGreaterThan(-1)
    expect(adoptAt).toBeGreaterThan(buddyAt)
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
