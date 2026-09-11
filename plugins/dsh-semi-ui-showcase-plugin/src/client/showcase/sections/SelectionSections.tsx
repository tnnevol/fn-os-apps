// 选择类组件 demo：Cascader、TreeSelect、Checkbox、Select。
import type { ReactNode } from 'react'
import {
  DshCascader,
  DshCheckbox,
  DshIconSearch,
  DshSelect,
  DshTreeSelect,
} from '@tnnevol/dsh-semi-ui'
import { useState } from 'react'
import { demo, sectionTitle, sectionText, stack } from '../class-names.ts'
import { DemoCard } from '../DemoCard.tsx'
import { cascaderData, selectOptionList, treeData } from '../demo-data.ts'

export function CascaderSection(): ReactNode {
  return (
    <>
      <h2 id="selection-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>展示默认、已选择、多选、搜索、禁用和错误校验状态。Cascader 的重点是完整路径，默认只允许选择叶子节点。</p>
      <DemoCard source={'<DshCascader treeData={data} multiple />\n<DshCascader treeData={data} filterTreeNode />'}><div className={demo}>{['默认状态', '已选择', '多选', '可搜索', '搜索全部节点', '禁用', '错误状态'].map((placeholder, index) => <DshCascader key={placeholder} className="dsh-semi-showcase-select" treeData={cascaderData} {...(index === 1 ? { defaultValue: ['model', 'luna'] } : {})} {...(index === 2 ? { multiple: true, defaultValue: ['model', 'sol'] } : {})} {...(index === 3 || index === 4 ? { filterTreeNode: true } : {})} {...(index === 4 ? { filterLeafOnly: false } : {})} {...(index === 5 ? { disabled: true } : {})} {...(index === 6 ? { validateStatus: 'error' as const } : {})} placeholder={placeholder} size="small" />)}</div></DemoCard>
    </>
  )
}

export function TreeSelectSection(): ReactNode {
  return (
    <>
      <h2 id="selection-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>展示默认、多选、叶子节点、标签折叠、搜索、禁用和成功校验状态。节点关系使用 Semi 的 checkRelation 属性。</p>
      <DemoCard source={'<DshTreeSelect treeData={data} multiple />\n<DshTreeSelect treeData={data} multiple leafOnly />\n<DshTreeSelect treeData={data} filterTreeNode />'}><div className={demo}>{['默认状态', '多选与复选', '只显示叶子节点', '标签折叠', '可搜索', '禁用', '成功状态'].map((placeholder, index) => <DshTreeSelect key={placeholder} className="dsh-semi-showcase-select" treeData={treeData} showLine={false} {...(index === 1 ? { multiple: true, treeCheckable: true, checkRelation: 'related' as const, defaultValue: ['plugins'] } : {})} {...(index === 2 ? { multiple: true, leafOnly: true, defaultValue: ['plugins'] } : {})} {...(index === 3 ? { multiple: true, maxTagCount: 1, defaultValue: ['plugins', 'apps'] } : {})} {...(index === 4 ? { filterTreeNode: true } : {})} {...(index === 5 ? { disabled: true } : {})} {...(index === 6 ? { validateStatus: 'success' as const } : {})} placeholder={placeholder} size="small" />)}</div></DemoCard>
    </>
  )
}

export function CheckboxSection(): ReactNode {
  const [checkboxChecked, setCheckboxChecked] = useState(false)
  return (
    <>
      <h2 id="checkbox-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>复选框用于表示选中或未选中的状态，点击示例可以实时切换。</p>
      <DemoCard source={'<DshCheckbox checked={checked} onChange={onChange}>可选项</DshCheckbox>'}>
        <div className={demo}>
          <DshCheckbox checked={checkboxChecked} onChange={() => { setCheckboxChecked(value => !value) }}>可选项</DshCheckbox>
          <DshCheckbox checked>默认选中</DshCheckbox>
        </div>
      </DemoCard>
      <h2 id="checkbox-states" className={sectionTitle}>选中与半选</h2>
      <p className={sectionText}>使用 `checked` 和 `indeterminate` 展示选择状态。</p>
      <DemoCard source={'<DshCheckbox checked>选中</DshCheckbox>\n<DshCheckbox indeterminate>半选</DshCheckbox>'}>
        <div className={demo}>
          <DshCheckbox checked>选中</DshCheckbox>
          <DshCheckbox indeterminate>半选</DshCheckbox>
          <DshCheckbox>未选中</DshCheckbox>
        </div>
      </DemoCard>
      <h2 id="checkbox-disabled" className={sectionTitle}>禁用状态</h2>
      <p className={sectionText}>禁用状态不可交互，并使用共享主题中的禁用颜色。</p>
      <DemoCard source={'<DshCheckbox disabled>禁用</DshCheckbox>\n<DshCheckbox disabled checked>禁用且选中</DshCheckbox>'}>
        <div className={demo}>
          <DshCheckbox disabled>禁用</DshCheckbox>
          <DshCheckbox disabled checked>禁用且选中</DshCheckbox>
        </div>
      </DemoCard>
    </>
  )
}

