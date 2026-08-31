import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { ComponentType, CSSProperties, MouseEvent, ReactNode } from 'react'
import * as SemiIcons from '@douyinfe/semi-icons/lib/es/icons/index.js'
import {
  DshButton,
  DshButtonGroup,
  DshCascader,
  DshCheckbox,
  DshDropdown,
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
  DshModal,
  DshPopover,
  DshProgress,
  DshSpin,
  DshToast,
  DshTooltip,
  DshTree,
  DshTreeSelect,
} from '@tnnevol/dsh-semi-ui'
import type { ShowcaseRouteController } from './route.ts'
import type { ShowcaseThemeController } from './theme-preview.ts'

type Category = 'buttons' | 'selection' | 'tree' | 'modal' | 'feedback'
type ComponentItem = 'Button 按钮' | 'Cascader 级联选择' | 'TreeSelect 树选择器' | 'Checkbox 复选框' | 'Tree 树形控件' | 'Icon 图标' | 'Modal 对话框' | 'Popover 浮层' | 'Tooltip 文字提示' | 'Dropdown 下拉框' | 'Progress 进度条' | 'Spin 加载器' | 'Toast 提示'
type ModalDemo = 'basic' | 'footerFill' | 'mask' | 'buttonProps' | 'customFooter' | 'styled' | 'fullscreen'

const page: CSSProperties = { position: 'absolute', inset: 0, overflow: 'auto', background: 'var(--dsw-alias-bg-base)', color: 'var(--dsw-alias-label-primary)' }
const topbar: CSSProperties = { position: 'sticky', top: 0, zIndex: 10, display: 'flex', alignItems: 'center', minHeight: 64, padding: '0 24px', borderBottom: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-base)' }
const brand: CSSProperties = { width: 220, flexShrink: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-.02em' }
const topnav: CSSProperties = { display: 'flex', alignItems: 'center', gap: 26, flex: 1, color: 'var(--dsw-alias-label-secondary)', fontSize: 14 }
const topnavItem: CSSProperties = { border: 0, padding: '8px 0', background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer' }
const shell: CSSProperties = { display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr) 180px', minHeight: 'calc(100% - 64px)' }
const sidebar: CSSProperties = { minWidth: 0, padding: '24px 12px', borderRight: '1px solid var(--dsw-alias-border-l2)' }
const sidebarGroup: CSSProperties = { display: 'grid', gap: 3, marginBottom: 24 }
const sidebarTitle: CSSProperties = { padding: '0 12px 8px', color: 'var(--dsw-alias-label-secondary)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }
const sidebarItem: CSSProperties = { display: 'flex', alignItems: 'center', width: '100%', padding: '9px 12px', border: 0, borderRadius: 4, background: 'transparent', color: 'var(--dsw-alias-label-secondary)', font: 'inherit', fontSize: 14, textAlign: 'left', cursor: 'pointer' }
const main: CSSProperties = { minWidth: 0, padding: '42px clamp(24px, 5vw, 72px) 72px' }
const mainInner: CSSProperties = { width: 'min(1080px, 100%)', margin: '0 auto' }
const outline: CSSProperties = { minWidth: 0, padding: '42px 18px', borderLeft: '1px solid var(--dsw-alias-border-l2)', color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 }
const outlineItem: CSSProperties = { display: 'block', padding: '5px 0', border: 0, background: 'transparent', color: 'inherit', font: 'inherit', textAlign: 'left', cursor: 'pointer' }
const breadcrumb: CSSProperties = { marginBottom: 12, color: 'var(--dsw-alias-label-tertiary)', fontSize: 13 }
const heading: CSSProperties = { margin: 0, fontSize: 34, lineHeight: 1.2, letterSpacing: '-.025em' }
const description: CSSProperties = { maxWidth: 720, margin: '16px 0 0', color: 'var(--dsw-alias-label-secondary)', fontSize: 15, lineHeight: 1.7 }
const sectionTitle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, margin: '46px 0 18px', fontSize: 22, lineHeight: 1.3 }
const sectionText: CSSProperties = { margin: '0 0 18px', color: 'var(--dsw-alias-label-secondary)', fontSize: 14, lineHeight: 1.7 }
const demoCard: CSSProperties = { overflow: 'hidden', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 4, background: 'var(--dsw-alias-bg-layer-2)' }
const demoPreview: CSSProperties = { minWidth: 0, padding: 24, background: 'var(--dsw-alias-bg-layer-2)' }
const code: CSSProperties = { minWidth: 0, margin: 0, padding: 22, overflow: 'auto', background: 'var(--dsw-alias-bg-layer-3)', color: 'var(--dsw-alias-label-secondary)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 12, lineHeight: 1.65, whiteSpace: 'pre-wrap' }
const demo: CSSProperties = { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }
const stack: CSSProperties = { display: 'grid', gap: 24 }
const demoBlock: CSSProperties = { display: 'grid', gap: 10 }
const demoLabel: CSSProperties = { color: 'var(--dsw-alias-label-secondary)', fontSize: 13 }
const dropdownApiTable: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(120px, .7fr) minmax(180px, 1.3fr) minmax(110px, .7fr)', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 4, overflow: 'hidden', fontSize: 12 }
const dropdownApiCell: CSSProperties = { padding: '10px 12px', borderBottom: '1px solid var(--dsw-alias-border-l2)' }
const iconGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))', gap: 8, maxHeight: 520, overflow: 'auto' }
const iconTile: CSSProperties = { display: 'grid', justifyItems: 'center', alignContent: 'center', minHeight: 86, gap: 8, padding: '12px 8px', border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 4, color: 'var(--dsw-alias-label-secondary)', textAlign: 'center' }
const iconTileLabel: CSSProperties = { maxWidth: '100%', overflow: 'hidden', color: 'var(--dsw-alias-label-tertiary)', fontSize: 10, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
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
const iconCatalog = Object.entries(SemiIcons)
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
  { title: '输入类', items: [{ icon: DshIconLabCascader, label: 'Cascader 级联选择', value: 'selection' as Category }, { icon: DshIconLabTreeSelect, label: 'TreeSelect 树选择器', value: 'selection' as Category }, { icon: DshIconLabCheckbox, label: 'Checkbox 复选框', value: 'selection' as Category }] },
  { title: '导航类', items: [{ icon: DshIconLabTree, label: 'Tree 树形控件', value: 'tree' as Category }] },
  { title: '反馈类', items: [{ icon: DshIconLabModal, label: 'Modal 对话框', value: 'modal' as Category }, { icon: DshIconLabProgress, label: 'Progress 进度条', value: 'feedback' as Category }, { icon: DshIconLabSpin, label: 'Spin 加载器', value: 'feedback' as Category }, { icon: DshIconLabToast, label: 'Toast 提示', value: 'feedback' as Category }, { icon: DshIconLabTooltip, label: 'Tooltip 文字提示', value: 'buttons' as Category }, { icon: DshIconLabDropdown, label: 'Dropdown 下拉框', value: 'buttons' as Category }, { icon: DshIconElementStroked, label: 'Popover 浮层', value: 'buttons' as Category }] },
] as const

function DemoCode({ children }: { children: string }): ReactNode {
  return <pre style={code}><code>{children}</code></pre>
}

function DemoCard({ children, source }: { children: ReactNode; source: string }): ReactNode {
  return <div style={demoCard}><div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, .9fr) minmax(300px, 1.1fr)' }}><div style={demoPreview}>{children}</div><DemoCode>{source}</DemoCode></div></div>
}

