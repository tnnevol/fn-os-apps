import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

/**
 * 用量图标的接线：显隐判定的位置比判定本身更容易出错。
 *
 * 光有 `codexUsageVisible` 的正确真值表不够——如果它在组件里被放在挂起轮询的
 * `useEffect` **之后**，定时器照样会起来，在图标看不见的情况下继续请求用量
 * 接口。这类缺陷纯函数测试抓不到，只能盯源码结构。
 *
 * 这里同时守住两件不能被顺手改掉的事：
 * 1. 判定发生在 `timer.interval` 之前，并进 effect 依赖数组；
 * 2. 插槽注册仍在 `conversation.input.right`，`id`/`order` 不变（两个用量插件
 *    不能遮蔽彼此）。
 */
const STATUS = new URL('../../src/components/CodexUsageStatus.tsx', import.meta.url)
const INDEX = new URL('../../src/client/index.tsx', import.meta.url)
const PROVIDER = new URL('../../src/contracts/provider.ts', import.meta.url)

describe('Codex 用量图标的供应商显隐接线', () => {
  it('组件从座位标准套件读取 modelSelection 投影', async () => {
    const status = await readFile(STATUS, 'utf8')
    expect(status).toContain("useProjection('modelSelection')")
    expect(status).toContain('codexUsageVisible(selected)')
    // props 走座位标准套件，而不是手写一个只有 t/timer 的对象。
    expect(status).toContain("PropsRuntime<'conversation.input.right'>")
  })

  it('供应商判断发生在建立轮询之前，且进入 effect 依赖', async () => {
    const status = await readFile(STATUS, 'utf8')
    const visibleAt = status.indexOf('const visible = codexUsageVisible(selected)')
    const guardAt = status.indexOf('if (!visible) return')
    const initialRefreshAt = status.indexOf('void refresh()')
    const intervalAt = status.indexOf('timer.interval(')
    const depsAt = status.indexOf('}, [timer, visible])')
    expect(visibleAt).toBeGreaterThan(-1)
    expect(guardAt).toBeGreaterThan(-1)
    expect(initialRefreshAt).toBeGreaterThan(-1)
    expect(intervalAt).toBeGreaterThan(-1)
    // 判断 → 早退 → 首次拉取 → 起定时器。
    //
    // 早退必须在**首次 `void refresh()` 之前**，不只是定时器之前：只把判断挪到
    // `refresh()` 和 `timer.interval()` 中间，隐藏时不会建定时器，但挂载那一刻
    // 仍然会发一次用量请求——这正是「隐藏了还在轮询」要避免的。
    expect(visibleAt).toBeLessThan(guardAt)
    expect(guardAt).toBeLessThan(initialRefreshAt)
    expect(initialRefreshAt).toBeLessThan(intervalAt)
    expect(depsAt).toBeGreaterThan(intervalAt)
  })

  it('不匹配时不渲染内容，并且不残留已展开的浮层', async () => {
    const status = await readFile(STATUS, 'utf8')
    expect(status).toMatch(/if \(!visible\) return null/)
    expect(status).toContain('|| !visible) && popoverOpen')
  })

  it('供应商标识来自 contracts，不在组件里再写一份字面量', async () => {
    const status = await readFile(STATUS, 'utf8')
    const provider = await readFile(PROVIDER, 'utf8')
    expect(provider).toContain("export const CODEX_PROVIDER = 'openai-codex'")
    // 组件本身不该出现裸的供应商字符串。
    expect(status).not.toContain("'openai-codex'")
  })

  it('插槽注册保持 conversation.input.right 且 id/order 不变', async () => {
    const index = await readFile(INDEX, 'utf8')
    expect(index).toContain("ctx.slots.inject('conversation.input.right'")
    expect(index).toContain("id: 'codex-usage'")
    expect(index).toContain('order: 1')
    // 拉入 SessionStandardProps 的合并，useProjection 类型才存在。
    expect(index).toContain("import type {} from '@deepseek-ai/dsh-client-ui-session/client'")
  })
})
