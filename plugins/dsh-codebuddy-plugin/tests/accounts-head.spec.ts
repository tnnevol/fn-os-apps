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

  it('按钮位于「账号管理」区块头内', () => {
    const head = accountsBody.slice(accountsBody.indexOf('dsh-codebuddy-panel-section-head'))
    expect(head).toContain('onClick={onAddAccount}')
    expect(head).toContain('dsh-codebuddy-accounts-head-actions')
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

describe('动作区可容纳四个控件', () => {
  it('允许换行（窄屏一行放不下会横向溢出）', () => {
    const block = /\.dsh-codebuddy-accounts-head-actions\s*\{([^}]*)\}/.exec(INDEX_SCSS)?.[1] ?? ''
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
