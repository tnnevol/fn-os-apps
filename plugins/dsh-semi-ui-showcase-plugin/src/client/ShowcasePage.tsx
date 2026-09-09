import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { ComponentType, MouseEvent, ReactNode } from 'react'
import {
  DshButton,
  DshButtonGroup,
  DshCascader,
  DshAvatar,
  DshBadge,
  DshCard,
  DshCheckbox,
  DshCollapse,
  DshDescriptions,
  DshDropdown,
  DshEmpty,
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
  DshLayout,
  DshList,
  DshInputNumber,
  DshModal,
  DshPopover,
  DshProgress,
  DshScrollList,
  DshSpin,
  DshSelect,
  DshSemiIcons,
  DshSlider,
  DshSwitch,
  DshTable,
  DshTag,
  DshToast,
  DshTooltip,
  DshTree,
  DshTreeSelect,
  DshTypography,
} from '@tnnevol/dsh-semi-ui'
import type { ShowcaseComponentRoute, ShowcaseRouteController } from './route.ts'
import type { ShowcaseThemeController } from './theme-preview.ts'

type Category = 'buttons' | 'input' | 'selection' | 'tree' | 'modal' | 'feedback' | 'data'
type ComponentItem = 'Layout 布局' | 'Nav 导航' | 'Table 表格' | 'Card 卡片' | 'Descriptions 描述' | 'Empty 空状态' | 'Button 按钮' | 'Input 输入框' | 'InputNumber 数字输入框' | 'Slider 滑块' | 'Switch 开关' | 'Form 表单' | 'Cascader 级联选择' | 'TreeSelect 树选择器' | 'Checkbox 复选框' | 'Tree 树形控件' | 'Collapse 折叠面板' | 'Icon 图标' | 'Modal 对话框' | 'Popover 浮层' | 'Tooltip 文字提示' | 'Dropdown 下拉框' | 'Progress 进度条' | 'Spin 加载器' | 'Toast 提示' | 'CodeBuddy 多账户'
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
  { title: '数据展示类', items: [{ icon: DshIconLabTree, label: 'Collapse 折叠面板', value: 'data' as Category }, { icon: DshIconLabTreeSelect, label: 'Card 卡片', value: 'data' as Category }, { icon: DshIconLabTooltip, label: 'Descriptions 描述', value: 'data' as Category }, { icon: DshIconLabHeart, label: 'Empty 空状态', value: 'data' as Category }] },
  { title: '布局与导航', items: [{ icon: DshIconLabButton, label: 'Layout 布局', value: 'data' as Category }, { icon: DshIconLabTree, label: 'Nav 导航', value: 'data' as Category }, { icon: DshIconLabToast, label: 'Table 表格', value: 'data' as Category }] },
  { title: '反馈类', items: [{ icon: DshIconLabModal, label: 'Modal 对话框', value: 'modal' as Category }, { icon: DshIconLabProgress, label: 'Progress 进度条', value: 'feedback' as Category }, { icon: DshIconLabSpin, label: 'Spin 加载器', value: 'feedback' as Category }, { icon: DshIconLabToast, label: 'Toast 提示', value: 'feedback' as Category }, { icon: DshIconLabTooltip, label: 'Tooltip 文字提示', value: 'buttons' as Category }, { icon: DshIconLabDropdown, label: 'Dropdown 下拉框', value: 'buttons' as Category }, { icon: DshIconElementStroked, label: 'Popover 浮层', value: 'buttons' as Category }] },
  { title: '案例演示', items: [{ icon: DshIconLabTree, label: 'CodeBuddy 多账户', value: 'data' as Category }] },
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
  'Collapse 折叠面板': 'collapse',
  'Icon 图标': 'icon',
  'Modal 对话框': 'modal',
  'Popover 浮层': 'popover',
  'Tooltip 文字提示': 'tooltip',
  'Dropdown 下拉框': 'dropdown',
  'Progress 进度条': 'progress',
  'Spin 加载器': 'spin',
  'Toast 提示': 'toast',
  'CodeBuddy 多账户': 'codebuddy-accounts',
  'Layout 布局': 'layout',
  'Nav 导航': 'nav',
  'Table 表格': 'table',
  'Card 卡片': 'card',
  'Descriptions 描述': 'descriptions',
  'Empty 空状态': 'empty',
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
  'Collapse 折叠面板': 'data',
  'Icon 图标': 'tree',
  'Modal 对话框': 'modal',
  'Popover 浮层': 'buttons',
  'Tooltip 文字提示': 'buttons',
  'Dropdown 下拉框': 'buttons',
  'Progress 进度条': 'feedback',
  'Spin 加载器': 'feedback',
  'Toast 提示': 'feedback',
  'CodeBuddy 多账户': 'data',
  'Layout 布局': 'data',
  'Nav 导航': 'data',
  'Table 表格': 'data',
  'Card 卡片': 'data',
  'Descriptions 描述': 'data',
  'Empty 空状态': 'data',
}

function DemoCode({ children }: { children: string }): ReactNode {
  const officialSource = children
    .replaceAll('@tnnevol/dsh-semi-ui', '@douyinfe/semi-ui')
    .replace(/\bDsh(?=[A-Z])/g, '')
  return <pre className={code}><code>{officialSource}</code></pre>
}

