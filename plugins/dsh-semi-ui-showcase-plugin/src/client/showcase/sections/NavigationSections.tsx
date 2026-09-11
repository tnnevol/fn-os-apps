// 布局与导航类组件 demo：Layout、Nav、Table。
import type { ReactNode } from 'react'
import { useState } from 'react'
import { sectionTitle, sectionText, stack } from '../class-names.ts'
import { DemoCard } from '../DemoCard.tsx'
import {
  DshIconUser,
  DshLayout,
  DshNav,
  DshTable,
} from '@tnnevol/dsh-semi-ui'
import { navHorizontalItems, tableColumns, tableData } from '../demo-data.ts'

export function LayoutSection(): ReactNode {
  return (
    <>
      <h2 id="layout-basic" className={sectionTitle}>基本用法与侧边布局</h2>
      <p className={sectionText}>Layout 通过 Sider、Header、Content 和 Footer 组合出页面结构；Sider 可以叠加 Nav 形成经典的侧边布局。本展示页的整体骨架同样由 Layout 承载——顶栏固定，左侧菜单与主体内容是两个独立的滚动区域。</p>
      <DemoCard source={'<DshLayout className="demo-layout">\n  <DshLayout.Sider><DshNav /></DshLayout.Sider>\n  <DshLayout>\n    <DshLayout.Header>Header</DshLayout.Header>\n    <DshLayout.Content>Content</DshLayout.Content>\n    <DshLayout.Footer>Footer</DshLayout.Footer>\n  </DshLayout>\n</DshLayout>'}>
        <div className="dsh-semi-showcase-layout-demo">
          <DshLayout className="dsh-semi-showcase-layout">
            <DshLayout.Header className="dsh-semi-showcase-layout-header">Header</DshLayout.Header>
            <DshLayout>
              <DshLayout.Sider className="dsh-semi-showcase-layout-sider">Sider</DshLayout.Sider>
              <DshLayout.Content className="dsh-semi-showcase-layout-content">Content</DshLayout.Content>
            </DshLayout>
            <DshLayout.Footer className="dsh-semi-showcase-layout-footer">Footer</DshLayout.Footer>
          </DshLayout>
        </div>
      </DemoCard>
    </>
  )
}

export function NavSection(): ReactNode {
  const [navSelectedKeys, setNavSelectedKeys] = useState<string[]>(['overview'])
  return (
    <>
      <h2 id="nav-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>通过 `items` 快速得到导航栏，每个导航项目包含 `itemKey`、`text` 和 `icon`；`header` 与 `footer` 定义导航头部与底部。</p>
      <DemoCard source={'<DshNav\n  selectedKeys={["user"]}\n  items={[\n    { itemKey: "user", text: "用户管理", icon: <DshIconUser /> },\n    { itemKey: "union", text: "活动管理" },\n    { itemKey: "job", text: "任务平台", items: ["任务管理", "用户任务查询"] },\n  ]}\n  header={{ text: "工作台" }}\n  footer={{ collapseButton: true }}\n/>'}>
        <div className="dsh-semi-showcase-nav-demo">
          <DshNav
            className="dsh-semi-showcase-nav"
            bodyStyle={{ height: 292 }}
            selectedKeys={['user']}
            items={[
              { itemKey: 'user', text: '用户管理', icon: <DshIconUser /> },
              { itemKey: 'union', text: '活动管理' },
              { itemKey: 'job', text: '任务平台', items: ['任务管理', '用户任务查询'] },
            ]}
            header={{ text: '工作台' }}
            footer={{ collapseButton: true }}
          />
        </div>
      </DemoCard>
      <h2 id="nav-states" className={sectionTitle}>受控选中与水平布局</h2>
      <p className={sectionText}>受控 `selectedKeys` 配合 `onSelect` 管理选中项；`mode="horizontal"` 提供水平导航，子项目以浮层形式展开。</p>
      <DemoCard source={'const [selected, setSelected] = useState(["overview"])\n<DshNav\n  mode="horizontal"\n  selectedKeys={selected}\n  onSelect={({ itemKey }) => setSelected([itemKey as string])}\n  items={items}\n/>'}>
        <div className={stack}>
          <DshNav
            className="dsh-semi-showcase-nav-horizontal"
            mode="horizontal"
            selectedKeys={navSelectedKeys}
            onSelect={({ itemKey }: { itemKey: string | number }) => { setNavSelectedKeys([String(itemKey)]) }}
            items={navHorizontalItems}
          />
          <span className="dsh-semi-showcase-event-status" role="status">{`当前选中：${navSelectedKeys.join('、')}`}</span>
        </div>
      </DemoCard>
    </>
  )
}

export function TableSection(): ReactNode {
  const [tableSelectedKeys, setTableSelectedKeys] = useState<Array<string | number>>([])
  return (
    <>
      <h2 id="table-basic" className={sectionTitle}>基本表格与行选择</h2>
      <p className={sectionText}>最基本的两个参数为 `dataSource` 与 `columns`；`rowSelection` 开启行选择，`pagination` 接入分页。</p>
      <DemoCard source={'const columns = [\n  { title: "名称", dataIndex: "name" },\n  { title: "大小", dataIndex: "size", sorter: (a, b) => a.size - b.size },\n  { title: "所有者", dataIndex: "owner" },\n]\n<DshTable columns={columns} dataSource={tableData} rowSelection={{ fixed: true }} />'}>
        <DshTable
          className="dsh-semi-showcase-table"
          columns={tableColumns}
          dataSource={tableData}
          rowSelection={{ fixed: true, selectedRowKeys: tableSelectedKeys, onChange: (keys: Array<string | number>) => { setTableSelectedKeys(keys) } }}
          pagination={{ pageSize: 3 }}
        />
      </DemoCard>
    </>
  )
}
