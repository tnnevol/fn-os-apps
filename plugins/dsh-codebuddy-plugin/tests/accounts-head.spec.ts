import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 「添加账号」入口的位置约束。
 *
 * 原先它是页面顶部一张独立的操作卡（标题 + 说明 + 按钮）。现改为放在
 * 「账号管理」区块标题右侧，与自动签到/自动旅行/刷新同处一个动作区。
 *
 * 这里最容易犯的错是：把按钮放进只在「有账号」时才渲染的分支里——那样账号为 0
 * 时（恰恰最需要添加账号）按钮反而不存在。因此区块头必须**常驻**，
 * 列表为空时只把卡片网格换成空状态。
 */
const PANEL = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/panel.tsx',
  'utf8',
)
const INDEX_SCSS = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/styles/index.scss',
  'utf8',
)
const LAYOUT_SCSS = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/styles/panel-layout.scss',
  'utf8',
)

/** AccountsPage 的返回体（到下一个顶层 function 为止）。 */
const accountsBody = ((): string => {
  const start = PANEL.indexOf('function AccountsPage')
  const rest = PANEL.slice(start + 1)
  const nextFn = rest.indexOf('\nfunction ')
  return nextFn === -1 ? rest : rest.slice(0, nextFn)
})()

describe('添加账号入口', () => {
  it('操作卡已移除', () => {
    expect(PANEL).not.toContain('dsh-codebuddy-panel-action-card')
    expect(PANEL).not.toContain('accountActionTitle')
  })

  it('按钮位于区块头**左端**（贴标题右侧），不在右端动作区里', () => {
    const head = accountsBody.slice(accountsBody.indexOf('dsh-codebuddy-panel-section-head'))
    const leadAt = head.indexOf('dsh-codebuddy-accounts-head-lead')
    const addAt = head.indexOf('onClick={onAddAccount}')
    const actionsAt = head.indexOf('dsh-codebuddy-accounts-head-actions')
    expect(leadAt).toBeGreaterThan(-1)
    expect(addAt).toBeGreaterThan(leadAt)
    // 在右端动作区开始之前 —— 否则按钮又混进了次级控件堆里。
    expect(actionsAt).toBeGreaterThan(addAt)
  })

  it('左右两段由 space-between 分列两端', () => {
    const block = /\.dsh-codebuddy-panel-section-head\s*\{([^}]*)\}/.exec(LAYOUT_SCSS)?.[1] ?? ''
    expect(block).toMatch(/justify-content:\s*space-between/)
  })

  it('区块头常驻：外层没有条件渲染（否则空列表时入口消失）', () => {
    // 只比较「区块头在 rows.length === 0 之前」是不够的：把区块头包进
    // `rows.length > 0 ? ( … ) : null` 时先后关系不变，断言会假通过（实测漏网）。
    // 真正的依据是**区块头之前不能出现任何未闭合的条件表达式**。
    const headAt = accountsBody.indexOf('dsh-codebuddy-panel-section-head')
    expect(headAt).toBeGreaterThan(-1)
    const before = accountsBody.slice(Math.max(0, headAt - 260), headAt)
    // 允许注释里提到 rows.length；只看代码里的条件渲染写法。
    const code = before.replace(/\{[\s\S]*?\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).not.toMatch(/rows\.length\s*[><=!]/)
    expect(code).not.toMatch(/\?\s*\(/)
    // 同时确认空列表分支确实存在（结构没被整体删掉）。
    expect(accountsBody).toContain('rows.length === 0 ?')
  })

  it('登录中时按钮禁用并改文案', () => {
    expect(accountsBody).toMatch(/disabled=\{loginWaiting\}/)
    expect(accountsBody).toMatch(/loginWaiting \? t\('signingIn'\) : t\('createUser'\)/)
  })
})

describe('动作区可容纳多个控件', () => {
  it('允许换行（窄屏一行放不下会横向溢出）', () => {
    const block = /\.dsh-codebuddy-accounts-head-actions\s*\{([^}]*)\}/.exec(INDEX_SCSS)?.[1] ?? ''
    expect(block).toMatch(/flex-wrap:\s*wrap/)
  })

  it('左端（标题 + 主操作）也允许换行', () => {
    const block = /\.dsh-codebuddy-accounts-head-lead\s*\{([^}]*)\}/.exec(INDEX_SCSS)?.[1] ?? ''
    expect(block).toMatch(/flex-wrap:\s*wrap/)
  })

  it('窄屏竖排后动作区靠左，避免换行时与标题错开', () => {
    const narrow = LAYOUT_SCSS.slice(LAYOUT_SCSS.indexOf('@media (max-width: 720px)'))
    expect(narrow).toMatch(/\.dsh-codebuddy-accounts-head-actions\s*\{\s*justify-content:\s*flex-start/)
  })
})