/** Copy of the CodeBuddy logomark (same artwork as the plugin's CodeBuddyLogo). */
const CODEBUDDY_GLYPH = 'M30.5918 3.12856C30.984 2.77679 31.0078 2.7632 31.2955 2.74593C31.7615 2.71193 32.1882 2.93586 32.9147 3.59728C34.6119 5.13959 36.9755 8.30995 38.4449 11.0177L39.0125 12.0691L39.8143 12.4677C40.5885 12.8589 41.8587 13.6611 42.389 14.0913C42.6286 14.2894 42.6626 14.2934 42.912 14.1964C44.0375 13.7583 45.6494 14.3393 47.0714 15.7033C48.3516 16.9303 49.5781 19.0269 50.0478 20.7767C50.1164 21.0582 50.2074 21.6636 50.2405 22.1144C50.3477 23.6973 49.84 24.9617 48.8624 25.5341C48.6628 25.6493 48.6492 25.6807 48.6548 26.1783C48.6998 28.5492 48.0606 30.9165 46.7768 33.2244C45.3276 35.8156 42.7467 38.496 39.2544 41.0214C37.3789 42.3862 32.9421 44.9717 30.9361 45.8792C26.1304 48.0428 22.278 48.8718 18.9316 48.4618C16.9356 48.22 14.6761 47.4417 13.3392 46.5373C12.9873 46.294 12.9318 46.2791 12.6629 46.3561C11.2318 46.7671 9.35752 45.9219 7.76528 44.1544C7.13027 43.448 6.10508 41.7136 5.77273 40.7853C5.00409 38.6128 5.15721 36.6516 6.18105 35.4808C6.44522 35.1797 6.4538 35.1667 6.39603 34.6598C6.30065 33.8298 6.25703 32.6017 6.30061 31.809L6.33535 31.0683L5.22371 29.1019C3.50212 26.0386 2.40857 23.4663 1.98661 21.501C1.76389 20.4233 1.77734 19.9446 2.05091 19.5908C2.21741 19.3773 2.76347 19.1568 3.42155 19.0352C5.07869 18.7442 8.69327 19.0065 12.7142 19.7165L13.1316 19.789L14.0497 18.977C15.5733 17.6274 16.5858 16.8705 18.4518 15.707C20.3967 14.4901 22.5922 13.4895 25.064 12.6968L25.8564 12.4423L26.2926 11.2974C27.8535 7.17701 29.452 4.13917 30.5918 3.12856ZM17.5169 24.2439C15.7528 25.2625 14.8705 25.7716 14.2223 26.3423C11.5975 28.6536 10.6172 32.3151 11.7346 35.6292C12.0106 36.4475 12.5193 37.3301 13.5378 39.0941C14.5563 40.8582 15.0662 41.7401 15.637 42.3882C17.9483 45.0128 21.6091 45.9938 24.923 44.8764C25.7414 44.6004 26.6233 44.0909 28.3875 43.0724L38.5362 37.213C40.3004 36.1945 41.1826 35.6854 41.8308 35.1147C44.4555 32.8034 45.4363 29.1426 44.319 25.8286C44.043 25.0103 43.5343 24.1277 42.5158 22.3637C41.4974 20.5997 40.9873 19.7177 40.4166 19.0696C38.1053 16.4448 34.4441 15.4631 31.1301 16.5806C30.3118 16.8565 29.4297 17.3661 27.6656 18.3846L17.5169 24.2439Z'

