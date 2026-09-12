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
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/styles/accounts.scss',
  'utf8',
)
const LAYOUT_SCSS = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/styles/panel-shell.scss',
  'utf8',
)

/** AccountsPage 的返回体（到下一个顶层 function 为止）。 */
const accountsBody = ((): string => {
  const start = PANEL.indexOf('function AccountsPage')
  const rest = PANEL.slice(start + 1)
  const nextFn = rest.indexOf('\nfunction ')
  return nextFn === -1 ? rest : rest.slice(0, nextFn)
})()

/** hooks/use-auto-prefs.ts 中的 useAutoPrefs 函数体（包含三个 auto* 偏好的同步）。 */
const HOOK = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/hooks/use-auto-prefs.ts',
  'utf8',
)
/** components/CodeBuddySection.tsx（设置页组件，store 来源之一）。 */
const SECTION = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/components/CodeBuddySection.tsx',
  'utf8',
)

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
    const narrow = INDEX_SCSS.slice(INDEX_SCSS.indexOf('@media (max-width: 720px)'))
    expect(narrow).toMatch(/\.dsh-codebuddy-accounts-head-actions\s*\{\s*justify-content:\s*flex-start/)
  })
})

describe('骨架与真实结构对齐', () => {
  it('骨架不再画已移除的操作卡', () => {
    // 实现迁到 ui/loading-shared.tsx（`AccountsSkeleton`）。从该文件取整段函数体：
    // 起点 `export function AccountsSkeleton`，到下一个 `\nexport ` 或文件末尾。
    const shared = readFileSync(
      '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/ui/loading-shared.tsx',
      'utf8',
    )
    const start = shared.indexOf('export function AccountsSkeleton')
    const rest = shared.slice(start + 1)
    const nextExport = rest.indexOf('\nexport ')
    const body = nextExport === -1 ? rest : rest.slice(0, nextExport)
    expect(body).not.toContain('panel-action-card')
    // 应与真实页面一致：先积分总览卡，再区块头。
    expect(body).toContain('dsh-codebuddy-panel-stat-card')
    expect(body).toContain('dsh-codebuddy-panel-section-head')
  })
})

