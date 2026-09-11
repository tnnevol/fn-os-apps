// 标签/徽标类数据展示组件 demo：Tabs、Tag、Avatar、Badge。
import type { ReactNode } from 'react'
import { useState } from 'react'
import { demo, sectionTitle, sectionText, stack } from '../class-names.ts'
import { DemoCard } from '../DemoCard.tsx'
import {
  DshAvatar,
  DshAvatarGroup,
  DshBadge,
  DshButton,
  DshTabs,
  DshTag,
} from '@tnnevol/dsh-semi-ui'
import { tabsTabList } from '../demo-data.ts'
export function TabsSection(): ReactNode {
  const [tabsActiveKey, setTabsActiveKey] = useState('1')
  return (
    <>
      <h2 id="tabs-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>通过 TabPane 逐项传入标签页，`tab` 为标题，`itemKey` 为唯一标识；也可以用 `tabList` 数组配置。</p>
      <DemoCard source={'<DshTabs type="line">\n  <DshTabs.TabPane tab="文档" itemKey="1">文档内容</DshTabs.TabPane>\n  <DshTabs.TabPane tab="快速起步" itemKey="2">快速起步内容</DshTabs.TabPane>\n  <DshTabs.TabPane tab="帮助" itemKey="3">帮助内容</DshTabs.TabPane>\n</DshTabs>'}>
        <DshTabs type="line" defaultActiveKey="1">
          <DshTabs.TabPane tab="文档" itemKey="1"><span className="dsh-semi-showcase-collapse-body">Semi Design 是由抖音前端团队与 UED 团队共同设计开发并维护的设计系统。</span></DshTabs.TabPane>
          <DshTabs.TabPane tab="快速起步" itemKey="2"><span className="dsh-semi-showcase-collapse-body">通过 pnpm 安装组件库，即可快速开始使用。</span></DshTabs.TabPane>
          <DshTabs.TabPane tab="帮助" itemKey="3"><span className="dsh-semi-showcase-collapse-body">查阅 API 文档与常见问题排查。</span></DshTabs.TabPane>
        </DshTabs>
      </DemoCard>
      <h2 id="tabs-states" className={sectionTitle}>类型、禁用与受控</h2>
      <p className={sectionText}>`type` 支持 line、card 和 button 三种外观；`disabled` 禁用单个标签，受控 `activeKey` 配合 `onChange` 管理当前页。</p>
      <DemoCard source={'<DshTabs type="card">...</DshTabs>\n<DshTabs type="button">...</DshTabs>\n<DshTabs.TabPane tab="禁用" disabled />\n<DshTabs activeKey={key} onChange={setKey} tabList={tabList} />'}>
        <div className={stack}>
          <DshTabs type="card" defaultActiveKey="1">
            <DshTabs.TabPane tab="文档" itemKey="1"><span className="dsh-semi-showcase-collapse-body">卡片类型的内容。</span></DshTabs.TabPane>
            <DshTabs.TabPane tab="快速起步" itemKey="2"><span className="dsh-semi-showcase-collapse-body">另一种外观。</span></DshTabs.TabPane>
            <DshTabs.TabPane tab="帮助" itemKey="3"><span className="dsh-semi-showcase-collapse-body">帮助内容。</span></DshTabs.TabPane>
          </DshTabs>
          <DshTabs type="button" defaultActiveKey="1">
            <DshTabs.TabPane tab="文档" itemKey="1"><span className="dsh-semi-showcase-collapse-body">按钮类型的内容。</span></DshTabs.TabPane>
            <DshTabs.TabPane tab="快速起步" itemKey="2"><span className="dsh-semi-showcase-collapse-body">适合过滤切换。</span></DshTabs.TabPane>
            <DshTabs.TabPane tab="帮助（禁用）" itemKey="3" disabled><span className="dsh-semi-showcase-collapse-body">不可点击。</span></DshTabs.TabPane>
          </DshTabs>
          <div className={demo}>
            <DshTabs type="button" activeKey={tabsActiveKey} onChange={setTabsActiveKey} tabList={tabsTabList} />
          </div>
        </div>
      </DemoCard>
    </>
  )
}

