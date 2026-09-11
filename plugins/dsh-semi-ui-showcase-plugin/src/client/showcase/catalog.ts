import type { ComponentType } from 'react'
import type { DshIconProps } from '@tnnevol/dsh-semi-ui'
import type { ShowcaseComponentRoute } from '../route.ts'
import type { Category, ComponentItem } from './types.ts'

export type { ComponentItem, Category }

/**
 * Semi 图标的公共渲染契约（通过共享 facade 暴露），仅覆盖侧边栏用到的属性。
 * 具体图标的 svg/type 已在包内固定，这里只要求可渲染并接受通用 span 属性。
 */
export type ShowcaseSidebarIcon = ComponentType<Omit<DshIconProps, 'svg' | 'type'>>
export type SidebarEntry = { icon: ShowcaseSidebarIcon; label: ComponentItem }

export interface SidebarGroup {
  title: string
  items: SidebarEntry[]
}

export const componentRouteByLabel: Record<ComponentItem, ShowcaseComponentRoute> = {
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
  'Select 选择器': 'select',
  'Skeleton 骨架屏': 'skeleton',
  'Tabs 标签栏': 'tabs',
  'Tag 标签': 'tag',
  'Avatar 头像': 'avatar',
  'Badge 徽标': 'badge',
  'List 列表': 'list',
  'Typography 排版': 'typography',
  'ScrollList 滚动列表': 'scrollList',
  'HotKeys 快捷键': 'hotKeys',
}

export const componentByRoute: Record<ShowcaseComponentRoute, ComponentItem> = Object.fromEntries(
  Object.entries(componentRouteByLabel).map(([label, componentRoute]) => [componentRoute, label]),
) as Record<ShowcaseComponentRoute, ComponentItem>

export const categoryByComponent: Record<ComponentItem, Category> = {
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
  'Select 选择器': 'selection',
  'Skeleton 骨架屏': 'feedback',
  'Tabs 标签栏': 'data',
  'Tag 标签': 'data',
  'Avatar 头像': 'data',
  'Badge 徽标': 'data',
  'List 列表': 'data',
  'Typography 排版': 'data',
  'ScrollList 滚动列表': 'data',
  'HotKeys 快捷键': 'data',
}
