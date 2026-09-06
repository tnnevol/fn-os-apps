import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { ComponentType, MouseEvent, ReactNode } from 'react'
import {
  DshButton,
  DshButtonGroup,
  DshCascader,
  DshCheckbox,
  DshDropdown,
  DshForm,
  DshIconAlertCircle,
  DshIconArrowLeft,
  DshIconCheckCircle,
  DshIconButton,
  DshIconClose,
  DshIconChevronDown,
  DshIconElementStroked,
  DshIconFile,
  DshIconFolder,
  DshIconFolderOpen,
  DshIconHelpCircle,
  DshIconInfoCircle,
  DshIconLabButton,
  DshIconLabCascader,
  DshIconLabCheckbox,
  DshIconLabDropdown,
  DshIconLabHeart,
  DshIconLabModal,
  DshIconLabProgress,
  DshIconLabSpin,
  DshIconLabTooltip,
  DshIconLabToast,
  DshIconLabTree,
  DshIconLabTreeSelect,
  DshIconMoon,
  DshIconRefresh,
  DshIconRestart,
  DshIconSetting,
  DshIconSun,
  DshInput,
  DshInputNumber,
  DshModal,
  DshPopover,
  DshProgress,
  DshSpin,
  DshSemiIcons,
  DshSlider,
  DshSwitch,
  DshToast,
  DshTooltip,
  DshTree,
  DshTreeSelect,
} from '@tnnevol/dsh-semi-ui'
import type { ShowcaseComponentRoute, ShowcaseRouteController } from './route.ts'
import type { ShowcaseThemeController } from './theme-preview.ts'

type Category = 'buttons' | 'input' | 'selection' | 'tree' | 'modal' | 'feedback'
type ComponentItem = 'Button 按钮' | 'Input 输入框' | 'InputNumber 数字输入框' | 'Slider 滑块' | 'Switch 开关' | 'Form 表单' | 'Cascader 级联选择' | 'TreeSelect 树选择器' | 'Checkbox 复选框' | 'Tree 树形控件' | 'Icon 图标' | 'Modal 对话框' | 'Popover 浮层' | 'Tooltip 文字提示' | 'Dropdown 下拉框' | 'Progress 进度条' | 'Spin 加载器' | 'Toast 提示'
type ModalDemo = 'basic' | 'footerFill' | 'mask' | 'buttonProps' | 'customFooter' | 'styled' | 'fullscreen'

const page = 'dsh-semi-showcase-page'
const topbar = 'dsh-semi-showcase-topbar'
const brand = 'dsh-semi-showcase-brand'
const topnav = 'dsh-semi-showcase-topnav'
const topnavItem = 'dsh-semi-showcase-topnav-item'
const shell = 'dsh-semi-showcase-shell'
const sidebar = 'dsh-semi-showcase-sidebar'
const sidebarGroup = 'dsh-semi-showcase-sidebar-group'
const sidebarTitle = 'dsh-semi-showcase-sidebar-title'
const sidebarItem = 'dsh-semi-showcase-sidebar-item'
const main = 'dsh-semi-showcase-main'
const mainInner = 'dsh-semi-showcase-main-inner'
const outline = 'dsh-semi-showcase-outline'
const outlineItem = 'dsh-semi-showcase-outline-item'
const breadcrumb = 'dsh-semi-showcase-breadcrumb'
const heading = 'dsh-semi-showcase-heading'
const description = 'dsh-semi-showcase-description'
const sectionTitle = 'dsh-semi-showcase-section-title'
const sectionText = 'dsh-semi-showcase-section-text'
const demoCard = 'dsh-semi-showcase-demo-card'
const demoPreview = 'dsh-semi-showcase-demo-preview'
const code = 'dsh-semi-showcase-code'
const demo = 'dsh-semi-showcase-demo'
const stack = 'dsh-semi-showcase-stack'
const demoBlock = 'dsh-semi-showcase-demo-block'
const demoLabel = 'dsh-semi-showcase-demo-label'
const dropdownApiTable = 'dsh-semi-showcase-dropdown-api-table'
const dropdownApiCell = 'dsh-semi-showcase-dropdown-api-cell'
const iconGrid = 'dsh-semi-showcase-icon-grid'
const iconTile = 'dsh-semi-showcase-icon-tile'
const iconTileLabel = 'dsh-semi-showcase-icon-tile-label'
const treeData = [{ label: '工作区', value: 'workspace', key: 'workspace', children: [{ label: '插件', value: 'plugins', key: 'plugins' }, { label: '应用', value: 'apps', key: 'apps' }] }]
const disabledTreeData = [{ label: '工作区', value: 'workspace', key: 'workspace', children: [{ label: '插件', value: 'plugins', key: 'plugins' }, { label: '应用（禁用）', value: 'apps', key: 'apps', disabled: true }] }]
const cascaderData = [
  { label: '模型', value: 'model', children: [{ label: 'GPT-5.6 Luna', value: 'luna' }, { label: 'GPT-5.6 Sol', value: 'sol' }] },
  { label: '能力', value: 'capability', children: [{ label: '联网搜索', value: 'search' }, { label: '图片识别', value: 'vision' }] },
]
const buttonTypes = [
  ['primary', '主要'],
  ['secondary', '次要'],
  ['tertiary', '第三'],
  ['warning', '警告'],
  ['danger', '危险'],
] as const
const buttonThemes = ['solid', 'light', 'outline', 'borderless'] as const
const buttonSizes = ['large', 'default', 'small'] as const
const iconModes = [
  ['all', '全部图标'],
  ['filled', '面性图标'],
  ['stroked', '线性图标'],
  ['ai', 'AI 图标'],
] as const
type IconMode = typeof iconModes[number][0]
type ShowcaseIcon = ComponentType<{ 'aria-label'?: string; size?: 'inherit' | 'extra-small' | 'small' | 'default' | 'large' | 'extra-large'; fill?: string[] }>
const iconCatalog = Object.entries(DshSemiIcons)
  .filter(([name, icon]) => name !== 'Icon' && /^Icon[A-Z]/.test(name) && (typeof icon === 'function' || typeof icon === 'object'))
  .map(([name, icon]) => ({
    name,
    group: name.startsWith('IconAI') ? 'ai' : name.endsWith('Stroked') ? 'stroked' : 'filled',
    Icon: icon as ShowcaseIcon,
  }))
const modalMethods = [
  ['info', '信息', DshIconInfoCircle],
  ['success', '成功', DshIconCheckCircle],
  ['error', '错误', DshIconAlertCircle],
  ['warning', '警告', DshIconAlertCircle],
  ['confirm', '确认', DshIconHelpCircle],
] as const
type ModalMethod = typeof modalMethods[number][0]
const modalApi = DshModal as unknown as Record<ModalMethod, (props: Record<string, unknown>) => unknown>
type ToastCallOptions = { content: ReactNode; duration?: number; stack?: boolean }
const toastApi = DshToast as unknown as Record<'info' | 'success' | 'warning' | 'error', (options: ToastCallOptions) => string>
const sidebarGroups = [
  { title: '基础类', items: [{ icon: DshIconLabButton, label: 'Button 按钮', value: 'buttons' as Category }, { icon: DshIconLabHeart, label: 'Icon 图标', value: 'tree' as Category }] },
  { title: '输入类', items: [{ icon: DshIconElementStroked, label: 'Input 输入框', value: 'input' as Category }, { icon: DshIconElementStroked, label: 'InputNumber 数字输入框', value: 'input' as Category }, { icon: DshIconLabCascader, label: 'Slider 滑块', value: 'input' as Category }, { icon: DshIconLabCheckbox, label: 'Switch 开关', value: 'input' as Category }, { icon: DshIconElementStroked, label: 'Form 表单', value: 'input' as Category }, { icon: DshIconLabCascader, label: 'Cascader 级联选择', value: 'selection' as Category }, { icon: DshIconLabTreeSelect, label: 'TreeSelect 树选择器', value: 'selection' as Category }, { icon: DshIconLabCheckbox, label: 'Checkbox 复选框', value: 'selection' as Category }] },
  { title: '导航类', items: [{ icon: DshIconLabTree, label: 'Tree 树形控件', value: 'tree' as Category }] },
  { title: '反馈类', items: [{ icon: DshIconLabModal, label: 'Modal 对话框', value: 'modal' as Category }, { icon: DshIconLabProgress, label: 'Progress 进度条', value: 'feedback' as Category }, { icon: DshIconLabSpin, label: 'Spin 加载器', value: 'feedback' as Category }, { icon: DshIconLabToast, label: 'Toast 提示', value: 'feedback' as Category }, { icon: DshIconLabTooltip, label: 'Tooltip 文字提示', value: 'buttons' as Category }, { icon: DshIconLabDropdown, label: 'Dropdown 下拉框', value: 'buttons' as Category }, { icon: DshIconElementStroked, label: 'Popover 浮层', value: 'buttons' as Category }] },
] as const

