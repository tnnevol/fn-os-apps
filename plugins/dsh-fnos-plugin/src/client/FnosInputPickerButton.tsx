/** fnOS TreeSelect input action mounted in DSH's stable left toolbar slot. */

import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { FnosInputReference } from './input-references.ts'
import { FnosAuthorizedPathPicker } from './FnosAuthorizedPathPicker.tsx'

type InputPickerProps = PropsRuntime<'conversation.input.left'> & PropsLocale<'settings.dsh-fnos'> & {
  insertReferences: (input: { draft: string, draftRev: number }, references: readonly FnosInputReference[]) => boolean
}

export function FnosInputPickerButton({ input, inputActions, session, insertReferences, t }: InputPickerProps) {
  return <FnosAuthorizedPathPicker input={input} inputActions={inputActions} session={session} insertReferences={insertReferences} t={t} />
}
