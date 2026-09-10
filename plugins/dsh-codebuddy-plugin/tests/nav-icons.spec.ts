import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 左侧菜单必须用**彩色**图标。
 *
 * Semi 有两套图标包，只有一套是彩色的：
 * - `@douyinfe/semi-icons`：全部走 `currentColor`，单色（面向前景色自适应）。
 *   注意其中的 `IconAI*` 系列**也是单色**，名字带 AI 不代表彩色。
 * - `@douyinfe/semi-icons-lab`：SVG 内硬编码多色 `fill`，这才是彩色图标集。
 *
 * 因此菜单图标若来自 semi-icons，就会跟随导航前景色，看起来仍是单色——
 * 这正是要避免的。
 */
const PANEL = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/panel.tsx',
  'utf8',
)
const LAB_ROOT = '/Users/tnnevol/workspace/fn-packages/fn-os-apps/node_modules/.pnpm'
  + '/@douyinfe+semi-icons-lab@2.90.2_react-dom@18.3.1_react@18.3.1__react@18.3.1'
  + '/node_modules/@douyinfe/semi-icons-lab'

describe('左侧菜单图标', () => {
  const items = PANEL.slice(PANEL.indexOf('const items = ['), PANEL.indexOf('return (\n    <div className="dsh-codebuddy-panel"'))

  it('两个菜单项都使用 Lab（彩色）图标', () => {
    // 「积分管理」已并入「账号管理」，菜单回到两项。
    const icons = items.match(/<DshIconLab\w+ \/>/g) ?? []
    expect(icons).toHaveLength(2)
    expect(items).toContain('DshIconLabAvatar')
    expect(items).toContain('DshIconLabChart')
  })

  it('菜单项不再使用单色图标', () => {
    // 这三个是原先的单色图标（semi-icons，走 currentColor）。
    expect(items).not.toContain('<DshIconUser />')
    expect(items).not.toContain('<DshIconCommand />')
    expect(items).not.toContain('<DshIconElementStroked />')
  })

  it('所用 Lab 图标确实硬编码多色 fill（而不是 currentColor）', () => {
    for (const name of ['IconAvatar', 'IconChart', 'IconToken']) {
      const source = readFileSync(`${LAB_ROOT}/lib/es/icons/${name}.js`, 'utf8')
      expect(source).not.toContain('currentColor')
      const colors = new Set(source.match(/#[0-9A-Fa-f]{6}/g) ?? [])
      expect(colors.size).toBeGreaterThanOrEqual(2)
    }
  })

  it('图标不影响导航选中态（硬编码 fill 不会被 color 覆盖）', () => {
    // Semi 的 .semi-navigation-item-icon-info 会设 color；由于 Lab 图标用硬编码
    // fill 而非 currentColor，选中/悬停都不会改变它们的颜色。
    const token = readFileSync(`${LAB_ROOT}/lib/es/icons/IconToken.js`, 'utf8')
    expect(token.match(/fill: "#[0-9A-Fa-f]{6}"/g)?.length).toBeGreaterThanOrEqual(3)
  })
})
