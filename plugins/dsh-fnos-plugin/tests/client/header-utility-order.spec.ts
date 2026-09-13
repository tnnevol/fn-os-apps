import { describe, expect, it } from 'vitest'
import { SlotCore } from '@deepseek-ai/dsh-client-ui-slots'
import { FNOS_OPEN_IN_APP_SEAT, FNOS_SESSION_LOG_SEAT } from '../../src/client/header-utility-seats.ts'

/**
 * 会话头部两个条目的左右顺序。
 *
 * 用真实 `SlotCore` 注册这两个座位并断言最终顺序，而不是断言源码字符串——
 * 顺序回归不会报错：一旦 priority/order 被打平，位置就静默地改由注册顺序决定，
 * 两个按钮就此调换，界面看起来「只是挪了个位置」，很难在评审中发现。
 *
 * 官方布局：`ui-open-in-app` 用 order -10、`session-log-export` 用默认 order 0，
 * 所以文件入口在左、更多操作在右。
 */

const Comp = (() => null) as never

function orderOf(seats: readonly object[]): string[] {
  const core = new SlotCore()
  core.register({
    name: 'root',
    children: { 'conversation.session.header.utilities': { kind: 'list', scope: 'session' } },
  }, Comp)
  for (const seat of seats) core.register(seat as never, Comp)
  return core.entries('conversation.session.header.utilities')
    .map(entry => (entry.options as { id: string }).id)
}

describe('会话头部条目顺序', () => {
  it('文件入口排在 Session log 左侧（与官方一致）', () => {
    expect(orderOf([FNOS_SESSION_LOG_SEAT, FNOS_OPEN_IN_APP_SEAT]))
      .toEqual(['open-in-app', 'session-log-download'])
  })

  it('顺序不依赖注册先后', () => {
    // 反过来注册，结果必须相同：顺序由 order 决定，而不是注册顺序。
    expect(orderOf([FNOS_OPEN_IN_APP_SEAT, FNOS_SESSION_LOG_SEAT]))
      .toEqual(['open-in-app', 'session-log-download'])
  })

  it('两个座位都用更低优先级遮蔽官方条目', () => {
    // 官方两条目用默认 priority 0；同优先级注册会直接抛错，整个插件加载失败。
    expect(FNOS_OPEN_IN_APP_SEAT.priority).toBeLessThan(0)
    expect(FNOS_SESSION_LOG_SEAT.priority).toBeLessThan(0)
    // 遮蔽靠同 id：官方用 'open-in-app' 与 'session-log-download'。
    expect(FNOS_OPEN_IN_APP_SEAT.id).toBe('open-in-app')
    expect(FNOS_SESSION_LOG_SEAT.id).toBe('session-log-download')
  })
})