function CodeBuddyDemoLogo({ size = 18 }: { size?: number }): ReactNode {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      <g transform="scale(0.6)">
        <rect x="0" y="0" width="40" height="40" rx="8.63158" fill="#6C4DFF" />
        <path d={CODEBUDDY_GLYPH} fill="#fff" />
        <rect x="18.4944" y="31.334" width="4.00904" height="8.32646" rx="2.00452" transform="rotate(-30 18.4944 31.334)" fill="#fff" />
        <rect x="29.311" y="25.0898" width="4.00904" height="8.32646" rx="2.00452" transform="rotate(-30 29.311 25.0898)" fill="#fff" />
      </g>
    </svg>
  )
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
  // Multi-user management demo state: a mock account roster driving the
  // Collapse panel, mirroring the CodeBuddySection account shape.
  type DemoAccount = { id: string, name: string, uid: string, tag: string, uid2?: string, enterprise?: string }
  const [userAccounts, setUserAccounts] = useState<DemoAccount[]>([
    { id: 'u-01', name: '主账号', uid: '9584b7fb-14ef-4ada-af99-b5eb10ecaf2e', tag: '当前', uid2: '10086' },
    { id: 'u-02', name: '体验账号', uid: '3f2a9c81-7c55-4e21-9a30-8d1b2c4d5e6f', tag: '备用', enterprise: '示例科技（深圳）有限公司' },
    { id: 'u-03', name: '涨涨涨', uid: 'c81e728d-9d54-4b21-b9a6-0b1d3a5f7e89', tag: '备用', uid2: '10010' },
  ])
  // Which state variant the 多状态展示 grid renders: loading / empty /
  // signed-out / error are static fixtures; normal edits the shared roster.
  const [cbDemoState, setCbDemoState] = useState<'roster' | 'loading' | 'empty' | 'signed-out' | 'error'>('roster')
  // 添加账号表单 state.
  const [cbFormOpen, setCbFormOpen] = useState(false)
  const [cbFormNickname, setCbFormNickname] = useState('')
  const [cbFormEnterprise, setCbFormEnterprise] = useState(false)
  // 危险操作确认 demo state: the pending-removal account id.
  const [cbRemoveTarget, setCbRemoveTarget] = useState<string | undefined>(undefined)
  // 账号掉线 demo state: ids of accounts whose refresh credential expired.
  const [cbExpiredIds, setCbExpiredIds] = useState<string[]>([])
  // Re-login flow state: which expired account is being re-authenticated.
  const [cbReloginTarget, setCbReloginTarget] = useState<string | undefined>(undefined)
  // 添加账号弹框的提交动作：抽出为命名回调，避免 JSX 属性里多层嵌套括号。
  // 复制登录链接由 Typography.Text 的 copyable 内置能力承担（图标跟随标题、
  // 自动反馈复制成功），不再需要自建剪贴板回调。
  const cbSubmitAccount = (): void => {
    setCbFormOpen(false)
    setCbDemoState('roster')
    setUserAccounts(items => [...items, {
      id: `u-${String(items.length + 1).padStart(2, '0')}`,
      name: cbFormNickname.trim().length > 0 ? cbFormNickname.trim() : `新账号 ${items.length + 1}`,
      uid: `新增-${items.length + 1}`,
      tag: '当前',
      ...(cbFormEnterprise ? { enterprise: '示例科技（深圳）有限公司' } : {}),
    }].map((item, index, all) => index === all.length - 1 ? item : { ...item, tag: '备用' }))
    DshToast.success({ content: '演示：登录成功后该账号会成为当前账号' })
  }
  // 偏好设置 demo state.
  const [cbPrefShowUsage, setCbPrefShowUsage] = useState(true)
  const [cbPrefDangerPct, setCbPrefDangerPct] = useState(90)
  const [cbPrefAutoSwitch, setCbPrefAutoSwitch] = useState(false)
  // 额度气泡 demo: 8 mock packages so the 388px ScrollList actually scrolls.
  const usageDemoWindows = useMemo(() => [
    { name: 'CodeBuddy个人体验版', used: 60, limit: 100, usedPercent: 60, resetsAt: '2026-10-01 00:00:00' },
    { name: '企业共享套餐', used: 320, limit: 800, usedPercent: 40, resetsAt: '2026-09-30 00:00:00' },
    { name: '充值包 A', used: 12, limit: 50, usedPercent: 24, resetsAt: '2026-12-31 00:00:00' },
    { name: '充值包 B', used: 45, limit: 50, usedPercent: 90, resetsAt: '2026-12-31 00:00:00' },
    { name: '赠送体验包', used: 8, limit: 30, usedPercent: 27, resetsAt: '2026-11-15 00:00:00' },
    { name: '团队协作包', used: 210, limit: 300, usedPercent: 70, resetsAt: '2026-10-20 00:00:00' },
    { name: '新客礼包', used: 0, limit: 20, usedPercent: 0, resetsAt: '2027-01-01 00:00:00' },
    { name: '升级补差包', used: 5, limit: 40, usedPercent: 13, resetsAt: '2026-10-10 00:00:00' },
  ], [])
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
    : activeComponent === 'CodeBuddy 多账户'
      ? 'CodeBuddy 插件多用户管理的完整 UI 评定页：账号列表的多种运行状态，以及添加账号表单、危险操作确认与偏好设置表单。'
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
          : activeComponent === 'Collapse 折叠面板'
            ? '折叠面板用于将同类内容收纳进可展开的区域，适合账号列表、分组配置等纵向空间受限的场景。'
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
    : activeComponent === 'CodeBuddy 多账户'
      ? [['完整形态', 'cb-full'], ['多状态展示', 'cb-states'], ['添加账号表单', 'cb-form'], ['危险操作确认', 'cb-danger'], ['账号掉线与重新登录', 'cb-expired'], ['额度气泡', 'cb-usage'], ['偏好设置', 'cb-prefs']]
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
        : activeComponent === 'Collapse 折叠面板'
          ? [['基本用法', 'collapse-basic'], ['多用户管理示例', 'collapse-users'], ['创建用户', 'collapse-create']]
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

            {activeComponent === 'CodeBuddy 多账户' ? (
              <>
                {/* 完整形态：与 CodeBuddySection 账号管理区同名 class 的 1:1 预览。 */}
                <h2 id="cb-full" className={sectionTitle}>完整形态</h2>
                <p className={sectionText}>与 CodeBuddy 插件「账号管理」设置区同名 class、同一套结构的 1:1 预览：每个账号一个折叠面板，头部为昵称 + 绿色「当前」Tag；激活账号头部无操作按钮，其余账号放「设为当前」；展开后是账号信息行与「删除账号」。</p>
                <DemoCard source={'// 与 CodeBuddySection 的账号管理区结构一致（同名 class）\n<div className="dsh-codebuddy-accounts">\n  <div className="dsh-codebuddy-accounts-head">\n    <span className="dsh-codebuddy-accounts-title">账号管理</span>\n    <Button size="small" theme="solid" type="primary" onClick={openAddForm}>添加账号</Button>\n  </div>\n  <p className="dsh-codebuddy-accounts-desc">已登录的 CodeBuddy 账号……</p>\n  <Collapse className="dsh-codebuddy-accounts-collapse" expandIconPosition="left">\n    {accounts.map(account => (\n      <Collapse.Panel\n        key={account.id}\n        itemKey={account.id}\n        header={\n          <span className="dsh-codebuddy-account-header">\n            <span className="dsh-codebuddy-account-name">{account.nickname}</span>\n            {account.active && <Tag size="small" type="solid" color="green">当前</Tag>}\n          </span>\n        }\n        extra={account.active ? undefined : (\n          <Button size="small" theme="light" type="secondary">设为当前</Button>\n        )}\n      >\n        <div className="dsh-codebuddy-account-body">…账号信息行…</div>\n      </Collapse.Panel>\n    ))}\n  </Collapse>\n</div>'}>
                  <div className="dsh-codebuddy-section dsh-semi-showcase-collapse-plugin-section">
                    <div className="dsh-codebuddy-title-row">
                      <CodeBuddyDemoLogo />
                      <h2 className="dsh-codebuddy-title">CodeBuddy</h2>
                    </div>
                    <p className="dsh-codebuddy-desc">使用腾讯 CodeBuddy 账号登录。</p>
                    <div className="dsh-codebuddy-accounts">
                      <div className="dsh-codebuddy-accounts-head">
                        <span className="dsh-codebuddy-accounts-title">账号管理</span>
                        <DshButton
                          htmlType="button"
                          size="small"
                          theme="solid"
                          type="primary"
                          onClick={() => { setCbFormOpen(true); setCbFormNickname(''); setCbFormEnterprise(false) }}
                        >
                          添加账号
                        </DshButton>
                      </div>
                      <p className="dsh-codebuddy-accounts-desc">已登录的 CodeBuddy 账号。展开面板可管理对应账号；请求均使用当前账号。</p>
                      <DshCollapse className="dsh-codebuddy-accounts-collapse" expandIconPosition="left" defaultActiveKey="u-01">
                        {userAccounts.map(user => (
                          <DshCollapse.Panel
                            key={user.id}
                            itemKey={user.id}
                            header={(
                              <span className="dsh-codebuddy-account-header">
                                <span className="dsh-codebuddy-account-name">{user.name}</span>
                                {user.tag === '当前' ? <DshTag size="small" type="solid" color="green">当前</DshTag> : null}
                              </span>
                            )}
                            extra={user.tag === '当前' ? undefined : (
                              <DshButton
                                htmlType="button"
                                size="small"
                                theme="light"
                                type="secondary"
                                onClick={() => { setUserAccounts(items => items.map(item => ({ ...item, tag: item.id === user.id ? '当前' : '备用' }))) }}
                              >
                                设为当前
                              </DshButton>
                            )}
                          >
                            <div className="dsh-codebuddy-account-body">
                              <div className="dsh-codebuddy-row"><span className="dsh-codebuddy-row-label">UID</span><span className="dsh-codebuddy-row-value">{user.uid}</span></div>
                              {user.enterprise !== undefined
                                ? <div className="dsh-codebuddy-row"><span className="dsh-codebuddy-row-label">企业</span><span className="dsh-codebuddy-row-value">{user.enterprise}</span></div>
                                : null}
                              <div className="dsh-codebuddy-row"><span className="dsh-codebuddy-row-label">UIN</span><span className="dsh-codebuddy-row-value">{user.uid2 ?? '—'}</span></div>
                              <div className="dsh-codebuddy-account-remove">
                                <DshButton
                                  htmlType="button"
                                  size="small"
                                  type="danger"
                                  theme="borderless"
                                  onClick={() => { setCbRemoveTarget(user.id) }}
                                >
                                  删除账号
                                </DshButton>
                              </div>
                            </div>
                          </DshCollapse.Panel>
                        ))}
                      </DshCollapse>
                    </div>
                  </div>
                </DemoCard>

                {/* 多状态展示：加载 / 空 / 未登录过期 / 错误 / 已登录花名册。 */}
                <h2 id="cb-states" className={sectionTitle}>多状态展示</h2>
                <p className={sectionText}>账号区在真实插件中的五种运行状态：加载中（首发拉取）、空（从未登录）、未登录（凭据过期，需重新登录）、错误（RPC 或凭据文件不可读）、正常花名册。切换下方按钮对比各状态的排版。</p>
                <DemoCard source={'type AccountsState = "loading" | "empty" | "signed-out" | "error" | "roster"\n\n// loading     → <Spin size="middle" /> 包裹占位\n// empty       → 「暂无已登录账号。」+ 主 CTA「添加账号」\n// signed-out  → 黄色提示「登录已过期」+ 「重新登录」主按钮\n// error       → 红色错误行 + 重试按钮\n// roster      → 正常折叠面板列表'}>
                  <div className={demo}>
                    {([['roster', '正常'], ['loading', '加载中'], ['empty', '空'], ['signed-out', '未登录'], ['error', '错误']] as const).map(([state, label]) => (
                      <DshButton key={state} type={cbDemoState === state ? 'primary' : 'secondary'} theme={cbDemoState === state ? 'solid' : 'light'} size="small" onClick={() => { setCbDemoState(state) }}>{label}</DshButton>
                    ))}
                  </div>
                  <div className="dsh-codebuddy-section dsh-semi-showcase-collapse-plugin-section">
                    <div className="dsh-codebuddy-accounts">
                      <div className="dsh-codebuddy-accounts-head">
                        <span className="dsh-codebuddy-accounts-title">账号管理</span>
                        {cbDemoState !== 'loading' ? <DshButton htmlType="button" size="small" theme="solid" type="primary" onClick={() => { setCbDemoState('roster') }}>添加账号</DshButton> : null}
                      </div>
                      {cbDemoState === 'loading' ? (
                        <div className="dsh-semi-showcase-collapse-state-block"><DshSpin size="middle" /><span className="dsh-codebuddy-accounts-desc">正在加载账号…</span></div>
                      ) : cbDemoState === 'empty' ? (
                        <div className="dsh-semi-showcase-collapse-state-block">
                          <span className="dsh-codebuddy-accounts-desc">暂无已登录账号。点击「添加账号」完成浏览器登录。</span>
                        </div>
                      ) : cbDemoState === 'signed-out' ? (
                        <div className="dsh-semi-showcase-collapse-state-block dsh-semi-showcase-collapse-state-warn">
                          <span className="dsh-codebuddy-accounts-desc">登录已过期。之前的账号凭据已失效，需要重新登录才能继续使用。</span>
                          <DshButton htmlType="button" size="small" theme="solid" type="primary" onClick={() => { setCbDemoState('roster') }}>重新登录</DshButton>
                        </div>
                      ) : cbDemoState === 'error' ? (
                        <div className="dsh-semi-showcase-collapse-state-block">
                          <span className="dsh-codebuddy-error">not-found: 账号列表加载失败。</span>
                          <DshButton htmlType="button" size="small" theme="light" type="secondary" icon={<DshIconRefresh />} onClick={() => { setCbDemoState('roster') }}>重试</DshButton>
                        </div>
                      ) : (
                        <DshCollapse className="dsh-codebuddy-accounts-collapse" expandIconPosition="left">
                          {userAccounts.slice(0, 2).map(user => (
                            <DshCollapse.Panel
                              key={user.id}
                              itemKey={user.id}
                              header={(
                                <span className="dsh-codebuddy-account-header">
                                  <span className="dsh-codebuddy-account-name">{user.name}</span>
                                  {user.tag === '当前' ? <DshTag size="small" type="solid" color="green">当前</DshTag> : null}
                                </span>
                              )}
                            >
                              <div className="dsh-codebuddy-account-body">
                                <div className="dsh-codebuddy-row"><span className="dsh-codebuddy-row-label">UID</span><span className="dsh-codebuddy-row-value">{user.uid}</span></div>
                              </div>
                            </DshCollapse.Panel>
                          ))}
                        </DshCollapse>
                      )}
                    </div>
                  </div>
                </DemoCard>

                {/* 添加账号表单。 */}
                <h2 id="cb-form" className={sectionTitle}>添加账号表单</h2>
                <p className={sectionText}>点上方「添加账号」或下方按钮弹出表单：昵称可选备注、企业账号开关，提交后追加一个演示账号。弹框标题右侧是 Semi Typography 自带的复制图标（Typography.Text 的 `copyable` 能力）：点击复制登录链接，成功后图标变对勾并显示"复制成功"，无需自建复制按钮。</p>
                <DemoCard source={'// 复制功能使用 Semi Typography 自带的 copyable：图标跟随标题，\n// 点击即复制并自动反馈（图标变对勾 + "复制成功"），无需手写剪贴板逻辑。\n<DshModal\n  title={\n    <DshTypography.Text copyable={{ content: loginLink }}>\n      添加 CodeBuddy 账号\n    </DshTypography.Text>\n  }\n  visible={visible} onOk={submit} onCancel={close}\n>\n  <DshForm labelPosition="top">\n    <DshForm.Slot label="备注名"><DshInput maxLength={120} placeholder="可选" /></DshForm.Slot>\n    <DshForm.Slot label="企业账号"><DshSwitch /></DshForm.Slot>\n  </DshForm>\n</DshModal>'}>
                  <DshButton type="primary" theme="solid" onClick={() => { setCbFormOpen(true); setCbFormNickname(''); setCbFormEnterprise(false) }}>打开添加账号表单</DshButton>
                  <DshModal
                    title={(
                      <DshTypography.Text copyable={{ content: 'https://auth.example.com/oauth/authorize?state=demo' }}>
                        添加 CodeBuddy 账号
                      </DshTypography.Text>
                    )}
                    visible={cbFormOpen}
                    closeOnEsc
                    onCancel={() => { setCbFormOpen(false) }}
                    onOk={() => { cbSubmitAccount() }}
                  >
                    <div className="dsh-semi-showcase-collapse-create-body">
                      <DshForm className="dsh-semi-showcase-form" labelPosition="top">
                        <DshForm.Slot label={<span className="dsh-semi-showcase-form-preference-label"><strong>备注名</strong></span>}>
                          <DshInput className="dsh-semi-showcase-control" value={cbFormNickname} onChange={setCbFormNickname} placeholder="可选" showClear maxLength={120} />
                        </DshForm.Slot>
                        <DshForm.Slot label={<span className="dsh-semi-showcase-form-preference-label"><strong>企业账号</strong><span>企业账号登录后额外展示企业名称与部门信息。</span></span>}>
                          <DshSwitch checked={cbFormEnterprise} onChange={(checked: boolean) => { setCbFormEnterprise(checked) }} aria-label="企业账号" />
                        </DshForm.Slot>
                      </DshForm>
                      <p className="dsh-semi-showcase-secondary-text">点击标题右侧的复制图标可复制登录链接；演示中「打开登录页」直接创建账号，实际插件会在此步打开浏览器 OAuth 登录。</p>
                    </div>
                  </DshModal>
                </DemoCard>

                {/* 危险操作确认。 */}
                <h2 id="cb-danger" className={sectionTitle}>危险操作确认</h2>
                <p className={sectionText}>删除账号前弹出确认 Modal：正文标明该账号将丢失的凭据与当前身份，删除当前账号时会提示后续将切换到的账号。在「完整形态」卡中点「删除账号」也会触发同一个确认。</p>
                <DemoCard source={'<DshModal\n  title="删除账号"\n  type="warning"\n  visible={visible}\n  okText="确认删除"\n  okButtonProps={{ type: "danger" }}\n  onOk={confirmRemove}\n  onCancel={close}\n>\n  确定删除该账号？其存储的登录凭据将被清除。\n</DshModal>'}>
                  <DshButton type="danger" theme="light" onClick={() => { setCbRemoveTarget(userAccounts[0]?.id) }}>演示删除确认</DshButton>
                </DemoCard>

                {/* 账号掉线与重新登录。 */}
                <h2 id="cb-expired" className={sectionTitle}>账号掉线与重新登录</h2>
                <p className={sectionText}>多账号下其中某个账号凭据过期的场景：掉线账号的头部标记黄色「已掉线」Tag 并把「设为当前」换成「重新登录」主按钮；展开后显示掉线原因与恢复动作。若掉线的是当前账号，账单区顶部出现警示条，请求自动改由剩余账号中最靠前的可用账号接管（头部「当前」Tag 随之移动）。下方按钮把任一账号置为掉线/恢复，模拟一次完整生命周期。</p>
                <DemoCard source={'// 掉线账号的折叠面板：头部 Tag 与 extra 按账号状态切换\n{accounts.map(account => (\n  <Collapse.Panel\n    key={account.id}\n    itemKey={account.id}\n    header={\n      <span className="dsh-codebuddy-account-header">\n        <span className="dsh-codebuddy-account-name">{account.nickname}</span>\n        {account.expired\n          ? <Tag size="small" type="light" color="orange">已掉线</Tag>\n          : account.active && <Tag size="small" type="solid" color="green">当前</Tag>}\n      </span>\n    }\n    extra={account.expired\n      ? <Button size="small" theme="solid" type="primary">重新登录</Button>\n      : account.active ? undefined : <Button size="small" theme="light">设为当前</Button>}\n    >\n      {account.expired\n        ? <div className="dsh-codebuddy-account-expired">\n            <span>该账号的登录凭据已过期，无法发起请求或查询额度。</span>\n            <Button size="small" type="primary" theme="solid">重新登录</Button>\n          </div>\n        : <div className="dsh-codebuddy-account-body">…账号信息行…</div>}\n    </Collapse.Panel>\n  ))}\n}\n\n// 掉线的是当前账号时，面板顶部出现接管警示条\n{ takeoverBy && (\n  <div className="dsh-codebuddy-account-takeover">\n    当前账号已掉线，请求改由「{takeoverBy.nickname}」接管。为掉线账号重新登录后可切回。\n  </div>\n)'}>
                  <div className={demo}>
                    <DshButton
                      htmlType="button"
                      size="small"
                      theme="light"
                      type={cbExpiredIds.length > 0 ? 'secondary' : 'warning'}
                      onClick={() => { setCbExpiredIds(ids => ids.length > 0 ? [] : [userAccounts.find(item => item.tag === '当前')?.id ?? 'u-01']) }}
                    >
                      {cbExpiredIds.length > 0 ? '全部恢复在线' : '让当前账号掉线'}
                    </DshButton>
                    <DshButton
                      htmlType="button"
                      size="small"
                      theme="light"
                      type="warning"
                      onClick={() => { setCbExpiredIds(ids => ids.length > 0 ? ids : ['u-03']) }}
                    >
                      让备用账号掉线
                    </DshButton>
                  </div>
                  <div className="dsh-codebuddy-section dsh-semi-showcase-collapse-plugin-section">
                    <div className="dsh-codebuddy-accounts">
                      <div className="dsh-codebuddy-accounts-head">
                        <span className="dsh-codebuddy-accounts-title">账号管理</span>
                        <DshButton
                          htmlType="button"
                          size="small"
                          theme="solid"
                          type="primary"
                          onClick={() => { setCbFormOpen(true); setCbFormNickname(''); setCbFormEnterprise(false) }}
                        >
                          添加账号
                        </DshButton>
                      </div>
                      <p className="dsh-codebuddy-accounts-desc">已登录的 CodeBuddy 账号。展开面板可管理对应账号；请求均使用当前账号。</p>
                      {(() => {
                        const expiredActive = userAccounts.find(item => item.id === cbExpiredIds[0] && item.tag === '当前')
                        const takeoverBy = expiredActive !== undefined
                          ? userAccounts.find(item => !cbExpiredIds.includes(item.id) && item.id !== expiredActive.id)
                          : undefined
                        return (
                          <>
                            {expiredActive !== undefined && takeoverBy !== undefined ? (
                              <div className="dsh-codebuddy-account-takeover">
                                <DshIconAlertCircle aria-hidden />
                                <span>当前账号「{expiredActive.name}」已掉线，请求改由「{takeoverBy.name}」接管。为掉线账号重新登录后可切回。</span>
                              </div>
                            ) : null}
                            <DshCollapse className="dsh-codebuddy-accounts-collapse" expandIconPosition="left" defaultActiveKey={cbExpiredIds[0] ?? undefined}>
                              {userAccounts.map(user => {
                                const expired = cbExpiredIds.includes(user.id)
                                return (
                                  <DshCollapse.Panel
                                    key={user.id}
                                    itemKey={user.id}
                                    header={(
                                      <span className="dsh-codebuddy-account-header">
                                        <span className="dsh-codebuddy-account-name">{user.name}</span>
                                        {expired
                                          ? <DshTag size="small" type="light" color="orange">已掉线</DshTag>
                                          : user.tag === '当前' ? <DshTag size="small" type="solid" color="green">当前</DshTag> : null}
                                      </span>
                                    )}
                                    extra={expired ? (
                                      <DshButton
                                        htmlType="button"
                                        size="small"
                                        theme="solid"
                                        type="primary"
                                        onClick={() => { setCbReloginTarget(user.id) }}
                                      >
                                        重新登录
                                      </DshButton>
                                    ) : user.tag === '当前' ? undefined : (
                                      <DshButton
                                        htmlType="button"
                                        size="small"
                                        theme="light"
                                        type="secondary"
                                        onClick={() => { setUserAccounts(items => items.map(item => ({ ...item, tag: item.id === user.id ? '当前' : '备用' }))) }}
                                      >
                                        设为当前
                                      </DshButton>
                                    )}
                                  >
                                    {expired ? (
                                      <div className="dsh-codebuddy-account-expired">
                                        <span className="dsh-codebuddy-account-expired-text">该账号的登录凭据已过期，无法发起请求或查询额度。重新登录后凭据与额度信息会自动恢复，历史偏好保留。</span>
                                        <DshButton
                                          htmlType="button"
                                          size="small"
                                          theme="solid"
                                          type="primary"
                                          onClick={() => { setCbReloginTarget(user.id) }}
                                        >
                                          重新登录
                                        </DshButton>
                                      </div>
                                    ) : (
                                      <div className="dsh-codebuddy-account-body">
                                        <div className="dsh-codebuddy-row"><span className="dsh-codebuddy-row-label">UID</span><span className="dsh-codebuddy-row-value">{user.uid}</span></div>
                                        {user.enterprise !== undefined
                                          ? <div className="dsh-codebuddy-row"><span className="dsh-codebuddy-row-label">企业</span><span className="dsh-codebuddy-row-value">{user.enterprise}</span></div>
                                          : null}
                                        <div className="dsh-codebuddy-row"><span className="dsh-codebuddy-row-label">UIN</span><span className="dsh-codebuddy-row-value">{user.uid2 ?? '—'}</span></div>
                                        <div className="dsh-codebuddy-account-remove">
                                          <DshButton
                                            htmlType="button"
                                            size="small"
                                            type="danger"
                                            theme="borderless"
                                            onClick={() => { setCbRemoveTarget(user.id) }}
                                          >
                                            删除账号
                                          </DshButton>
                                        </div>
                                      </div>
                                    )}
                                  </DshCollapse.Panel>
                                )
                              })}
                            </DshCollapse>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                </DemoCard>

                {/* 额度气泡：Ring + Popover，多套餐列表用 Semi ScrollList 承载（max-height 388，超出滚动）。 */}
                <h2 id="cb-usage" className={sectionTitle}>额度气泡</h2>
                <p className={sectionText}>对话输入区右侧的额度指示器：圆环显示合并余量，点击弹出多套餐明细浮层。浮层内容区使用 Semi 的 ScrollList 组件承载，`max-height` 388px——套餐少时按内容自然撑开不出现空白，超过 388px 才进入 Y 轴滚动，滚动条样式由 DSH 主题统一。下方演示造了 8 个套餐以验证滚动。</p>
                <DemoCard source={'// 气泡内容区：ScrollList 内容区 max-height=388，超出自动滚动\n<DshPopover\n  trigger="click"\n  position="topRight"\n  content={\n    <DshScrollList className="dsh-codebuddy-usage-popover-scroll">\n      {windows.map(w => (\n        <div className="dsh-codebuddy-usage-popover-window" key={w.name}>\n          <div className="dsh-codebuddy-usage-popover-heading">\n            <span>{w.name}</span>\n            <span>剩余 {w.remaining}%</span>\n          </div>\n          <DshProgress percent={w.remaining} showInfo={false} />\n          <span className="dsh-codebuddy-usage-popover-reset">{w.resetsAt}</span>\n        </div>\n      ))}\n    </DshScrollList>\n  }\n>\n  <DshProgress type="circle" percent={remain} width={26} />\n</DshPopover>'}>
                  <div className="dsh-codebuddy-section dsh-semi-showcase-collapse-plugin-section">
                    <div className="dsh-codebuddy-usage-demo-row">
                      <DshPopover
                        trigger="click"
                        position="bottomLeft"
                        showArrow={false}
                        contentClassName="dsh-codebuddy-usage-popover"
                        content={(
                          <DshScrollList className="dsh-codebuddy-usage-popover-scroll">
                            {usageDemoWindows.map((window, index) => (
                              <div className="dsh-codebuddy-usage-popover-window" key={`${window.name}-${index}`}>
                                <div className="dsh-codebuddy-usage-popover-heading">
                                  <span>{window.name}</span>
                                  <span>{`剩余 ${Math.round(100 - window.usedPercent)}%`}</span>
                                </div>
                                <div className="dsh-codebuddy-usage-popover-amounts">
                                  <span>{'已用额度'}</span>
                                  <span>{`${window.used} / ${window.limit}`}</span>
                                </div>
                                <DshProgress
                                  percent={100 - window.usedPercent}
                                  showInfo={false}
                                  stroke="var(--dsw-alias-label-tertiary)"
                                  orbitStroke="var(--dsw-alias-border-l3)"
                                  className="dsh-codebuddy-usage-popover-progress"
                                />
                                <span className="dsh-codebuddy-usage-popover-reset">{`重置 ${window.resetsAt}`}</span>
                              </div>
                            ))}
                          </DshScrollList>
                        )}
                      >
                        <span
                          className="dsh-codebuddy-usage-popover-trigger"
                          role="button"
                          tabIndex={0}
                        >
                          <DshProgress
                            type="circle"
                            percent={37}
                            width={26}
                            strokeWidth={3}
                            stroke="var(--dsw-alias-label-tertiary)"
                            orbitStroke="var(--dsw-alias-border-l3)"
                            showInfo
                            format={() => <CodeBuddyDemoLogo size={12} />}
                          />
                        </span>
                      </DshPopover>
                      <span className="dsh-codebuddy-accounts-desc">点击圆环打开气泡；8 个套餐超出 388px 高度，内容区自动滚动。</span>
                    </div>
                  </div>
                </DemoCard>

                {/* 偏好设置。 */}
                <h2 id="cb-prefs" className={sectionTitle}>偏好设置</h2>
                <p className={sectionText}>账号区下方的偏好表单，与用量展示联动的三项 UI 偏好：显示额度余量、余量告警百分比，以及多账户新增的「额度不足自动切换」演示开关。</p>
                <DemoCard source={'<DshForm labelPosition="left">\n  <DshForm.Slot label="显示额度余量"><DshSwitch /></DshForm.Slot>\n  <DshForm.Slot label="余量告警百分比"><DshSlider min={1} max={100} /></DshForm.Slot>\n  <DshForm.Slot label="额度不足自动切换"><DshSwitch /></DshForm.Slot>\n</DshForm>'}>
                  <div className="dsh-codebuddy-section dsh-semi-showcase-collapse-plugin-section">
                    <DshForm className="dsh-codebuddy-pref-form" labelPosition="left">
                      <DshForm.Slot label={<span className="dsh-semi-showcase-form-preference-label"><strong>显示额度余量</strong><span>在对话框输入区显示已用额度进度。</span></span>}>
                        <DshSwitch checked={cbPrefShowUsage} onChange={(checked: boolean) => { setCbPrefShowUsage(checked) }} aria-label="显示额度余量" />
                      </DshForm.Slot>
                      <DshForm.Slot label={<span className="dsh-semi-showcase-form-preference-label"><strong>余量告警百分比</strong><span>已用百分比达到此值时，进度条变为红色提醒。</span></span>}>
                        <div className="dsh-semi-showcase-form-slider">
                          <DshSlider value={cbPrefDangerPct} min={1} max={100} step={1} onChange={(value: number | [number, number]) => { if (typeof value === 'number') setCbPrefDangerPct(value) }} aria-label="余量告警百分比" />
                          <span className="dsh-semi-showcase-form-slider-value">{cbPrefDangerPct}%</span>
                        </div>
                      </DshForm.Slot>
                      <DshForm.Slot label={<span className="dsh-semi-showcase-form-preference-label"><strong>额度不足自动切换</strong><span>当前账号额度告警时自动切换到额度最充裕的备用账号。</span></span>}>
                        <DshSwitch checked={cbPrefAutoSwitch} onChange={(checked: boolean) => { setCbPrefAutoSwitch(checked) }} aria-label="额度不足自动切换" />
                      </DshForm.Slot>
                    </DshForm>
                  </div>
                </DemoCard>

                {/* 删除确认 Modal：完整形态与危险操作演示共用。 */}
                <DshModal
                  title="删除账号"
                  type="warning"
                  visible={cbRemoveTarget !== undefined}
                  closeOnEsc
                  okText="确认删除"
                  cancelText="取消"
                  okButtonProps={{ type: 'danger', theme: 'solid' }}
                  onCancel={() => { setCbRemoveTarget(undefined) }}
                  onOk={() => {
                    const target = cbRemoveTarget
                    setCbRemoveTarget(undefined)
                    if (target === undefined) return
                    setUserAccounts(items => {
                      const remaining = items.filter(item => item.id !== target)
                      if (remaining.length === 0) { setCbDemoState('empty'); return items }
                      return remaining.map((item, index) => index === 0 ? { ...item, tag: '当前' } : item)
                    })
                  }}
                >
                  <p>确定删除该账号？其存储的登录凭据将被清除。</p>
                  <p className="dsh-semi-showcase-secondary-text">若删除的是当前账号，将自动切换到列表中剩余的第一个账号；删除最后一个账号即退出登录。</p>
                </DshModal>

                {/* 重新登录 Modal：模拟为掉线账号重新走一遍 OAuth，成功后账号恢复在线。 */}
                <DshModal
                  title="重新登录"
                  visible={cbReloginTarget !== undefined}
                  closeOnEsc
                  okText="完成登录"
                  cancelText="取消"
                  onCancel={() => { setCbReloginTarget(undefined) }}
                  onOk={() => {
                    const target = cbReloginTarget
                    setCbReloginTarget(undefined)
                    if (target === undefined) return
                    setCbExpiredIds(ids => ids.filter(id => id !== target))
                    setUserAccounts(items => items.map(item => item.id === target ? { ...item, tag: '当前' } : item))
                    DshToast.success({ content: '登录成功：凭据已更新，账号恢复在线' })
                  }}
                >
                  <div className="dsh-semi-showcase-collapse-create-body">
                    <p>
                      即将为「{userAccounts.find(item => item.id === cbReloginTarget)?.name ?? '该账号'}」重新打开浏览器登录。
                      完成授权后该账号的凭据会被替换更新，昵称、UID 与偏好设置保持不变。
                    </p>
                    <p className="dsh-semi-showcase-secondary-text">演示中点「完成登录」直接恢复在线；实际插件会在此步打开腾讯 CodeBuddy OAuth 页并轮询登录结果。</p>
                  </div>
                </DshModal>
              </>
            ) : null}

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

            {category === 'data' && activeComponent === 'Collapse 折叠面板' ? (
              <>
                <h2 id="collapse-basic" className={sectionTitle}>基本用法</h2>
                <p className={sectionText}>通过 `itemKey` 标识面板，`header` 定义标题，`extra` 承载标题行右侧操作；受控 `activeKey` 配合 `onChange` 管理展开状态。</p>
                <DemoCard source={'<DshCollapse activeKey={activeKey} onChange={setActiveKey}>\n  <DshCollapse.Panel itemKey="a" header="面板 A">内容 A</DshCollapse.Panel>\n  <DshCollapse.Panel itemKey="b" header="面板 B" extra={<Tag>备用</Tag>}>内容 B</DshCollapse.Panel>\n</DshCollapse>'}>
                  <DshCollapse className="dsh-semi-showcase-collapse" expandIconPosition="left">
                    <DshCollapse.Panel itemKey="basic-a" header="套餐说明">
                      <span className="dsh-semi-showcase-collapse-body">企业套餐按自然月重置，用量在折叠头部实时汇总。</span>
                    </DshCollapse.Panel>
                    <DshCollapse.Panel itemKey="basic-b" header="折叠但含操作" extra={<DshTag size="small" type="light">备用</DshTag>}>
                      <span className="dsh-semi-showcase-collapse-body">extra 区域的点击不会触发展开收起，适合放按钮或开关。</span>
                    </DshCollapse.Panel>
                  </DshCollapse>
                </DemoCard>

                <h2 id="collapse-users" className={sectionTitle}>多用户管理示例</h2>
                <p className={sectionText}>完整评定入口已移至侧边栏「案例演示 → CodeBuddy 多账户」，包含多状态展示与表单设置。</p>
                <DemoCard source={'详见「CodeBuddy 多账户」演示页'}>
                  <DshButton type="primary" theme="solid" onClick={() => { route.select('codebuddy-accounts') }}>前往 CodeBuddy 多账户演示</DshButton>
                </DemoCard>

                <h2 id="collapse-create" className={sectionTitle}>手风琴模式</h2>
                <p className={sectionText}>`accordion` 限制同时只展开一个面板，适合账号详情这类不需要并列阅读的场景。</p>
                <DemoCard source={'<DshCollapse accordion defaultActiveKey="only">\n  <DshCollapse.Panel itemKey="only" header="仅展开一个">...</DshCollapse.Panel>\n</DshCollapse>'}>
                  <DshCollapse className="dsh-semi-showcase-collapse" accordion defaultActiveKey="acc-a" expandIconPosition="left">
                    <DshCollapse.Panel itemKey="acc-a" header="第一个账号">
                      <span className="dsh-semi-showcase-collapse-body">手风琴模式下展开另一个面板时，当前面板自动收起。</span>
                    </DshCollapse.Panel>
                    <DshCollapse.Panel itemKey="acc-b" header="第二个账号">
                      <span className="dsh-semi-showcase-collapse-body">适合账号详情这类不需要并列阅读的场景。</span>
                    </DshCollapse.Panel>
                  </DshCollapse>
                </DemoCard>
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
