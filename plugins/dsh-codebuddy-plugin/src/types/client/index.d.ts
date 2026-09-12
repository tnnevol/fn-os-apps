
import type { SlotRegistry } from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { CodeBuddyLocaleKey } from '../../client/locales/index.ts'

// 让 renderer 提供的 slot service 对经由不同 peer dependency 路径解析
// renderer 包的消费者保持可见。
declare module '@deepseek-ai/cordis' {
  interface Context {
    slots: SlotRegistry
  }
}
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'settings.codebuddy': CodeBuddyLocaleKey
  }
}
export type TimerService = {
  interval(callback: () => void, delay: number): () => void
}