export function TagSection(): ReactNode {
  const [tagPreventVisible, setTagPreventVisible] = useState(true)
  return (
    <>
      <h2 id="tag-basic" className={sectionTitle}>基本用法与尺寸</h2>
      <p className={sectionText}>将内容使用 Tag 包裹即可；`size` 默认定义了 small 和 large 两种尺寸。</p>
      <DemoCard source={'<DshTag>default tag</DshTag>\n<DshTag size="small" color="light-blue">small tag</DshTag>\n<DshTag size="large" color="cyan">large tag</DshTag>'}>
        <div className={demo}>
          <DshTag>default tag</DshTag>
          <DshTag size="small" color="light-blue">small tag</DshTag>
          <DshTag size="large" color="cyan">large tag</DshTag>
        </div>
      </DemoCard>
      <h2 id="tag-colors" className={sectionTitle}>颜色与形状</h2>
      <p className={sectionText}>`color` 支持官方色板，`type` 控制 solid、light、ghost 三种填充方式，`shape` 支持 square 与 circle。</p>
      <DemoCard source={'<DshTag color="green" type="solid">solid</DshTag>\n<DshTag color="amber" type="light">light</DshTag>\n<DshTag color="violet" type="ghost">ghost</DshTag>\n<DshTag shape="circle" color="amber">circle</DshTag>'}>
        <div className={stack}>
          <div className={demo}>
            <DshTag color="green" type="solid">solid</DshTag>
            <DshTag color="amber" type="light">light</DshTag>
            <DshTag color="violet" type="ghost">ghost</DshTag>
            <DshTag color="white" type="solid">white</DshTag>
          </div>
          <div className={demo}>
            <DshTag size="small" shape="circle" color="amber">circle small</DshTag>
            <DshTag size="large" shape="circle" color="violet">circle large</DshTag>
          </div>
        </div>
      </DemoCard>
      <h2 id="tag-closable" className={sectionTitle}>可关闭标签</h2>
      <p className={sectionText}>添加 `closable` 后标签显示关闭图标；在 `onClose` 中阻止默认事件可以让标签保持可见，并用受控 `visible` 管理显隐。</p>
      <DemoCard source={'<DshTag closable>可关闭标签</DshTag>\n<DshTag closable visible={visible}\n  onClose={(value, e) => { e.preventDefault() }}\n>阻止默认关闭</DshTag>'}>
        <div className={demo}>
          <DshTag closable>可关闭标签</DshTag>
          <DshTag closable visible={tagPreventVisible} onClose={(_value: unknown, event: { preventDefault: () => void }) => { event.preventDefault() }}>阻止默认关闭</DshTag>
          <DshButton size="small" type="secondary" theme="light" onClick={() => { setTagPreventVisible(true) }}>恢复标签</DshButton>
        </div>
      </DemoCard>
    </>
  )
}

export function AvatarSection(): ReactNode {
  return (
    <>
      <h2 id="avatar-basic" className={sectionTitle}>基本用法、尺寸与图片</h2>
      <p className={sectionText}>头像支持字符、图标和图片内容；`size` 提供 extra-extra-small 到 extra-large 的尺寸梯度。</p>
      <DemoCard source={'<DshAvatar>SE</DshAvatar>\n<DshAvatar size="small" alt="User">U</DshAvatar>\n<DshAvatar src="/path/to/img.jpg" alt="User" />'}>
        <div className={stack}>
          <div className={demo}>
            {(['extra-extra-small', 'extra-small', 'small', 'default', 'medium', 'large', 'extra-large'] as const).map(size => <DshAvatar key={size} size={size} alt="User" style={{ margin: 4 }}>{size.startsWith('extra') ? 'U' : 'U'}</DshAvatar>)}
          </div>
          <div className={demo}>
            <DshAvatar src="https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/avatar/avatar-1.png" alt="图片头像" style={{ margin: 4 }} />
            <DshAvatar src="https://not-exist.invalid/avatar.png" alt="加载失败" style={{ margin: 4 }}>回退</DshAvatar>
          </div>
        </div>
      </DemoCard>
      <h2 id="avatar-colors" className={sectionTitle}>颜色与形状</h2>
      <p className={sectionText}>`color` 支持默认色板 15 种颜色，`shape` 支持 circle（默认）与 square，也可以用 style 完全自定义。</p>
      <DemoCard source={'<DshAvatar color="red">RM</DshAvatar>\n<DshAvatar color="light-blue">TJ</DshAvatar>\n<DshAvatar shape="square">U</DshAvatar>\n<DshAvatar style={{ color: "#f56a00", backgroundColor: "#fde3cf" }}>ZL</DshAvatar>'}>
        <div className={demo}>
          <DshAvatar color="red" alt="Bob Matteo" style={{ margin: 4 }}>BM</DshAvatar>
          <DshAvatar color="light-blue" alt="Taylor Joy" style={{ margin: 4 }}>TJ</DshAvatar>
          <DshAvatar color="green" alt="Green" style={{ margin: 4 }}>GN</DshAvatar>
          <DshAvatar shape="square" alt="Square" style={{ margin: 4 }}>U</DshAvatar>
          <DshAvatar style={{ color: '#f56a00', backgroundColor: '#fde3cf', margin: 4 }} alt="Zank Lance">ZL</DshAvatar>
        </div>
      </DemoCard>
      <h2 id="avatar-group" className={sectionTitle}>头像组</h2>
      <p className={sectionText}>AvatarGroup 将多个头像显示为一组，超出 `maxCount` 的部分自动合并为 +N。</p>
      <DemoCard source={'<DshAvatarGroup maxCount={3} size="small">\n  <DshAvatar color="red">LL</DshAvatar>\n  <DshAvatar>CX</DshAvatar>\n  <DshAvatar color="amber">RM</DshAvatar>\n  <DshAvatar color="green">YZ</DshAvatar>\n</DshAvatarGroup>'}>
        <div className={demo}>
          <DshAvatarGroup maxCount={3} size="small">
            <DshAvatar color="red" alt="Lisa LeBlanc">LL</DshAvatar>
            <DshAvatar alt="Caroline Xiao">CX</DshAvatar>
            <DshAvatar color="amber" alt="Rafal Matin">RM</DshAvatar>
            <DshAvatar color="green" alt="Youself Zhang">YZ</DshAvatar>
          </DshAvatarGroup>
          <DshAvatarGroup size="small" shape="square">
            <DshAvatar color="blue">S1</DshAvatar>
            <DshAvatar color="teal">S2</DshAvatar>
            <DshAvatar color="pink">S3</DshAvatar>
          </DshAvatarGroup>
        </div>
      </DemoCard>
    </>
  )
}

