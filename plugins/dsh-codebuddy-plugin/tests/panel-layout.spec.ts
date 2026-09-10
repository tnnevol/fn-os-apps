import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 后台面板的布局必须用 **Semi Layout 组件**表达，不自建 HTML 容器。
 *
 * 目标结构（左右 → 右侧上下 → header 固定 + 主体滚动）：
 *
 *   <Layout>                                  ← 含 Sider，Semi 自动加 has-sider → row
 *     <Layout.Sider>  菜单（独立容器，不随主体滚动）
 *     <Layout className="…-main">             ← 不含 Sider → 默认 column
 *       <Layout.Header className="…-toolbar">  ← 固定不滚动
 *       <Layout.Content className="…-views">   ← 唯一滚动容器
 *
 * Semi 的 Layout 默认 `flex-direction: column`，只有含 Sider 时加
 * `.semi-layout-has-sider { flex-direction: row }`——因此「左侧菜单 + 右侧上下」
 * 正好由两层 Layout 的嵌套表达，不需要任何手写 flex 方向。
 *
 * 另外 Layout 系列渲染语义化标签：Header→<header>、Content→<main>、Sider→<aside>。
 */
const PANEL = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/panel.tsx',
  'utf8',
)
/** Semi layout 的 CSS：用于确认 box-sizing 前提（width:100% + padding 不溢出）。 */
const SEMI_LAYOUT_CSS = (() => {
  const pnpm = '/Users/tnnevol/workspace/fn-packages/fn-os-apps/node_modules/.pnpm'
  const dir = readdirSync(pnpm).find(d => d.startsWith('@douyinfe+semi-foundation@'))
  if (dir === undefined) throw new Error('未找到 semi-foundation')
  return join(pnpm, dir, 'node_modules/@douyinfe/semi-foundation/lib/es/layout/layout.css')
})()

const PANEL_SCSS = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/styles/panel-layout.scss',
  'utf8',
)

const INDEX_SCSS = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/styles/index.scss',
  'utf8',
)

