import { describe, expect, it, vi } from 'vitest'
import { apply as applyHost } from '../src/index.ts'
import { SEMI_UI_COMPONENT_HASHES, SEMI_UI_SHOWCASE_HASH, ShowcaseRouteController } from '../src/client/route.ts'
import { readFile } from 'node:fs/promises'

/** 拆分后的源文件：页面壳、目录、数据与各 demo 区块。 */
async function readShowcaseSources(): Promise<Record<string, string>> {
  const files = [
    'src/client/ShowcasePage.tsx',
    'src/client/showcase/catalog.ts',
    'src/client/showcase/class-names.ts',
    'src/client/showcase/demo-data.ts',
    'src/client/showcase/descriptions.ts',
    'src/client/showcase/sidebar.ts',
    'src/client/showcase/DemoCard.tsx',
    'src/client/showcase/CodeBuddySection.tsx',
    'src/client/showcase/sections/OverlaysSections.tsx',
    'src/client/showcase/sections/InputSections.tsx',
    'src/client/showcase/sections/SelectionSections.tsx',
    'src/client/showcase/sections/TreeSections.tsx',
    'src/client/showcase/sections/FeedbackSections.tsx',
    'src/client/showcase/sections/CollapseSection.tsx',
    'src/client/showcase/sections/DisplaySections.tsx',
    'src/client/showcase/sections/ListSections.tsx',
    'src/client/showcase/sections/NavigationSections.tsx',
    'src/client/showcase/sections/SurfaceSections.tsx',
  ] as const
  const sources: Record<string, string> = {}
  for (const file of files) sources[file] = await readFile(new URL(`../${file}`, import.meta.url), 'utf8')
  return sources
}

