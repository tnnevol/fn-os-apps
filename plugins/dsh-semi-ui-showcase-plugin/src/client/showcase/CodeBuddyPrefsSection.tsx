// 偏好设置 demo：账号区下方的三项 UI 偏好表单。
import type { ReactNode } from 'react'
import {
  DshForm,
  DshSlider,
  DshSwitch,
} from '@tnnevol/dsh-semi-ui'
import { useState } from 'react'
import { sectionTitle, sectionText } from './class-names.ts'
import { DemoCard } from './DemoCard.tsx'

/** CodeBuddy 多账户演示的偏好设置表单。 */
export function CodeBuddyPrefsSection(): ReactNode {
  const [cbPrefShowUsage, setCbPrefShowUsage] = useState(true)
  const [cbPrefDangerPct, setCbPrefDangerPct] = useState(90)
  const [cbPrefAutoSwitch, setCbPrefAutoSwitch] = useState(false)
  return (
    <>
            {/* 偏好设置。 */}
            <h2 id="cb-prefs" className={sectionTitle}>偏好设置</h2>
            <p className={sectionText}>账号区下方的偏好表单，与用量展示联动的三项 UI 偏好：显示额度余量、余量告警百分比，以及多账户新增的「额度不足自动切换」演示开关。</p>
            <DemoCard source={'<DshForm labelPosition="left">\n  <DshForm.Slot label="显示额度余量"><DshSwitch /></DshForm.Slot>\n  <DshForm.Slot label="余量告警百分比"><DshSlider min={1} max={100} /></DshForm.Slot>\n  <DshForm.Slot label="额度不足自动切换"><DshSwitch /></DshForm.Slot>\n</DshForm>'}>
              <div className="dsh-codebuddy-section dsh-semi-showcase-collapse-plugin-section">
                <DshForm className="dsh-codebuddy-pref-form" labelPosition="left">
                  <DshForm.Slot label={<span className="dsh-semi-showcase-form-preference-label"><strong>显示额度余量</strong><span>在对话框输入区显示已用额度进度。</span></span>}>
                    <DshSwitch checked={cbPrefShowUsage} onChange={(checked: boolean) => { setCbPrefShowUsage(checked) }} aria-label="显示额度余量" />
                  </DshForm.Slot>
                  <DshForm.Slot label={<span className="dsh-semi-showcase-form-preference-label"><strong>余量告警百分比</strong><span>已用百分比达到此值时，进度条变为红色提醒。</span></span>}>
                    <div className="dsh-semi-showcase-form-slider">
                      <DshSlider value={cbPrefDangerPct} min={1} max={100} step={1} onChange={(value: number | [number, number]) => { if (typeof value === 'number') setCbPrefDangerPct(value) }} aria-label="余量告警百分比" />
                      <span className="dsh-semi-showcase-form-slider-value">{cbPrefDangerPct}%</span>
                    </div>
                  </DshForm.Slot>
                  <DshForm.Slot label={<span className="dsh-semi-showcase-form-preference-label"><strong>额度不足自动切换</strong><span>当前账号额度告警时自动切换到额度最充裕的备用账号。</span></span>}>
                    <DshSwitch checked={cbPrefAutoSwitch} onChange={(checked: boolean) => { setCbPrefAutoSwitch(checked) }} aria-label="额度不足自动切换" />
                  </DshForm.Slot>
                </DshForm>
              </div>
            </DemoCard>

</>
  )
}