describe('面板布局使用 Semi Layout 组件', () => {
  const shell = PANEL.slice(PANEL.indexOf('return (\n    <div className="dsh-codebuddy-panel"'))

  it('右侧用内层 Layout（不含 Sider → column，即上下布局）', () => {
    expect(shell).toMatch(/<DshLayout className="dsh-codebuddy-panel-main">/)
  })

  it('header 用 Layout.Header，主体用 Layout.Content', () => {
    expect(shell).toMatch(/<DshLayout\.Header className="dsh-codebuddy-panel-toolbar">/)
    expect(shell).toMatch(/<DshLayout\.Content className="dsh-codebuddy-panel-views">/)
  })

  it('菜单用 Layout.Sider（左右布局由 Semi 的 has-sider 触发）', () => {
    expect(shell).toMatch(/<DshLayout\.Sider>/)
  })

  it('不再自建 flex 容器承载滚动：内容区没有 display:flex 手写方向', () => {
    // 旧实现用 .dsh-codebuddy-panel-content { display:flex; flex-direction:column }
    // 自建上下布局，已由内层 Layout 取代。
    expect(INDEX_SCSS).not.toMatch(/\.dsh-codebuddy-panel-content\s*\{/)
    expect(INDEX_SCSS).not.toMatch(/dsh-codebuddy-panel-main\s*\{[^}]*flex-direction/)
  })
})

describe('滚动与固定行为', () => {
  it('只有主体滚动（overflow-y: auto）', () => {
    expect(INDEX_SCSS).toMatch(/\.dsh-codebuddy-panel-views\s*\{[^}]*overflow-y:\s*auto/)
  })

  it('内层 Layout 自身不滚动（否则 header 会与内容同处一个滚动上下文）', () => {
    expect(INDEX_SCSS).toMatch(/\.dsh-codebuddy-panel-main\s*\{[^}]*overflow:\s*hidden/)
  })

  it('主体设了 min-height: 0（flex 子项默认 min-height:auto，不设则 overflow 不生效）', () => {
    expect(INDEX_SCSS).toMatch(/\.dsh-codebuddy-panel-views\s*\{[^}]*min-height:\s*0/)
  })

  it('header 不收缩（flex: 0 0 auto 或 none）', () => {
    expect(INDEX_SCSS).toMatch(/\.dsh-codebuddy-panel-toolbar\s*\{[^}]*flex:\s*(0 0 auto|none)/)
  })
})

describe('标题与内容的横向对齐', () => {
  /**
   * 不变量是「标题左边界 === 卡片左边界」，而不是某一种实现方式。
   * 早先两者共用 `width: min(100%,1480px)` 来对齐，但那会让 header 不到通栏、
   * 分隔线两端悬空，且宽度上限与自带 padding 组合后（padding 在宽度**之内**）
   * 宽屏下标题比卡片多缩进 32px。现改为 header 通栏 + padding-inline 对齐。
   */
  const toolbarPad = (): string =>
    /\.dsh-codebuddy-panel-toolbar\s*\{[^}]*padding-inline:\s*([^;]+);/.exec(INDEX_SCSS)?.[1]?.trim() ?? ''
  const viewsPad = (): string =>
    /\.dsh-codebuddy-panel-views\s*\{[^}]*padding:\s*([^;]+);/.exec(INDEX_SCSS)?.[1]?.trim() ?? ''

  /** 复算两处的左边界，覆盖宽屏（走 1480px 列居中）与窄屏（走内边距）两侧。 */
  function leftEdges(containerWidth: number): { header: number, view: number } {
    const PAD = 32, CAP = 1480
    // header 通栏：内容盒 = 自身宽度，横向内边距取 max(pad, (w-cap)/2)
    const header = Math.max(PAD, (containerWidth - CAP) / 2)
    // view：在 views 的内容盒内居中的 1480 列
    const contentBox = containerWidth - 2 * PAD
    const view = PAD + Math.max(0, (contentBox - CAP) / 2)
    return { header, view }
  }

  it('两者左边界在宽/中/窄屏都一致', () => {
    for (const w of [2400, 1920, 1720, 1544, 1400, 900, 700]) {
      const { header, view } = leftEdges(w)
      expect(Math.abs(header - view)).toBeLessThan(0.01)
    }
  })

  it('header 用 padding-inline 按同一 1480px 列计算', () => {
    expect(toolbarPad()).toMatch(/max\(clamp\(16px,\s*2vw,\s*32px\),\s*calc\(\(100% - 1480px\) \/ 2\)\)/)
  })

  it('header 通栏：显式 width: 100%（分隔线才能横跨整个面板）', () => {
    const block = /\.dsh-codebuddy-panel-toolbar\s*\{([^}]*)\}/.exec(INDEX_SCSS)?.[1] ?? ''
    expect(block).toMatch(/(^|[^-])width:\s*100%/)
    // 且不得残留宽度上限——那会让分隔线在宽屏下两端悬空。
    expect(block).not.toMatch(/(^|[^-])width:\s*min\(/)
    expect(block).not.toMatch(/max-width:/)
  })

  it('width: 100% 与 padding-inline 并存不溢出（依赖 Semi 的 border-box）', () => {
    // Semi 的 layout.css 已为 .semi-layout-header 设 box-sizing: border-box，
    // 因此 padding 计在 100% 之内；若哪天该前提失效，这条会提醒复核。
    const semiLayout = readFileSync(
      SEMI_LAYOUT_CSS,
      'utf8',
    )
    expect(semiLayout).toMatch(/\.semi-layout-header[^{}]*\{[^}]*box-sizing:\s*border-box/)
  })

  it('页面内容列仍受 1480px 上限约束', () => {
    expect(INDEX_SCSS).toMatch(/\.dsh-codebuddy-panel-view\s*\{\s*width:\s*min\(100%,\s*1480px\)/)
    void viewsPad
  })
})

describe('固定 header 的分隔与阴影', () => {
  const toolbarBlock = (): string =>
    /\.dsh-codebuddy-panel-toolbar\s*\{([^}]*)\}/.exec(INDEX_SCSS)?.[1] ?? ''

  it('有底部阴影', () => {
    expect(toolbarBlock()).toMatch(/box-shadow:\s*var\(--dsw-shadow-lv\d/)
  })

  it('同时有主题感知的底部描边（阴影在深色主题下几乎不可见）', () => {
    // 核算 token：--dsw-shadow-lv* 是固定 5% 纯黑（#0000000d），深色主题
    // 背景 #151517 上叠 5% 黑，对比度仅 1.009:1 —— 等于看不见。
    // --dsw-alias-border-* 是主题感知的（浅色 #000000xx / 深色 #ffffffxx），
    // 因此分隔必须由它承担。
    expect(toolbarBlock()).toMatch(/border-bottom:\s*1px solid var\(--dsw-alias-border-l\d\)/)
  })

  it('压在滚动内容之上（否则上滑的卡片会盖住分隔线）', () => {
    const block = toolbarBlock()
    expect(block).toMatch(/position:\s*relative/)
    expect(block).toMatch(/z-index:\s*1/)
  })

  it('用 border-bottom 而非 inset 阴影（inset 会被 padding 缩进、无法通栏）', () => {
    expect(toolbarBlock()).not.toMatch(/inset/)
  })
})

describe('内容区顶部留白', () => {
  const contentBlock = (): string =>
    /\.dsh-codebuddy-panel-views\s*\{([^}]*)\}/.exec(INDEX_SCSS)?.[1] ?? ''
  const updatedBlock = (): string =>
    /\.dsh-codebuddy-token-updated\s*\{([^}]*)\}/.exec(PANEL_SCSS)?.[1] ?? ''

  it('由滚动内容容器（Layout.Content）承担 15px 顶部内边距', () => {
    // 放在容器上而不是页面内的某个元素上：三个页面（账号/积分/Token）统一生效，
    // 不必每页各补一条间距。
    expect(contentBlock()).toMatch(/padding:\s*15px\s/)
  })

  it('「数据更新于 …」自身不再单独加顶部内边距', () => {
    expect(updatedBlock()).not.toMatch(/padding-top/)
    expect(updatedBlock()).not.toMatch(/padding:/)
  })

  it('窄屏只覆盖左右与底部，顶部 15px 仍然生效', () => {
    const narrow = PANEL_SCSS.slice(PANEL_SCSS.indexOf('@media (max-width: 720px)'))
    const rule = /\.dsh-codebuddy-panel-views\s*\{([^}]*)\}/.exec(narrow)?.[1] ?? ''
    // 若窄屏用 padding 简写覆盖，会顺带把 padding-top 复位——必须是分项覆盖。
    expect(rule).not.toMatch(/(^|[^-])padding:\s/)
    expect(rule).toMatch(/padding-left/)
  })
})
