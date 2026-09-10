import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

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
  it('header 与 view 共用同一宽度约束（否则标题比卡片多缩进一个 padding）', () => {
    expect(INDEX_SCSS).toMatch(
      /\.dsh-codebuddy-panel-toolbar,\s*\n\.dsh-codebuddy-panel-view\s*\{\s*width:\s*min\(100%,\s*1480px\)/,
    )
  })

  it('两者横向内边距一致：toolbar 与 views 用同一值', () => {
    // toolbar 的 padding 简写与 views 的简写必须给出同样的左右值。
    const toolbar = /\.dsh-codebuddy-panel-toolbar\s*\{[^}]*padding:\s*([^;]+);/.exec(INDEX_SCSS)?.[1] ?? ''
    const views = /\.dsh-codebuddy-panel-views\s*\{[^}]*padding:\s*([^;]+);/.exec(INDEX_SCSS)?.[1] ?? ''
    const sides = (v: string): string => v.trim().split(/\s+/).slice(1, 3).join(' ')
    expect(toolbar).not.toBe('')
    expect(sides(toolbar)).toBe(sides(views))
  })
})
