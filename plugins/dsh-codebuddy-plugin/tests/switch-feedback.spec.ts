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

  it('原有的余额不足禁用规则仍然保留（本次只新增，不替换）', () => {
    // 改动前的规则：自动切换开启时禁用、无可用余额时禁用（当前账号除外）。
    // 新条件必须与它取并集而不是覆盖。
    expect(switchButtonBlock()).toMatch(/autoSwitch \|\| \(balance !== undefined && !balance\.usable\)/)
    expect(switchButtonBlock()).toMatch(/account\.id !== accounts\.find\(item => item\.active\)\?\.id/)
  })
})