describe('骨架与真实结构对齐', () => {
  it('骨架不再画已移除的操作卡', () => {
    const start = PANEL.indexOf('function AccountsSkeleton')
    const rest = PANEL.slice(start + 1)
    const nextFn = rest.indexOf('\nfunction ')
    const body = nextFn === -1 ? rest : rest.slice(0, nextFn)
    expect(body).not.toContain('panel-action-card')
    // 应与真实页面一致：先积分总览卡，再区块头。
    expect(body).toContain('dsh-codebuddy-panel-stat-card')
    expect(body).toContain('dsh-codebuddy-panel-section-head')
  })
})

describe('自动切换账号开关', () => {
  it('账号页标题行有该开关', () => {
    expect(accountsBody).toContain('<AutoSwitchToggle')
  })

  it('开关状态与设置页共用同一个 store（底层同一存储键）', () => {
    // 两处开关互为镜像：都读写 usage-prefs 里的同一个持久化 atom。
    expect(PANEL).toContain('useStore($autoSwitch)')
    expect(PANEL).toContain('$autoSwitch.set(checked)')
  })

  it('挂载与切换时同步到 host', () => {
    expect(accountsBody).toMatch(/rpc\.call\(CODEBUDDY_AUTH_CHANNEL, 'autoSwitch', \{ enabled: checked \}\)/)
    expect(accountsBody).toMatch(/rpc\.call\(CODEBUDDY_AUTH_CHANNEL, 'autoSwitch', \{ enabled: autoSwitchOn \}\)/)
  })

  it('只传 enabled，不覆盖设置页维护的阈值', () => {
    // 主机侧 thresholdPct 缺省沿用已加载值；若这里传一个数字，会把用户在设置页
    // 调好的阈值改掉。
    const calls = [...accountsBody.matchAll(/autoSwitch[^)]*\)/g)].map(m => m[0])
    for (const call of calls) {
      expect(call).not.toContain('thresholdPct')
    }
  })
})

describe('自动切换开启时隐藏「设为当前账号」', () => {
  it('条件包含 autoSwitch 判断', () => {
    expect(PANEL).toMatch(/if \(!row\.active && !autoSwitch\)/)
  })

  it('该标记由账号页传入，取自开关状态', () => {
    // 必须与开关同源：若传常量或漏传，开关就管不到卡片菜单。
    expect(accountsBody).toMatch(/autoSwitch=\{autoSwitchOn\}/)
  })

  it('开启时菜单项确实不追加（判断作用于 push 之前）', () => {
    const at = PANEL.indexOf('if (!row.active && !autoSwitch)')
    expect(at).toBeGreaterThan(-1)
    const body = PANEL.slice(at, at + 420)
    expect(body).toContain("key=\"switch\"")
  })
})

describe('面板与设置页的开关保持同步', () => {
  it('订阅偏好变化（面板关闭时组件仍挂载，否则会显示旧状态）', () => {
    // 面板关闭只是 `return null`，组件不卸载 → useState 不会重读 localStorage。
    // 若设置页改了自动切换，账号页会一直显示旧值，且卡片菜单的「设为当前账号」
    // 按旧值隐藏/显示。
    expect(accountsBody).toContain('subscribeUsagePref')
  })

  it('订阅回调里把三个开关同步到 host', () => {
    const at = accountsBody.indexOf('subscribeUsagePref(')
    const body = accountsBody.slice(at, at + 700)
    for (const store of ['$autoCheckin', '$autoTravel', '$autoSwitch']) {
      expect(body).toContain(`${store}.get()`)
    }
    // 展示值由 store 驱动，回调只负责同步 host（不再镜像到 state）。
    expect(body).not.toContain('setAutoSwitchOn')
  })

  it('订阅可取消（effect 返回 disposer）', () => {
    const at = accountsBody.indexOf('subscribeUsagePref(')
    // `return subscribeUsagePref(` 才会在卸载时注销监听；漏掉 return 会泄漏监听。
    expect(accountsBody.slice(Math.max(0, at - 60), at)).toMatch(/return\s+$/)
  })
})

describe('添加账号弹框内选择框的左间距', () => {
  const INDEX = readFileSync(
    '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/styles/index.scss',
    'utf8',
  )

  it('把 Semi 给 selection 的 12px 左外边距归零', () => {
    // Semi 的 .semi-select-selection 自带 margin-left: 12px，而插件给选择框加了
    // padding: 4px 8px，两者叠加文字左侧留白达 20px。归零后只由 padding 决定。
    expect(INDEX).toMatch(/\.dsh-codebuddy-add-form \.semi-select-selection \{\s*margin-left: 0;/)
  })

  it('覆盖限定在弹框表单内，不波及其它选择器', () => {
    // 用「插件类 + 后代 Semi 类」写法（与仓库既有 .dsh-codebuddy-account-descriptions
    // .semi-descriptions-key 一致），避免全局改写 Semi 组件外观。
    const m = /([^{}\n]*\.semi-select-selection[^{}\n]*)\{/.exec(INDEX)
    expect(m?.[1]?.trim()).toBe('.dsh-codebuddy-add-form .semi-select-selection')
  })
})
