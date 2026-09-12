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

  it('余额不足仍然禁用（当前账号除外）', () => {
    // 断言的是**规则本身**而不是某个变量名：这段曾被重构成
    // `const isActive = account.id === ...active?.id` + `!isActive`，
    // 语义等价但字面量变了，绑字面量的断言会在无害重构时误报（已发生过）。
    //
    // 注意 `autoSwitch` **不再**是禁用原因：自动切换开启时改为整体不渲染
    // （见下方「自动切换开启时隐藏所有账号的选择入口」）。同一个条件不该在
    // 禁用与渲染两处各写一遍，否则日后改动容易只改一处。
    const block = switchButtonBlock()
    expect(block).toMatch(/balance !== undefined && !balance\.usable/)
    // 该禁用条件已不再包含 autoSwitch。
    const disabled = block.slice(block.indexOf('disabled={switching'), block.indexOf('onClick='))
    expect(disabled).not.toContain('autoSwitch')
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
  const HIDE_LINE = /if \(hideForAutoSwitch \|\| \(isActive && !switching\)\) return null/

  it('已选中且非切换中时返回 null，不渲染按钮', () => {
    expect(switchButtonBlock()).toMatch(HIDE_LINE)
  })

  it('切换在途时仍渲染，保留「切换中…」与转圈', () => {
    // 切换成功前该账号尚未成为当前账号（setAccounts 在响应回来后才更新），
    // 若此刻就隐藏，用户点了按钮它会直接消失，看不出请求是否发出。
    const block = switchButtonBlock()
    expect(block).toMatch(HIDE_LINE)
    // 隐藏发生在构造 button 之后，因此 switching 分支的文案仍在同一片段里。
    expect(block).toMatch(/\{switching \? t\('accountSwitching'\) : t\('selectAccount'\)\}/)
  })

  it('隐藏位置在 button 构造之后，不会连切换中的转圈一起砍掉', () => {
    const block = switchButtonBlock()
    expect(block.indexOf('const button = (')).toBeLessThan(block.indexOf('if (hideForAutoSwitch ||'))
  })

  it('当前账号这一项仍然被隐藏（条件里保留了 isActive）', () => {
    const block = switchButtonBlock()
    expect(block).toMatch(/isActive && !switching/)
    // 且为此必须先算出 isActive，避免写成别的字段。
    expect(block).toMatch(/const isActive = account\.id === accounts\.find\(item => item\.active\)\?\.id/)
  })
})

/**
 * 自动切换开启时，**所有**账号的「选择账号」都隐藏。
 *
 * 那时账号由策略按剩余额度接管，手动指定会被下一次自动切换覆盖，留一个按不动的
 * 按钮只会让人以为设置没生效。管理面板的「设为当前」菜单项本来就是这个语义
 * （`!row.active && !autoSwitch`），设置区块此前只做成「禁用非当前账号」——两处
 * 对同一个开关的反应不一致。
 *
 * 注意隐藏与禁用的区别不只是外观：禁用会留下一个 Tab 可达、但按不动的元素，
 * 而这里要的是「这个操作此刻不存在」。
 */
describe('自动切换开启时隐藏所有账号的选择入口', () => {
  it('隐藏条件包含 autoSwitch（且不与 switching 冲突）', () => {
    const block = switchButtonBlock()
    expect(block).toMatch(/const hideForAutoSwitch = autoSwitch && !switching/)
    expect(block).toMatch(/if \(hideForAutoSwitch \|\| \(isActive && !switching\)\) return null/)
  })

  /**
   * 取出 `hideForAutoSwitch` 的右侧表达式，并用**结构化求值**在真值下判定。
   *
   * 为什么要求值而不是做词法检查：这里最初断言「定义行不含 isActive/activeId」，
   * 结果漏掉了一个真实变异——把条件写成
   * `autoSwitch && !switching && account.id === accounts.find(item => item.active)?.id`
   * （退化成「只隐藏当前账号」，正是本次要修的 bug），字面量里既没有 "isActive"
   * 也没有 "activeId"，词法检查完全看不见它。
   *
   * 真正的不变量是语义的：**隐藏判定不得依赖是哪个账号**。因此在「当前账号」与
   * 「非当前账号」两种取值下各判定一次，要求结果相同。
   *
   * 不用 `new Function`/eval（仓库禁用 `no-new-func`）：改为把表达式里的标识符
   * 替换为字面量后按运算符求值——本表达式只由 `&&`、`!`、标识符与括号组成，
   * 足以覆盖。若日后表达式复杂到无法这样求值，下方有一条守卫会失败并提示改用
   * 真实组件渲染测试。
   */
  function hideExpr(): string {
    const line = switchButtonBlock().split('\n').find(l => l.includes('const hideForAutoSwitch ='))
    expect(line).toBeDefined()
    return line!.slice(line!.indexOf('=') + 1).trim().replace(/;$/, '')
  }

  /**
   * 对只含标识符与 `&&`/`!`/括号的表达式求值。
   *
   * 做法：把每个标识符按 ctx 换成 `true`/`false` 字面量，再用一组穷举判定——
   * `A && !B` 这类表达式在布尔域上等价于「所有合取项都为真」。这里直接实现一个
   * 极小的解析：按 `&&` 切分，每一项去掉前导 `!` 后查 ctx。
   */
  function evalConjunction(expr: string, ctx: Record<string, boolean>): boolean {
    // 守卫：表达式若超出「&& 合取 + ! 取反 + 标识符」的形式，说明它已复杂到
    // 本夹具不该假装能求值，直接失败提醒改用渲染测试。
    const allowed = /^[\sA-Za-z0-9_$.?!&()]+$/
    expect(allowed.test(expr)).toBe(true)
    expect(expr).not.toMatch(/\(|\)/)
    return expr.split('&&').map(part => part.trim()).every((part) => {
      const negated = part.startsWith('!')
      const name = part.replace(/^!+/, '').trim()
      const value = ctx[name]
      expect(value).toBeDefined()
      return negated ? !value : value
    })
  }

  it('隐藏判定不依赖是哪个账号（当前 / 非当前账号结果相同）', () => {
    const expr = hideExpr()
    // 同一组条件、同一个账号的身份差异不影响结果——本用例的核心断言。
    const base = { autoSwitch: true, switching: false }
    expect(evalConjunction(expr, { ...base, isActive: true })).toBe(true)
    expect(evalConjunction(expr, { ...base, isActive: false })).toBe(true)
  })

  it('autoSwitch 关闭时不隐藏', () => {
    expect(evalConjunction(hideExpr(), { autoSwitch: false, switching: false })).toBe(false)
  })

  it('切换在途时不隐藏，保留转圈', () => {
    expect(evalConjunction(hideExpr(), { autoSwitch: true, switching: true })).toBe(false)
  })

  it('切换在途时二者都放行，保留转圈', () => {
    // 若 autoSwitch 分支不放行 switching，用户点了按钮它会立刻消失。
    const block = switchButtonBlock()
    expect(block).toMatch(/const hideForAutoSwitch = autoSwitch && !switching/)
    expect(block).toMatch(/isActive && !switching/)
  })

  it('与面板菜单同一语义：两个入口都用 autoSwitch 隐藏', () => {
    const card = readFileSync(`${ROOT}/client/ui/account-card.tsx`, 'utf8')
    // 面板：自动切换开启时不渲染「设为当前」。
    expect(card).toMatch(/if \(!row\.active && !autoSwitch\) \{/)
    // 设置区块：同样由 autoSwitch 触发隐藏。
    expect(switchButtonBlock()).toMatch(/const hideForAutoSwitch = autoSwitch && !switching/)
  })
})
