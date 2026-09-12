import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 账号切换的**进行中反馈**。
 *
 * 这是一条真实缺陷的回归守卫：`CodeBuddySection.tsx` 里
 *
 *   const [switchingId, setSwitchingId] = useState<string | undefined>(undefined)
 *   setSwitchingId(id)          // 切换开始
 *   setSwitchingId(undefined)   // 切换结束
 *
 * 两个 setter 都在调用，但 `switchingId` 的值**从未被读取** —— 也就是说：
 *
 *  1. 用户点「设为当前」后没有任何反馈（不知是否生效，容易重复点击）；
 *  2. 每次 setState 都触发一次无用重渲染。
 *
 * 而 locales 里 `accountSwitching: '切换中…'` / `'Switching…'` **已定义却全项目
 * 零引用** —— 两个证据合起来说明：作者本意是切换时显示「切换中…」并禁用按钮，
 * 渲染层漏接了。
 *
 * 重复点击的后果不只是体验：host 侧会连续发起换号，最终停在哪个账号取决于网络
 * 返回顺序。
 *
 * 关于 `loading` 与 `disabled` 的关系（已读 Semi 源码确认，见下测试）：Semi 的
 * Button 在 `loading && !disabled` 时走 IconButton 分支渲染转圈图标，**不会**
 * 自动禁用按钮，因此两个 prop 必须都给。
 */
const ROOT = '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src'
const SECTION = readFileSync(`${ROOT}/components/CodeBuddySection.tsx`, 'utf8')
const LOCALES_ZH = readFileSync(`${ROOT}/client/locales/zh.ts`, 'utf8')
const LOCALES_EN = readFileSync(`${ROOT}/client/locales/en.ts`, 'utf8')

/** 切换账号按钮的渲染片段（从 switchAccount 的定义到移除按钮之前）。 */
const switchButtonBlock = (): string => {
  const start = SECTION.indexOf('const switching = switchingId === account.id')
  expect(start).toBeGreaterThan(-1)
  return SECTION.slice(start, SECTION.indexOf('setRemoveTarget', start))
}

describe('切换账号按钮有进行中反馈', () => {
  it('switchingId 被读取并驱动 loading（不再只写不读）', () => {
    expect(SECTION).toMatch(/const switching = switchingId === account\.id/)
    expect(switchButtonBlock()).toMatch(/loading=\{switching\}/)
  })

  it('切换中禁用按钮，避免重复点击导致连续换号', () => {
    // 重复点击会让 host 连续换号，最终停在哪个账号取决于网络返回顺序。
    expect(switchButtonBlock()).toMatch(/disabled=\{switching \|\|/)
  })

  it('切换中文案使用既有的 accountSwitching 键（不再是孤立 i18n）', () => {
    expect(switchButtonBlock()).toMatch(/\{switching \? t\('accountSwitching'\) : t\('selectAccount'\)\}/)
    // 该键必须真实存在于两种语言——曾定义后无人使用。
    expect(LOCALES_ZH).toMatch(/accountSwitching: '切换中…'/)
    expect(LOCALES_EN).toMatch(/accountSwitching: 'Switching…'/)
  })

  it('loading 与 disabled 同时给：Semi 的 loading 不会自动禁用', () => {
    // Semi Button.render(): `isLoading && !isDisabled` 才走 IconButton 分支，
    // 即 loading 只影响图标位、不改变可点击性。只给 loading 会让「看起来在转」
    // 的按钮仍可被点击——这正是要防的。
    const block = switchButtonBlock()
    expect(block).toContain('loading={switching}')
    expect(block).toMatch(/disabled=\{switching \|\|/)
  })

  it('原有的余额不足 / 自动切换禁用规则仍然保留（只新增，不替换）', () => {
    // 改动前的规则：自动切换开启时禁用、无可用余额时禁用（当前账号除外）。
    // 断言的是**规则本身**而不是某个变量名：这段后来被重构成
    // `const isActive = account.id === ...active?.id` + `!isActive`，
    // 语义等价但字面量变了，绑字面量的断言会在无害重构时误报（已发生过）。
    const block = switchButtonBlock()
    expect(block).toMatch(/autoSwitch \|\| \(balance !== undefined && !balance\.usable\)/)
    // 「当前账号除外」这一条件可以是原字面量，也可以是等价的 isActive 取反。
    const literalForm = /account\.id !== accounts\.find\(item => item\.active\)\?\.id/
    const isActiveForm = /!isActive/
    expect(literalForm.test(block) || isActiveForm.test(block)).toBe(true)
  })

  it('当前账号若要被排除，必须先算出它是不是当前账号', () => {
    // 上面两种写法都以后者为准，这里锁住它的定义，避免有人写了 `!isActive`
    // 却把 isActive 定义反了或定义成别的字段。
    expect(switchButtonBlock()).toMatch(/const isActive = account\.id === accounts\.find\(item => item\.active\)\?\.id/)
  })
})

/**
 * 已选中的账号不再出现「选择账号」按钮。
 *
 * 真实缺陷：该按钮原先无条件渲染，而它的 `disabled` 里含
 * `... && account.id !== activeId` —— 对当前账号这一项恒为 false，于是
 * `disabled` 只剩 `switching`，非切换状态下按钮**可点**且文案为「选择账号」，
 * 点了是自己切自己（host 侧也无意义）。面板卡片的同名菜单项早已按
 * `!row.active && !autoSwitch` 隐藏，设置区块此前漏了。
 */
describe('当前账号隐藏「选择账号」按钮', () => {
  it('已选中且非切换中时返回 null，不渲染按钮', () => {
    expect(switchButtonBlock()).toMatch(/if \(isActive && !switching\) return null/)
  })

  it('切换在途时仍渲染，保留「切换中…」与转圈', () => {
    // 切换成功前该账号尚未成为当前账号（setAccounts 在响应回来后才更新），
    // 若此刻就隐藏，用户点了按钮它会直接消失，看不出请求是否发出。
    const block = switchButtonBlock()
    expect(block).toMatch(/if \(isActive && !switching\) return null/)
    // 隐藏发生在构造 button 之后，因此 switching 分支的文案仍在同一片段里。
    expect(block).toMatch(/\{switching \? t\('accountSwitching'\) : t\('selectAccount'\)\}/)
  })

  it('隐藏位置在 button 构造之后，不会连切换中的转圈一起砍掉', () => {
    const block = switchButtonBlock()
    expect(block.indexOf('const button = (')).toBeLessThan(block.indexOf('if (isActive && !switching) return null'))
  })

  it('隐藏的是「当前账号」这一项，其它账号的手动切换仍保留', () => {
    // 与面板菜单 `!row.active && !autoSwitch`（自动切换开启时对所有账号隐藏）
    // 不同：这里不把 autoSwitch 作为隐藏条件，只隐藏当前账号。
    const hideLine = switchButtonBlock().match(/if \(isActive && !switching\) return null/)
    expect(hideLine).not.toBeNull()
    expect(hideLine![0]).not.toContain('autoSwitch')
  })
})
