import { describe, expect, it, vi } from 'vitest'
import { apply as applyHost, SEMI_UI_SHOWCASE_SETTINGS_NAMESPACE } from '../src/index.ts'
import { SEMI_UI_SHOWCASE_HASH, ShowcaseRouteController } from '../src/client/route.ts'

function fakeBrowser(hash = '#/') {
  const listeners = new Map<string, Set<() => void>>()
  return {
    location: { hash },
    history: {} as History,
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      const callbacks = listeners.get(type) ?? new Set()
      callbacks.add(listener as () => void)
      listeners.set(type, callbacks)
    }),
    removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => {
      listeners.get(type)?.delete(listener as () => void)
    }),
  }
}

describe('Semi UI showcase hash route', () => {
  it('serves a settings namespace so the showcase card is discoverable', () => {
    const register = vi.fn()
    applyHost({ settings: { register } } as never)
    expect(register).toHaveBeenCalledTimes(1)
    expect(register.mock.calls[0]?.[0]).toBe(SEMI_UI_SHOWCASE_SETTINGS_NAMESPACE)
  })

  it('closes the settings shell before opening the showcase route', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/client/ShowcaseCard.tsx', import.meta.url), 'utf8'))
    expect(source).toContain('[role="dialog"] button')
    expect(source).toContain('button.textContent')
    expect(source).not.toContain('new KeyboardEvent')
    expect(source).toContain('closeDshSettings(); route.open()')
  })

  it('uses the official theme toggle and left-side back button', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/client/ShowcasePage.tsx', import.meta.url), 'utf8'))
    expect(source).toContain('DshIconArrowLeft')
    expect(source).toContain('DshIconSun')
    expect(source).toContain('DshIconMoon')
    expect(source).toContain('切换到亮色模式')
    expect(source).toContain('切换到暗色模式')
    expect(source).toContain('route.close()')
    expect(source).not.toContain('关闭总览')
    expect(source).not.toContain('⌄')
  })

  it('uses shared Semi icon components for sidebar navigation', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/client/ShowcasePage.tsx', import.meta.url), 'utf8'))
    for (const icon of ['DshIconLabButton', 'DshIconLabCascader', 'DshIconLabTreeSelect', 'DshIconLabTree', 'DshIconLabHeart', 'DshIconLabModal', 'DshIconLabProgress', 'DshIconLabSpin', 'DshIconLabToast', 'DshIconLabTooltip', 'DshIconLabDropdown']) expect(source).toContain(icon)
    for (const glyph of ['▣', '⌘', '▤', '◇', '□', '◌', '∨']) expect(source).not.toContain(glyph)
  })

  it('renders the complete Semi icon catalog with official icon groups', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/client/ShowcasePage.tsx', import.meta.url), 'utf8'))
    expect(source).toContain("@douyinfe/semi-icons/lib/es/icons/index.js")
    for (const group of ['全部图标', '面性图标', '线性图标', 'AI 图标']) expect(source).toContain(group)
    expect(source).toContain('iconCatalog.filter')
    expect(source).toContain('size="extra-large"')
    expect(source).toContain('颜色与双色图标')
    expect(source).toContain('fill={[')
  })

  it('shows the Tree checkbox state in the component overview', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/client/ShowcasePage.tsx', import.meta.url), 'utf8'))
    expect(source).toContain('<DshTree treeData={treeData} multiple')
    expect(source).toContain('checkRelation="related"')
    expect(source).toContain("defaultValue={['plugins']}")
  })

  it('covers the main Semi button types, themes, sizes, and states', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/client/ShowcasePage.tsx', import.meta.url), 'utf8'))
    for (const type of ['primary', 'secondary', 'tertiary', 'warning', 'danger']) expect(source).toContain(`['${type}',`)
    for (const theme of ['solid', 'light', 'outline', 'borderless']) expect(source).toContain(`'${theme}'`)
    for (const size of ['large', 'default', 'small']) expect(source).toContain(`'${size}'`)
    expect(source).toContain('loading={buttonLoading}')
    expect(source).toContain('disabled>禁用')
    expect(source).toContain('DshButtonGroup')
    expect(source).toContain('DshIconButton')
  })

  it('lists only components that have a runtime showcase', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/client/ShowcasePage.tsx', import.meta.url), 'utf8'))
    expect(source).toContain('>组件</button>')
    for (const label of ['>主题</button>', '>设计转代码</button>', '>模板</button>', '>数据可视化</button>']) expect(source).not.toContain(label)
    for (const label of ['Button 按钮', 'Cascader 级联选择', 'TreeSelect 树选择器', 'Checkbox 复选框', 'Tree 树形控件', 'Icon 图标', 'Modal 对话框', 'Tooltip 文字提示', 'Dropdown 下拉框']) expect(source).toContain(label)
    for (const label of ['Typography 文字', 'Divider 分割线', 'Tabs 标签栏']) expect(source).not.toContain(label)
  })

  it('covers selection validation and disabled states', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/client/ShowcasePage.tsx', import.meta.url), 'utf8'))
    expect(source).toContain('multiple defaultValue=')
    expect(source).toContain('validateStatus="error"')
    expect(source).toContain('validateStatus="success"')
    expect(source).toContain('placeholder="禁用"')
  })

  it('covers the official Modal state families', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/client/ShowcasePage.tsx', import.meta.url), 'utf8'))
    for (const prop of ['footerFill', 'maskClosable', 'okButtonProps', 'cancelButtonProps', 'header', 'footer', 'centered', 'fullScreen', 'bodyStyle']) expect(source).toContain(prop)
    for (const method of ['info', 'success', 'error', 'warning', 'confirm']) expect(source).toContain(`['${method}',`)
    expect(source).toContain('modalApi[method]')
  })

  it('includes the official feedback component families', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/client/ShowcasePage.tsx', import.meta.url), 'utf8'))
    for (const label of ['Progress 进度条', 'Spin 加载器', 'Toast 提示']) expect(source).toContain(label)
    for (const section of ['progress-basic', 'progress-circle', 'progress-format', 'spin-basic', 'spin-size', 'spin-content', 'toast-basic', 'toast-status', 'toast-control']) expect(source).toContain(section)
    for (const method of ['DshToast.info', 'DshToast.success', 'DshToast.warning', 'DshToast.error', 'DshToast.close']) expect(source).toContain(method)
  })

  it('keeps the shared theme scoped to official component states', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../../../packages/dsh-semi-ui/src/theme.ts', import.meta.url), 'utf8'))
    expect(source).toContain('.semi-button.semi-button-primary.semi-button-solid')
    expect(source).toContain('.semi-button.semi-button-warning.semi-button-light')
    expect(source).toContain('.semi-button.semi-button-danger.semi-button-outline')
    expect(source).toContain('semi-button-primary.semi-button-solid:not(.semi-button-disabled):is(:active, :focus-visible)')
    expect(source).toContain('.semi-modal-info-icon')
    expect(source).toContain('.semi-cascader-option-label-checkbox.semi-checkbox-checked')
    expect(source).toContain('.semi-cascader-option-label-checkbox.semi-checkbox-indeterminate')
    expect(source).toContain('.semi-checkbox:not(.semi-checkbox-checked):not(.semi-checkbox-indeterminate):hover')
    expect(source).toContain('.semi-tree-option-disabled .semi-tree-option-label')
    expect(source).toContain('--dsw-static-neutral-bluish-1000')
    expect(source).toContain('data-dsh-semi-theme-refcount')
  })

  it('opens the route and returns to the previous DSH hash', () => {
    const browser = fakeBrowser('#/conversation/1')
    const route = new ShowcaseRouteController(browser as unknown as Window)
    route.open()
    expect(browser.location.hash).toBe(SEMI_UI_SHOWCASE_HASH)
    expect(route.getSnapshot().active).toBe(true)
    route.close()
    expect(browser.location.hash).toBe('#/conversation/1')
    expect(route.getSnapshot().active).toBe(false)
  })

  it('keeps the external-store snapshot stable between route changes', () => {
    const route = new ShowcaseRouteController(fakeBrowser() as unknown as Window)
    expect(route.getSnapshot()).toBe(route.getSnapshot())
    route.open()
    expect(route.getSnapshot().active).toBe(true)
    expect(route.getSnapshot()).toBe(route.getSnapshot())
  })

  it('ignores unknown hashes and removes listeners on dispose', () => {
    const browser = fakeBrowser('#/future-dsh-route')
    const route = new ShowcaseRouteController(browser as unknown as Window)
    const dispose = route.install()
    expect(route.getSnapshot().active).toBe(false)
    dispose()
    expect(browser.removeEventListener).toHaveBeenCalledTimes(2)
    expect(browser.location.hash).toBe('#/future-dsh-route')
  })
})
