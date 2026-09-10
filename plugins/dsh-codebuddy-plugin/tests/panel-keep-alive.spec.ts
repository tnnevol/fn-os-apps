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
  it('两个页面都渲染在视图容器内，且用 hidden 而非条件渲染', () => {
    // 每个页面都被包在 .dsh-codebuddy-panel-view 里，并带 hidden 开关。
    // 「积分管理」已并入账号页，不再是独立页面。
    for (const page of ['AccountsPage', 'TokenStatsPage']) {
      const re = new RegExp(`className="dsh-codebuddy-panel-view" hidden=\\{[^}]+\\}[\\s\\S]{0,220}?<${page}`)
      expect(panel).toMatch(re)
    }
  })

  it('不再用 `page === x ? <XPage/> : null` 的条件渲染', () => {
    // 条件渲染会让页面卸载，正是要避免的写法。
    expect(panel).not.toMatch(/snapshot\.page === 'accounts' \? \(/)
    expect(panel).not.toMatch(/snapshot\.page === 'tokens' \? <TokenStatsPage/)
  })

  it('按 visited 惰性挂载：没进过的页面不会预先拉数据', () => {
    expect(panel).toContain('visited.has(')
    // 首次进入才加入 visited——若一上来就挂载三页，会并发发三份请求。
    expect(panel).toMatch(/new Set\(\[snapshot\.page\]\)/)
  })

  it('账号页在 rosterTick 变化时重拉账号列表', () => {
    // 账号增删/改名/登录完成都会让父级自增 rosterTick。keep-alive 下页面不再
    // 重新挂载，若 deps 里没有它就会一直显示旧账号。
    //
    // 断言必须限定在 AccountsPage 自身的代码段内：rosterTick 在文件别处也出现
    // （Props 定义等），查整份文件会假通过——这条曾经漏网。
    const start = panel.indexOf('function AccountsPage')
    expect(start).toBeGreaterThan(-1)
    const rest = panel.slice(start + 1)
    const nextFn = rest.indexOf('\nfunction ')
    const body = nextFn === -1 ? rest : rest.slice(0, nextFn)
    expect(body).toContain("'panelStatus'")
    // deps 里必须含 rosterTick（面板内操作触发的重取）。
    // 不写死整个数组：账号页同时还依赖 accountEpoch（设置页/自动切换触发的
    // 重取），把它钉成 [rosterTick] 会在加第二个依赖时误报。
    expect(body).toMatch(/usePanelData<[^>]*>\(\s*rpc, 'panelStatus', \{\}, \[rosterTick[^\]]*\]/)
  })

  it('积分总览随账号页一起刷新（数据由 AccountsPage 以 props 传入）', () => {
    // 迁入后不再自己拉取 panelStatus：账号页已有同一份 PanelAccountRow[]，
    // 再拉一次既浪费 RPC，也会让两处数据短暂不一致。
    const start = panel.indexOf('function CreditsOverview')
    expect(start).toBeGreaterThan(-1)
    const rest = panel.slice(start + 1)
    const nextFn = rest.indexOf('\nfunction ')
    const body = nextFn === -1 ? rest : rest.slice(0, nextFn)
    expect(body).not.toContain('usePanelData')
    expect(body).not.toContain('rpc.')
    // 由账号页传入 rows。
    expect(panel).toMatch(/<CreditsOverview rows=\{rows\} t=\{t\} \/>/)
  })
})
