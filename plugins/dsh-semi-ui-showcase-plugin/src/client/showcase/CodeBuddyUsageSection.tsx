// 额度气泡 demo：圆环进度 + Popover 内 ScrollList 套餐明细。
import type { ReactNode } from 'react'
import {
  DshPopover,
  DshProgress,
  DshScrollList,
} from '@tnnevol/dsh-semi-ui'
import { sectionTitle, sectionText } from './class-names.ts'
import { DemoCard } from './DemoCard.tsx'
import { CodeBuddyDemoLogo } from './CodeBuddyLogo.tsx'

const usageDemoWindows = [
  { name: 'CodeBuddy个人体验版', used: 60, limit: 100, usedPercent: 60, resetsAt: '2026-10-01 00:00:00' },
  { name: '企业共享套餐', used: 320, limit: 800, usedPercent: 40, resetsAt: '2026-09-30 00:00:00' },
  { name: '充值包 A', used: 12, limit: 50, usedPercent: 24, resetsAt: '2026-12-31 00:00:00' },
  { name: '充值包 B', used: 45, limit: 50, usedPercent: 90, resetsAt: '2026-12-31 00:00:00' },
  { name: '赠送体验包', used: 8, limit: 30, usedPercent: 27, resetsAt: '2026-11-15 00:00:00' },
  { name: '团队协作包', used: 210, limit: 300, usedPercent: 70, resetsAt: '2026-10-20 00:00:00' },
  { name: '新客礼包', used: 0, limit: 20, usedPercent: 0, resetsAt: '2027-01-01 00:00:00' },
  { name: '升级补差包', used: 5, limit: 40, usedPercent: 13, resetsAt: '2026-10-10 00:00:00' },
]

/** 额度指示气泡：8 个套餐验证 388px 滚动。 */
export function CodeBuddyUsageSection(): ReactNode {
  return (
    <>
            {/* 额度气泡：Ring + Popover，多套餐列表用 Semi ScrollList 承载（max-height 388，超出滚动）。 */}
            <h2 id="cb-usage" className={sectionTitle}>额度气泡</h2>
            <p className={sectionText}>对话输入区右侧的额度指示器：圆环显示合并余量，点击弹出多套餐明细浮层。浮层内容区使用 Semi 的 ScrollList 组件承载，`max-height` 388px——套餐少时按内容自然撑开不出现空白，超过 388px 才进入 Y 轴滚动，滚动条样式由 DSH 主题统一。下方演示造了 8 个套餐以验证滚动。</p>
            <DemoCard source={'// 气泡内容区：ScrollList 内容区 max-height=388，超出自动滚动\n<DshPopover\n  trigger="click"\n  position="topRight"\n  content={\n    <DshScrollList className="dsh-codebuddy-usage-popover-scroll">\n      {windows.map(w => (\n        <div className="dsh-codebuddy-usage-popover-window" key={w.name}>\n          <div className="dsh-codebuddy-usage-popover-heading">\n            <span>{w.name}</span>\n            <span>剩余 {w.remaining}%</span>\n          </div>\n          <DshProgress percent={w.remaining} showInfo={false} />\n          <span className="dsh-codebuddy-usage-popover-reset">{w.resetsAt}</span>\n        </div>\n      ))}\n    </DshScrollList>\n  }\n>\n  <DshProgress type="circle" percent={remain} width={26} />\n</DshPopover>'}>
              <div className="dsh-codebuddy-section dsh-semi-showcase-collapse-plugin-section">
                <div className="dsh-codebuddy-usage-demo-row">
                  <DshPopover
                    trigger="click"
                    position="bottomLeft"
                    showArrow={false}
                    contentClassName="dsh-codebuddy-usage-popover"
                    content={(
                      <DshScrollList className="dsh-codebuddy-usage-popover-scroll">
                        {usageDemoWindows.map((window, index) => (
                          <div className="dsh-codebuddy-usage-popover-window" key={`${window.name}-${index}`}>
                            <div className="dsh-codebuddy-usage-popover-heading">
                              <span>{window.name}</span>
                              <span>{`剩余 ${Math.round(100 - window.usedPercent)}%`}</span>
                            </div>
                            <div className="dsh-codebuddy-usage-popover-amounts">
                              <span>{'已用额度'}</span>
                              <span>{`${window.used} / ${window.limit}`}</span>
                            </div>
                            <DshProgress
                              percent={100 - window.usedPercent}
                              showInfo={false}
                              stroke="var(--dsw-alias-label-tertiary)"
                              orbitStroke="var(--dsw-alias-border-l3)"
                              className="dsh-codebuddy-usage-popover-progress"
                            />
                            <span className="dsh-codebuddy-usage-popover-reset">{`重置 ${window.resetsAt}`}</span>
                          </div>
                        ))}
                      </DshScrollList>
                    )}
                  >
                    <span
                      className="dsh-codebuddy-usage-popover-trigger"
                      role="button"
                      tabIndex={0}
                    >
                      <DshProgress
                        type="circle"
                        percent={37}
                        width={26}
                        strokeWidth={3}
                        stroke="var(--dsw-alias-label-tertiary)"
                        orbitStroke="var(--dsw-alias-border-l3)"
                        showInfo
                        format={() => <CodeBuddyDemoLogo size={12} />}
                      />
                    </span>
                  </DshPopover>
                  <span className="dsh-codebuddy-accounts-desc">点击圆环打开气泡；8 个套餐超出 388px 高度，内容区自动滚动。</span>
                </div>
              </div>
            </DemoCard>

    </>
  )
}
