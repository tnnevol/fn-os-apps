// Collapse 折叠面板 demo：基本用法、多用户管理入口与手风琴模式。
import type { ReactNode } from 'react'
import { sectionTitle, sectionText } from '../class-names.ts'
import { DemoCard } from '../DemoCard.tsx'
import {
  DshButton,
  DshCollapse,
  DshTag,
} from '@tnnevol/dsh-semi-ui'
import type { ShowcaseRouteController } from '../../route.ts'

interface CollapseSectionProps {
  route: ShowcaseRouteController
}

export function CollapseSection({ route }: CollapseSectionProps): ReactNode {
  return (
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
  )
}
