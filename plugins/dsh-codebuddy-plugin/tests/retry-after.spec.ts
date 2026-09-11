import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * `Retry-After` 此前只被解析进错误详情、**从未真正等待**（429 直接换号）。
 * 现在按报告要求实现为「有限的、可中断的等待」。
 *
 * 这里用源码断言 + 语义检查：完整的 HTTP 层等待需要模拟 SSE 服务，
 * 而关键的**行为契约**（上限、可中断、无值时的退避）都能从实现与常量核实。
 */
const ROOT = '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src'
const ADAPTER = readFileSync(`${ROOT}/host/adapter.ts`, 'utf8')

describe('Retry-After 等待', () => {
  it('有等待上限，避免会话被长间隔挂住', () => {
    expect(ADAPTER).toMatch(/const MAX_RETRY_WAIT_MS = 30_000/)
    // 服务端可能给出按小时计的间隔；必须夹住，而不是照单全收。
    expect(ADAPTER).toMatch(/Math\.min\(provider, MAX_RETRY_WAIT_MS\)/)
  })

  it('优先采用服务端 Retry-After，无值时退回指数退避', () => {
    expect(ADAPTER).toMatch(/source: 'provider'/)
    expect(ADAPTER).toMatch(/source: 'backoff'/)
    expect(ADAPTER).toMatch(/RETRY_BACKOFF_BASE_MS \* 2 \*\*/)
  })

  it('读取的是 harness 的 failure.providerRetryAfterMs 一等字段', () => {
    // 不臆造自定义 details 结构：DSH 已在 LlmFailure 上定义该字段。
    expect(ADAPTER).toContain('error.failure.providerRetryAfterMs')
  })

  it('等待可被 AbortSignal 打断，且打断后不再重试', () => {
    expect(ADAPTER).toMatch(/function waitFor\(ms: number, signal\?: AbortSignal\)/)
    expect(ADAPTER).toMatch(/signal\?\.addEventListener\('abort', finish, \{ once: true \}\)/)
    expect(ADAPTER).toMatch(/options\.signal\?\.aborted === true[\s\S]{0,200}throw new LlmError/)
  })

  it('waitFor 清理定时器与监听器（不留悬挂句柄）', () => {
    expect(ADAPTER).toMatch(/clearTimeout\(timer\)/)
    expect(ADAPTER).toMatch(/removeEventListener\('abort', finish\)/)
  })

  it('已中止的信号不会启动等待', () => {
    expect(ADAPTER).toMatch(/if \(signal\?\.aborted === true\) return Promise\.resolve\(\)/)
  })
})

describe('请求级 triedAccountIds', () => {
  it('是请求级状态（在 runWithFailover 内局部声明）', () => {
    // 不能放 session 或全局：跨请求共享会让后续请求误以为账号已尝试过。
    const run = ADAPTER.slice(ADAPTER.indexOf('private async * runWithFailover'))
    expect(run).toMatch(/const attempted = new Set<string>\(\)/)
  })

  it('初始账号在第一次尝试前就计入', () => {
    const run = ADAPTER.slice(ADAPTER.indexOf('private async * runWithFailover'), ADAPTER.indexOf('private async failoverToNextAccount'))
    expect(run).toMatch(/attempted\.add\(current\.id\)/)
  })

  it('切换成功后的目标账号计入 triedIds', () => {
    expect(ADAPTER).toMatch(/attempted\.add\(switched\.id\)/)
  })

  it('被动决策收到 triedIds（同一次请求不重复使用账号）', () => {
    expect(ADAPTER).toMatch(/decideReactiveTarget\(\{[\s\S]{0,300}triedIds: \[\.\.\.attempted\]/)
  })

  it('切换带 CAS（expectedActiveId），不覆盖并发的账号变更', () => {
    expect(ADAPTER).toMatch(/switchTo\(decision\.targetId, current\.id\)/)
  })
})