const componentRouteByLabel: Record<ComponentItem, ShowcaseComponentRoute> = {
  'Button 按钮': 'button',
  'Input 输入框': 'input',
  'InputNumber 数字输入框': 'input-number',
  'Slider 滑块': 'slider',
  'Switch 开关': 'switch',
  'Form 表单': 'form',
  'Cascader 级联选择': 'cascader',
  'TreeSelect 树选择器': 'tree-select',
  'Checkbox 复选框': 'checkbox',
  'Tree 树形控件': 'tree',
  'Icon 图标': 'icon',
  'Modal 对话框': 'modal',
  'Popover 浮层': 'popover',
  'Tooltip 文字提示': 'tooltip',
  'Dropdown 下拉框': 'dropdown',
  'Progress 进度条': 'progress',
  'Spin 加载器': 'spin',
  'Toast 提示': 'toast',
}

const componentByRoute: Record<ShowcaseComponentRoute, ComponentItem> = Object.fromEntries(
  Object.entries(componentRouteByLabel).map(([label, componentRoute]) => [componentRoute, label]),
) as Record<ShowcaseComponentRoute, ComponentItem>

const categoryByComponent: Record<ComponentItem, Category> = {
  'Button 按钮': 'buttons',
  'Input 输入框': 'input',
  'InputNumber 数字输入框': 'input',
  'Slider 滑块': 'input',
  'Switch 开关': 'input',
  'Form 表单': 'input',
  'Cascader 级联选择': 'selection',
  'TreeSelect 树选择器': 'selection',
  'Checkbox 复选框': 'selection',
  'Tree 树形控件': 'tree',
  'Icon 图标': 'tree',
  'Modal 对话框': 'modal',
  'Popover 浮层': 'buttons',
  'Tooltip 文字提示': 'buttons',
  'Dropdown 下拉框': 'buttons',
  'Progress 进度条': 'feedback',
  'Spin 加载器': 'feedback',
  'Toast 提示': 'feedback',
}

function DemoCode({ children }: { children: string }): ReactNode {
  const officialSource = children
    .replaceAll('@tnnevol/dsh-semi-ui', '@douyinfe/semi-ui')
    .replace(/\bDsh(?=[A-Z])/g, '')
  return <pre className={code}><code>{officialSource}</code></pre>
}

function DemoCard({ children, source }: { children: ReactNode; source: string }): ReactNode {
  return <div className={demoCard}><div className="dsh-semi-showcase-demo-card-inner"><div className={demoPreview}>{children}</div><DemoCode>{source}</DemoCode></div></div>
}

