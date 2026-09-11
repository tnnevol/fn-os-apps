import type { ReactNode } from 'react'
import { code, demoCard, demoPreview } from './class-names.ts'

/** 将 Dsh 前缀还原为官方 Semi 组件名，让示例代码与官方文档对齐。 */
export function toOfficialSource(source: string): string {
  return source
    .replaceAll('@tnnevol/dsh-semi-ui', '@douyinfe/semi-ui')
    .replace(/\bDsh(?=[A-Z])/g, '')
}

export function DemoCode({ children }: { children: string }): ReactNode {
  return <pre className={code}><code>{toOfficialSource(children)}</code></pre>
}

/** 演示卡片：预览在上、对应源码在下。 */
export function DemoCard({ children, source }: { children: ReactNode; source: string }): ReactNode {
  return (
    <div className={demoCard}>
      <div className="dsh-semi-showcase-demo-card-inner">
        <div className={demoPreview}>{children}</div>
        <DemoCode>{source}</DemoCode>
      </div>
    </div>
  )
}
