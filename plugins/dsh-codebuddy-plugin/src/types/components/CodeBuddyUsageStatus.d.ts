
import type { Translate } from '../client/panel-types'
export type { Translate } from '../client/panel-types'
import type { ConnectionRpc } from '../../client/rpc.ts'

export type TimerService = {
  interval(callback: () => void, delay: number): () => void
}
export interface CodeBuddyUsageStatusProps {
  t: Translate
  timer: TimerService
  rpc: ConnectionRpc
}
