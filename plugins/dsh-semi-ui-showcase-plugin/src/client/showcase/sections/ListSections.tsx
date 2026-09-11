// 列表与排版类组件 demo：List、Typography、ScrollList。
import type { ReactNode } from 'react'
import { useState } from 'react'
import { demo, sectionTitle, sectionText, stack } from '../class-names.ts'
import { DemoCard } from '../DemoCard.tsx'
import {
  DshAvatar,
  DshButton,
  DshEmpty,
  DshList,
  DshScrollItem,
  DshScrollList,
  DshTypography,
} from '@tnnevol/dsh-semi-ui'
import {
  listSimpleData,
  listSmallData,
  listUsersData,
  scrollAmPmItems,
  scrollHourItems,
} from '../demo-data.ts'

export function ListSection(): ReactNode {
  return (
    <>
      <h2 id="list-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>通过 `dataSource` 与 `renderItem` 渲染列表项，`header`/`footer` 自定义头尾，`bordered` 显示边框。</p>
      <DemoCard source={'<DshList\n  header={<div>Header</div>}\n  footer={<div>Footer</div>}\n  bordered\n  dataSource={listData}\n  renderItem={item => <DshList.Item>{item}</DshList.Item>}\n/>'}>
        <DshList header={<div>列表头</div>} footer={<div>列表尾</div>} bordered dataSource={listSimpleData} renderItem={(item: string) => <DshList.Item>{item}</DshList.Item>} />
      </DemoCard>
      <h2 id="list-template" className={sectionTitle}>模板用法</h2>
      <p className={sectionText}>List.Item 支持 `header`、`main`、`extra` 三个区域，适合承载带头像的操作行。</p>
      <DemoCard source={'<DshList dataSource={listUsers} renderItem={user => (\n  <DshList.Item\n    header={<DshAvatar color={user.color}>{user.short}</DshAvatar>}\n    main={<div><span>{user.title}</span><span>{user.desc}</span></div>}\n    extra={<DshButton size="small">查看</DshButton>}\n  />\n)} />'}>
        <DshList
          bordered
          dataSource={listUsersData}
          renderItem={(user: { key: string, color: 'blue' | 'green' | 'amber', short: string, title: string, desc: string }) => (
            <DshList.Item
              key={user.key}
              header={<DshAvatar color={user.color} alt={user.title}>{user.short}</DshAvatar>}
              main={(
                <div>
                  <span>{user.title}</span>
                  <span className="dsh-semi-showcase-secondary-text">{user.desc}</span>
                </div>
              )}
              extra={<DshButton size="small" type="secondary" theme="light">查看</DshButton>}
            />
          )}
        />
      </DemoCard>
      <h2 id="list-states" className={sectionTitle}>尺寸与空状态</h2>
      <p className={sectionText}>`size` 支持 large、default、small；传入空数据配合 Empty 展示空状态。</p>
      <DemoCard source={'<DshList size="small" bordered dataSource={listData} renderItem={item => <DshList.Item>{item}</DshList.Item>} />\n<DshList emptyContent={<DshEmpty title="暂无会话" />} dataSource={[]} renderItem={() => null} />'}>
        <div className={stack}>
          <DshList size="small" bordered dataSource={listSmallData} renderItem={(item: string) => <DshList.Item>{item}</DshList.Item>} />
          <DshList emptyContent={<DshEmpty title="暂无会话" description="开启新对话后会显示在这里。" />} dataSource={[]} renderItem={() => null} />
        </div>
      </DemoCard>
    </>
  )
}