export function ShowcasePage({ route, theme }: { route: ShowcaseRouteController; theme: ShowcaseThemeController }) {
  const snapshot = useSyncExternalStore(route.subscribe, route.getSnapshot, route.getSnapshot)
  const themeSnapshot = useSyncExternalStore(theme.subscribe, theme.getSnapshot, theme.getSnapshot)
  const [modalVisible, setModalVisible] = useState(false)
  const [modalDemo, setModalDemo] = useState<ModalDemo>('basic')
  const [buttonLoading, setButtonLoading] = useState(false)
  const [checkboxChecked, setCheckboxChecked] = useState(false)
  const [iconMode, setIconMode] = useState<IconMode>('all')
  const [toastId, setToastId] = useState<string>()
  const [dropdownSelected, setDropdownSelected] = useState('插件')
  const [dropdownEvent, setDropdownEvent] = useState('等待菜单操作')
  const [dropdownCustomVisible, setDropdownCustomVisible] = useState(false)
  const [inputValue, setInputValue] = useState('DSH Semi UI')
  const [inputNumberValue, setInputNumberValue] = useState<number | string>(24)
  const [sliderValue, setSliderValue] = useState(42)
  const [switchChecked, setSwitchChecked] = useState(true)
  const [showUsage, setShowUsage] = useState(true)
  const [dangerPercentage, setDangerPercentage] = useState(90)
  const activeComponent = componentByRoute[snapshot.component]
  const category = categoryByComponent[activeComponent]
  const dropdownMenu = useMemo(() => (
    <DshDropdown.Menu>
      <DshDropdown.Title>工作区</DshDropdown.Title>
      <DshDropdown.Item icon={<DshIconFolderOpen />} active={dropdownSelected === '插件'} onClick={() => { setDropdownSelected('插件'); setDropdownEvent('已选择：插件') }}>插件</DshDropdown.Item>
      <DshDropdown.Item icon={<DshIconFile />} active={dropdownSelected === '文档'} onClick={() => { setDropdownSelected('文档'); setDropdownEvent('已选择：文档') }}>文档</DshDropdown.Item>
      <DshDropdown.Item icon={<DshIconFolder />} disabled>应用（禁用）</DshDropdown.Item>
      <DshDropdown.Divider />
      <DshDropdown.Title>操作</DshDropdown.Title>
      <DshDropdown.Item icon={<DshIconSetting />} type="primary" onClick={() => { setDropdownEvent('已打开设置') }}>设置</DshDropdown.Item>
      <DshDropdown.Item icon={<DshIconRefresh />} type="warning" onClick={() => { setDropdownEvent('已刷新工作区') }}>刷新工作区</DshDropdown.Item>
      <DshDropdown.Item icon={<DshIconAlertCircle />} type="danger" onClick={() => { setDropdownEvent('已执行危险操作') }}>删除缓存</DshDropdown.Item>
    </DshDropdown.Menu>
  ), [dropdownSelected])
  const nestedDropdownMenu = useMemo(() => (
    <DshDropdown.Menu>
      <DshDropdown.Item>当前会话</DshDropdown.Item>
      <DshDropdown.Item>全部会话</DshDropdown.Item>
      <DshDropdown.Item disabled>已归档会话</DshDropdown.Item>
    </DshDropdown.Menu>
  ), [])
  const dropdownEventMenu = useMemo(() => (
    <DshDropdown.Menu>
      <DshDropdown.Item onClick={() => { setDropdownEvent('onClick：选择了菜单项') }}>点击事件</DshDropdown.Item>
      <DshDropdown.Item onMouseEnter={() => { setDropdownEvent('onMouseEnter：指针进入菜单项') }}>移入事件</DshDropdown.Item>
      <DshDropdown.Item onMouseLeave={() => { setDropdownEvent('onMouseLeave：指针离开菜单项') }}>移出事件</DshDropdown.Item>
      <DshDropdown.Item onContextMenu={(event: MouseEvent<HTMLLIElement>) => { event.preventDefault(); setDropdownEvent('onContextMenu：右键菜单项') }}>右键事件</DshDropdown.Item>
    </DshDropdown.Menu>
  ), [])
  const dropdownJsonMenu = [
    { node: 'title', name: '快捷操作' },
    { node: 'item', name: '新建文件', type: 'primary', active: true, icon: <DshIconFile />, onClick: () => { setDropdownEvent('JSON 菜单：新建文件') } },
    { node: 'item', name: '打开目录', type: 'secondary', icon: <DshIconFolderOpen />, onClick: () => { setDropdownEvent('JSON 菜单：打开目录') } },
    { node: 'divider' },
    { node: 'item', name: '清理缓存', type: 'danger', icon: <DshIconAlertCircle />, onClick: () => { setDropdownEvent('JSON 菜单：清理缓存') } },
  ]
  const dropdownSimpleMenu = useMemo(() => <DshDropdown.Menu><DshDropdown.Item>菜单项 1</DshDropdown.Item><DshDropdown.Item>菜单项 2</DshDropdown.Item><DshDropdown.Item>菜单项 3</DshDropdown.Item></DshDropdown.Menu>, [])
  const popoverContent = useMemo(() => <div className="dsh-semi-showcase-popover-content"><strong>Popover 内容</strong><span className="dsh-semi-showcase-secondary-text">这是由调用方传入的自定义内容。</span></div>, [])
  const nextTheme = themeSnapshot.active.colorScheme === 'dark' ? 'light' : 'dark'
  const themeToggleLabel = nextTheme === 'light' ? '切换到亮色模式' : '切换到暗色模式'
  const ThemeIcon = nextTheme === 'light' ? DshIconSun : DshIconMoon
  useEffect(() => () => { DshModal.destroyAll?.(); DshToast.destroyAll?.() }, [])
  if (!snapshot.active) return null

  const categoryTitle = activeComponent
  const categoryDescription = activeComponent === 'Button 按钮'
    ? '按钮用于开始一个即时操作，支持多种类型、主题、尺寸和交互状态。'
    : activeComponent === 'Cascader 级联选择'
      ? '级联选择用于从具有层级关系的选项中选择一个或多个值。'
      : activeComponent === 'TreeSelect 树选择器'
        ? '树选择器将树形结构与选择器结合，支持单选、多选和节点关系控制。'
      : activeComponent === 'Checkbox 复选框'
          ? '复选框用于在多个选项中进行选择，支持默认、选中、半选和禁用状态。'
        : activeComponent === 'Input 输入框'
          ? '输入框用于接收单行文本，支持清除、前后缀、校验状态、尺寸和禁用状态。'
        : activeComponent === 'InputNumber 数字输入框'
          ? '数字输入框用于输入和调整数值，支持步进、范围限制、精度和尺寸。'
        : activeComponent === 'Slider 滑块'
          ? '滑块用于在连续或离散区间内选择数值，支持单值、范围、刻度和提示。'
        : activeComponent === 'Switch 开关'
          ? '开关用于表示即时生效的二元状态，支持受控切换、文字和禁用状态。'
        : activeComponent === 'Form 表单'
          ? '表单用于组织字段、标签和提交操作，统一管理输入控件的布局与交互。'
        : activeComponent === 'Tree 树形控件'
          ? '树形控件用于展示具有层级关系的结构化数据，并支持展开、选中与复选。'
          : activeComponent === 'Icon 图标'
            ? '图标用于表达操作、状态和内容类型，统一从共享 Semi UI 包导出。'
            : activeComponent === 'Modal 对话框'
              ? '对话框用于承载需要用户确认或完成的任务，支持确认、取消和关闭交互。'
              : activeComponent === 'Tooltip 文字提示'
                ? '文字提示用于补充说明，不承载复杂交互，鼠标移入后延迟显示。'
                : activeComponent === 'Progress 进度条'
                  ? '进度条用于展示操作的当前进度和状态，也可以表示任务或对象的完成度。'
                  : activeComponent === 'Spin 加载器'
                    ? '加载器用于告知用户内容正在加载，适用于时长不确定的异步操作。'
              : activeComponent === 'Toast 提示'
                      ? 'Toast 用于对用户操作提供及时反馈，支持信息、成功、警告、错误和手动关闭。'
                      : activeComponent === 'Popover 浮层'
                        ? 'Popover 用于展示与当前操作相关的补充内容，支持点击触发和自定义内容。'
                        : '下拉菜单用于承载一组可点击的操作项，默认通过点击触发。'
  const outlineItems: Array<[string, string]> = activeComponent === 'Button 按钮'
    ? [['如何引入', 'how-to'], ['按钮类型', 'button-types'], ['按钮主题', 'button-theme'], ['状态', 'button-states'], ['组合与浮层', 'button-overlays']]
    : activeComponent === 'Cascader 级联选择' || activeComponent === 'TreeSelect 树选择器'
      ? [['基本用法', 'selection-basic'], ['节点选中关系', 'selection-basic'], ['API 参考', 'selection-basic']]
      : activeComponent === 'Checkbox 复选框'
        ? [['基本用法', 'checkbox-basic'], ['选中与半选', 'checkbox-states'], ['禁用状态', 'checkbox-disabled'], ['API 参考', 'checkbox-basic']]
      : activeComponent === 'Input 输入框'
        ? [['基本用法', 'input-basic'], ['尺寸与状态', 'input-states'], ['API 参考', 'input-basic']]
      : activeComponent === 'InputNumber 数字输入框'
        ? [['基本用法', 'input-number-basic'], ['范围与尺寸', 'input-number-states'], ['API 参考', 'input-number-basic']]
      : activeComponent === 'Slider 滑块'
        ? [['基本用法', 'slider-basic'], ['范围与刻度', 'slider-states'], ['API 参考', 'slider-basic']]
      : activeComponent === 'Switch 开关'
        ? [['基本用法', 'switch-basic'], ['文字与禁用', 'switch-states'], ['API 参考', 'switch-basic']]
      : activeComponent === 'Form 表单'
        ? [['基本用法', 'form-basic'], ['字段状态', 'form-states'], ['API 参考', 'form-basic']]
      : activeComponent === 'Tree 树形控件'
        ? [['基本用法', 'tree-basic'], ['复选与半选', 'tree-basic'], ['选中与禁用', 'tree-basic'], ['API 参考', 'tree-basic']]
          : activeComponent === 'Icon 图标'
            ? [['图标列表', 'tree-icons'], ['基础使用', 'tree-icons-basic'], ['尺寸与状态', 'tree-icons-states'], ['颜色与双色图标', 'tree-icons-colors'], ['API 参考', 'tree-icons']]
          : activeComponent === 'Modal 对话框'
            ? [['基本用法', 'modal-basic'], ['按钮与内容状态', 'modal-states'], ['信息反馈状态', 'modal-methods'], ['API 参考', 'modal-basic']]
            : activeComponent === 'Progress 进度条'
              ? [['标准进度条', 'progress-basic'], ['圆形进度条', 'progress-circle'], ['自定义文本', 'progress-format']]
              : activeComponent === 'Spin 加载器'
                ? [['基本用法', 'spin-basic'], ['尺寸', 'spin-size'], ['包裹内容', 'spin-content']]
                : activeComponent === 'Toast 提示'
                  ? [['普通提示', 'toast-basic'], ['状态提示', 'toast-status'], ['手动关闭与堆叠', 'toast-control']]
                : activeComponent === 'Popover 浮层'
                  ? [['基本用法', 'popover-basic'], ['箭头与位置', 'popover-basic'], ['API 参考', 'popover-basic']]
                  : activeComponent === 'Dropdown 下拉框'
                    ? [['基本用法', 'dropdown-basic'], ['嵌套使用', 'dropdown-nested'], ['弹出位置', 'dropdown-position'], ['触发方式', 'dropdown-trigger'], ['触发事件', 'dropdown-events'], ['JSON 用法', 'dropdown-json'], ['API 参考', 'dropdown-api']]
                    : [['基本用法', 'tooltip-basic'], ['API 参考', 'tooltip-basic']]
  const openModal = (demo: ModalDemo): void => {
    setModalDemo(demo)
    setModalVisible(true)
  }
  const closeModal = (): void => { setModalVisible(false) }
  const modalBody = modalDemo === 'styled'
    ? <div className="dsh-semi-showcase-modal-scroll"><p>Modal 的内容区域可以独立滚动，不会改变页面上下文。</p><p>这是与官方示例一致的 bodyStyle 场景，用于验证长内容、背景、文字和滚动条的主题状态。</p><p>DSH 的主题变量会同时作用于 Modal 表面、边框、遮罩和按钮。</p></div>
    : modalDemo === 'customFooter'
      ? <div><p>自定义页脚只保留明确的操作，适合需要额外说明的对话框。</p><p className="dsh-semi-showcase-secondary-text">页脚由调用方渲染。</p></div>
      : <div><p>{modalDemo === 'mask' ? '点击遮罩层不会关闭当前对话框。' : '这是一个受控 Modal，用于验证标题、内容、关闭按钮和确认/取消操作。'}</p><p className="dsh-semi-showcase-secondary-text">点击确认或取消返回预览页面。</p></div>
  const modalFooter = <div className="dsh-semi-showcase-modal-footer"><DshButton type="secondary" theme="light" onClick={closeModal}>了解更多</DshButton><DshButton type="primary" theme="solid" onClick={closeModal}>继续</DshButton></div>
  return (
    <main className={page} data-dsh-semi-ui-showcase>
      <header className={topbar}>
        <div className="dsh-semi-showcase-brand-wrap">
          <DshIconButton type="tertiary" theme="borderless" aria-label="返回" icon={<DshIconArrowLeft />} onClick={() => { route.close() }} />
          <div className={brand}>DSH Semi UI</div>
        </div>
        <nav className={topnav} aria-label="总览导航">
          <button type="button" className={topnavItem} onClick={() => { route.select('button') }}>组件</button>
        </nav>
        <div className="dsh-semi-showcase-theme-actions">
          <DshTooltip content={themeToggleLabel} trigger="hover">
            <DshIconButton type="tertiary" theme="light" aria-label={themeToggleLabel} icon={<ThemeIcon />} onClick={() => { theme.setPreference(nextTheme) }} />
          </DshTooltip>
        </div>
      </header>
      <div className={shell}>
        <aside className={sidebar} aria-label="组件导航">
          {sidebarGroups.map(group => (
            <div key={group.title} className={sidebarGroup}>
              <div className={sidebarTitle}>{group.title}</div>
              {group.items.map(({ icon: Icon, label }) => <button key={label} type="button" className={`${sidebarItem}${activeComponent === label ? ' is-active' : ''}`} onClick={() => { route.select(componentRouteByLabel[label]) }}><span className="dsh-semi-showcase-sidebar-icon"><Icon aria-hidden /></span>{label}</button>)}
            </div>
          ))}
        </aside>
        <section className={main}>
          <div className={mainInner}>
            <div className={breadcrumb}>组件 · {categoryTitle}</div>
            <h1 className={heading}>{categoryTitle}</h1>
            <p className={description}>{categoryDescription}</p>

            {category === 'buttons' && activeComponent === 'Button 按钮' ? (
              <>
                <h2 id="how-to" className={sectionTitle}>如何引入</h2>
                <DemoCard source={"import { Button } from '@tnnevol/dsh-semi-ui'\n\n<DshButton type=\"primary\">主要按钮</DshButton>"}><DshButton type="primary" theme="solid">主要按钮</DshButton></DemoCard>
                <h2 id="button-types" className={sectionTitle}>按钮类型</h2>
                <p className={sectionText}>按钮类型用于表达操作的重要程度。</p>
                <DemoCard source={'<DshButton type="primary">主要</DshButton>\n<DshButton type="secondary">次要</DshButton>\n<DshButton type="warning">警告</DshButton>'}><div className={demo}>{buttonTypes.map(([type, label]) => <DshButton key={type} type={type} theme="solid">{label}</DshButton>)}</div></DemoCard>
                <h2 id="button-theme" className={sectionTitle}>按钮主题与尺寸</h2>
                <p className={sectionText}>主题控制按钮的视觉层级，尺寸适用于不同密度的页面。</p>
                <DemoCard source={'type: primary | secondary | tertiary | warning | danger\ntheme: solid | light | outline | borderless'}><div className={stack}>{buttonThemes.map(themeName => <div key={themeName} className={demoBlock}><span className={demoLabel}>{themeName}</span><div className={demo}>{buttonTypes.map(([type, label]) => <DshButton key={`${themeName}-${type}`} type={type} theme={themeName} size="small">{label}</DshButton>)}</div></div>)}<div className={demo}><span className={demoLabel}>size</span>{buttonSizes.map(size => <DshButton key={size} type="secondary" theme="light" size={size}>{size}</DshButton>)}</div></div></DemoCard>
                <h2 id="button-states" className={sectionTitle}>按钮状态</h2>
                <p className={sectionText}>加载、禁用、块级和图标按钮均使用共享主题 Token。</p>
                <DemoCard source={'<DshButton loading={loading}>保存</DshButton>\n<DshButton disabled>禁用</DshButton>\n<DshButton icon={<DshIconSetting />}>设置</DshButton>'}><div className={stack}><div className={demo}><DshButton type="primary" theme="solid" loading={buttonLoading}>保存</DshButton><DshButton type="secondary" theme="light" onClick={() => { setButtonLoading(value => !value) }}>{buttonLoading ? '关闭加载态' : '开启加载态'}</DshButton><DshButton type="secondary" theme="solid" disabled>禁用</DshButton><DshButton type="danger" theme="outline" disabled>禁用描边</DshButton><DshButton type="primary" theme="solid" block className="dsh-semi-showcase-block-button">块级按钮</DshButton></div><div className={demo}><DshButton type="primary" theme="solid" icon={<DshIconSetting />}>设置</DshButton><DshButton type="secondary" theme="light" icon={<DshIconRefresh />} iconPosition="right">刷新</DshButton><DshIconButton type="primary" theme="solid" icon={<DshIconSetting />} aria-label="设置" /><DshIconButton type="secondary" theme="light" icon={<DshIconClose />} aria-label="关闭" disabled /></div></div></DemoCard>
                <h2 id="button-overlays" className={sectionTitle}>按钮组合与浮层</h2>
                <DemoCard source={'<DshButtonGroup>...</DshButtonGroup>\n<DshTooltip content="提示">...</DshTooltip>\n<DshDropdown trigger="click">...</DshDropdown>'}><div className={demo}><DshButtonGroup type="primary" theme="solid" aria-label="操作按钮组"><DshButton>保存</DshButton><DshButton>继续</DshButton><DshButton>更多</DshButton></DshButtonGroup><DshButtonGroup type="secondary" theme="light" size="small" aria-label="辅助操作按钮组"><DshButton>上一项</DshButton><DshButton>下一项</DshButton></DshButtonGroup><DshTooltip content="Tooltip 默认浮层，鼠标悬停查看"><DshButton type="secondary" theme="light">Tooltip</DshButton></DshTooltip><DshDropdown trigger="click" render={dropdownMenu}><DshButton type="secondary" theme="light">Dropdown</DshButton></DshDropdown></div></DemoCard>
              </>
            ) : null}

            {activeComponent === 'Tooltip 文字提示' ? (
              <>
                <h2 id="tooltip-basic" className={sectionTitle}>基本用法</h2>
                <p className={sectionText}>鼠标悬停查看提示，并使用 DSH 的浮层背景与文字变量。</p>
                <DemoCard source={'<DshTooltip content="Tooltip 默认浮层">\n  <DshButton>悬停查看</DshButton>\n</DshTooltip>'}><DshTooltip content="Tooltip 默认浮层，鼠标悬停查看"><DshButton type="secondary" theme="light">悬停查看</DshButton></DshTooltip></DemoCard>
              </>
            ) : null}

            {activeComponent === 'Dropdown 下拉框' ? (
              <>
                <h2 id="dropdown-basic" className={sectionTitle}>基本用法</h2>
                <p className={sectionText}>Dropdown 默认通过悬停触发，也可以使用点击、聚焦或右键触发。菜单由 Menu、Title、Item 和 Divider 组合而成。</p>
                <DemoCard source={'<DshDropdown showTick position="bottomLeft" render={\n  <DshDropdown.Menu>\n    <DshDropdown.Title>工作区</DshDropdown.Title>\n    <DshDropdown.Item icon={<DshIconFolder />}>插件</DshDropdown.Item>\n    <DshDropdown.Item disabled>应用</DshDropdown.Item>\n    <DshDropdown.Divider />\n    <DshDropdown.Item type="danger">删除</DshDropdown.Item>\n  </DshDropdown.Menu>\n}>\n  <DshButton>打开菜单</DshButton>\n</DshDropdown>'}>
                  <DshDropdown trigger="click" showTick position="bottomLeft" render={dropdownMenu}>
                    <DshButton type="secondary" theme="light" icon={<DshIconChevronDown />}>打开菜单</DshButton>
                  </DshDropdown>
                </DemoCard>

                <h2 id="dropdown-nested" className={sectionTitle}>嵌套使用</h2>
                <p className={sectionText}>嵌套 Dropdown 适合承载多级操作，子菜单可以从父菜单项的右侧展开。</p>
                <DemoCard source={'<DshDropdown render={\n  <DshDropdown.Menu>\n    <DshDropdown position="rightTop" render={subMenu}>\n      <DshDropdown.Item>导出</DshDropdown.Item>\n    </DshDropdown>\n  </DshDropdown.Menu>\n}>...</DshDropdown>'}>
                  <DshDropdown render={<DshDropdown.Menu><DshDropdown position="rightTop" trigger="hover" render={nestedDropdownMenu}><DshDropdown.Item icon={<DshIconFolderOpen />}>导出</DshDropdown.Item></DshDropdown><DshDropdown.Item>重命名</DshDropdown.Item><DshDropdown.Item disabled>移动到（禁用）</DshDropdown.Item></DshDropdown.Menu>}>
                    <DshButton type="secondary" theme="light">打开多级菜单</DshButton>
                  </DshDropdown>
                </DemoCard>

                <h2 id="dropdown-position" className={sectionTitle}>弹出位置</h2>
                <p className={sectionText}>使用 `position` 调整菜单相对触发器的方向，常用位置包括 bottom、bottomLeft 和 bottomRight。</p>
                <DemoCard source={'<DshDropdown position="bottom" />\n<DshDropdown position="bottomLeft" />\n<DshDropdown position="bottomRight" />'}>
                  <div className={demo}>
                    <DshDropdown trigger="click" position="bottom" render={dropdownSimpleMenu}><DshButton type="secondary" theme="light">bottom</DshButton></DshDropdown>
                    <DshDropdown trigger="click" position="bottomLeft" render={dropdownSimpleMenu}><DshButton type="secondary" theme="light">bottomLeft</DshButton></DshDropdown>
                    <DshDropdown trigger="click" position="bottomRight" render={dropdownSimpleMenu}><DshButton type="secondary" theme="light">bottomRight</DshButton></DshDropdown>
                  </div>
                </DemoCard>

                <h2 id="dropdown-trigger" className={sectionTitle}>触发方式</h2>
                <p className={sectionText}>官方 Dropdown 支持 hover、focus、click、custom 和 contextMenu 五种触发方式。</p>
                <DemoCard source={'<DshDropdown trigger="hover" />\n<DshDropdown trigger="focus" />\n<DshDropdown trigger="click" />\n<DshDropdown trigger="custom" visible={visible} />\n<DshDropdown trigger="contextMenu" />'}>
                  <div className={demo}>
                    <DshDropdown trigger="hover" render={dropdownSimpleMenu}><DshButton type="secondary" theme="light">Hover</DshButton></DshDropdown>
                    <DshDropdown trigger="focus" render={dropdownSimpleMenu}><DshButton type="secondary" theme="light">Focus</DshButton></DshDropdown>
                    <DshDropdown trigger="click" render={dropdownSimpleMenu}><DshButton type="secondary" theme="light">Click</DshButton></DshDropdown>
                    <DshDropdown trigger="custom" visible={dropdownCustomVisible} onVisibleChange={setDropdownCustomVisible} render={dropdownSimpleMenu}><DshButton type="secondary" theme="light" onClick={() => { setDropdownCustomVisible(value => !value) }}>Custom</DshButton></DshDropdown>
                    <DshDropdown trigger="contextMenu" position="bottomRight" render={dropdownSimpleMenu}><DshButton type="secondary" theme="light">右键打开</DshButton></DshDropdown>
                  </div>
                </DemoCard>

                <h2 id="dropdown-events" className={sectionTitle}>触发事件</h2>
                <p className={sectionText}>菜单项支持 onClick、onMouseEnter、onMouseLeave 和 onContextMenu 事件，当前事件会显示在示例下方。</p>
                <DemoCard source={'<DshDropdown.Item onClick={handleClick}>点击事件</DshDropdown.Item>\n<DshDropdown.Item onMouseEnter={handleEnter}>移入事件</DshDropdown.Item>\n<DshDropdown.Item onContextMenu={handleContextMenu}>右键事件</DshDropdown.Item>'}>
                  <div className={stack}>
                    <DshDropdown trigger="click" position="bottomLeft" render={dropdownEventMenu}><DshButton type="secondary" theme="light">打开事件菜单</DshButton></DshDropdown>
                    <span className="dsh-semi-showcase-event-status" role="status">{dropdownEvent}</span>
                  </div>
                </DemoCard>

                <h2 id="dropdown-json" className={sectionTitle}>JSON 用法</h2>
                <p className={sectionText}>简单菜单可以通过 `menu` 数组快速配置标题、菜单项、分隔线、图标、类型和激活态。</p>
                <DemoCard source={'const menu = [\n  { node: "title", name: "快捷操作" },\n  { node: "item", name: "新建文件", type: "primary", active: true },\n  { node: "divider" },\n  { node: "item", name: "清理缓存", type: "danger" },\n]\n<DshDropdown menu={menu} showTick />'}>
                  <DshDropdown trigger="click" showTick position="bottomLeft" menu={dropdownJsonMenu}><DshButton type="secondary" theme="light">打开 JSON 菜单</DshButton></DshDropdown>
                </DemoCard>

                <h2 id="dropdown-api" className={sectionTitle}>API 参考</h2>
                <p className={sectionText}>以下是本页覆盖的核心属性和组合组件，完整 API 以 Semi 官方文档为准。</p>
                <div className={dropdownApiTable} role="table" aria-label="Dropdown API 参考">
                  <strong className={`${dropdownApiCell} dsh-semi-showcase-dropdown-api-header`}>属性</strong><strong className={`${dropdownApiCell} dsh-semi-showcase-dropdown-api-header`}>用途</strong><strong className={`${dropdownApiCell} dsh-semi-showcase-dropdown-api-header`}>示例</strong>
                  <span className={dropdownApiCell}>trigger</span><span className={dropdownApiCell}>控制菜单的触发方式</span><code className={dropdownApiCell}>hover / focus / click / contextMenu</code>
                  <span className={dropdownApiCell}>render / menu</span><span className={dropdownApiCell}>提供 React 菜单或 JSON 菜单</span><code className={dropdownApiCell}>DshDropdown.Menu</code>
                  <span className={dropdownApiCell}>position</span><span className={dropdownApiCell}>调整浮层相对触发器的位置</span><code className={dropdownApiCell}>bottomLeft</code>
                  <span className={dropdownApiCell}>showTick</span><span className={dropdownApiCell}>为 active 菜单项显示选中标记</span><code className={dropdownApiCell}>true</code>
                </div>
              </>
            ) : null}

            {activeComponent === 'Popover 浮层' ? (
              <>
                <h2 id="popover-basic" className={sectionTitle}>基本用法</h2>
                <p className={sectionText}>Popover 用于展示补充信息或轻量交互内容，点击触发后不会影响当前页面上下文。</p>
                <DemoCard source={'<DshPopover trigger="click" content={content}>\n  <DshButton>打开 Popover</DshButton>\n</DshPopover>'}><DshPopover trigger="click" position="top" showArrow content={popoverContent}><DshButton type="secondary" theme="light">打开 Popover</DshButton></DshPopover></DemoCard>
                <h2 className={sectionTitle}>箭头与位置</h2>
                <p className={sectionText}>使用 `position` 和 `showArrow` 控制浮层定位与指向，内容由 Popover 的 `content` 属性提供。</p>
                <DemoCard source={'<DshPopover position="right" showArrow content="右侧内容">\n  <DshButton>右侧打开</DshButton>\n</DshPopover>'}><div className={demo}><DshPopover trigger="click" position="right" showArrow content={<span>右侧 Popover 内容</span>}><DshButton type="secondary" theme="light">右侧打开</DshButton></DshPopover><DshPopover trigger="hover" position="bottomLeft" content={<span>悬停显示内容</span>}><DshButton type="secondary" theme="light">悬停打开</DshButton></DshPopover></div></DemoCard>
              </>
            ) : null}

            {activeComponent === 'Progress 进度条' ? (
              <>
                <h2 id="progress-basic" className={sectionTitle}>标准进度条</h2>
                <p className={sectionText}>通过 `percent` 控制完成度，通过 `stroke`、`size` 和 `showInfo` 调整展示状态。</p>
                <DemoCard source={'<DshProgress percent={10} />\n<DshProgress percent={50} />\n<DshProgress percent={80} size="large" />'}><div className="dsh-semi-showcase-stack dsh-semi-showcase-progress-stack"><DshProgress percent={10} aria-label="10%" /><DshProgress percent={50} aria-label="50%" /><DshProgress percent={80} size="large" aria-label="80%" /><DshProgress percent={65} stroke="var(--dsw-alias-state-warn-primary)" aria-label="65% warning" /></div></DemoCard>
                <h2 id="progress-circle" className={sectionTitle}>圆形进度条</h2>
                <DemoCard source={'<DshProgress type="circle" percent={50} />'}><div className={demo}><DshProgress type="circle" percent={25} aria-label="25%" /><DshProgress type="circle" percent={50} aria-label="50%" /><DshProgress type="circle" percent={75} size="large" aria-label="75%" /></div></DemoCard>
                <h2 id="progress-format" className={sectionTitle}>自定义文本</h2>
                <DemoCard source={'<DshProgress percent={80} format={percent => `${percent} / 100`} />'}><DshProgress percent={80} showInfo format={(percent: number) => `${percent} / 100`} aria-label="80 / 100" /></DemoCard>
              </>
            ) : null}

            {activeComponent === 'Spin 加载器' ? (
              <>
                <h2 id="spin-basic" className={sectionTitle}>基本用法</h2>
                <p className={sectionText}>Spin 用于展示不确定时长的加载过程，支持延迟、提示文本和自定义指示器。</p>
                <DemoCard source={'<DshSpin />'}><div className="dsh-semi-showcase-demo dsh-semi-showcase-spin-demo"><DshSpin size="small" /><DshSpin size="middle" /><DshSpin size="large" /></div></DemoCard>
                <h2 id="spin-size" className={sectionTitle}>尺寸</h2>
                <DemoCard source={'<DshSpin size="small" />\n<DshSpin size="middle" />\n<DshSpin size="large" />'}><div className={stack}><div className={demo}><DshSpin size="small" /><span className={demoLabel}>small</span><DshSpin size="middle" /><span className={demoLabel}>middle</span><DshSpin size="large" /><span className={demoLabel}>large</span></div></div></DemoCard>
                <h2 id="spin-content" className={sectionTitle}>包裹内容</h2>
                <DemoCard source={'<DshSpin tip="加载中...">\n  <div>需要等待的内容</div>\n</DshSpin>'}><DshSpin tip="加载中..."><div className="dsh-semi-showcase-spin-content">需要等待的内容</div></DshSpin></DemoCard>
              </>
            ) : null}

            {activeComponent === 'Toast 提示' ? (
              <>
                <h2 id="toast-basic" className={sectionTitle}>普通提示</h2>
                <p className={sectionText}>Toast 使用命令式 API 及时反馈操作结果，浮层样式由共享 DSH 主题统一管理。</p>
                <DemoCard source={'DshToast.info({ content: "这是一条提示" })'}><div className={demo}><DshButton type="secondary" theme="light" onClick={() => { toastApi.info({ content: '这是一条普通提示', duration: 3 }) }}>普通提示</DshButton></div></DemoCard>
                <h2 id="toast-status" className={sectionTitle}>状态提示</h2>
                <DemoCard source={'DshToast.success({ content: "操作成功" })\nDshToast.warning({ content: "请注意" })\nDshToast.error({ content: "操作失败" })'}><div className={demo}><DshButton type="primary" theme="light" onClick={() => { toastApi.info({ content: '信息提示', duration: 3 }) }}>信息</DshButton><DshButton type="secondary" theme="light" onClick={() => { toastApi.success({ content: '操作成功', duration: 3 }) }}>成功</DshButton><DshButton type="warning" theme="light" onClick={() => { toastApi.warning({ content: '请注意当前状态', duration: 3 }) }}>警告</DshButton><DshButton type="danger" theme="light" onClick={() => { toastApi.error({ content: '操作失败', duration: 3 }) }}>错误</DshButton></div></DemoCard>
                <h2 id="toast-control" className={sectionTitle}>手动关闭与堆叠</h2>
                <DemoCard source={'const id = DshToast.info({ content: "不会自动关闭", duration: 0 })\nDshToast.close(id)'}><div className={demo}><DshButton type="secondary" theme="light" onClick={() => { setToastId(toastApi.info({ content: '这条提示需要手动关闭', duration: 0 })) }}>手动打开</DshButton><DshButton type="secondary" theme="light" disabled={toastId === undefined} onClick={() => { if (toastId !== undefined) { DshToast.close(toastId); setToastId(undefined) } }}>关闭 Toast</DshButton><DshButton type="secondary" theme="light" onClick={() => { toastApi.info({ content: '堆叠提示 1', duration: 5, stack: true }); toastApi.success({ content: '堆叠提示 2', duration: 5, stack: true }); toastApi.warning({ content: '堆叠提示 3', duration: 5, stack: true }) }}>显示堆叠</DshButton></div></DemoCard>
              </>
            ) : null}

            {category === 'input' && activeComponent === 'Input 输入框' ? (
              <>
                <h2 id="input-basic" className={sectionTitle}>基本用法</h2>
                <p className={sectionText}>输入框支持受控值、清除按钮和占位提示，输入内容会实时同步到示例。</p>
                <DemoCard source={'<Input value={value} onChange={setValue} showClear placeholder="请输入内容" />'}>
                  <DshInput className="dsh-semi-showcase-control" value={inputValue} onChange={setInputValue} showClear placeholder="请输入内容" />
                </DemoCard>
                <h2 id="input-states" className={sectionTitle}>尺寸与状态</h2>
                <p className={sectionText}>通过 `size`、`validateStatus` 和 `disabled` 展示常见的输入状态。</p>
                <DemoCard source={`<Input size="small" />
<Input validateStatus="error" />
<Input disabled value="不可编辑" />`}>
                  <div className={stack}>
                    <DshInput className="dsh-semi-showcase-control" size="small" placeholder="小尺寸" />
                    <DshInput className="dsh-semi-showcase-control" validateStatus="error" value="校验失败" readOnly />
                    <DshInput className="dsh-semi-showcase-control" disabled value="不可编辑" />
                  </div>
                </DemoCard>
              </>
            ) : null}

            {category === 'input' && activeComponent === 'InputNumber 数字输入框' ? (
              <>
                <h2 id="input-number-basic" className={sectionTitle}>基本用法</h2>
                <p className={sectionText}>数字输入框支持键盘输入和步进按钮，当前值为 {String(inputNumberValue)}。</p>
                <DemoCard source={'<InputNumber value={value} onChange={setValue} step={1} />'}>
                  <DshInputNumber className="dsh-semi-showcase-control" value={inputNumberValue} onChange={setInputNumberValue} step={1} />
                </DemoCard>
                <h2 id="input-number-states" className={sectionTitle}>范围与尺寸</h2>
                <p className={sectionText}>使用 `min`、`max` 和 `size` 限制输入范围并适配不同密度。</p>
                <DemoCard source={`<InputNumber min={0} max={100} size="small" />
<InputNumber disabled value={50} />`}>
                  <div className={stack}>
                    <DshInputNumber className="dsh-semi-showcase-control" min={0} max={100} size="small" defaultValue={50} />
                    <DshInputNumber className="dsh-semi-showcase-control" disabled value={50} />
                  </div>
                </DemoCard>
              </>
            ) : null}

            {category === 'input' && activeComponent === 'Slider 滑块' ? (
              <>
                <h2 id="slider-basic" className={sectionTitle}>基本用法</h2>
                <p className={sectionText}>滑动选择一个数值，当前值为 {sliderValue}。</p>
                <DemoCard source={'<Slider value={value} onChange={setValue} step={1} />'}>
                  <div className="dsh-semi-showcase-slider">
                    <DshSlider value={sliderValue} onChange={(value: number | [number, number]) => { if (typeof value === 'number') setSliderValue(value) }} />
                  </div>
                </DemoCard>
                <h2 id="slider-states" className={sectionTitle}>范围与刻度</h2>
                <p className={sectionText}>`range` 用于选择区间，`marks` 用于标记关键位置。</p>
                <DemoCard source={'<Slider range defaultValue={[20, 80]} marks={{ 0: "0", 50: "50", 100: "100" }} />'}>
                  <div className="dsh-semi-showcase-slider">
                    <DshSlider range defaultValue={[20, 80]} marks={{ 0: '0', 50: '50', 100: '100' }} />
                  </div>
                </DemoCard>
              </>
            ) : null}

            {category === 'input' && activeComponent === 'Switch 开关' ? (
              <>
                <h2 id="switch-basic" className={sectionTitle}>基本用法</h2>
                <p className={sectionText}>开关是受控组件，点击后会立即更新当前状态。</p>
                <DemoCard source={'<Switch checked={checked} onChange={setChecked} />'}>
                  <div className={demo}>
                    <DshSwitch checked={switchChecked} onChange={setSwitchChecked} aria-label="启用状态" />
                    <span className={demoLabel}>{switchChecked ? '已开启' : '已关闭'}</span>
                  </div>
                </DemoCard>
                <h2 id="switch-states" className={sectionTitle}>文字与禁用</h2>
                <p className={sectionText}>通过 `checkedText`、`uncheckedText` 和 `disabled` 表达更明确的状态。</p>
                <DemoCard source={`<Switch checkedText="开" uncheckedText="关" />
<Switch disabled checked />`}>
                  <div className={demo}>
                    <DshSwitch defaultChecked checkedText="开" uncheckedText="关" />
                    <DshSwitch disabled defaultChecked />
                  </div>
                </DemoCard>
              </>
            ) : null}

            {category === 'input' && activeComponent === 'Form 表单' ? (
              <>
                <h2 id="form-basic" className={sectionTitle}>基本用法</h2>
                <p className={sectionText}>Form 通过 Slot 组织标签和控件，适合展示额度、偏好等配置型表单。</p>
                <DemoCard source={`<Form labelPosition="left">
  <Form.Slot label="显示额度余量"><Switch checked={showUsage} /></Form.Slot>
  <Form.Slot label="自定义额度上限"><InputNumber placeholder="使用默认" /></Form.Slot>
  <Form.Slot label="余量告警百分比"><Slider value={percentage} /></Form.Slot>
</Form>`}>
                  <DshForm className="dsh-semi-showcase-form" labelPosition="left">
                    <DshForm.Slot label={<span className="dsh-semi-showcase-form-preference-label"><strong>显示额度余量</strong><span>在侧边栏底部设置按钮上方显示已用额度进度。</span></span>}>
                      <DshSwitch checked={showUsage} onChange={setShowUsage} aria-label="显示额度余量" />
                    </DshForm.Slot>
                    <DshForm.Slot label={<span className="dsh-semi-showcase-form-preference-label"><strong>自定义额度上限</strong><span>覆盖服务端上报的总量，按此值计算已用百分比。</span></span>}>
                      <DshInputNumber className="dsh-semi-showcase-control" placeholder="使用默认" />
                    </DshForm.Slot>
                    <DshForm.Slot label={<span className="dsh-semi-showcase-form-preference-label"><strong>余量告警百分比</strong><span>已用百分比达到此值时，进度条变为红色提醒。</span></span>}>
                      <div className="dsh-semi-showcase-form-slider">
                        <DshSlider value={dangerPercentage} onChange={(value: number | [number, number]) => { if (typeof value === 'number') setDangerPercentage(value) }} />
                        <span className="dsh-semi-showcase-form-slider-value">{dangerPercentage}%</span>
                      </div>
                    </DshForm.Slot>
                  </DshForm>
                </DemoCard>
                <h2 id="form-states" className={sectionTitle}>字段状态</h2>
                <p className={sectionText}>表单字段可以组合控件自身的校验、禁用和辅助说明状态。</p>
                <DemoCard source={`<Form.Slot label="邮箱" error={{ helpText: "请输入有效邮箱" }}><Form.Input validateStatus="error" initValue="invalid" /></Form.Slot>
<Form.Slot label="只读"><Form.Input disabled initValue="系统生成" /></Form.Slot>`}>
                  <DshForm className="dsh-semi-showcase-form">
                    <DshForm.Slot label="邮箱" error={{ helpText: '请输入有效邮箱' }}><DshForm.Input field="email" validateStatus="error" initValue="invalid" /></DshForm.Slot>
                    <DshForm.Slot label="只读"><DshForm.Input field="generated" disabled initValue="系统生成" /></DshForm.Slot>
                  </DshForm>
                </DemoCard>
              </>
            ) : null}

            {category === 'selection' && activeComponent === 'Cascader 级联选择' ? (
              <>
                <h2 id="selection-basic" className={sectionTitle}>基本用法</h2>
                <p className={sectionText}>展示默认、已选择、多选、搜索、禁用和错误校验状态。Cascader 的重点是完整路径，默认只允许选择叶子节点。</p>
                <DemoCard source={'<DshCascader treeData={data} multiple />\n<DshCascader treeData={data} filterTreeNode />'}><div className={demo}>{['默认状态', '已选择', '多选', '可搜索', '搜索全部节点', '禁用', '错误状态'].map((placeholder, index) => <DshCascader key={placeholder} className="dsh-semi-showcase-select" treeData={cascaderData} {...(index === 1 ? { defaultValue: ['model', 'luna'] } : {})} {...(index === 2 ? { multiple: true, defaultValue: ['model', 'sol'] } : {})} {...(index === 3 || index === 4 ? { filterTreeNode: true } : {})} {...(index === 4 ? { filterLeafOnly: false } : {})} {...(index === 5 ? { disabled: true } : {})} {...(index === 6 ? { validateStatus: 'error' as const } : {})} placeholder={placeholder} size="small" />)}</div></DemoCard>
              </>
            ) : null}

            {category === 'selection' && activeComponent === 'TreeSelect 树选择器' ? (
              <>
                <h2 id="selection-basic" className={sectionTitle}>基本用法</h2>
                <p className={sectionText}>展示默认、多选、叶子节点、标签折叠、搜索、禁用和成功校验状态。节点关系使用 Semi 的 checkRelation 属性。</p>
                <DemoCard source={'<DshTreeSelect treeData={data} multiple />\n<DshTreeSelect treeData={data} multiple leafOnly />\n<DshTreeSelect treeData={data} filterTreeNode />'}><div className={demo}>{['默认状态', '多选与复选', '只显示叶子节点', '标签折叠', '可搜索', '禁用', '成功状态'].map((placeholder, index) => <DshTreeSelect key={placeholder} className="dsh-semi-showcase-select" treeData={treeData} showLine={false} {...(index === 1 ? { multiple: true, treeCheckable: true, checkRelation: 'related' as const, defaultValue: ['plugins'] } : {})} {...(index === 2 ? { multiple: true, leafOnly: true, defaultValue: ['plugins'] } : {})} {...(index === 3 ? { multiple: true, maxTagCount: 1, defaultValue: ['plugins', 'apps'] } : {})} {...(index === 4 ? { filterTreeNode: true } : {})} {...(index === 5 ? { disabled: true } : {})} {...(index === 6 ? { validateStatus: 'success' as const } : {})} placeholder={placeholder} size="small" />)}</div></DemoCard>
              </>
            ) : null}

            {category === 'selection' && activeComponent === 'Checkbox 复选框' ? (
              <>
                <h2 id="checkbox-basic" className={sectionTitle}>基本用法</h2>
                <p className={sectionText}>复选框用于表示选中或未选中的状态，点击示例可以实时切换。</p>
                <DemoCard source={'<DshCheckbox checked={checked} onChange={onChange}>可选项</DshCheckbox>'}>
                  <div className={demo}>
                    <DshCheckbox checked={checkboxChecked} onChange={() => { setCheckboxChecked(value => !value) }}>可选项</DshCheckbox>
                    <DshCheckbox checked>默认选中</DshCheckbox>
                  </div>
                </DemoCard>
                <h2 id="checkbox-states" className={sectionTitle}>选中与半选</h2>
                <p className={sectionText}>使用 `checked` 和 `indeterminate` 展示选择状态。</p>
                <DemoCard source={'<DshCheckbox checked>选中</DshCheckbox>\n<DshCheckbox indeterminate>半选</DshCheckbox>'}>
                  <div className={demo}>
                    <DshCheckbox checked>选中</DshCheckbox>
                    <DshCheckbox indeterminate>半选</DshCheckbox>
                    <DshCheckbox>未选中</DshCheckbox>
                  </div>
                </DemoCard>
                <h2 id="checkbox-disabled" className={sectionTitle}>禁用状态</h2>
                <p className={sectionText}>禁用状态不可交互，并使用共享主题中的禁用颜色。</p>
                <DemoCard source={'<DshCheckbox disabled>禁用</DshCheckbox>\n<DshCheckbox disabled checked>禁用且选中</DshCheckbox>'}>
                  <div className={demo}>
                    <DshCheckbox disabled>禁用</DshCheckbox>
                    <DshCheckbox disabled checked>禁用且选中</DshCheckbox>
                  </div>
                </DemoCard>
              </>
            ) : null}

            {category === 'tree' && activeComponent === 'Tree 树形控件' ? (
              <>
                <h2 id="tree-basic" className={sectionTitle}>基本用法</h2>
                <p className={sectionText}>展示基本用法、多选、搜索、整行高亮、选中、半选和禁用状态。</p>
                <DemoCard source={'<DshTree treeData={treeData} defaultExpandAll />\n<DshTree treeData={treeData} multiple filterTreeNode />'}><div className={stack}><div className={demoBlock}><span className={demoLabel}>基本用法与整行高亮</span><DshTree treeData={treeData} defaultExpandAll className="dsh-semi-showcase-tree" /></div><div className={demoBlock}><span className={demoLabel}>复选与半选状态</span><DshTree treeData={treeData} multiple defaultValue={['plugins']} defaultExpandAll showLine blockNode className="dsh-semi-showcase-tree" aria-label="Tree 复选示例" /></div><div className={demoBlock}><span className={demoLabel}>搜索与标签高亮</span><DshTree treeData={treeData} multiple filterTreeNode defaultExpandAll blockNode className="dsh-semi-showcase-tree" aria-label="Tree 搜索示例" /></div><div className={demoBlock}><span className={demoLabel}>选中与禁用状态</span><DshTree treeData={disabledTreeData} defaultValue="plugins" defaultExpandAll blockNode className="dsh-semi-showcase-tree" aria-label="Tree 选中示例" /></div></div></DemoCard>
              </>
            ) : null}

            {category === 'tree' && activeComponent === 'Icon 图标' ? (
              <>
                <h2 id="tree-icons" className={sectionTitle}>图标列表</h2>
                <p className={sectionText}>与 Semi 官方 Icon 文档一致，完整展示 `@douyinfe/semi-icons` 的面性、线性和 AI 图标，并按图标类型筛选。</p>
                <DemoCard source={'import * as Icons from \'@douyinfe/semi-icons\'\n\n<IconHome size="large" />'}><div className={stack}><div className={demo}>{iconModes.map(([mode, label]) => <DshButton key={mode} type={iconMode === mode ? 'primary' : 'secondary'} theme={iconMode === mode ? 'solid' : 'light'} size="small" onClick={() => { setIconMode(mode) }}>{label}</DshButton>)}</div><div className={iconGrid}>{iconCatalog.filter(icon => iconMode === 'all' || icon.group === iconMode).map(({ name, Icon }) => <div key={name} className={iconTile}><Icon aria-label={name} size="large" /><span className={iconTileLabel} title={name}>{name}</span></div>)}</div></div></DemoCard>
                <h2 id="tree-icons-basic" className={sectionTitle}>基础使用</h2>
                <p className={sectionText}>图标颜色继承 DSH 的文本和状态变量，名称与官方 Icon 组件保持一致。</p>
                <DemoCard source={'<DshIconFolder /> <DshIconFolderOpen />\n<DshIconFile /> <DshIconSetting />'}><div className="dsh-semi-showcase-demo dsh-semi-showcase-icon-row dsh-semi-showcase-icon-row--small"><DshIconFolder aria-label="文件夹" /><DshIconFolderOpen aria-label="打开的文件夹" /><DshIconFile aria-label="文件" /><DshIconSetting aria-label="设置" /><DshIconRefresh aria-label="刷新" /><DshIconRestart aria-label="重启" /></div></DemoCard>
                <h2 id="tree-icons-states" className={sectionTitle}>尺寸与状态</h2>
                <p className={sectionText}>按照官方文档展示尺寸、旋转和加载状态。</p>
                <DemoCard source={'<DshIconRefresh size="extra-small" />\n<DshIconRefresh rotate={180} />\n<DshIconRefresh spin />'}><div className="dsh-semi-showcase-demo dsh-semi-showcase-icon-row dsh-semi-showcase-icon-row--small"><DshIconRefresh size="extra-small" aria-label="超小" /><DshIconRefresh size="small" aria-label="小" /><DshIconRefresh size="default" aria-label="默认" /><DshIconRefresh size="large" aria-label="大" /><DshIconRefresh size="extra-large" aria-label="超大" /><DshIconRefresh rotate={180} aria-label="旋转" /><DshIconRefresh spin aria-label="加载" /></div></DemoCard>
                <h2 id="tree-icons-colors" className={sectionTitle}>颜色与双色图标</h2>
                <p className={sectionText}>颜色由组件属性控制，双色图标与多色按钮不再依赖主题里的固定颜色。</p>
                <DemoCard source={'<IconHome fill={[primaryColor]} />\n<IconHome fill={[primaryColor, secondaryColor]} />'}><div className="dsh-semi-showcase-demo dsh-semi-showcase-icon-row dsh-semi-showcase-icon-row--large"><DshIconFolder fill={['var(--dsw-alias-primary)']} aria-label="主题色" /><DshIconFolder fill={['var(--dsw-alias-success)']} aria-label="成功色" /><DshIconFolder fill={['var(--dsw-alias-warning)']} aria-label="警告色" /><DshIconFolderOpen fill={['var(--dsw-alias-primary)', 'var(--dsw-alias-label-secondary)']} aria-label="双色图标" /><DshIconSetting fill={['var(--dsw-alias-danger)', 'var(--dsw-alias-label-secondary)']} aria-label="双色设置" /></div></DemoCard>
              </>
            ) : null}

            {category === 'modal' && activeComponent === 'Modal 对话框' ? (
              <>
                <h2 id="modal-basic" className={sectionTitle}>基本用法</h2>
                <p className={sectionText}>对话框用于等待用户响应、告知重要信息或在不丢失上下文的情况下展示更多信息。</p>
                <DemoCard source={'<DshModal title="基本对话框" visible={visible}\n  onOk={close} onCancel={close} closeOnEsc />'}><div className={demo}><DshButton type="primary" theme="solid" onClick={() => { openModal('basic') }}>打开基本对话框</DshButton><DshButton type="secondary" theme="light" onClick={() => { openModal('footerFill') }}>底部撑满</DshButton><DshButton type="secondary" theme="light" onClick={() => { openModal('mask') }}>遮罩不可关闭</DshButton></div></DemoCard>
                <h2 id="modal-states" className={sectionTitle}>按钮与内容状态</h2>
                <p className={sectionText}>通过 footerFill、okButtonProps、cancelButtonProps、header、footer、centered 和滚动内容展示官方文档中的常用状态。</p>
                <DemoCard source={'<DshModal footerFill />\n<DshModal okButtonProps={{ size: "small", type: "warning" }} />\n<DshModal header={null} footer={footer} />'}><div className={demo}><DshButton type="secondary" theme="light" onClick={() => { openModal('buttonProps') }}>自定义按钮属性</DshButton><DshButton type="secondary" theme="light" onClick={() => { openModal('customFooter') }}>自定义页脚</DshButton><DshButton type="secondary" theme="light" onClick={() => { openModal('styled') }}>居中与滚动内容</DshButton><DshButton type="secondary" theme="light" onClick={() => { openModal('fullscreen') }}>全屏 Modal</DshButton></div></DemoCard>
                <h2 id="modal-methods" className={sectionTitle}>信息反馈状态</h2>
                <p className={sectionText}>命令式 Modal 提供信息、成功、错误、警告和确认五种状态，图标与按钮颜色均使用 DSH 主题变量。</p>
                <DemoCard source={'DshModal.info({ title: "信息", content: "..." })\nDshModal.success({ title: "成功", content: "..." })\nDshModal.error({ title: "错误", content: "..." })\nDshModal.warning({ title: "警告", content: "..." })\nDshModal.confirm({ title: "确认", content: "..." })'}><div className={demo}>{modalMethods.map(([method, label, Icon]) => <DshButton key={method} type={method === 'error' ? 'danger' : method === 'warning' ? 'warning' : 'primary'} theme="light" icon={<Icon />} onClick={() => { modalApi[method]({ title: `${label}状态`, content: `这是 ${label} Modal 的内容，用于验证图标、正文、按钮和遮罩状态。`, okText: '确定', cancelText: '取消' }) }}>{label}</DshButton>)}</div></DemoCard>
                <DshModal {...(modalDemo === 'customFooter' ? { footer: modalFooter } : {})} title={modalDemo === 'customFooter' ? '自定义页脚' : modalDemo === 'fullscreen' ? '全屏对话框' : modalDemo === 'mask' ? '遮罩不可关闭' : modalDemo === 'buttonProps' ? '自定义按钮属性' : modalDemo === 'styled' ? '自定义样式' : modalDemo === 'footerFill' ? '底部撑满' : '基本对话框'} visible={modalVisible} centered={modalDemo === 'styled' || modalDemo === 'fullscreen'} fullScreen={modalDemo === 'fullscreen'} footerFill={modalDemo === 'footerFill'} maskClosable={modalDemo !== 'mask'} closeOnEsc okText="确定" cancelText="取消" okButtonProps={modalDemo === 'buttonProps' ? { size: 'small', type: 'warning' } : undefined} cancelButtonProps={modalDemo === 'buttonProps' ? { size: 'small', disabled: true } : undefined} header={modalDemo === 'customFooter' ? null : undefined} onCancel={closeModal} onOk={closeModal}>{modalBody}</DshModal>
              </>
            ) : null}
          </div>
        </section>
        <aside className={outline} aria-label="页面目录">
          <div className="dsh-semi-showcase-outline-heading">目录</div>
          {outlineItems.map(([item, target]) => <button key={item} type="button" className={outlineItem} onClick={() => { document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>{item}</button>)}
        </aside>
      </div>
    </main>
  )
}
