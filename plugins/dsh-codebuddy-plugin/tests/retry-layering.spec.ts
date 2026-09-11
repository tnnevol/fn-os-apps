import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 内层与外层重试的**职责划分**。
 *
 * 背景：DSH 自带的 `@deepseek-ai/dsh-llm-retry` 已随 `dsh-base` 挂载，工作在
 * 整个 agent 请求层面（`agent/request-error`），默认 `maxRetries: 5`，自带指数
 * 退避与 `Retry-After` 支持，可重试码为
 * `EMPTY_RESPONSE / RATE_LIMIT / SERVER / TIMEOUT / TRANSPORT`。
 *
 * 因此 adapter 内层只做官方不做的那件事：`QUOTA` 时换账号。若内层也处理
 * `RATE_LIMIT` 或自己做等待，两层会对同一错误各重试一遍，最坏变成
 * 「内层次数 × 外层 6 次」的远端请求。
 */
const ROOT = '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src'
const ADAPTER = readFileSync(`${ROOT}/host/adapter.ts`, 'utf8')

describe('内层只负责换账号，不重复外层的等待与重试', () => {
  it('可切换错误包含 QUOTA 与 RATE_LIMIT', () => {
    /**
     * 曾经只认 QUOTA，理由是「限流是服务端对该账号的节流，换账号不解决」。
     * 实测否证：CodeBuddy 的 429 是**账号 × 模型**级别的额度耗尽 ——
     * 同一账号对 deepseek-v4.1-flash 是 429、对 glm-5.3 是 200，且另一个账号
     * 对同一模型是 200。换账号确实有效，所以 RATE_LIMIT 也必须触发换号。
     */
    const run = ADAPTER.slice(
      ADAPTER.indexOf('private async * runWithFailover'),
      ADAPTER.indexOf('private async failoverToNextAccount'),
    )
    const predicate = /const swappable = ([^\n]+)/.exec(run)?.[1] ?? ''
    expect(predicate).toContain('QUOTA_EXCEEDED_CODE')
    expect(predicate).toContain("'RATE_LIMIT'")
  })

  it('瞬时故障仍交给外层原地重试（换账号无益）', () => {
    const run = ADAPTER.slice(
      ADAPTER.indexOf('private async * runWithFailover'),
      ADAPTER.indexOf('private async failoverToNextAccount'),
    )
    // 不应把 SERVER / TRANSPORT / TIMEOUT 也纳入换号条件
    const predicate = /const swappable = ([^\n]+)/.exec(run)?.[1] ?? ''
    for (const code of ['SERVER', 'TRANSPORT', 'TIMEOUT', 'EMPTY_RESPONSE']) {
      expect(predicate).not.toContain(code)
    }
  })

  it('内层不再自己等待 Retry-After（外层已实现且语义更优）', () => {
    // 曾经实现过 MAX_RETRY_WAIT_MS / waitFor / retryDelayFor，现已移除。
    expect(ADAPTER).not.toMatch(/function waitFor\(/)
    expect(ADAPTER).not.toMatch(/function retryDelayFor\(/)
    expect(ADAPTER).not.toMatch(/MAX_RETRY_WAIT_MS\s*=/)
  })

  it('保留说明：等待与退避为何不在本模块', () => {
    // 曾经两套并存，需要在源码里留下「为什么不做」的记录，避免后人再加回来。
    expect(ADAPTER).toContain('llm-retry')
    expect(ADAPTER).toMatch(/maxRetries: 5/)
    expect(ADAPTER).toMatch(/乘法关系/)
  })
})

describe('尝试上限由账号数决定', () => {
  it('不写死魔数 5，而是取账号总数', () => {
    const run = ADAPTER.slice(
      ADAPTER.indexOf('private async * runWithFailover'),
      ADAPTER.indexOf('private async failoverToNextAccount'),
    )
    expect(run).toMatch(/const total = await this\.config\.session\.accountCount\(\)/)
    expect(run).toMatch(/const maxAttempts = Math\.max\(1, total\)/)
    // 不应出现硬编码的 5 次上限
    expect(run).not.toMatch(/maxAttempts\s*=\s*5\b/)
  })

  it('session 提供 accountCount', () => {
    const SESSION = readFileSync(`${ROOT}/host/session.ts`, 'utf8')
    expect(SESSION).toMatch(/async accountCount\(\): Promise<number>/)
    // 无文档时按 1 处理，而不是 0（否则一次都不尝试）
    expect(SESSION).toMatch(/storage === undefined \? 1 : Math\.max\(1, storage\.accounts\.length\)/)
  })
})

describe('请求级 triedAccountIds', () => {
  it('是请求级状态（在 runWithFailover 内局部声明）', () => {
    // 不能放 session 或全局：跨请求共享会让后续请求误以为账号已尝试过。
    const run = ADAPTER.slice(ADAPTER.indexOf('private async * runWithFailover'))
    expect(run).toMatch(/const attempted = new Set<string>\(\)/)
  })

  it('初始账号在第一次尝试前就计入', () => {
    const run = ADAPTER.slice(
      ADAPTER.indexOf('private async * runWithFailover'),
      ADAPTER.indexOf('private async failoverToNextAccount'),
    )
    expect(run).toMatch(/attempted\.add\(current\.id\)/)
  })

  it('每轮切换成功后把目标账号计入', () => {
    const run = ADAPTER.slice(
      ADAPTER.indexOf('private async * runWithFailover'),
      ADAPTER.indexOf('private async failoverToNextAccount'),
    )
    expect(run).toMatch(/attempted\.add\(switched\.id\)/)
  })

  it('被动决策收到 triedIds（同一次请求不重复使用账号）', () => {
    expect(ADAPTER).toMatch(/decideReactiveTarget\(\{[\s\S]{0,400}triedIds: \[\.\.\.attempted\]/)
  })

  it('切换带 CAS（expectedActiveId），不覆盖并发的账号变更', () => {
    expect(ADAPTER).toMatch(/switchTo\(decision\.targetId, current\.id\)/)
  })
})

describe('已产出 chunk 后绝不重放', () => {
  const run = (): string => ADAPTER.slice(
    ADAPTER.indexOf('private async * runWithFailover'),
    ADAPTER.indexOf('private async failoverToNextAccount'),
  )

  it('用 emitted 标志追踪是否已产出', () => {
    // 重试意味着重发整个请求：会让用户看到重复内容、工具调用重复执行、可能重复计费。
    expect(run()).toMatch(/let emitted = false/)
    expect(run()).toMatch(/emitted = true/)
  })

  it('已产出时直接抛出，不换号不重试', () => {
    expect(run()).toMatch(/if \(emitted\) throw error/)
  })

  it('逐个 chunk 转发（而不是一次性 yield* 整个流）', () => {
    // 必须逐块转发才能知道「是否已产出」，`yield*` 无法区分。
    expect(run()).toMatch(/for await \(const chunk of this\.attemptStream\(options\)\)/)
  })
})