export function BadgeSection(): ReactNode {
  return (
    <>
      <h2 id="badge-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>基本类型为 `count`，传入 `dot` 则显示为小圆点，两者互斥，优先渲染小圆点。</p>
      <DemoCard source={'<DshBadge count={5}><DshAvatar color="blue" shape="square">BM</DshAvatar></DshBadge>\n<DshBadge dot><DshAvatar color="blue" shape="square">BM</DshAvatar></DshBadge>\n<DshBadge count="NEW">文字徽标</DshBadge>'}>
        <div className={demo}>
          <DshBadge count={5}><DshAvatar color="blue" shape="square" alt="Badge demo">BM</DshAvatar></DshBadge>
          <DshBadge dot><DshAvatar color="blue" shape="square" alt="Badge dot">DT</DshAvatar></DshBadge>
          <DshBadge count="NEW"><DshButton type="secondary" theme="light">动态</DshButton></DshBadge>
          <DshBadge count={5} /><DshBadge dot />
        </div>
      </DemoCard>
      <h2 id="badge-states" className={sectionTitle}>溢出计数与位置</h2>
      <p className={sectionText}>`overflowCount` 设置显示数字的最大值，`position` 控制徽标出现在四角中的哪一角，`type` 控制颜色语义。</p>
      <DemoCard source={'<DshBadge count={99} overflowCount={10} />\n<DshBadge count={1000} overflowCount={999} />\n<DshBadge count="VIP" position="rightTop" type="danger" />\n<DshBadge count="VIP" position="leftBottom" type="danger" />'}>
        <div className={stack}>
          <div className={demo}>
            <DshBadge count={99} overflowCount={10}><DshAvatar color="grey" shape="square" alt="overflow 10">O1</DshAvatar></DshBadge>
            <DshBadge count={100} overflowCount={99}><DshAvatar color="grey" shape="square" alt="overflow 99">O2</DshAvatar></DshBadge>
          </div>
          <div className={demo}>
            <DshBadge count="VIP" position="rightTop" type="danger"><DshAvatar alt="rightTop">RT</DshAvatar></DshBadge>
            <DshBadge count="VIP" position="rightBottom" type="danger"><DshAvatar alt="rightBottom">RB</DshAvatar></DshBadge>
            <DshBadge count="VIP" position="leftTop" type="danger"><DshAvatar alt="leftTop">LT</DshAvatar></DshBadge>
            <DshBadge count="VIP" position="leftBottom" type="danger"><DshAvatar alt="leftBottom">LB</DshAvatar></DshBadge>
          </div>
        </div>
      </DemoCard>
    </>
  )
}
