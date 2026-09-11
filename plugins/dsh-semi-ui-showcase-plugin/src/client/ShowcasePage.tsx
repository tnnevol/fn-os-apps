import type { ComponentType, ReactNode } from 'react'
import {
  DshIconArrowLeft,
  DshIconButton,
  DshIconMoon,
  DshIconSun,
  DshLayout,
  DshTooltip,
} from '@tnnevol/dsh-semi-ui'
import { useSyncExternalStore } from 'react'
import type { ShowcaseRouteController } from './route.ts'
import type { ShowcaseThemeController } from './theme-preview.ts'
import { componentByRoute, componentRouteByLabel } from './showcase/catalog.ts'
import { componentDescriptions, componentOutlines } from './showcase/descriptions.ts'
import { sidebarGroups } from './showcase/sidebar.ts'
import { brand, breadcrumb, description, heading, main, mainInner, outline, outlineItem, page, shell, sidebar, sidebarGroup, sidebarItem, sidebarTitle, topbar, topnav, topnavItem } from './showcase/class-names.ts'
import { CodeBuddySection } from './showcase/CodeBuddySection.tsx'
import { ButtonSection, DropdownSection, PopoverSection, TooltipSection } from './showcase/sections/OverlaysSections.tsx'
import { FormSection, InputNumberSection, InputSection, SliderSection, SwitchSection } from './showcase/sections/InputSections.tsx'
import { CascaderSection, CheckboxSection, SelectSection, TreeSelectSection } from './showcase/sections/SelectionSections.tsx'
import { HotKeysSection, IconSection, TreeSection } from './showcase/sections/TreeSections.tsx'
import { ModalSection, ProgressSection, SkeletonSection, SpinSection, ToastSection } from './showcase/sections/FeedbackSections.tsx'
import { CollapseSection } from './showcase/sections/CollapseSection.tsx'
import { AvatarSection, BadgeSection, TabsSection, TagSection } from './showcase/sections/DisplaySections.tsx'
import { ListSection, ScrollListSection, TypographySection } from './showcase/sections/ListSections.tsx'
import { LayoutSection, NavSection, TableSection } from './showcase/sections/NavigationSections.tsx'
import { CardSection, DescriptionsSection, EmptySection } from './showcase/sections/SurfaceSections.tsx'
import type { ComponentItem } from './showcase/types.ts'

/** 组件路由 → 主内容区渲染的 demo 区块组件。 */
const sectionByComponent: Partial<Record<ComponentItem, ComponentType>> = {
  'Button 按钮': ButtonSection,
  'Tooltip 文字提示': TooltipSection,
  'Dropdown 下拉框': DropdownSection,
  'Popover 浮层': PopoverSection,
  'Input 输入框': InputSection,
  'InputNumber 数字输入框': InputNumberSection,
  'Slider 滑块': SliderSection,
  'Switch 开关': SwitchSection,
  'Form 表单': FormSection,
  'Cascader 级联选择': CascaderSection,
  'TreeSelect 树选择器': TreeSelectSection,
  'Checkbox 复选框': CheckboxSection,
  'Select 选择器': SelectSection,
  'Tree 树形控件': TreeSection,
  'Icon 图标': IconSection,
  'HotKeys 快捷键': HotKeysSection,
  'Progress 进度条': ProgressSection,
  'Spin 加载器': SpinSection,
  'Toast 提示': ToastSection,
  'Modal 对话框': ModalSection,
  'Skeleton 骨架屏': SkeletonSection,
  'Tabs 标签栏': TabsSection,
  'Tag 标签': TagSection,
  'Avatar 头像': AvatarSection,
  'Badge 徽标': BadgeSection,
  'List 列表': ListSection,
  'Typography 排版': TypographySection,
  'ScrollList 滚动列表': ScrollListSection,
  'Layout 布局': LayoutSection,
  'Nav 导航': NavSection,
  'Table 表格': TableSection,
  'Card 卡片': CardSection,
  'Descriptions 描述': DescriptionsSection,
  'Empty 空状态': EmptySection,
}

interface ShowcasePageProps {
  route: ShowcaseRouteController
  theme: ShowcaseThemeController
}

export function ShowcasePage({ route, theme }: ShowcasePageProps): ReactNode {
  const snapshot = useSyncExternalStore(route.subscribe, route.getSnapshot, route.getSnapshot)
  const themeSnapshot = useSyncExternalStore(theme.subscribe, theme.getSnapshot, theme.getSnapshot)
  if (!snapshot.active) return null

  const activeComponent = componentByRoute[snapshot.component]
  const nextTheme = themeSnapshot.active.colorScheme === 'dark' ? 'light' : 'dark'
  const themeToggleLabel = nextTheme === 'light' ? '切换到亮色模式' : '切换到暗色模式'
  const ThemeIcon = nextTheme === 'light' ? DshIconSun : DshIconMoon
  const Section = activeComponent === 'CodeBuddy 多账户'
    ? CodeBuddySection
    : activeComponent === 'Collapse 折叠面板'
      ? undefined
      : sectionByComponent[activeComponent]

  return (
    <DshLayout className={page} data-dsh-semi-ui-showcase>
      <DshLayout.Header className={topbar}>
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
      </DshLayout.Header>
      <DshLayout hasSider className={shell}>
        <DshLayout.Sider className={sidebar} aria-label="组件导航">
          {sidebarGroups.map(group => (
            <div key={group.title} className={sidebarGroup}>
              <div className={sidebarTitle}>{group.title}</div>
              {group.items.map(({ icon: Icon, label }) => (
                <button key={label} type="button" className={`${sidebarItem}${activeComponent === label ? ' is-active' : ''}`} onClick={() => { route.select(componentRouteByLabel[label]) }}>
                  <span className="dsh-semi-showcase-sidebar-icon"><Icon aria-hidden /></span>{label}
                </button>
              ))}
            </div>
          ))}
        </DshLayout.Sider>
        <DshLayout.Content className={main}>
          <div className={mainInner}>
            <div className={breadcrumb}>组件 · {activeComponent}</div>
            <h1 className={heading}>{activeComponent}</h1>
            <p className={description}>{componentDescriptions[activeComponent]}</p>
            {Section !== undefined
              ? <Section />
              : <CollapseSection route={route} />}
          </div>
        </DshLayout.Content>
        <DshLayout.Sider className={outline} aria-label="页面目录">
          <div className="dsh-semi-showcase-outline-heading">目录</div>
          {componentOutlines[activeComponent].map(([item, target]) => (
            <button key={item} type="button" className={outlineItem} onClick={() => { document.getElementById(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>{item}</button>
          ))}
        </DshLayout.Sider>
      </DshLayout>
    </DshLayout>
  )
}