/** 拼接所有 demo 源码，供断言组件用法（用法分布在各区块文件中）。 */
async function readDemoSources(): Promise<string> {
  const sources = await readShowcaseSources()
  return Object.entries(sources)
    .filter(([file]) => file.includes('sections/') || file.includes('CodeBuddy') || file.includes('demo-data'))
    .map(([, code]) => code)
    .join('\n')
}

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
  it('does not register a plugin settings configuration panel', () => {
    expect(() => { applyHost({} as never) }).not.toThrow()
  })

  it('opens the showcase from the right-aligned session header utility slot', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/client/index.tsx', import.meta.url), 'utf8'))
    const action = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/client/SemiUiHeaderAction.tsx', import.meta.url), 'utf8'))
    expect(source).toContain("ctx.slots.inject('conversation.session.header.utilities'")
    expect(source).toContain("name: 'conversation.session.header.utilities'")
    expect(source).not.toContain("settings.plugin.item")
    expect(source).not.toContain('ShowcaseCard')
    expect(action).toContain('DshButton')
    expect(action).toContain('route.open()')
  })

  it('uses the official theme toggle and left-side back button', async () => {
    const source = (await readShowcaseSources())['src/client/ShowcasePage.tsx']
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
    const source = (await readShowcaseSources())['src/client/showcase/sidebar.ts']
    for (const icon of ['DshIconLabButton', 'DshIconLabCascader', 'DshIconLabTreeSelect', 'DshIconLabTree', 'DshIconLabHeart', 'DshIconLabModal', 'DshIconLabProgress', 'DshIconLabSpin', 'DshIconLabToast', 'DshIconLabTooltip', 'DshIconLabDropdown']) expect(source).toContain(icon)
    for (const glyph of ['▣', '⌘', '▤', '◇', '□', '◌', '∨']) expect(source).not.toContain(glyph)
  })

  it('renders the complete Semi icon catalog with official icon groups', async () => {
    const source = await readDemoSources()
    expect(source).toContain('DshSemiIcons')
    for (const group of ['全部图标', '面性图标', '线性图标', 'AI 图标']) expect(source).toContain(group)
    expect(source).toContain('iconCatalog.filter')
    expect(source).toContain('size="extra-large"')
    expect(source).toContain('颜色与双色图标')
    expect(source).toContain('fill={[')
  })

  it('keeps Semi implementation dependencies behind the shared facade', async () => {
    const pluginPackages = [
      '../package.json',
      '../../dsh-codex-auth-plugin/package.json',
      '../../dsh-fnos-plugin/package.json',
    ]
    for (const packagePath of pluginPackages) {
      const manifest = JSON.parse(await import('node:fs/promises').then(({ readFile }) => readFile(new URL(packagePath, import.meta.url), 'utf8'))) as Record<string, Record<string, string> | undefined>
      const dependencies = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies })
      expect(dependencies.filter(name => name.startsWith('@douyinfe/'))).toEqual([])
    }
    const source = await readDemoSources()
    expect(source).not.toMatch(/(?:from|import)\s+['"]@douyinfe\//u)
  })

  it('shows the Tree checkbox state in the component overview', async () => {
    const source = await readDemoSources()
    expect(source).toContain('<DshTree treeData={treeData} multiple')
    expect(source).toContain("checkRelation: 'related' as const")
    expect(source).toContain("defaultValue={['plugins']}")
  })

  it('covers the main Semi button types, themes, sizes, and states', async () => {
    const source = await readDemoSources()
    for (const type of ['primary', 'secondary', 'tertiary', 'warning', 'danger']) expect(source).toContain(`['${type}',`)
    for (const theme of ['solid', 'light', 'outline', 'borderless']) expect(source).toContain(`'${theme}'`)
    for (const size of ['large', 'default', 'small']) expect(source).toContain(`'${size}'`)
    expect(source).toContain('loading={buttonLoading}')
    expect(source).toContain('disabled>禁用')
    expect(source).toContain('DshButtonGroup')
    expect(source).toContain('DshIconButton')
  })

  it('uses official Semi component names in code examples and stacks previews above code', async () => {
    const sources = await readShowcaseSources()
    const source = String(sources['src/client/showcase/DemoCard.tsx'])
    const style = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/client/style.scss', import.meta.url), 'utf8'))
    expect(source).toContain(".replaceAll('@tnnevol/dsh-semi-ui', '@douyinfe/semi-ui')")
    expect(source).toContain(".replace(/\\bDsh(?=[A-Z])/g, '')")
    expect(style).toContain('grid-template-rows: auto auto')
    expect(style).toContain('background: var(--semi-color-bg-0)')
    expect(style).toContain('color: var(--semi-color-text-2)')
    expect(style).toContain('padding: 24px')
    expect(style).not.toContain('grid-template-columns: minmax(260px, .9fr) minmax(300px, 1.1fr)')
  })

  it('lists only components that have a runtime showcase', async () => {
    const sources = await readShowcaseSources()
    const source = String(sources['src/client/ShowcasePage.tsx']) + sources['src/client/showcase/sidebar.ts'] + sources['src/client/showcase/catalog.ts']
    expect(source).toContain('>组件</button>')
    for (const label of ['>主题</button>', '>设计转代码</button>', '>模板</button>', '>数据可视化</button>']) expect(source).not.toContain(label)
    for (const label of ['Button 按钮', 'Input 输入框', 'InputNumber 数字输入框', 'Slider 滑块', 'Switch 开关', 'Form 表单', 'Cascader 级联选择', 'TreeSelect 树选择器', 'Checkbox 复选框', 'Tree 树形控件', 'Icon 图标', 'Modal 对话框', 'Popover 浮层', 'Tooltip 文字提示', 'Dropdown 下拉框', 'Select 选择器', 'Skeleton 骨架屏', 'Tabs 标签栏', 'Tag 标签', 'Avatar 头像', 'Badge 徽标', 'List 列表', 'Typography 排版', 'ScrollList 滚动列表', 'HotKeys 快捷键']) expect(source).toContain(label)
    for (const label of ['Divider 分割线', 'Space 间距', 'Grid 栅格']) expect(source).not.toContain(label)
  })

  it('maps every sidebar component to an independent route', async () => {
    const sources = await readShowcaseSources()
    const source = String(sources['src/client/ShowcasePage.tsx']) + sources['src/client/showcase/catalog.ts']
    for (const componentRoute of Object.keys(SEMI_UI_COMPONENT_HASHES)) expect(source).toContain(`'${componentRoute}'`)
    expect(source).toContain('componentRouteByLabel')
    expect(source).toContain('route.select(componentRouteByLabel[label])')
    expect(source).toContain("route.select('button')")
  })

  it('covers selection validation and disabled states', async () => {
    const source = await readDemoSources()
    expect(source).toContain('multiple: true')
    expect(source).toContain("validateStatus: 'error' as const")
    expect(source).toContain("validateStatus: 'success' as const")
    expect(source).toContain("'禁用'")
  })

  it('showcases every newly exposed input component', async () => {
    const source = await readDemoSources()
    for (const component of ['DshInput', 'DshInputNumber', 'DshSlider', 'DshSwitch', 'DshForm']) expect(source).toContain(component)
    for (const section of ['input-basic', 'input-states', 'input-number-basic', 'input-number-states', 'slider-basic', 'slider-states', 'switch-basic', 'switch-states', 'form-basic', 'form-states']) expect(source).toContain(section)
    for (const prop of ['showClear', 'validateStatus', 'min={0}', 'max={100}', 'range', 'marks=', 'checkedText', 'uncheckedText', 'DshForm.Slot']) expect(source).toContain(prop)
  })

  it('covers the official Select states and multi-select behaviors', async () => {
    const source = await readDemoSources()
    expect(source).toContain('<DshSelect.Option value="luna">')
    expect(source).toContain('optionList={selectOptionList}')
    expect(source).toContain('multiple filter defaultValue={["luna", "sol"]}')
    expect(source).toContain('maxTagCount={2}')
    expect(source).toContain('showRestTagsPopover')
    expect(source).toContain('max={2}')
    expect(source).toContain('prefix={<DshIconSearch />}')
  })

  it('covers Skeleton placeholder composition and loading toggle', async () => {
    const source = await readDemoSources()
    for (const part of ['DshSkeleton.Avatar', 'DshSkeleton.Image', 'DshSkeleton.Title', 'DshSkeleton.Paragraph', 'DshSkeleton.Button']) expect(source).toContain(part)
    expect(source).toContain('loading={skeletonLoading}')
    expect(source).toContain('setSkeletonLoading')
    expect(source).toContain('active')
  })

  it('covers Tabs types, disabled panes, and controlled keys', async () => {
    const source = await readDemoSources()
    for (const part of ['DshTabs.TabPane', 'type="line"', 'type="card"', 'type="button"', 'disabled', 'activeKey={tabsActiveKey}', 'onChange={setTabsActiveKey}', 'tabList={tabsTabList}']) expect(source).toContain(part)
  })

  it('covers Tag colors, shapes, and closable behaviors', async () => {
    const source = await readDemoSources()
    for (const part of ['type="solid"', 'type="light"', 'type="ghost"', 'shape="circle"', 'closable', 'tagPreventVisible', 'event.preventDefault()']) expect(source).toContain(part)
  })

  it('covers Avatar sizes, colors, shapes, and avatar groups', async () => {
    const source = await readDemoSources()
    for (const part of ['DshAvatarGroup', 'color="red"', 'color="light-blue"', 'shape="square"', 'size="extra-large"', 'src="https://', 'maxCount={3}']) expect(source).toContain(part)
  })

  it('covers Badge count, dot, overflow, and position variants', async () => {
    const source = await readDemoSources()
    for (const part of ['<DshBadge count={5}>', '<DshBadge dot>', 'count="NEW"', 'overflowCount={10}', 'overflowCount={999}', 'position="rightTop"', 'position="leftBottom"']) expect(source).toContain(part)
  })

  it('covers List basic, template, size, and empty states', async () => {
    const source = await readDemoSources()
    for (const part of ['renderItem={(item: string) => <DshList.Item>{item}</DshList.Item>}', 'header={<div>列表头</div>}', 'footer={<div>列表尾</div>}', 'DshList.Item', 'main={', 'extra={<DshButton', 'size="small" bordered', 'emptyContent={<DshEmpty', 'dataSource={[]}']) expect(source).toContain(part)
  })

  it('covers Typography title, text, numeral, ellipsis, and copyable', async () => {
    const source = await readDemoSources()
    for (const part of ['DshTypography.Title heading={2}', 'type="secondary"', 'type="warning"', 'type="danger"', 'DshTypography.Text mark', 'DshTypography.Text code', 'DshTypography.Paragraph spacing="extended"', 'DshTypography.Numeral rule="bytes-decimal"', 'rule="percentages"', 'ellipsis={{ rows: 2, expandable: true, collapsible: true }}', 'copyable={{ content:']) expect(source).toContain(part)
  })

  it('covers ScrollList wheel selection and plain scroll container', async () => {
    const source = await readDemoSources()
    const style = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/client/style.scss', import.meta.url), 'utf8'))
    for (const part of ['DshScrollItem', 'mode="wheel"', 'cycled', 'selectedIndex={scrollAmPmIndex}', 'dsh-semi-showcase-scrolllist-plain']) expect(source).toContain(part)
    expect(style).toContain('.dsh-semi-showcase-scrolllist-plain .semi-scrolllist-body')
    expect(style).toContain('max-height: 200px')
  })

  it('covers HotKeys global shortcut, preventDefault, and listener target', async () => {
    const source = await readDemoSources()
    for (const part of ['DshHotKeys.Keys.Control', "DshHotKeys.Keys.A", 'preventDefault', 'getListenerTarget', 'onHotKey=', 'hotKeysModalVisible']) expect(source).toContain(part)
  })

  it('fills the previously missing data and layout showcases', async () => {
    const sources = await readShowcaseSources()
    const catalog = String(sources['src/client/showcase/catalog.ts'])
    const source = [sources['src/client/showcase/sections/DisplaySections.tsx'], sources['src/client/showcase/sections/ListSections.tsx'], sources['src/client/showcase/sections/NavigationSections.tsx'], sources['src/client/showcase/sections/SurfaceSections.tsx'], sources['src/client/showcase/sections/CollapseSection.tsx'], catalog].map(String).join('')
    for (const label of ["'Layout 布局'", "'Nav 导航'", "'Table 表格'", "'Card 卡片'", "'Descriptions 描述'", "'Empty 空状态'"]) expect(catalog).toContain(label)
    for (const part of ['DshLayout.Header', 'DshLayout.Sider', 'DshLayout.Content', 'DshLayout.Footer', 'collapseButton: true', 'mode="horizontal"', 'selectedKeys={navSelectedKeys}', 'columns={tableColumns}', 'dataSource={tableData}', 'rowSelection={{ fixed: true, selectedRowKeys: tableSelectedKeys', 'pagination={{ pageSize: 3 }}', 'headerExtraContent=', 'footerStyle=', 'shadows="hover"', 'headerLine={false}', 'column={2}', 'align="justify"', 'layout="horizontal"']) expect(String(source)).toContain(part)
  })

  it('uses Switch and Slider for the configuration form showcase', async () => {
    const source = await readDemoSources()
    for (const label of ['显示额度余量', '自定义额度上限', '余量告警百分比', 'showUsage', 'dangerPercentage', 'dsh-semi-showcase-form-slider']) expect(source).toContain(label)
    expect(source).toContain('<DshSwitch checked={showUsage} onChange={setShowUsage}')
    expect(source).toContain('<DshSlider value={dangerPercentage}')
    expect(source).toContain('<DshInputNumber className="dsh-semi-showcase-control" placeholder="使用默认" />')
    expect(source).not.toContain('htmlType="submit"')

    const style = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/client/style.scss', import.meta.url), 'utf8'))
    expect(style).toContain('justify-content: space-between')
    expect(style).toContain('.dsh-semi-showcase-form .semi-form-field[x-label-pos=\'left\'] .semi-form-field-main')
  })

  it('covers the official Modal state families', async () => {
    const source = await readDemoSources()
    for (const prop of ['footerFill', 'maskClosable', 'okButtonProps', 'cancelButtonProps', 'header', 'footer', 'centered', 'fullScreen']) expect(source).toContain(prop)
    expect(source).toContain('dsh-semi-showcase-modal-scroll')
    expect(source).toContain("{...(modalDemo === 'customFooter' ? { footer: modalFooter } : {})}")
    expect(source).not.toContain("footer={modalDemo === 'customFooter' ? modalFooter : undefined}")
    for (const method of ['info', 'success', 'error', 'warning', 'confirm']) expect(source).toContain(`['${method}',`)
    expect(source).toContain('modalApi[method]')
  })

  it('includes the official feedback component families', async () => {
    const sources = await readShowcaseSources()
    const source = String(sources['src/client/showcase/sections/FeedbackSections.tsx']) + String(sources['src/client/showcase/catalog.ts'])
    for (const label of ['Progress 进度条', 'Spin 加载器', 'Toast 提示']) expect(source).toContain(label)
    for (const section of ['progress-basic', 'progress-circle', 'progress-format', 'spin-basic', 'spin-size', 'spin-content', 'toast-basic', 'toast-status', 'toast-control']) expect(String(sources['src/client/showcase/sections/FeedbackSections.tsx'])).toContain(section)
    for (const method of ['DshToast.info', 'DshToast.success', 'DshToast.warning', 'DshToast.error', 'DshToast.close']) expect(source).toContain(method)
  })

  it('includes a working Popover showcase', async () => {
    const sources = await readShowcaseSources()
    const source = String(sources['src/client/showcase/sections/OverlaysSections.tsx']) + String(sources['src/client/showcase/catalog.ts'])
    expect(source).toContain('DshPopover')
    expect(source).toContain('Popover 浮层')
    expect(source).toContain('trigger="click"')
    expect(source).toContain('showArrow')
    expect(source).toContain('popover-basic')
  })

  it('covers the official Dropdown showcase families', async () => {
    const source = await readDemoSources()
    for (const section of ['dropdown-basic', 'dropdown-nested', 'dropdown-position', 'dropdown-trigger', 'dropdown-events', 'dropdown-json', 'dropdown-api']) expect(source).toContain(section)
    for (const trigger of ['trigger="hover"', 'trigger="focus"', 'trigger="click"', 'trigger="custom"', 'trigger="contextMenu"']) expect(source).toContain(trigger)
    for (const part of ['DshDropdown.Menu', 'DshDropdown.Title', 'DshDropdown.Item', 'DshDropdown.Divider', 'showTick', 'onMouseEnter', 'onMouseLeave', 'onContextMenu', 'menu={dropdownJsonMenu']) expect(source).toContain(part)
  })

  it('keeps the shared theme scoped to official component states', async () => {
    const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../../../packages/dsh-semi-ui/src/theme.ts', import.meta.url), 'utf8'))
    const style = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../../../packages/dsh-semi-ui/src/theme.scss', import.meta.url), 'utf8'))
    for (const token of ['.semi-button.semi-button-primary.semi-button-solid', '.semi-button.semi-button-warning.semi-button-light', '.semi-button.semi-button-danger.semi-button-outline', 'semi-button-primary.semi-button-solid:not(.semi-button-disabled):is(:active, :focus-visible)', '.semi-modal-info-icon', '.semi-cascader-option-label-checkbox.semi-checkbox-checked', '.semi-cascader-option-label-checkbox.semi-checkbox-indeterminate', '.semi-checkbox:not(.semi-checkbox-checked):not(.semi-checkbox-indeterminate):hover', '.semi-tree-option-disabled .semi-tree-option-label', '.semi-popover-wrapper', '.semi-slider-wrapper:not(.semi-slider-vertical-wrapper) > .semi-slider-track', '.semi-slider-handle-clicked', '--semi-color-fill-0', '--semi-color-primary', '--semi-color-primary-disabled', '--semi-color-secondary-light-hover', '--semi-color-tertiary-light-active', '--semi-color-success: var(--dsw-alias-state-success-primary)', '--semi-color-danger-light-default', '--semi-color-warning-light-active', '--semi-color-success-light-hover', '--semi-color-text-2', '--semi-border-radius-small: var(--semi-border-radius-large)', '--dsw-static-neutral-bluish-1000']) expect(style).toContain(token)
    expect(style).toContain('height: 6px')
    expect(style).toContain('width: 18px')
    expect(style).not.toContain('!important')
    expect(style).not.toContain('stroke: var(--semi-color-primary) !important')
    expect(source).toContain('data-dsh-semi-theme-refcount')
  })

  it('opens the route and returns to the previous DSH hash', () => {
    const browser = fakeBrowser('#/conversation/1')
    const route = new ShowcaseRouteController(browser as unknown as Window)
    route.open()
    expect(browser.location.hash).toBe(SEMI_UI_COMPONENT_HASHES.button)
    expect(route.getSnapshot().active).toBe(true)
    expect(route.getSnapshot().component).toBe('button')
    route.close()
    expect(browser.location.hash).toBe('#/conversation/1')
    expect(route.getSnapshot().active).toBe(false)
  })

  it('switches components without reusing the showcase root route', () => {
    const browser = fakeBrowser()
    const route = new ShowcaseRouteController(browser as unknown as Window)
    route.open()
    for (const [component, componentHash] of Object.entries(SEMI_UI_COMPONENT_HASHES)) {
      route.select(component as keyof typeof SEMI_UI_COMPONENT_HASHES)
      expect(browser.location.hash).toBe(componentHash)
      expect(route.getSnapshot().component).toBe(component)
    }
    expect(browser.location.hash).not.toBe(SEMI_UI_SHOWCASE_HASH)
  })

  it('recognizes a component route on initial load', () => {
    const browser = fakeBrowser(SEMI_UI_COMPONENT_HASHES.slider)
    const route = new ShowcaseRouteController(browser as unknown as Window)
    expect(route.getSnapshot()).toEqual({ active: true, component: 'slider' })
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
