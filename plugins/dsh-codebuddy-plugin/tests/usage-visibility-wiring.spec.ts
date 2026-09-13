import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * CodeBuddy 用量图标的接线。
 *
 * 显隐判定的**位置**比判定本身更容易出错：如果它被放在挂起轮询的 `useEffect`
 * 之后，定时器照样会起来，在图标看不见的情况下继续请求用量接口——纯函数测试
 * 抓不到这类缺陷，只能盯源码结构。
 *
 * 还要守住 `timer.interval(...)` 那一行的存在与形状：它是客户端唯一的定时器，
 * `auto-switch-toggle.spec.ts` 里有断言盯着它是只读的。这里补的是「它必须在
 * 供应商判断之后」。
 */
const ROOT = '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src'
const STATUS = readFileSync(`${ROOT}/components/CodeBuddyUsageStatus.tsx`, 'utf8')
const PROPS = readFileSync(`${ROOT}/types/components/CodeBuddyUsageStatus.d.ts`, 'utf8')
const INDEX = readFileSync(`${ROOT}/client/index.tsx`, 'utf8')
const CONSTANTS = readFileSync(`${ROOT}/contracts/constants.ts`, 'utf8')

describe('CodeBuddy 用量图标的供应商显隐接线', () => {
  it('组件从座位标准套件读取 modelSelection 投影', () => {
    expect(STATUS).toContain("useProjection('modelSelection')")
    expect(STATUS).toContain('codebuddyUsageVisible(selected, showUsage)')
    // props 走座位标准套件，而不是手写一个只有 t/timer/rpc 的对象。
    expect(PROPS).toContain("PropsRuntime<'conversation.input.right'>")
    expect(PROPS).toContain("import type {} from '@deepseek-ai/dsh-client-ui-session/client'")
  })

  it('供应商与偏好取与后，判断发生在建立轮询之前并进入 effect 依赖', () => {
    const visibleAt = STATUS.indexOf('const visible = codebuddyUsageVisible(selected, showUsage)')
    const guardAt = STATUS.indexOf('if (!visible) return')
    const initialRefreshAt = STATUS.indexOf('void refresh()')
    const intervalAt = STATUS.indexOf('timer.interval(')
    const depsAt = STATUS.indexOf('}, [rpc, visible, timer, accountVersion])')
    expect(visibleAt).toBeGreaterThan(-1)
    expect(guardAt).toBeGreaterThan(-1)
    expect(initialRefreshAt).toBeGreaterThan(-1)
    expect(intervalAt).toBeGreaterThan(-1)
    // 判断 → 早退 → 首次拉取 → 起定时器。早退必须在首次 `void refresh()` 之前，
    // 不只是定时器之前：否则隐藏状态在挂载那一刻仍会发一次用量请求。
    expect(visibleAt).toBeLessThan(guardAt)
    expect(guardAt).toBeLessThan(initialRefreshAt)
    expect(initialRefreshAt).toBeLessThan(intervalAt)
    expect(depsAt).toBeGreaterThan(intervalAt)
  })

  it('图标不挂出时不渲染内容，也不残留已展开的浮层', () => {
    expect(STATUS).toMatch(/if \(!visible\) return null/)
    expect(STATUS).toContain('|| !visible) && popoverOpen')
  })

  it('供应商标识来自 contracts，不在组件里再写一份字面量', () => {
    expect(CONSTANTS).toContain("export const CODEBUDDY_PROVIDER = 'codebuddy'")
    expect(STATUS).not.toContain("'codebuddy'")
  })

  it('插槽注册保持 conversation.input.right 且 id/order 不变', () => {
    expect(INDEX).toContain("ctx.slots.inject('conversation.input.right'")
    expect(INDEX).toContain("id: 'codebuddy-usage'")
    expect(INDEX).toContain('order: 2')
    expect(INDEX).toContain("import type {} from '@deepseek-ai/dsh-client-ui-session/client'")
  })
})
