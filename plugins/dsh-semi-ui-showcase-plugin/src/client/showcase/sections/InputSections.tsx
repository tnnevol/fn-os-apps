// 输入类组件 demo：Input、InputNumber、Slider、Switch、Form。
import type { ReactNode } from 'react'
import {
  DshForm,
  DshInput,
  DshInputNumber,
  DshSlider,
  DshSwitch,
} from '@tnnevol/dsh-semi-ui'
import { useState } from 'react'
import { demo, demoLabel, sectionTitle, sectionText, stack } from '../class-names.ts'
import { DemoCard } from '../DemoCard.tsx'

export function InputSection(): ReactNode {
  const [inputValue, setInputValue] = useState('DSH Semi UI')
  return (
    <>
      <h2 id="input-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>输入框支持受控值、清除按钮和占位提示，输入内容会实时同步到示例。</p>
      <DemoCard source={'<Input value={value} onChange={setValue} showClear placeholder="请输入内容" />'}>
        <DshInput className="dsh-semi-showcase-control" value={inputValue} onChange={setInputValue} showClear placeholder="请输入内容" />
      </DemoCard>
      <h2 id="input-states" className={sectionTitle}>尺寸与状态</h2>
      <p className={sectionText}>通过 `size`、`validateStatus` 和 `disabled` 展示常见的输入状态。</p>
      <DemoCard source={`<Input size="small" />
<Input validateStatus="error" />
<Input disabled value="不可编辑" />`}>
        <div className={stack}>
          <DshInput className="dsh-semi-showcase-control" size="small" placeholder="小尺寸" />
          <DshInput className="dsh-semi-showcase-control" validateStatus="error" value="校验失败" readOnly />
          <DshInput className="dsh-semi-showcase-control" disabled value="不可编辑" />
        </div>
      </DemoCard>
    </>
  )
}

export function InputNumberSection(): ReactNode {
  const [inputNumberValue, setInputNumberValue] = useState<number | string>(24)
  return (
    <>
      <h2 id="input-number-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>数字输入框支持键盘输入和步进按钮，当前值为 {String(inputNumberValue)}。</p>
      <DemoCard source={'<InputNumber value={value} onChange={setValue} step={1} />'}>
        <DshInputNumber className="dsh-semi-showcase-control" value={inputNumberValue} onChange={setInputNumberValue} step={1} />
      </DemoCard>
      <h2 id="input-number-states" className={sectionTitle}>范围与尺寸</h2>
      <p className={sectionText}>使用 `min`、`max` 和 `size` 限制输入范围并适配不同密度。</p>
      <DemoCard source={`<InputNumber min={0} max={100} size="small" />
<InputNumber disabled value={50} />`}>
        <div className={stack}>
          <DshInputNumber className="dsh-semi-showcase-control" min={0} max={100} size="small" defaultValue={50} />
          <DshInputNumber className="dsh-semi-showcase-control" disabled value={50} />
        </div>
      </DemoCard>
    </>
  )
}

export function SliderSection(): ReactNode {
  const [sliderValue, setSliderValue] = useState(42)
  return (
    <>
      <h2 id="slider-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>滑动选择一个数值，当前值为 {sliderValue}。</p>
      <DemoCard source={'<Slider value={value} onChange={setValue} step={1} />'}>
        <div className="dsh-semi-showcase-slider">
          <DshSlider value={sliderValue} onChange={(value: number | [number, number]) => { if (typeof value === 'number') setSliderValue(value) }} />
        </div>
      </DemoCard>
      <h2 id="slider-states" className={sectionTitle}>范围与刻度</h2>
      <p className={sectionText}>`range` 用于选择区间，`marks` 用于标记关键位置。</p>
      <DemoCard source={'<Slider range defaultValue={[20, 80]} marks={{ 0: "0", 50: "50", 100: "100" }} />'}>
        <div className="dsh-semi-showcase-slider">
          <DshSlider range defaultValue={[20, 80]} marks={{ 0: '0', 50: '50', 100: '100' }} />
        </div>
      </DemoCard>
    </>
  )
}

