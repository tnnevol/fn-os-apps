/** fnOS TreeSelect input action mounted in DSH's stable left toolbar slot. */

import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { FnosInputReference } from './input-references.ts'
import { FnosAuthorizedPathPicker } from './FnosAuthorizedPathPicker.tsx'

type InputPickerProps = PropsRuntime<'conversation.input.left'> & PropsLocale<'settings.dsh-fnos'> & {
  insertReferences: (input: { draft: string, draftRev: number }, references: readonly FnosInputReference[]) => readonly FnosInputReference[]
}

export function FnosInputPickerButton({ useInput, inputActions, insertReferences, t }: InputPickerProps) {
  return <FnosAuthorizedPathPicker useInput={useInput} inputActions={inputActions} insertReferences={insertReferences} t={t} />
}
