import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 各管理页必须保持挂载（keep-alive），切回时不重新拉取。
 *
 * 原先用条件渲染 `page === 'x' ? <XPage/> : null`：切走即卸载，页面内的
 * useState（Token 各面板已选范围）与 useMemo 里的 TokenStatsStore、已拉到的
 * 数据、echarts 实例全部销毁，切回只能重新请求并重建图表——即「每次进菜单都
 * 重新拉取」。
 *
 * 这类缺陷在纯逻辑测试里看不出来（数据层完全正常），只能靠结构断言守住。
 */
const panel = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/panel.tsx',
  'utf8',
)

describe('管理面板的 keep-alive 结构', () => {
  it('三个页面都渲染在视图容器内，且用 hidden 而非条件渲染', () => {
    // 每个页面都被包在 .dsh-codebuddy-panel-view 里，并带 hidden 开关。
    for (const page of ['AccountsPage', 'CreditsPage', 'TokenStatsPage']) {
      const re = new RegExp(`className="dsh-codebuddy-panel-view" hidden=\\{[^}]+\\}[\\s\\S]{0,220}?<${page}`)
      expect(panel).toMatch(re)
    }
  })

  it('不再用 `page === x ? <XPage/> : null` 的条件渲染', () => {
    // 条件渲染会让页面卸载，正是要避免的写法。
    expect(panel).not.toMatch(/snapshot\.page === 'accounts' \? \(/)
    expect(panel).not.toMatch(/snapshot\.page === 'credits' \? <CreditsPage/)
    expect(panel).not.toMatch(/snapshot\.page === 'tokens' \? <TokenStatsPage/)
  })

  it('按 visited 惰性挂载：没进过的页面不会预先拉数据', () => {
    expect(panel).toContain('visited.has(')
    // 首次进入才加入 visited——若一上来就挂载三页，会并发发三份请求。
    expect(panel).toMatch(/new Set\(\[snapshot\.page\]\)/)
  })

  it('账号数据变化会让共用 panelStatus 的页面一起失效', () => {
    // CreditsPage 与 AccountsPage 同源（panelStatus）；若它不带 rosterTick，
    // keep-alive 下会一直显示旧账号（此前靠每次重新挂载掩盖了这个缺口）。
    //
    // 注意断言必须限定在 CreditsPage 自身的代码段内：rosterTick 在文件别处
    // 也出现（AccountsPage、Props 定义），查整份文件会假通过——这条曾经漏网。
    const start = panel.indexOf('function CreditsPage')
    expect(start).toBeGreaterThan(-1)
    // 取到下一个顶层 function 为止，确保只覆盖该组件。
    const rest = panel.slice(start + 1)
    const nextFn = rest.indexOf('\nfunction ')
    const body = nextFn === -1 ? rest : rest.slice(0, nextFn)
    expect(body).toContain("'panelStatus'")
    expect(body).toContain('rosterTick')
    // 且它确实作为 deps 传入，而不是只出现在参数里。
    expect(body).toMatch(/usePanelData<[^>]*>\(rpc, 'panelStatus', \{\}, \[rosterTick\]\)/)
  })
})