export function SwitchSection(): ReactNode {
  const [switchChecked, setSwitchChecked] = useState(true)
  return (
    <>
      <h2 id="switch-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>开关是受控组件，点击后会立即更新当前状态。</p>
      <DemoCard source={'<Switch checked={checked} onChange={setChecked} />'}>
        <div className={demo}>
          <DshSwitch checked={switchChecked} onChange={setSwitchChecked} aria-label="启用状态" />
          <span className={demoLabel}>{switchChecked ? '已开启' : '已关闭'}</span>
        </div>
      </DemoCard>
      <h2 id="switch-states" className={sectionTitle}>文字与禁用</h2>
      <p className={sectionText}>通过 `checkedText`、`uncheckedText` 和 `disabled` 表达更明确的状态。</p>
      <DemoCard source={`<Switch checkedText="开" uncheckedText="关" />
<Switch disabled checked />`}>
        <div className={demo}>
          <DshSwitch defaultChecked checkedText="开" uncheckedText="关" />
          <DshSwitch disabled defaultChecked />
        </div>
      </DemoCard>
    </>
  )
}

export function FormSection(): ReactNode {
  const [showUsage, setShowUsage] = useState(true)
  const [dangerPercentage, setDangerPercentage] = useState(90)
  return (
    <>
      <h2 id="form-basic" className={sectionTitle}>基本用法</h2>
      <p className={sectionText}>Form 通过 Slot 组织标签和控件，适合展示额度、偏好等配置型表单。</p>
      <DemoCard source={`<Form labelPosition="left">
  <Form.Slot label="显示额度余量"><Switch checked={showUsage} /></Form.Slot>
  <Form.Slot label="自定义额度上限"><InputNumber placeholder="使用默认" /></Form.Slot>
  <Form.Slot label="余量告警百分比"><Slider value={percentage} /></Form.Slot>
</Form>`}>
        <DshForm className="dsh-semi-showcase-form" labelPosition="left">
          <DshForm.Slot label={<span className="dsh-semi-showcase-form-preference-label"><strong>显示额度余量</strong><span>在侧边栏底部设置按钮上方显示已用额度进度。</span></span>}>
            <DshSwitch checked={showUsage} onChange={setShowUsage} aria-label="显示额度余量" />
          </DshForm.Slot>
          <DshForm.Slot label={<span className="dsh-semi-showcase-form-preference-label"><strong>自定义额度上限</strong><span>覆盖服务端上报的总量，按此值计算已用百分比。</span></span>}>
            <DshInputNumber className="dsh-semi-showcase-control" placeholder="使用默认" />
          </DshForm.Slot>
          <DshForm.Slot label={<span className="dsh-semi-showcase-form-preference-label"><strong>余量告警百分比</strong><span>已用百分比达到此值时，进度条变为红色提醒。</span></span>}>
            <div className="dsh-semi-showcase-form-slider">
              <DshSlider value={dangerPercentage} onChange={(value: number | [number, number]) => { if (typeof value === 'number') setDangerPercentage(value) }} />
              <span className="dsh-semi-showcase-form-slider-value">{dangerPercentage}%</span>
            </div>
          </DshForm.Slot>
        </DshForm>
      </DemoCard>
      <h2 id="form-states" className={sectionTitle}>字段状态</h2>
      <p className={sectionText}>表单字段可以组合控件自身的校验、禁用和辅助说明状态。</p>
      <DemoCard source={`<Form.Slot label="邮箱" error={{ helpText: "请输入有效邮箱" }}><Form.Input validateStatus="error" initValue="invalid" /></Form.Slot>
<Form.Slot label="只读"><Form.Input disabled initValue="系统生成" /></Form.Slot>`}>
        <DshForm className="dsh-semi-showcase-form">
          <DshForm.Slot label="邮箱" error={{ helpText: '请输入有效邮箱' }}><DshForm.Input field="email" validateStatus="error" initValue="invalid" /></DshForm.Slot>
          <DshForm.Slot label="只读"><DshForm.Input field="generated" disabled initValue="系统生成" /></DshForm.Slot>
        </DshForm>
      </DemoCard>
    </>
  )
}
