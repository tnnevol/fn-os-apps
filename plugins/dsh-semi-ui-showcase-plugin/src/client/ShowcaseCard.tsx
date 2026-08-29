import type { CSSProperties } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { DshButton } from '@tnnevol/dsh-semi-ui'
import type { ShowcaseRouteController } from './route.ts'

export type ShowcaseCardProps = PropsRuntime<'settings.plugin.item'> & { route: ShowcaseRouteController }

const card: CSSProperties = { padding: 16, border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 12, background: 'var(--dsw-alias-bg-layer-3)' }
const row: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }

function closeDshSettings(): void {
  // DSH's settings shell owns the modal state and exposes Escape as its
  // supported close contract to nested settings cards.
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

export function ShowcaseCard({ route }: ShowcaseCardProps) {
  return (
    <section style={card}>
      <div style={row}>
        <div>
          <strong>DSH Semi UI</strong>
          <p style={{ margin: '4px 0 0', color: 'var(--dsw-alias-label-tertiary)', fontSize: 13 }}>查看共享组件、交互状态和 DSH 主题效果。</p>
        </div>
        <DshButton theme="solid" type="primary" onClick={() => { closeDshSettings(); route.open() }}>打开总览</DshButton>
      </div>
    </section>
  )
}