export function TypographySection(): ReactNode {
  return (
    <>
      <h2 id="typography-title" className={sectionTitle}>标题组件</h2>
      <p className={sectionText}>Title 对应 h1-h6，通过 `heading` 指定层级。</p>
      <DemoCard source={'<DshTypography.Title heading={2}>h2. Semi Design</DshTypography.Title>\n<DshTypography.Title heading={4}>h4. Semi Design</DshTypography.Title>'}>
        <div className={stack}>
          <DshTypography.Title style={{ margin: '8px 0' }} heading={2}>h2. Semi Design</DshTypography.Title>
          <DshTypography.Title style={{ margin: '8px 0' }} heading={4}>h4. Semi Design</DshTypography.Title>
          <DshTypography.Title style={{ margin: '8px 0' }} heading={6}>h6. Semi Design</DshTypography.Title>
        </div>
      </DemoCard>
      <h2 id="typography-text" className={sectionTitle}>文本组件</h2>
      <p className={sectionText}>Text 支持 `type` 语义色与 mark、code、underline、delete、strong 等修饰属性。</p>
      <DemoCard source={'<DshTypography.Text type="secondary">Secondary</DshTypography.Text>\n<DshTypography.Text type="warning">Warning</DshTypography.Text>\n<DshTypography.Text code>Example Code</DshTypography.Text>\n<DshTypography.Text mark>Default Mark</DshTypography.Text>'}>
        <div className="dsh-semi-showcase-stack dsh-semi-showcase-typography-text-stack">
          <DshTypography.Text>Text</DshTypography.Text>
          <DshTypography.Text type="secondary">Secondary</DshTypography.Text>
          <DshTypography.Text type="tertiary">Tertiary</DshTypography.Text>
          <DshTypography.Text type="warning">Warning</DshTypography.Text>
          <DshTypography.Text type="danger">Danger</DshTypography.Text>
          <DshTypography.Text type="success">Success</DshTypography.Text>
          <DshTypography.Text disabled>Disabled</DshTypography.Text>
          <DshTypography.Text mark>Default Mark</DshTypography.Text>
          <DshTypography.Text code>Example Code</DshTypography.Text>
          <DshTypography.Text underline>Underline</DshTypography.Text>
          <DshTypography.Text delete>Deleted</DshTypography.Text>
          <DshTypography.Text strong>Strong</DshTypography.Text>
        </div>
      </DemoCard>
      <h2 id="typography-paragraph" className={sectionTitle}>段落与数值</h2>
      <p className={sectionText}>Paragraph 支持 `spacing` 宽松行距；Numeral 在 Text 基础上提供 `rule` 与 `precision` 数值处理。</p>
      <DemoCard source={'<DshTypography.Paragraph spacing="extended">宽松行距段落</DshTypography.Paragraph>\n<DshTypography.Numeral rule="bytes-decimal" precision={1}>12345678</DshTypography.Numeral>\n<DshTypography.Numeral rule="percentages" precision={2}>0.9876</DshTypography.Numeral>'}>
        <div className={stack}>
          <DshTypography.Paragraph spacing="extended" style={{ maxWidth: 460 }}>宽松行距的段落。区别于其他设计系统，Semi Design 以用户中心、内容优先、设计人性化为设计理念，帮助设计师与开发者打造高质量的 Web 应用。</DshTypography.Paragraph>
          <div className={demo}>
            <DshTypography.Numeral rule="bytes-decimal" precision={1}>12345678</DshTypography.Numeral>
            <DshTypography.Numeral rule="percentages" precision={2}>0.9876</DshTypography.Numeral>
          </div>
        </div>
      </DemoCard>
      <h2 id="typography-ellipsis" className={sectionTitle}>省略与复制</h2>
      <p className={sectionText}>`ellipsis` 支持单行与多行截断（可展开收起），`copyable` 支持一键复制并自动反馈复制成功。</p>
      <DemoCard source={'<DshTypography.Paragraph ellipsis={{ rows: 2, expandable: true }} style={{ maxWidth: 360 }}>长文本……</DshTypography.Paragraph>\n<DshTypography.Text copyable>点击图标复制这段文本</DshTypography.Text>\n<DshTypography.Text copyable={{ content: "复制指定内容" }}>复制指定内容</DshTypography.Text>'}>
        <div className={stack}>
          <DshTypography.Paragraph ellipsis={{ rows: 2, expandable: true, collapsible: true }} style={{ maxWidth: 420, marginBottom: 0 }}>Semi Design 以用户中心、内容优先、设计人性化为设计理念，具有内容优先、易于自定义主题、适用国际化场景等优势。展开可以查看完整文本，收起恢复两行截断。</DshTypography.Paragraph>
          <div className={demo}>
            <DshTypography.Text copyable>点击图标复制这段文本</DshTypography.Text>
            <DshTypography.Text copyable={{ content: 'https://semi.design/' }}>复制指定内容</DshTypography.Text>
          </div>
        </div>
      </DemoCard>
    </>
  )
}

export function ScrollListSection(): ReactNode {
  const [scrollAmPmIndex, setScrollAmPmIndex] = useState(0)
  const [scrollHourIndex, setScrollHourIndex] = useState(1)
  return (
    <>
      <h2 id="scrolllist-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>ScrollList 配合 ScrollItem 提供类似 iOS 的滚轮选择模式，支持点击与滚动选择，`header`/`footer` 自定义头尾。</p>
      <DemoCard source={'<DshScrollList style={listStyle} header="选择时间" footer={footer}>\n  <DshScrollItem list={ampmItems} selectedIndex={0} onSelect={handleSelect} />\n  <DshScrollItem list={hourItems} selectedIndex={1} onSelect={handleSelect} />\n</DshScrollList>'}>
        <DshScrollList className="dsh-semi-showcase-scrolllist" header="选择时间" footer={<div style={{ textAlign: 'center' }}>底部</div>}>
          <DshScrollItem list={scrollAmPmItems} selectedIndex={scrollAmPmIndex} mode="wheel" cycled onSelect={(data: { value: string }) => { setScrollAmPmIndex(scrollAmPmItems.findIndex(item => item.value === data.value)) }} />
          <DshScrollItem list={scrollHourItems} selectedIndex={scrollHourIndex} mode="wheel" cycled onSelect={(data: { value: number }) => { setScrollHourIndex(data.value) }} />
        </DshScrollList>
      </DemoCard>
      <h2 id="scrolllist-container" className={sectionTitle}>自定义滚动容器</h2>
      <p className={sectionText}>去掉滚轮外观后，ScrollList 的 body 是一个普通的纵向滚动容器，适合承载超出固定高度的内容（同 CodeBuddy 额度气泡的用法）。</p>
      <DemoCard source={'<DshScrollList className="my-scroll">\n  {packages.map(pkg => (\n    <div key={pkg.name}>…套餐内容…</div>\n  ))}\n</DshScrollList>\n/* .my-scroll .semi-scrolllist-body { max-height: 200px; overflow-y: auto } */'}>
        <DshScrollList className="dsh-semi-showcase-scrolllist-plain">
          {[...Array(8).keys()].map(index => (
            <div className="dsh-semi-showcase-scrolllist-row" key={index}>
              <span>{`演示套餐 ${index + 1}`}</span>
              <span className="dsh-semi-showcase-secondary-text">{`已用 ${index * 7} / 100`}</span>
            </div>
          ))}
        </DshScrollList>
      </DemoCard>
    </>
  )
}