export function SelectSection(): ReactNode {
  return (
    <>
      <h2 id="select-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>Option 标签必须声明 `value` 属性，children 会渲染到下拉列表；也可以通过 `optionList` 以数组形式传入。</p>
      <DemoCard source={'<DshSelect defaultValue="luna" style={{ width: 180 }}>\n  <DshSelect.Option value="luna">GPT-5.6 Luna</DshSelect.Option>\n  <DshSelect.Option value="sol">GPT-5.6 Sol</DshSelect.Option>\n</DshSelect>\n<DshSelect placeholder="请选择模型" optionList={selectOptionList} filter />'}>
        <div className={demo}>
          <DshSelect className="dsh-semi-showcase-select" defaultValue="luna" filter placeholder="请选择模型">
            <DshSelect.Option value="luna">GPT-5.6 Luna</DshSelect.Option>
            <DshSelect.Option value="sol">GPT-5.6 Sol</DshSelect.Option>
            <DshSelect.Option value="nova">GPT-5.6 Nova</DshSelect.Option>
          </DshSelect>
          <DshSelect className="dsh-semi-showcase-select" placeholder="数组传入 optionList" optionList={selectOptionList} />
        </div>
      </DemoCard>
      <h2 id="select-multiple" className={sectionTitle}>多选与标签</h2>
      <p className={sectionText}>`multiple` 开启多选，`maxTagCount` 限制展示的标签数量，超出部分以 +N 形式折叠；`filter` 开启搜索。</p>
      <DemoCard source={'<DshSelect multiple filter defaultValue={["luna", "sol"]} maxTagCount={2} />\n<DshSelect multiple max={2} placeholder="最多选两项" />'}>
        <div className={stack}>
          <DshSelect className="dsh-semi-showcase-select" multiple filter defaultValue={['luna', 'sol']} maxTagCount={2} showRestTagsPopover restTagsPopoverProps={{ position: 'top' }} optionList={selectOptionList} />
          <DshSelect className="dsh-semi-showcase-select" multiple max={2} placeholder="最多选两项" optionList={selectOptionList} />
        </div>
      </DemoCard>
      <h2 id="select-states" className={sectionTitle}>尺寸与状态</h2>
      <p className={sectionText}>通过 `size`、`validateStatus`、`disabled`、`showClear`、`prefix` 和 `suffix` 展示常见的输入状态。</p>
      <DemoCard source={'<DshSelect size="small" />\n<DshSelect validateStatus="error" />\n<DshSelect disabled />\n<DshSelect prefix={<DshIconSearch />} showClear />'}>
        <div className={stack}>
          <DshSelect className="dsh-semi-showcase-select" size="small" placeholder="小尺寸" optionList={selectOptionList} />
          <DshSelect className="dsh-semi-showcase-select" validateStatus="error" placeholder="校验失败" optionList={selectOptionList} />
          <DshSelect className="dsh-semi-showcase-select" validateStatus="warning" placeholder="警告状态" optionList={selectOptionList} />
          <DshSelect className="dsh-semi-showcase-select" disabled defaultValue="luna" optionList={selectOptionList} />
          <DshSelect className="dsh-semi-showcase-select" showClear prefix={<DshIconSearch />} placeholder="前缀与清除" optionList={selectOptionList} />
        </div>
      </DemoCard>
    </>
  )
}
