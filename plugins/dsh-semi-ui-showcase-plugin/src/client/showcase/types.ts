export type Category = 'buttons' | 'input' | 'selection' | 'tree' | 'modal' | 'feedback' | 'data'

export type ComponentItem = 'Layout 布局' | 'Nav 导航' | 'Table 表格' | 'Card 卡片' | 'Descriptions 描述' | 'Empty 空状态' | 'Button 按钮' | 'Input 输入框' | 'InputNumber 数字输入框' | 'Slider 滑块' | 'Switch 开关' | 'Form 表单' | 'Cascader 级联选择' | 'TreeSelect 树选择器' | 'Checkbox 复选框' | 'Tree 树形控件' | 'Collapse 折叠面板' | 'Icon 图标' | 'Modal 对话框' | 'Popover 浮层' | 'Tooltip 文字提示' | 'Dropdown 下拉框' | 'Progress 进度条' | 'Spin 加载器' | 'Toast 提示' | 'Select 选择器' | 'Skeleton 骨架屏' | 'Tabs 标签栏' | 'Tag 标签' | 'Avatar 头像' | 'Badge 徽标' | 'List 列表' | 'Typography 排版' | 'ScrollList 滚动列表' | 'HotKeys 快捷键' | 'CodeBuddy 多账户'

export type ModalDemo = 'basic' | 'footerFill' | 'mask' | 'buttonProps' | 'customFooter' | 'styled' | 'fullscreen'

/** 页面右侧目录条目：[标题, 锚点 id]。 */
export type OutlineItem = [label: string, anchor: string]