export function ShowcasePage({ route, theme }: { route: ShowcaseRouteController; theme: ShowcaseThemeController }) {
  const snapshot = useSyncExternalStore(route.subscribe, route.getSnapshot, route.getSnapshot)
  const themeSnapshot = useSyncExternalStore(theme.subscribe, theme.getSnapshot, theme.getSnapshot)
  const [modalVisible, setModalVisible] = useState(false)
  const [modalDemo, setModalDemo] = useState<ModalDemo>('basic')
  const [buttonLoading, setButtonLoading] = useState(false)
  const [checkboxChecked, setCheckboxChecked] = useState(false)
  const [category, setCategory] = useState<Category>('buttons')
  const [activeComponent, setActiveComponent] = useState<ComponentItem>('Button 按钮')
  const [iconMode, setIconMode] = useState<IconMode>('all')
  const [toastId, setToastId] = useState<string>()
  const [dropdownSelected, setDropdownSelected] = useState('插件')
  const [dropdownEvent, setDropdownEvent] = useState('等待菜单操作')
  const [dropdownCustomVisible, setDropdownCustomVisible] = useState(false)
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
  const popoverContent = useMemo(() => <div style={{ display: 'grid', gap: 6, minWidth: 180, padding: 4 }}><strong>Popover 内容</strong><span style={{ color: 'var(--dsw-alias-label-secondary)' }}>这是由调用方传入的自定义内容。</span></div>, [])
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
    ? <div style={{ maxHeight: 180, overflow: 'auto', lineHeight: 1.8 }}><p>Modal 的内容区域可以独立滚动，不会改变页面上下文。</p><p>这是与官方示例一致的 bodyStyle 场景，用于验证长内容、背景、文字和滚动条的主题状态。</p><p>DSH 的主题变量会同时作用于 Modal 表面、边框、遮罩和按钮。</p></div>
    : modalDemo === 'customFooter'
      ? <div><p>自定义页脚只保留明确的操作，适合需要额外说明的对话框。</p><p style={{ color: 'var(--dsw-alias-label-secondary)' }}>页脚由调用方渲染。</p></div>
      : <div><p>{modalDemo === 'mask' ? '点击遮罩层不会关闭当前对话框。' : '这是一个受控 Modal，用于验证标题、内容、关闭按钮和确认/取消操作。'}</p><p style={{ color: 'var(--dsw-alias-label-secondary)' }}>点击确认或取消返回预览页面。</p></div>
  const modalFooter = <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><DshButton type="secondary" theme="light" onClick={closeModal}>了解更多</DshButton><DshButton type="primary" theme="solid" onClick={closeModal}>继续</DshButton></div>
  return (
    <main style={page} data-dsh-semi-ui-showcase>
      <header style={topbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 220, flexShrink: 0 }}>
          <DshIconButton type="tertiary" theme="borderless" aria-label="返回" icon={<DshIconArrowLeft />} onClick={() => { route.close() }} />
          <div style={brand}>DSH Semi UI</div>
        </div>
        <nav style={topnav} aria-label="总览导航">
          <button type="button" style={topnavItem} onClick={() => { setCategory('buttons'); setActiveComponent('Button 按钮') }}>组件</button>
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <DshTooltip content={themeToggleLabel} trigger="hover">
            <DshIconButton type="tertiary" theme="light" aria-label={themeToggleLabel} icon={<ThemeIcon />} onClick={() => { theme.setPreference(nextTheme) }} />
          </DshTooltip>
        </div>
      </header>
      <div style={shell}>
        <aside style={sidebar} aria-label="组件导航">
          {sidebarGroups.map(group => (
            <div key={group.title} style={sidebarGroup}>
              <div style={sidebarTitle}>{group.title}</div>
              {group.items.map(({ icon: Icon, label, value }) => <button key={label} type="button" style={{ ...sidebarItem, ...(activeComponent === label ? { background: 'var(--dsw-alias-fill-l2)', color: 'var(--dsw-alias-primary)' } : {}) }} onClick={() => { setCategory(value); setActiveComponent(label) }}><span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, color: activeComponent === label ? 'var(--dsw-alias-primary)' : 'var(--dsw-alias-label-tertiary)' }}><Icon aria-hidden /></span>{label}</button>)}
            </div>
          ))}
        </aside>
        <section style={main}>
          <div style={mainInner}>
            <div style={breadcrumb}>组件 · {categoryTitle}</div>
            <h1 style={heading}>{categoryTitle}</h1>
            <p style={description}>{categoryDescription}</p>

            {category === 'buttons' && activeComponent === 'Button 按钮' ? (
              <>
                <h2 id="how-to" style={sectionTitle}>如何引入</h2>
                <DemoCard source={"import { Button } from '@tnnevol/dsh-semi-ui'\n\n<DshButton type=\"primary\">主要按钮</DshButton>"}><DshButton type="primary" theme="solid">主要按钮</DshButton></DemoCard>
                <h2 id="button-types" style={sectionTitle}>按钮类型</h2>
                <p style={sectionText}>按钮类型用于表达操作的重要程度。</p>
                <DemoCard source={'<DshButton type="primary">主要</DshButton>\n<DshButton type="secondary">次要</DshButton>\n<DshButton type="warning">警告</DshButton>'}><div style={demo}>{buttonTypes.map(([type, label]) => <DshButton key={type} type={type} theme="solid">{label}</DshButton>)}</div></DemoCard>
                <h2 id="button-theme" style={sectionTitle}>按钮主题与尺寸</h2>
                <p style={sectionText}>主题控制按钮的视觉层级，尺寸适用于不同密度的页面。</p>
                <DemoCard source={'type: primary | secondary | tertiary | warning | danger\ntheme: solid | light | outline | borderless'}><div style={stack}>{buttonThemes.map(themeName => <div key={themeName} style={demoBlock}><span style={demoLabel}>{themeName}</span><div style={demo}>{buttonTypes.map(([type, label]) => <DshButton key={`${themeName}-${type}`} type={type} theme={themeName} size="small">{label}</DshButton>)}</div></div>)}<div style={demo}><span style={demoLabel}>size</span>{buttonSizes.map(size => <DshButton key={size} type="secondary" theme="light" size={size}>{size}</DshButton>)}</div></div></DemoCard>
                <h2 id="button-states" style={sectionTitle}>按钮状态</h2>
                <p style={sectionText}>加载、禁用、块级和图标按钮均使用共享主题 Token。</p>
                <DemoCard source={'<DshButton loading={loading}>保存</DshButton>\n<DshButton disabled>禁用</DshButton>\n<DshButton icon={<DshIconSetting />}>设置</DshButton>'}><div style={stack}><div style={demo}><DshButton type="primary" theme="solid" loading={buttonLoading}>保存</DshButton><DshButton type="secondary" theme="light" onClick={() => { setButtonLoading(value => !value) }}>{buttonLoading ? '关闭加载态' : '开启加载态'}</DshButton><DshButton type="secondary" theme="solid" disabled>禁用</DshButton><DshButton type="danger" theme="outline" disabled>禁用描边</DshButton><DshButton type="primary" theme="solid" block style={{ maxWidth: 260 }}>块级按钮</DshButton></div><div style={demo}><DshButton type="primary" theme="solid" icon={<DshIconSetting />}>设置</DshButton><DshButton type="secondary" theme="light" icon={<DshIconRefresh />} iconPosition="right">刷新</DshButton><DshIconButton type="primary" theme="solid" icon={<DshIconSetting />} aria-label="设置" /><DshIconButton type="secondary" theme="light" icon={<DshIconClose />} aria-label="关闭" disabled /></div></div></DemoCard>
                <h2 id="button-overlays" style={sectionTitle}>按钮组合与浮层</h2>
                <DemoCard source={'<DshButtonGroup>...</DshButtonGroup>\n<DshTooltip content="提示">...</DshTooltip>\n<DshDropdown trigger="click">...</DshDropdown>'}><div style={demo}><DshButtonGroup type="primary" theme="solid" aria-label="操作按钮组"><DshButton>保存</DshButton><DshButton>继续</DshButton><DshButton>更多</DshButton></DshButtonGroup><DshButtonGroup type="secondary" theme="light" size="small" aria-label="辅助操作按钮组"><DshButton>上一项</DshButton><DshButton>下一项</DshButton></DshButtonGroup><DshTooltip content="Tooltip 默认浮层，鼠标悬停查看"><DshButton type="secondary" theme="light">Tooltip</DshButton></DshTooltip><DshDropdown trigger="click" render={dropdownMenu}><DshButton type="secondary" theme="light">Dropdown</DshButton></DshDropdown></div></DemoCard>
              </>
            ) : null}

            {activeComponent === 'Tooltip 文字提示' ? (
              <>
                <h2 id="tooltip-basic" style={sectionTitle}>基本用法</h2>
                <p style={sectionText}>鼠标悬停查看提示，并使用 DSH 的浮层背景与文字变量。</p>
                <DemoCard source={'<DshTooltip content="Tooltip 默认浮层">\n  <DshButton>悬停查看</DshButton>\n</DshTooltip>'}><DshTooltip content="Tooltip 默认浮层，鼠标悬停查看"><DshButton type="secondary" theme="light">悬停查看</DshButton></DshTooltip></DemoCard>
              </>
            ) : null}

            {activeComponent === 'Dropdown 下拉框' ? (
              <>
                <h2 id="dropdown-basic" style={sectionTitle}>基本用法</h2>
                <p style={sectionText}>Dropdown 默认通过悬停触发，也可以使用点击、聚焦或右键触发。菜单由 Menu、Title、Item 和 Divider 组合而成。</p>
                <DemoCard source={'<DshDropdown showTick position="bottomLeft" render={\n  <DshDropdown.Menu>\n    <DshDropdown.Title>工作区</DshDropdown.Title>\n    <DshDropdown.Item icon={<DshIconFolder />}>插件</DshDropdown.Item>\n    <DshDropdown.Item disabled>应用</DshDropdown.Item>\n    <DshDropdown.Divider />\n    <DshDropdown.Item type="danger">删除</DshDropdown.Item>\n  </DshDropdown.Menu>\n}>\n  <DshButton>打开菜单</DshButton>\n</DshDropdown>'}>
                  <DshDropdown trigger="click" showTick position="bottomLeft" render={dropdownMenu}>
                    <DshButton type="secondary" theme="light" icon={<DshIconChevronDown />}>打开菜单</DshButton>
                  </DshDropdown>
                </DemoCard>

                <h2 id="dropdown-nested" style={sectionTitle}>嵌套使用</h2>
                <p style={sectionText}>嵌套 Dropdown 适合承载多级操作，子菜单可以从父菜单项的右侧展开。</p>
                <DemoCard source={'<DshDropdown render={\n  <DshDropdown.Menu>\n    <DshDropdown position="rightTop" render={subMenu}>\n      <DshDropdown.Item>导出</DshDropdown.Item>\n    </DshDropdown>\n  </DshDropdown.Menu>\n}>...</DshDropdown>'}>
                  <DshDropdown render={<DshDropdown.Menu><DshDropdown position="rightTop" trigger="hover" render={nestedDropdownMenu}><DshDropdown.Item icon={<DshIconFolderOpen />}>导出</DshDropdown.Item></DshDropdown><DshDropdown.Item>重命名</DshDropdown.Item><DshDropdown.Item disabled>移动到（禁用）</DshDropdown.Item></DshDropdown.Menu>}>
                    <DshButton type="secondary" theme="light">打开多级菜单</DshButton>
                  </DshDropdown>
                </DemoCard>

                <h2 id="dropdown-position" style={sectionTitle}>弹出位置</h2>
                <p style={sectionText}>使用 `position` 调整菜单相对触发器的方向，常用位置包括 bottom、bottomLeft 和 bottomRight。</p>
                <DemoCard source={'<DshDropdown position="bottom" />\n<DshDropdown position="bottomLeft" />\n<DshDropdown position="bottomRight" />'}>
                  <div style={demo}>
                    <DshDropdown trigger="click" position="bottom" render={dropdownSimpleMenu}><DshButton type="secondary" theme="light">bottom</DshButton></DshDropdown>
                    <DshDropdown trigger="click" position="bottomLeft" render={dropdownSimpleMenu}><DshButton type="secondary" theme="light">bottomLeft</DshButton></DshDropdown>
                    <DshDropdown trigger="click" position="bottomRight" render={dropdownSimpleMenu}><DshButton type="secondary" theme="light">bottomRight</DshButton></DshDropdown>
                  </div>
                </DemoCard>

                <h2 id="dropdown-trigger" style={sectionTitle}>触发方式</h2>
                <p style={sectionText}>官方 Dropdown 支持 hover、focus、click、custom 和 contextMenu 五种触发方式。</p>
                <DemoCard source={'<DshDropdown trigger="hover" />\n<DshDropdown trigger="focus" />\n<DshDropdown trigger="click" />\n<DshDropdown trigger="custom" visible={visible} />\n<DshDropdown trigger="contextMenu" />'}>
                  <div style={demo}>
                    <DshDropdown trigger="hover" render={dropdownSimpleMenu}><DshButton type="secondary" theme="light">Hover</DshButton></DshDropdown>
                    <DshDropdown trigger="focus" render={dropdownSimpleMenu}><DshButton type="secondary" theme="light">Focus</DshButton></DshDropdown>
                    <DshDropdown trigger="click" render={dropdownSimpleMenu}><DshButton type="secondary" theme="light">Click</DshButton></DshDropdown>
                    <DshDropdown trigger="custom" visible={dropdownCustomVisible} onVisibleChange={setDropdownCustomVisible} render={dropdownSimpleMenu}><DshButton type="secondary" theme="light" onClick={() => { setDropdownCustomVisible(value => !value) }}>Custom</DshButton></DshDropdown>
                    <DshDropdown trigger="contextMenu" position="bottomRight" render={dropdownSimpleMenu}><DshButton type="secondary" theme="light">右键打开</DshButton></DshDropdown>
                  </div>
                </DemoCard>

                <h2 id="dropdown-events" style={sectionTitle}>触发事件</h2>
                <p style={sectionText}>菜单项支持 onClick、onMouseEnter、onMouseLeave 和 onContextMenu 事件，当前事件会显示在示例下方。</p>
                <DemoCard source={'<DshDropdown.Item onClick={handleClick}>点击事件</DshDropdown.Item>\n<DshDropdown.Item onMouseEnter={handleEnter}>移入事件</DshDropdown.Item>\n<DshDropdown.Item onContextMenu={handleContextMenu}>右键事件</DshDropdown.Item>'}>
                  <div style={stack}>
                    <DshDropdown trigger="click" position="bottomLeft" render={dropdownEventMenu}><DshButton type="secondary" theme="light">打开事件菜单</DshButton></DshDropdown>
                    <span style={{ color: 'var(--dsw-alias-label-tertiary)', fontSize: 12 }} role="status">{dropdownEvent}</span>
                  </div>
                </DemoCard>

                <h2 id="dropdown-json" style={sectionTitle}>JSON 用法</h2>
                <p style={sectionText}>简单菜单可以通过 `menu` 数组快速配置标题、菜单项、分隔线、图标、类型和激活态。</p>
                <DemoCard source={'const menu = [\n  { node: "title", name: "快捷操作" },\n  { node: "item", name: "新建文件", type: "primary", active: true },\n  { node: "divider" },\n  { node: "item", name: "清理缓存", type: "danger" },\n]\n<DshDropdown menu={menu} showTick />'}>
                  <DshDropdown trigger="click" showTick position="bottomLeft" menu={dropdownJsonMenu}><DshButton type="secondary" theme="light">打开 JSON 菜单</DshButton></DshDropdown>
                </DemoCard>

                <h2 id="dropdown-api" style={sectionTitle}>API 参考</h2>
                <p style={sectionText}>以下是本页覆盖的核心属性和组合组件，完整 API 以 Semi 官方文档为准。</p>
                <div style={dropdownApiTable} role="table" aria-label="Dropdown API 参考">
                  <strong style={{ ...dropdownApiCell, background: 'var(--dsw-alias-fill-l2)' }}>属性</strong><strong style={{ ...dropdownApiCell, background: 'var(--dsw-alias-fill-l2)' }}>用途</strong><strong style={{ ...dropdownApiCell, background: 'var(--dsw-alias-fill-l2)' }}>示例</strong>
                  <span style={dropdownApiCell}>trigger</span><span style={dropdownApiCell}>控制菜单的触发方式</span><code style={dropdownApiCell}>hover / focus / click / contextMenu</code>
                  <span style={dropdownApiCell}>render / menu</span><span style={dropdownApiCell}>提供 React 菜单或 JSON 菜单</span><code style={dropdownApiCell}>DshDropdown.Menu</code>
                  <span style={dropdownApiCell}>position</span><span style={dropdownApiCell}>调整浮层相对触发器的位置</span><code style={dropdownApiCell}>bottomLeft</code>
                  <span style={dropdownApiCell}>showTick</span><span style={dropdownApiCell}>为 active 菜单项显示选中标记</span><code style={dropdownApiCell}>true</code>
                </div>
              </>
            ) : null}

            {activeComponent === 'Popover 浮层' ? (
              <>
                <h2 id="popover-basic" style={sectionTitle}>基本用法</h2>
                <p style={sectionText}>Popover 用于展示补充信息或轻量交互内容，点击触发后不会影响当前页面上下文。</p>
                <DemoCard source={'<DshPopover trigger="click" content={content}>\n  <DshButton>打开 Popover</DshButton>\n</DshPopover>'}><DshPopover trigger="click" position="top" showArrow content={popoverContent}><DshButton type="secondary" theme="light">打开 Popover</DshButton></DshPopover></DemoCard>
                <h2 style={sectionTitle}>箭头与位置</h2>
                <p style={sectionText}>使用 `position` 和 `showArrow` 控制浮层定位与指向，内容由 Popover 的 `content` 属性提供。</p>
                <DemoCard source={'<DshPopover position="right" showArrow content="右侧内容">\n  <DshButton>右侧打开</DshButton>\n</DshPopover>'}><div style={demo}><DshPopover trigger="click" position="right" showArrow content={<span>右侧 Popover 内容</span>}><DshButton type="secondary" theme="light">右侧打开</DshButton></DshPopover><DshPopover trigger="hover" position="bottomLeft" content={<span>悬停显示内容</span>}><DshButton type="secondary" theme="light">悬停打开</DshButton></DshPopover></div></DemoCard>
              </>
            ) : null}

            {activeComponent === 'Progress 进度条' ? (
              <>
                <h2 id="progress-basic" style={sectionTitle}>标准进度条</h2>
                <p style={sectionText}>通过 `percent` 控制完成度，通过 `stroke`、`size` 和 `showInfo` 调整展示状态。</p>
                <DemoCard source={'<DshProgress percent={10} />\n<DshProgress percent={50} />\n<DshProgress percent={80} size="large" />'}><div style={{ ...stack, maxWidth: 360 }}><DshProgress percent={10} aria-label="10%" /><DshProgress percent={50} aria-label="50%" /><DshProgress percent={80} size="large" aria-label="80%" /><DshProgress percent={65} stroke="var(--dsw-alias-state-warn-primary)" aria-label="65% warning" /></div></DemoCard>
                <h2 id="progress-circle" style={sectionTitle}>圆形进度条</h2>
                <DemoCard source={'<DshProgress type="circle" percent={50} />'}><div style={demo}><DshProgress type="circle" percent={25} aria-label="25%" /><DshProgress type="circle" percent={50} aria-label="50%" /><DshProgress type="circle" percent={75} size="large" aria-label="75%" /></div></DemoCard>
                <h2 id="progress-format" style={sectionTitle}>自定义文本</h2>
                <DemoCard source={'<DshProgress percent={80} format={percent => `${percent} / 100`} />'}><DshProgress percent={80} showInfo format={(percent: number) => `${percent} / 100`} aria-label="80 / 100" /></DemoCard>
              </>
            ) : null}

            {activeComponent === 'Spin 加载器' ? (
              <>
                <h2 id="spin-basic" style={sectionTitle}>基本用法</h2>
                <p style={sectionText}>Spin 用于展示不确定时长的加载过程，支持延迟、提示文本和自定义指示器。</p>
                <DemoCard source={'<DshSpin />'}><div style={{ ...demo, minHeight: 64 }}><DshSpin size="small" /><DshSpin size="middle" /><DshSpin size="large" /></div></DemoCard>
                <h2 id="spin-size" style={sectionTitle}>尺寸</h2>
                <DemoCard source={'<DshSpin size="small" />\n<DshSpin size="middle" />\n<DshSpin size="large" />'}><div style={stack}><div style={demo}><DshSpin size="small" /><span style={demoLabel}>small</span><DshSpin size="middle" /><span style={demoLabel}>middle</span><DshSpin size="large" /><span style={demoLabel}>large</span></div></div></DemoCard>
                <h2 id="spin-content" style={sectionTitle}>包裹内容</h2>
                <DemoCard source={'<DshSpin tip="加载中...">\n  <div>需要等待的内容</div>\n</DshSpin>'}><DshSpin tip="加载中..."><div style={{ padding: 28, border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8, color: 'var(--dsw-alias-label-secondary)' }}>需要等待的内容</div></DshSpin></DemoCard>
              </>
            ) : null}

            {activeComponent === 'Toast 提示' ? (
              <>
                <h2 id="toast-basic" style={sectionTitle}>普通提示</h2>
                <p style={sectionText}>Toast 使用命令式 API 及时反馈操作结果，浮层样式由共享 DSH 主题统一管理。</p>
                <DemoCard source={'DshToast.info({ content: "这是一条提示" })'}><div style={demo}><DshButton type="secondary" theme="light" onClick={() => { toastApi.info({ content: '这是一条普通提示', duration: 3 }) }}>普通提示</DshButton></div></DemoCard>
                <h2 id="toast-status" style={sectionTitle}>状态提示</h2>
                <DemoCard source={'DshToast.success({ content: "操作成功" })\nDshToast.warning({ content: "请注意" })\nDshToast.error({ content: "操作失败" })'}><div style={demo}><DshButton type="primary" theme="light" onClick={() => { toastApi.info({ content: '信息提示', duration: 3 }) }}>信息</DshButton><DshButton type="secondary" theme="light" onClick={() => { toastApi.success({ content: '操作成功', duration: 3 }) }}>成功</DshButton><DshButton type="warning" theme="light" onClick={() => { toastApi.warning({ content: '请注意当前状态', duration: 3 }) }}>警告</DshButton><DshButton type="danger" theme="light" onClick={() => { toastApi.error({ content: '操作失败', duration: 3 }) }}>错误</DshButton></div></DemoCard>
                <h2 id="toast-control" style={sectionTitle}>手动关闭与堆叠</h2>
                <DemoCard source={'const id = DshToast.info({ content: "不会自动关闭", duration: 0 })\nDshToast.close(id)'}><div style={demo}><DshButton type="secondary" theme="light" onClick={() => { setToastId(toastApi.info({ content: '这条提示需要手动关闭', duration: 0 })) }}>手动打开</DshButton><DshButton type="secondary" theme="light" disabled={toastId === undefined} onClick={() => { if (toastId !== undefined) { DshToast.close(toastId); setToastId(undefined) } }}>关闭 Toast</DshButton><DshButton type="secondary" theme="light" onClick={() => { toastApi.info({ content: '堆叠提示 1', duration: 5, stack: true }); toastApi.success({ content: '堆叠提示 2', duration: 5, stack: true }); toastApi.warning({ content: '堆叠提示 3', duration: 5, stack: true }) }}>显示堆叠</DshButton></div></DemoCard>
              </>
            ) : null}

            {category === 'selection' && activeComponent === 'Cascader 级联选择' ? (
              <>
                <h2 id="selection-basic" style={sectionTitle}>基本用法</h2>
                <p style={sectionText}>展示默认、已选择、多选、搜索、禁用和错误校验状态。Cascader 的重点是完整路径，默认只允许选择叶子节点。</p>
                <DemoCard source={'<DshCascader treeData={data} multiple />\n<DshCascader treeData={data} filterTreeNode />'}><div style={demo}><DshCascader treeData={cascaderData} placeholder="默认状态" size="small" style={{ width: 220 }} /><DshCascader treeData={cascaderData} defaultValue={['model', 'luna']} placeholder="已选择" size="small" style={{ width: 220 }} /><DshCascader treeData={cascaderData} multiple defaultValue={['model', 'sol']} placeholder="多选" size="small" style={{ width: 220 }} /><DshCascader treeData={cascaderData} filterTreeNode placeholder="可搜索" size="small" style={{ width: 220 }} /><DshCascader treeData={cascaderData} filterTreeNode filterLeafOnly={false} placeholder="搜索全部节点" size="small" style={{ width: 220 }} /><DshCascader treeData={cascaderData} placeholder="禁用" size="small" disabled style={{ width: 220 }} /><DshCascader treeData={cascaderData} placeholder="错误状态" size="small" validateStatus="error" style={{ width: 220 }} /></div></DemoCard>
              </>
            ) : null}

            {category === 'selection' && activeComponent === 'TreeSelect 树选择器' ? (
              <>
                <h2 id="selection-basic" style={sectionTitle}>基本用法</h2>
                <p style={sectionText}>展示默认、多选、叶子节点、标签折叠、搜索、禁用和成功校验状态。节点关系使用 Semi 的 checkRelation 属性。</p>
                <DemoCard source={'<DshTreeSelect treeData={data} multiple />\n<DshTreeSelect treeData={data} multiple leafOnly />\n<DshTreeSelect treeData={data} filterTreeNode />'}><div style={demo}><DshTreeSelect treeData={treeData} showLine={false} placeholder="默认状态" size="small" style={{ width: 220 }} /><DshTreeSelect treeData={treeData} multiple treeCheckable checkRelation="related" defaultValue={['plugins']} showLine={false} placeholder="多选与复选" size="small" style={{ width: 220 }} /><DshTreeSelect treeData={treeData} multiple leafOnly defaultValue={['plugins']} showLine={false} placeholder="只显示叶子节点" size="small" style={{ width: 220 }} /><DshTreeSelect treeData={treeData} multiple maxTagCount={1} defaultValue={['plugins', 'apps']} showLine={false} placeholder="标签折叠" size="small" style={{ width: 220 }} /><DshTreeSelect treeData={treeData} filterTreeNode showLine={false} placeholder="可搜索" size="small" style={{ width: 220 }} /><DshTreeSelect treeData={treeData} showLine={false} placeholder="禁用" size="small" disabled style={{ width: 220 }} /><DshTreeSelect treeData={treeData} showLine={false} placeholder="成功状态" size="small" validateStatus="success" style={{ width: 220 }} /></div></DemoCard>
              </>
            ) : null}

            {category === 'selection' && activeComponent === 'Checkbox 复选框' ? (
              <>
                <h2 id="checkbox-basic" style={sectionTitle}>基本用法</h2>
                <p style={sectionText}>复选框用于表示选中或未选中的状态，点击示例可以实时切换。</p>
                <DemoCard source={'<DshCheckbox checked={checked} onChange={onChange}>可选项</DshCheckbox>'}>
                  <div style={demo}>
                    <DshCheckbox checked={checkboxChecked} onChange={() => { setCheckboxChecked(value => !value) }}>可选项</DshCheckbox>
                    <DshCheckbox checked>默认选中</DshCheckbox>
                  </div>
                </DemoCard>
                <h2 id="checkbox-states" style={sectionTitle}>选中与半选</h2>
                <p style={sectionText}>使用 `checked` 和 `indeterminate` 展示选择状态。</p>
                <DemoCard source={'<DshCheckbox checked>选中</DshCheckbox>\n<DshCheckbox indeterminate>半选</DshCheckbox>'}>
                  <div style={demo}>
                    <DshCheckbox checked>选中</DshCheckbox>
                    <DshCheckbox indeterminate>半选</DshCheckbox>
                    <DshCheckbox>未选中</DshCheckbox>
                  </div>
                </DemoCard>
                <h2 id="checkbox-disabled" style={sectionTitle}>禁用状态</h2>
                <p style={sectionText}>禁用状态不可交互，并使用共享主题中的禁用颜色。</p>
                <DemoCard source={'<DshCheckbox disabled>禁用</DshCheckbox>\n<DshCheckbox disabled checked>禁用且选中</DshCheckbox>'}>
                  <div style={demo}>
                    <DshCheckbox disabled>禁用</DshCheckbox>
                    <DshCheckbox disabled checked>禁用且选中</DshCheckbox>
                  </div>
                </DemoCard>
              </>
            ) : null}

            {category === 'tree' && activeComponent === 'Tree 树形控件' ? (
              <>
                <h2 id="tree-basic" style={sectionTitle}>基本用法</h2>
                <p style={sectionText}>展示基本用法、多选、搜索、整行高亮、选中、半选和禁用状态。</p>
                <DemoCard source={'<DshTree treeData={treeData} defaultExpandAll />\n<DshTree treeData={treeData} multiple filterTreeNode />'}><div style={stack}><div style={demoBlock}><span style={demoLabel}>基本用法与整行高亮</span><DshTree treeData={treeData} defaultExpandAll style={{ width: 260, height: 170, border: '1px solid var(--dsw-alias-border-l2)' }} /></div><div style={demoBlock}><span style={demoLabel}>复选与半选状态</span><DshTree treeData={treeData} multiple defaultValue={['plugins']} defaultExpandAll showLine blockNode style={{ width: 260, height: 170, border: '1px solid var(--dsw-alias-border-l2)' }} aria-label="Tree 复选示例" /></div><div style={demoBlock}><span style={demoLabel}>搜索与标签高亮</span><DshTree treeData={treeData} multiple filterTreeNode defaultExpandAll blockNode style={{ width: 260, height: 170, border: '1px solid var(--dsw-alias-border-l2)' }} aria-label="Tree 搜索示例" /></div><div style={demoBlock}><span style={demoLabel}>选中与禁用状态</span><DshTree treeData={disabledTreeData} defaultValue="plugins" defaultExpandAll blockNode style={{ width: 260, height: 170, border: '1px solid var(--dsw-alias-border-l2)' }} aria-label="Tree 选中示例" /></div></div></DemoCard>
              </>
            ) : null}

            {category === 'tree' && activeComponent === 'Icon 图标' ? (
              <>
                <h2 id="tree-icons" style={sectionTitle}>图标列表</h2>
                <p style={sectionText}>与 Semi 官方 Icon 文档一致，完整展示 `@douyinfe/semi-icons` 的面性、线性和 AI 图标，并按图标类型筛选。</p>
                <DemoCard source={'import * as Icons from \'@douyinfe/semi-icons\'\n\n<IconHome size="large" />'}><div style={stack}><div style={demo}>{iconModes.map(([mode, label]) => <DshButton key={mode} type={iconMode === mode ? 'primary' : 'secondary'} theme={iconMode === mode ? 'solid' : 'light'} size="small" onClick={() => { setIconMode(mode) }}>{label}</DshButton>)}</div><div style={iconGrid}>{iconCatalog.filter(icon => iconMode === 'all' || icon.group === iconMode).map(({ name, Icon }) => <div key={name} style={iconTile}><Icon aria-label={name} size="large" /><span style={iconTileLabel} title={name}>{name}</span></div>)}</div></div></DemoCard>
                <h2 id="tree-icons-basic" style={sectionTitle}>基础使用</h2>
                <p style={sectionText}>图标颜色继承 DSH 的文本和状态变量，名称与官方 Icon 组件保持一致。</p>
                <DemoCard source={'<DshIconFolder /> <DshIconFolderOpen />\n<DshIconFile /> <DshIconSetting />'}><div style={{ ...demo, fontSize: 20 }}><DshIconFolder aria-label="文件夹" /><DshIconFolderOpen aria-label="打开的文件夹" /><DshIconFile aria-label="文件" /><DshIconSetting aria-label="设置" /><DshIconRefresh aria-label="刷新" /><DshIconRestart aria-label="重启" /></div></DemoCard>
                <h2 id="tree-icons-states" style={sectionTitle}>尺寸与状态</h2>
                <p style={sectionText}>按照官方文档展示尺寸、旋转和加载状态。</p>
                <DemoCard source={'<DshIconRefresh size="extra-small" />\n<DshIconRefresh rotate={180} />\n<DshIconRefresh spin />'}><div style={{ ...demo, fontSize: 20 }}><DshIconRefresh size="extra-small" aria-label="超小" /><DshIconRefresh size="small" aria-label="小" /><DshIconRefresh size="default" aria-label="默认" /><DshIconRefresh size="large" aria-label="大" /><DshIconRefresh size="extra-large" aria-label="超大" /><DshIconRefresh rotate={180} aria-label="旋转" /><DshIconRefresh spin aria-label="加载" /></div></DemoCard>
                <h2 id="tree-icons-colors" style={sectionTitle}>颜色与双色图标</h2>
                <p style={sectionText}>颜色由组件属性控制，双色图标与多色按钮不再依赖主题里的固定颜色。</p>
                <DemoCard source={'<IconHome fill={[primaryColor]} />\n<IconHome fill={[primaryColor, secondaryColor]} />'}><div style={{ ...demo, fontSize: 24 }}><DshIconFolder fill={['var(--dsw-alias-primary)']} aria-label="主题色" /><DshIconFolder fill={['var(--dsw-alias-success)']} aria-label="成功色" /><DshIconFolder fill={['var(--dsw-alias-warning)']} aria-label="警告色" /><DshIconFolderOpen fill={['var(--dsw-alias-primary)', 'var(--dsw-alias-label-secondary)']} aria-label="双色图标" /><DshIconSetting fill={['var(--dsw-alias-danger)', 'var(--dsw-alias-label-secondary)']} aria-label="双色设置" /></div></DemoCard>
              </>
            ) : null}

            {category === 'modal' && activeComponent === 'Modal 对话框' ? (
              <>
                <h2 id="modal-basic" style={sectionTitle}>基本用法</h2>
                <p style={sectionText}>对话框用于等待用户响应、告知重要信息或在不丢失上下文的情况下展示更多信息。</p>
                <DemoCard source={'<DshModal title="基本对话框" visible={visible}\n  onOk={close} onCancel={close} closeOnEsc />'}><div style={demo}><DshButton type="primary" theme="solid" onClick={() => { openModal('basic') }}>打开基本对话框</DshButton><DshButton type="secondary" theme="light" onClick={() => { openModal('footerFill') }}>底部撑满</DshButton><DshButton type="secondary" theme="light" onClick={() => { openModal('mask') }}>遮罩不可关闭</DshButton></div></DemoCard>
                <h2 id="modal-states" style={sectionTitle}>按钮与内容状态</h2>
                <p style={sectionText}>通过 footerFill、okButtonProps、cancelButtonProps、header、footer、centered 和 bodyStyle 展示官方文档中的常用状态。</p>
                <DemoCard source={'<DshModal footerFill />\n<DshModal okButtonProps={{ size: "small", type: "warning" }} />\n<DshModal header={null} footer={footer} />'}><div style={demo}><DshButton type="secondary" theme="light" onClick={() => { openModal('buttonProps') }}>自定义按钮属性</DshButton><DshButton type="secondary" theme="light" onClick={() => { openModal('customFooter') }}>自定义页脚</DshButton><DshButton type="secondary" theme="light" onClick={() => { openModal('styled') }}>居中与滚动内容</DshButton><DshButton type="secondary" theme="light" onClick={() => { openModal('fullscreen') }}>全屏 Modal</DshButton></div></DemoCard>
                <h2 id="modal-methods" style={sectionTitle}>信息反馈状态</h2>
                <p style={sectionText}>命令式 Modal 提供信息、成功、错误、警告和确认五种状态，图标与按钮颜色均使用 DSH 主题变量。</p>
                <DemoCard source={'DshModal.info({ title: "信息", content: "..." })\nDshModal.success({ title: "成功", content: "..." })\nDshModal.error({ title: "错误", content: "..." })\nDshModal.warning({ title: "警告", content: "..." })\nDshModal.confirm({ title: "确认", content: "..." })'}><div style={demo}>{modalMethods.map(([method, label, Icon]) => <DshButton key={method} type={method === 'error' ? 'danger' : method === 'warning' ? 'warning' : 'primary'} theme="light" icon={<Icon />} onClick={() => { modalApi[method]({ title: `${label}状态`, content: `这是 ${label} Modal 的内容，用于验证图标、正文、按钮和遮罩状态。`, okText: '确定', cancelText: '取消' }) }}>{label}</DshButton>)}</div></DemoCard>
                <DshModal {...(modalDemo === 'customFooter' ? { footer: modalFooter } : {})} title={modalDemo === 'customFooter' ? '自定义页脚' : modalDemo === 'fullscreen' ? '全屏对话框' : modalDemo === 'mask' ? '遮罩不可关闭' : modalDemo === 'buttonProps' ? '自定义按钮属性' : modalDemo === 'styled' ? '自定义样式' : modalDemo === 'footerFill' ? '底部撑满' : '基本对话框'} visible={modalVisible} centered={modalDemo === 'styled' || modalDemo === 'fullscreen'} fullScreen={modalDemo === 'fullscreen'} footerFill={modalDemo === 'footerFill'} maskClosable={modalDemo !== 'mask'} closeOnEsc okText="确定" cancelText="取消" okButtonProps={modalDemo === 'buttonProps' ? { size: 'small', type: 'warning' } : undefined} cancelButtonProps={modalDemo === 'buttonProps' ? { size: 'small', disabled: true } : undefined} header={modalDemo === 'customFooter' ? null : undefined} bodyStyle={modalDemo === 'styled' ? { maxHeight: 180, overflow: 'auto' } : undefined} onCancel={closeModal} onOk={closeModal}>{modalBody}</DshModal>
              </>
            ) : null}
          </div>
        </section>
        <aside style={outline} aria-label="页面目录">
          <div style={{ marginBottom: 10, color: 'var(--dsw-alias-label-secondary)', fontWeight: 600 }}>目录</div>
          {outlineItems.map(([item, target]) => <button key={item} type="button" style={outlineItem} onClick={() => { document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>{item}</button>)}
        </aside>
      </div>
    </main>
  )
}
