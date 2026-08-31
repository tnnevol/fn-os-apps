import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { DshButton } from '@tnnevol/dsh-semi-ui'
import type { ShowcaseRouteController } from './route.ts'

export type SemiUiHeaderActionProps = PropsRuntime<'conversation.session.header.utilities'> & {
  route: ShowcaseRouteController
}

export function SemiUiHeaderAction({ route }: SemiUiHeaderActionProps) {
  return (
    <DshButton
      aria-label="打开 Semi UI 组件总览"
      htmlType="button"
      theme="borderless"
      type="tertiary"
      onClick={() => { route.open() }}
    >
      Semi UI
    </DshButton>
  )
}
