// 卡片与详情类组件 demo：Card、Descriptions、Empty。
import type { ReactNode } from 'react'
import { demo, sectionTitle, sectionText, stack } from '../class-names.ts'
import { DemoCard } from '../DemoCard.tsx'
import {
  DshButton,
  DshCard,
  DshDescriptions,
  DshEmpty,
  DshIconFolder,
  DshTag,
} from '@tnnevol/dsh-semi-ui'

export function CardSection(): ReactNode {
  return (
    <>
      <h2 id="card-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>Card 包含标题、封面、内容与页脚区域，`headerExtraContent` 在标题行右侧追加操作。</p>
      <DemoCard source={'<DshCard\n  title="Semi Design"\n  headerExtraContent={\n    <span>卡片右上角操作</span>\n  }\n  style={{ maxWidth: 360 }}\n>\n  卡片内容\n</DshCard>\n<DshCard footer={<DshButton>页脚操作</DshButton>}>带页脚的卡片</DshCard>'}>
        <div className={demo}>
          <DshCard
            title="Semi Design"
            headerExtraContent={<span className="dsh-semi-showcase-secondary-text">设置</span>}
            style={{ maxWidth: 300 }}
            bodyStyle={{ paddingBottom: 16 }}
          >
            <span className="dsh-semi-showcase-collapse-body">由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。</span>
          </DshCard>
          <DshCard
            title="带页脚的卡片"
            style={{ maxWidth: 300 }}
            footerStyle={{ display: 'flex', justifyContent: 'flex-end' }}
            footer={<DshButton size="small" type="primary" theme="solid">页脚操作</DshButton>}
          >
            <span className="dsh-semi-showcase-collapse-body">footerLine 为内容区与页脚区之间添加边线。</span>
          </DshCard>
        </div>
      </DemoCard>
      <h2 id="card-states" className={sectionTitle}>阴影与边线</h2>
      <p className={sectionText}>`shadows` 控制 hover 阴影，`bordered` 控制外边框，`headerLine`/`footerLine` 控制内部分割线。</p>
      <DemoCard source={'<DshCard shadows="hover" bordered={false}>阴影卡片</DshCard>\n<DshCard headerLine={false}>无标题边线</DshCard>\n<DshCard loading>加载中</DshCard>'}>
        <div className={demo}>
          <DshCard shadows="hover" style={{ maxWidth: 240 }}><span className="dsh-semi-showcase-collapse-body">hover 时显示阴影。</span></DshCard>
          <DshCard bordered={false} shadows="hover" style={{ maxWidth: 240 }}><span className="dsh-semi-showcase-collapse-body">无外边框的阴影卡片。</span></DshCard>
          <DshCard headerLine={false} style={{ maxWidth: 240 }} title="无标题边线"><span className="dsh-semi-showcase-collapse-body">标题区与内容区之间没有分割线。</span></DshCard>
          <DshCard loading style={{ maxWidth: 240 }} />
        </div>
      </DemoCard>
    </>
  )
}

export function DescriptionsSection(): ReactNode {
  return (
    <>
      <h2 id="descriptions-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>通过 `data` 以键值对数组方式传入数据，key 与 value 均支持 ReactNode 类型。</p>
      <DemoCard source={'const data = [\n  { key: "实际用户数量", value: "1,480,000" },\n  { key: "安全等级", value: "3级" },\n  { key: "垂类标签", value: <Tag>电商</Tag> },\n]\n<DshDescriptions data={data} />'}>
        <DshDescriptions
          data={[
            { key: '实际用户数量', value: '1,480,000' },
            { key: '7天留存', value: '98%' },
            { key: '安全等级', value: '3级' },
            { key: '垂类标签', value: <DshTag style={{ margin: 0 }}>电商</DshTag> },
          ]}
        />
      </DemoCard>
      <h2 id="descriptions-states" className={sectionTitle}>布局与尺寸</h2>
      <p className={sectionText}>`align` 控制 key 的对齐方式，`column` 控制一行展示的数据条数，`size` 控制整体密度。</p>
      <DemoCard source={'<DshDescriptions align="center" data={data} />\n<DshDescriptions column={2} size="small" data={data} />'}>
        <div className={stack}>
          <DshDescriptions align="center" size="small" data={[{ key: '双列居中', value: 'column=2 + align=center' }, { key: '生效时间', value: '即时生效' }]} column={2} />
          <DshDescriptions size="large" data={[{ key: '大尺寸', value: 'size=large' }, { key: '双端对齐', value: 'align=justify' }]} align="justify" />
        </div>
      </DemoCard>
    </>
  )
}

export function EmptySection(): ReactNode {
  return (
    <>
      <h2 id="empty-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>Empty 用于告知用户当前区域没有内容；未提供 children 时展示默认插画、标题与描述。</p>
      <DemoCard source={'<DshEmpty title="暂无数据" description="稍后再来看看吧。" />\n<DshEmpty title="搜索无结果" description="换个关键词试试。" />'}>
        <div className="dsh-semi-showcase-empty-demo">
          <DshEmpty title="暂无数据" description="稍后再来看看吧。" />
          <DshEmpty title="搜索无结果" description="换个关键词试试。" />
        </div>
      </DemoCard>
      <h2 id="empty-states" className={sectionTitle}>自定义内容与布局</h2>
      <p className={sectionText}>`image` 替换默认插画，children 自定义操作区，`layout` 支持 vertical（默认）与 horizontal 两种排布。</p>
      <DemoCard source={'<DshEmpty\n  image={<DshIconFolder style={{ fontSize: 48 }} />}\n  title="空文件夹"\n>\n  <DshButton type="primary">新建文件</DshButton>\n</DshEmpty>\n<DshEmpty layout="horizontal" title="横向布局" />'}>
        <div className={stack}>
          <DshEmpty image={<DshIconFolder style={{ fontSize: 48, color: 'var(--dsw-alias-label-tertiary)' }} />} title="空文件夹">
            <DshButton type="primary" theme="solid">新建文件</DshButton>
          </DshEmpty>
          <DshEmpty layout="horizontal" title="横向布局" description="插画与文字水平排列。" />
        </div>
      </DemoCard>
    </>
  )
}
