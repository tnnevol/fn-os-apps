import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 用量分布与模型排行：**按工作区 / 按模型** 维度切换。
 *
 * 交互要求（用户指定）：
 *  - 两个模块都要能按工作区、按模型两个维度排行；
 *  - 切换用 button group，放在面板内部；
 *  - 去掉这两个模块的副标题（副标题原先就是写死的维度说明，改为控件后即冗余）。
 *
 * 数据无需动 host：`TokenStats` 早已同时聚合 `workspaces` 与 `models`，
 * 之前只是两个面板各用其一。
 */
const PANEL = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/panel.tsx', 'utf8',
)
const SCSS = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/styles/panel-layout.scss', 'utf8',
)
const LOCALES = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/locales.ts', 'utf8',
)

describe('DimensionToggle：结构与交互', () => {
  const toggle = PANEL.slice(
    PANEL.indexOf('function DimensionToggle'),
    PANEL.indexOf('一个统计面板的外壳'),
  )

  it('用 DshButtonGroup（互斥单选一组的语义）', () => {
    expect(toggle).toContain('<DshButtonGroup')
    // 与 RangeToggle 同一激活表达：solid/primary 选中、borderless/tertiary 未选
    expect(toggle).toMatch(/theme=\{dimension === key \? 'solid' : 'borderless'\}/)
    expect(toggle).toMatch(/type=\{dimension === key \? 'primary' : 'tertiary'\}/)
  })

  it('读屏可感知：aria-pressed 与 aria-label 都在', () => {
    expect(toggle).toMatch(/aria-pressed=\{dimension === key\}/)
    expect(toggle).toMatch(/aria-label=\{t\('tokenDimension'\)\}/)
  })

  it('两个档位：workspace 与 model，顺序稳定（工作区在前）', () => {
    const dims = PANEL.slice(
      PANEL.indexOf('const DIMENSIONS'),
      PANEL.indexOf('const DIMENSIONS') + 220,
    )
    expect(dims).toMatch(/key: 'workspace', labelKey: 'tokenByWorkspace'/)
    expect(dims).toMatch(/key: 'model', labelKey: 'tokenByModel'/)
    // 工作区在前：与两个面板的历史默认视角（分布=工作区）一致
    expect(dims.indexOf("'workspace'")).toBeLessThan(dims.indexOf("'model'"))
  })

  it('文案键存在（en + zh）', () => {
    for (const key of ['tokenByWorkspace', 'tokenByModel', 'tokenDimension']) {
      // 每个 key 在 en 与 zh 两段各出现一次
      const count = LOCALES.split('\n').filter(l => l.includes(`${key}:`)).length
      expect(count).toBe(2)
    }
  })
})

describe('两个面板都接上了切换', () => {
  it('用量分布：extra 传 DimensionToggle，内容按维度分支', () => {
    const block = PANEL.slice(PANEL.indexOf("title={t('tokenDistribution')}"), PANEL.indexOf("title={t('tokenModels')}"))
    expect(block).toContain('<DimensionToggle dimension={distributionDimension}')
    // 两个维度各渲染一种列表
    expect(block).toMatch(/distributionDimension === 'workspace'/)
    expect(block).toContain('<WorkspaceList items={distribution.data.workspaces}')
    expect(block).toContain('<BreakdownList items={distribution.data.models}')
  })

  it('「模型用量排行」面板已移除（与分布面板能力重合）', () => {
    // 维度可切换后，分布与排行两个面板的能力集合完全相同（同数据源、同两维度），
    // 保留两个只会同屏出现镜像数据。按模型视角保留在分布面板的第二档里。
    expect(PANEL).not.toContain("title={t('tokenModels')}")
    // 双栏容器也随之移除（分布面板独占一行）
    expect(PANEL).not.toContain('dsh-codebuddy-token-columns')
  })

  it('分布面板独占一行（不再包在双栏容器里）', () => {
    const block = PANEL.slice(PANEL.indexOf("title={t('tokenDistribution')}"), PANEL.indexOf("title={t('tokenTopSessions')}"))
    expect(block).toContain('<DimensionToggle')
    expect(block).not.toContain('dsh-codebuddy-token-columns')
  })
})

describe('副标题移除（仅限这两个模块）', () => {
  it('用量分布不再传静态维度 hint', () => {
    const block = PANEL.slice(PANEL.indexOf("title={t('tokenDistribution')}"), PANEL.indexOf("title={t('tokenTopSessions')}"))
    expect(block).not.toMatch(/hint=\{t\('tokenBy/)
  })

  it('其余面板的数据型副标题保留（信息量不同，不在此需求范围）', () => {
    // 总览的「N 个活跃会话」、趋势的「总计 X Token」是随数据变化的，删掉会丢信息
    expect(PANEL).toMatch(/hint=\{\`\$\{data\.totals\.sessions\}/)
    expect(PANEL).toMatch(/hint=\{trend\.data === undefined/)
  })

  it('TokenPanel 的 hint 变为可选', () => {
    expect(PANEL).toMatch(/hint\?: string/)
  })
})

describe('样式与位置：按钮组放在排行卡片内部', () => {
  it('维度切换渲染在卡片内部的 toolbar 里（而不是面板头部）', () => {
    // 用户要求：按钮组属于这份列表（切换的是列表的统计口径），
    // 放面板头部会像在控制整个面板（含周期选择器）。
    const block = PANEL.slice(
      PANEL.indexOf("title={t('tokenDistribution')}"),
      PANEL.indexOf("title={t('tokenTopSessions')}"),
    )
    const toolbarAt = block.indexOf('dsh-codebuddy-token-card-toolbar')
    const toggleAt = block.indexOf('<DimensionToggle')
    expect(toolbarAt).toBeGreaterThan(-1)
    expect(toggleAt).toBeGreaterThan(toolbarAt)
    // 面板头部不传 extra
    expect(block).not.toContain('extra=')
  })

  it('dimension 按钮组在窄屏占满宽度（卡片内部规则）', () => {
    expect(SCSS).toMatch(/\.dsh-codebuddy-token-card-toolbar \.dsh-codebuddy-panel-dimension \{ width: 100%; \}/)
  })

  it('toolbar 与列表之间有间距（不贴着排行首行）', () => {
    expect(SCSS).toMatch(/\.dsh-codebuddy-token-card-toolbar\s*\{[^}]*margin-bottom:\s*14px/)
  })

  it('使用独立的 class，不与时间周期按钮组混用', () => {
    // 混用会让「时间周期」的样式改动波及维度切换，反之亦然
    expect(PANEL).toContain('dsh-codebuddy-panel-dimension')
    expect(PANEL).not.toMatch(/className="dsh-codebuddy-panel-range"[^>]*aria-label=\{t\('tokenDimension'\)\}/)
  })
})

describe('数据源：不需要动 host', () => {
  it('TokenStats 同时聚合 workspaces 与 models（两维度数据早已就绪）', () => {
    expect(PANEL).toMatch(/workspaces: Array<\{ name: string, path\?: string, total: number/)
    expect(PANEL).toMatch(/models: Array<\{ name: string, total: number/)
  })
})
