import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * `usePanelData` 发出的 RPC 请求必须带 `payload` 字段。
 *
 * 这是一条真实故障的回归守卫：清理代码时把 `payload` 参数从
 * `rpc.call(channel, endpoint, payload)` 里整个省略了，写成
 * `rpc.call(channel, endpoint)`。
 *
 * 为什么这会让整个账号管理页空白：
 *  1. Connection 客户端用 `JSON.stringify({ type, rpcId, method, payload })`
 *     构造信封，而 **`JSON.stringify` 会丢掉值为 `undefined` 的键** ——
 *     于是线上发出的是一个没有 `payload` 字段的 `client-request`；
 *  2. host 用 zod 校验信封，schema 是 `payload: z.unknown()`，而 `z.unknown()`
 *     要求**键必须存在**（缺键报 `expected nonoptional, received undefined`）；
 *  3. 校验失败 → host 返回 `invalid client-request message` → 端点数据取不回来。
 *
 * 更难发现的是：本插件的本地类型把 payload 声明成可选（`payload?: unknown`），
 * 比 DSH 真实契约（`payload: unknown`，必填）宽松，所以 **tsc 不会报错**，
 * 单元测试若只 mock 掉 rpc 也照样通过——故障只在真实浏览器+host 联调时出现。
 *
 * 因此这里不测「调用有没有发生」，而是直接把**信封序列化后是否含 payload 键**
 * 固定下来，并同时守住「本地类型不得把 payload 放宽成可选」这条前提。
 */
const ROOT = '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src'
const HOOK = readFileSync(`${ROOT}/client/hooks/use-panel-data.ts`, 'utf8')
const RPC_TYPE = readFileSync(`${ROOT}/types/client/rpc.d.ts`, 'utf8')

/** 所有 `rpc.call(...)` 调用的参数片段（含跨行写法）。 */
function rpcCallArgs(source: string): string[] {
  const out: string[] = []
  const marker = 'rpc.call'
  let from = source.indexOf(marker)
  while (from !== -1) {
    // 取到该次调用的闭合括号（参数里可能含嵌套括号/花括号）。
    let depth = 0
    let index = source.indexOf('(', from)
    const start = index
    for (; index < source.length; index += 1) {
      const ch = source[index]
      if (ch === '(') depth += 1
      else if (ch === ')') {
        depth -= 1
        if (depth === 0) break
      }
    }
    out.push(source.slice(start, index + 1))
    from = source.indexOf(marker, index)
  }
  return out
}

describe('usePanelData 的 RPC 信封带 payload', () => {
  it('rpc.call 显式传了第三个参数（空对象），没有省略', () => {
    const calls = rpcCallArgs(HOOK)
    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) {
      // 形如 `(CODEBUDDY_AUTH_CHANNEL, endpoint, {})` —— 必须有三段。
      const parts = call.slice(1, -1).split(',')
      expect(parts.length).toBeGreaterThanOrEqual(3)
      expect(parts[2]!.trim()).not.toBe('')
    }
  })

  it('payload 确实传入而非落到 signal 位置（参数顺序不能错）', () => {
    // 正向断言：调用里出现 `endpoint, {}` 这一对。
    expect(HOOK).toMatch(/rpc\.call<[^>]*>\(\s*CODEBUDDY_AUTH_CHANNEL,\s*endpoint,\s*\{\s*\}\s*\)/)
  })

  it('省略 payload 会让信封丢掉 payload 键（故障机理，用真实 JSON 行为固定）', () => {
    // 这条不依赖源码文本，而是直接演示「为什么省略会坏」——若哪天有人质疑这个
    // 约束是否真实，这里给出可执行的证据。
    const withPayload = JSON.stringify({ type: 'client-request', rpcId: 'x', method: 'panelStatus', payload: {} })
    const omitted = JSON.stringify({ type: 'client-request', rpcId: 'x', method: 'panelStatus', payload: undefined })
    expect(withPayload).toContain('"payload":{}')
    // 值为 undefined 的键被 stringify 丢弃 —— 线上信封因此缺字段。
    expect(omitted).not.toContain('payload')
  })

  it('本地 ConnectionRpc 类型不得把 payload 放宽成可选', () => {
    /**
     * 本地声明若写成 `payload?: unknown`，就会比 DSH 真实契约（必填）宽松，
     * 于是「省略 payload」这种写法能通过 tsc、单元测试也照过，故障只在真实
     * 联调时暴露。这条把类型声明本身钉住，避免宽类型再次掩盖同类问题。
     *
     * 注意：这里刻意**要求**它是必填。当前上游声明是 `payload: unknown`。
     */
    expect(RPC_TYPE).toMatch(/call:\s*<T>\([^)]*payload:\s*unknown/)
  })
})
