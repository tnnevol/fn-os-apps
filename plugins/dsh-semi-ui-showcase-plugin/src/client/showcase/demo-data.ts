// 各 demo 区块共享的静态演示数据。带交互状态的演示数据放在对应区块文件里。

export const cascaderData = [
  { label: '模型', value: 'model', children: [{ label: 'GPT-5.6 Luna', value: 'luna' }, { label: 'GPT-5.6 Sol', value: 'sol' }] },
  { label: '能力', value: 'capability', children: [{ label: '联网搜索', value: 'search' }, { label: '图片识别', value: 'vision' }] },
]

export const treeData = [{ label: '工作区', value: 'workspace', key: 'workspace', children: [{ label: '插件', value: 'plugins', key: 'plugins' }, { label: '应用', value: 'apps', key: 'apps' }] }]

export const disabledTreeData = [{ label: '工作区', value: 'workspace', key: 'workspace', children: [{ label: '插件', value: 'plugins', key: 'plugins' }, { label: '应用（禁用）', value: 'apps', key: 'apps', disabled: true }] }]

export const buttonTypes = [
  ['primary', '主要'],
  ['secondary', '次要'],
  ['tertiary', '第三'],
  ['warning', '警告'],
  ['danger', '危险'],
] as const

export const buttonThemes = ['solid', 'light', 'outline', 'borderless'] as const

export const buttonSizes = ['large', 'default', 'small'] as const

export const iconModes = [
  ['all', '全部图标'],
  ['filled', '面性图标'],
  ['stroked', '线性图标'],
  ['ai', 'AI 图标'],
] as const

export type IconMode = typeof iconModes[number][0]

// ---- 2026-03 新增组件的演示数据 ----

export const selectOptionList = [
  { value: 'luna', label: 'GPT-5.6 Luna' },
  { value: 'sol', label: 'GPT-5.6 Sol' },
  { value: 'nova', label: 'GPT-5.6 Nova' },
  { value: 'flare', label: 'GPT-5.6 Flare' },
]

export const tabsTabList = [
  { tab: '文档', itemKey: '1' },
  { tab: '快速起步', itemKey: '2' },
  { tab: '帮助', itemKey: '3' },
]

export const listSimpleData = [
  '从明天起，做一个幸福的人',
  '喂马，劈柴，周游世界',
  '从明天起，关心粮食和蔬菜',
  '我有一所房子，面朝大海，春暖花开',
]

export const listSmallData = listSimpleData.slice(0, 2)

export const listUsersData: Array<{ key: string, color: 'blue' | 'green' | 'amber', short: string, title: string, desc: string }> = [
  { key: 'u1', color: 'blue', short: 'SE', title: 'Semi Design', desc: '设计系统 · 抖音前端团队' },
  { key: 'u2', color: 'green', short: 'DS', desc: 'DeepSeek Harness · 本仓库', title: 'DSH 插件' },
  { key: 'u3', color: 'amber', short: 'CB', title: 'CodeBuddy', desc: '多账户管理 · 示例数据' },
]

export const scrollAmPmItems = [{ value: '上午' }, { value: '下午' }]

export const scrollHourItems = Array.from({length: 12}).fill(0).map((_item, index) => ({ value: index + 1 }))

export const navHorizontalItems = [
  { itemKey: 'overview', text: '总览' },
  { itemKey: 'conversation', text: '会话' },
  { itemKey: 'task', text: '任务' },
  { itemKey: 'more', text: '更多', items: [{ itemKey: 'log', text: '日志' }, { itemKey: 'setting', text: '设置' }] },
]

export const tableColumns = [
  { title: '名称', dataIndex: 'name' },
  { title: '大小', dataIndex: 'size', sorter: (a: { size: number }, b: { size: number }) => a.size - b.size },
  { title: '所有者', dataIndex: 'owner' },
  { title: '更新时间', dataIndex: 'updatedAt' },
]

export const tableData = [
  { key: '1', name: 'design-tokens.sketch', size: 1024, owner: 'Carolyn', updatedAt: '2026-01-02 10:12' },
  { key: '2', name: 'semi-ui-diff.zip', size: 2048, owner: 'Ishika', updatedAt: '2026-01-03 12:00' },
  { key: '3', name: 'avatar.png', size: 256, owner: 'Zoey', updatedAt: '2026-01-04 08:30' },
  { key: '4', name: 'usage-report.csv', size: 512, owner: 'Arlena', updatedAt: '2026-01-05 16:45' },
  { key: '5', name: 'icon-font.ttf', size: 4096, owner: 'Mikey', updatedAt: '2026-01-06 09:20' },
  { key: '6', name: 'theme-vars.json', size: 128, owner: 'Byrl', updatedAt: '2026-01-07 14:05' },
]
