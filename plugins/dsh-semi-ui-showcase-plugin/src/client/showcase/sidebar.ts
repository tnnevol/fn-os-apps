import {
  DshIconLabAvatar,
  DshIconLabButton,
  DshIconLabCascader,
  DshIconLabChart,
  DshIconLabCheckbox,
  DshIconLabDropdown,
  DshIconElementStroked,
  DshIconLabHeart,
  DshIconLabModal,
  DshIconLabProgress,
  DshIconLabSpin,
  DshIconLabToast,
  DshIconLabTooltip,
  DshIconLabTree,
  DshIconLabTreeSelect,
} from '@tnnevol/dsh-semi-ui'
import type { SidebarGroup } from './catalog.ts'

export const sidebarGroups: SidebarGroup[] = [
  { title: '基础类', items: [{ icon: DshIconLabButton, label: 'Button 按钮' }, { icon: DshIconLabHeart, label: 'Icon 图标' }, { icon: DshIconLabTooltip, label: 'Typography 排版' }] },
  { title: '输入类', items: [{ icon: DshIconElementStroked, label: 'Input 输入框' }, { icon: DshIconElementStroked, label: 'InputNumber 数字输入框' }, { icon: DshIconLabCascader, label: 'Slider 滑块' }, { icon: DshIconLabCheckbox, label: 'Switch 开关' }, { icon: DshIconElementStroked, label: 'Form 表单' }, { icon: DshIconLabCascader, label: 'Cascader 级联选择' }, { icon: DshIconLabTreeSelect, label: 'TreeSelect 树选择器' }, { icon: DshIconLabCheckbox, label: 'Checkbox 复选框' }, { icon: DshIconLabDropdown, label: 'Select 选择器' }] },
  { title: '导航类', items: [{ icon: DshIconLabTree, label: 'Tree 树形控件' }, { icon: DshIconLabToast, label: 'Tabs 标签栏' }, { icon: DshIconLabTree, label: 'HotKeys 快捷键' }] },
  { title: '数据展示类', items: [{ icon: DshIconLabTree, label: 'Collapse 折叠面板' }, { icon: DshIconLabTreeSelect, label: 'Card 卡片' }, { icon: DshIconLabTooltip, label: 'Descriptions 描述' }, { icon: DshIconLabHeart, label: 'Empty 空状态' }, { icon: DshIconLabTooltip, label: 'Tag 标签' }, { icon: DshIconLabAvatar, label: 'Avatar 头像' }, { icon: DshIconLabChart, label: 'Badge 徽标' }, { icon: DshIconLabToast, label: 'List 列表' }, { icon: DshIconLabToast, label: 'ScrollList 滚动列表' }] },
  { title: '布局与导航', items: [{ icon: DshIconLabButton, label: 'Layout 布局' }, { icon: DshIconLabTree, label: 'Nav 导航' }, { icon: DshIconLabToast, label: 'Table 表格' }] },
  { title: '反馈类', items: [{ icon: DshIconLabModal, label: 'Modal 对话框' }, { icon: DshIconLabProgress, label: 'Progress 进度条' }, { icon: DshIconLabSpin, label: 'Spin 加载器' }, { icon: DshIconLabToast, label: 'Toast 提示' }, { icon: DshIconLabSpin, label: 'Skeleton 骨架屏' }, { icon: DshIconLabTooltip, label: 'Tooltip 文字提示' }, { icon: DshIconLabDropdown, label: 'Dropdown 下拉框' }, { icon: DshIconElementStroked, label: 'Popover 浮层' }] },
  { title: '案例演示', items: [{ icon: DshIconLabTree, label: 'CodeBuddy 多账户' }] },
]