describe('自动切换账号开关', () => {
  it('账号页标题行有该开关', () => {
    // AccountsPage 通过 `useAutoPrefs` 拿到三个开关值（hook 在另一文件）。
    // 该断言改验：hook 返回的 `autoSwitch` 通过 prop 传给 `<AutoSwitchToggle>`。
    expect(accountsBody).toContain('autoSwitchOn')
    expect(accountsBody).toContain('<AutoSwitchToggle')
  })

  it('开关状态与设置页共用同一个 store（底层同一存储键）', () => {
    // store 是 hook 的来源；hook 与设置页都 useStore($autoSwitch)。
    // （早期设置页还会就地写 `$autoSwitch.set(checked)`，那是另一回事——
    // store 是同一份，不论写入发生在哪一处。）
    expect(HOOK).toContain('useStore($autoSwitch)')
    expect(SECTION).toMatch(/useStore\(\$autoSwitch\)/)
  })

  it('切换开关时同步到 host', () => {
    // 用户在面板里拨动开关 → 推给 host（在 AccountsPage 的 onChange 内联里）。
    expect(accountsBody).toMatch(/rpc\.call\(CODEBUDDY_AUTH_CHANNEL, 'autoSwitch', \{ enabled: checked \}\)/)
  })

  it('挂载时**读** host 配置，而不是把本地值推上去', () => {
    // 曾经挂载时会推 { enabled: autoSwitchOn }，那会让 host 上更新的值被旧
    // localStorage 静默覆盖（实测：host false/25 被上推成 true/10）。
    // 现在挂载走 autoPrefs 读通道，方向改为「host 为准」。读通道在 hook 里：
    expect(HOOK).toContain("'autoPrefs'")
    expect(HOOK).not.toMatch(/rpc\.call\(CODEBUDDY_AUTH_CHANNEL, 'autoSwitch', \{ enabled: autoSwitchOn \}\)/)
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
  // 卡片渲染已迁到 ui/account-card.tsx（`AccountCardImpl`）。条件 / 菜单由
  // 该文件持有；AccountsPage 仅通过 prop `autoSwitch` 传入开关状态。
  const CARD = readFileSync(
    '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/ui/account-card.tsx',
    'utf8',
  )

  it('条件包含 autoSwitch 判断', () => {
    expect(CARD).toMatch(/if \(!row\.active && !autoSwitch\)/)
  })

  it('该标记由账号页传入，取自开关状态', () => {
    // 必须与开关同源：若传常量或漏传，开关就管不到卡片菜单。
    expect(accountsBody).toMatch(/autoSwitch=\{autoSwitchOn\}/)
  })

  it('开启时菜单项确实不追加（判断作用于 push 之前）', () => {
    const at = CARD.indexOf('if (!row.active && !autoSwitch)')
    expect(at).toBeGreaterThan(-1)
    const body = CARD.slice(at, at + 420)
    expect(body).toContain('key="switch"')
  })
})

describe('面板与设置页的开关保持同步', () => {
  // 三个 auto* 偏好的同步封装在 hooks/use-auto-prefs.ts 的 `useAutoPrefs` 里。
  // hookBody = useAutoPrefs 函数体（slice 到下一个 `\nfunction ` 或文件末尾），
  // 保留三个开关的订阅 / host 同步形态。AccountsPage 本体通过 `useAutoPrefs`
  // 读取展示值（`autoCheckin: autoCheckinOn` 等），不再自行订阅。
  const HOOK = readFileSync(
    '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/hooks/use-auto-prefs.ts',
    'utf8',
  )
  const hookBody = ((): string => {
    const start = HOOK.indexOf('export function useAutoPrefs')
    const rest = HOOK.slice(start + 1)
    const nextFn = rest.indexOf('\nfunction ')
    return nextFn === -1 ? rest : rest.slice(0, nextFn)
  })()

  it('账号页通过 useAutoPrefs 取得三个开关（不再自行订阅）', () => {
    // hook 体里订阅偏好变化；AccountsPage 仅消费返回值。
    expect(hookBody).toContain('subscribeUsagePref')
    expect(accountsBody).toContain('useAutoPrefs(rpc)')
    expect(accountsBody).not.toMatch(/subscribeUsagePref\(/)
  })

  it('订阅回调里把三个开关同步到 host', () => {
    expect(hookBody).toContain('subscribeUsagePref(')
    const at = hookBody.indexOf('subscribeUsagePref(')
    const body = hookBody.slice(at, at + 800)
    for (const store of ['$autoCheckin', '$autoTravel', '$autoSwitch']) {
      expect(body).toContain(`${store}.get()`)
    }
    // 展示值由 store 驱动，回调只负责同步 host（不再镜像到 state）。
    expect(body).not.toContain('setAutoSwitchOn')
  })

  it('订阅可取消（effect 返回 disposer）', () => {
    const at = hookBody.indexOf('subscribeUsagePref(')
    // `return subscribeUsagePref(` 才会在卸载时注销监听；漏掉 return 会泄漏监听。
    expect(hookBody.slice(Math.max(0, at - 60), at)).toMatch(/return\s+$/)
  })
})

describe('添加账号弹框内选择框的左间距', () => {
  const INDEX = readFileSync(
    '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/styles/add-account-modal.scss',
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

describe('管理面板订阅账号代际', () => {
  const PANEL = readFileSync(
    '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/panel.tsx',
    'utf8',
  )
  const EPOCH = readFileSync(
    '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/store/account-epoch.ts',
    'utf8',
  )

  it('账号页订阅 accountEpoch（否则设置页/自动切换后面板停留旧值）', () => {
    // 面板是 keep-alive 常驻挂载，不会因切走而重挂载；只有 rosterTick（面板内
    // 操作触发）或 accountEpoch（宿主广播的账号切换）变化才重取。
    // account-epoch.ts 的模块注释明确要求「管理面板各页」订阅本模块。
    expect(PANEL).toContain('subscribeAccountEpoch')
    expect(PANEL).toMatch(/useSyncExternalStore\(subscribeAccountEpoch, accountEpoch, accountEpoch\)/)
    // 必须真的进入 usePanelData 的 deps —— 只订阅不使用不会触发重取。
    expect(PANEL).toMatch(/'panelStatus', \{\}, \[rosterTick, accountVersion\]/)
  })

  it('代际由宿主广播驱动（三条切换路径都广播）', () => {
    const INDEX = readFileSync(
      '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/index.tsx',
      'utf8',
    )
    expect(INDEX).toContain("remote.$on('llm/adapters-updated'")
    expect(INDEX).toContain('bumpAccountEpoch()')
  })

  it('代际模块自述要求面板订阅（与实现一致）', () => {
    expect(EPOCH).toContain('管理面板各页')
  })
})
