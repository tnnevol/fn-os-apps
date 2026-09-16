import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 主动切换周期的间隔。
 *
 * 主动切换**必须靠轮询**：只有周期性探测才能在「没有请求发生」时发现额度将尽，
 * 从而在下一个提问到来前把账号换好（这正是它相对纯被动换号的价值——用户不感知
 * 一次失败）。DSH 自带的重连只在失败后触发，替代不了它。
 *
 * 间隔取 1 分钟而非 30s：额度是分钟级变化的东西，30s 窗口内的变化通常为零，而
 * 每次探测都是一次远端往返。
 */
const SERVICE = readFileSync(
  '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/host/auth-service.ts',
  'utf8',
)

describe('自动切换周期', () => {
  it('间隔为 1 分钟（具名常量，单一来源）', () => {
    expect(SERVICE).toMatch(/const AUTO_SWITCH_INTERVAL_MS = 60_000/)
  })

  it('周期使用该常量，不写死数字', () => {
    // 写死会让「间隔是多少」散落在调用点，改一处漏一处。
    expect(SERVICE).toMatch(/runCycleDetached\('auto-switch', \(\) => this\.runAutoSwitchCycle\(\)\) \}, AUTO_SWITCH_INTERVAL_MS\)/)
    // 曾经的 30s 已移除
    expect(SERVICE).not.toMatch(/runAutoSwitchCycle\(\) \}, 30_000\)/)
  })

  it('周期拒绝不会逃逸成未处理拒绝', () => {
    // `void promise` 只丢弃引用，不处理拒绝；在 dsh 的 fail-loud 策略下
    // 一次周期失败就会让整个进程 exit(1)。必须经 runCycleDetached 收口。
    expect(SERVICE).not.toMatch(/void this\.runAutoSwitchCycle\(\)/)
    expect(SERVICE).toMatch(/private runCycleDetached\(label: string, run: \(\) => Promise<unknown>\): void \{[\s\S]*?\.catch\(/)
  })

  it('周期注册在 ctx.effect 的清理范围内（插件卸载后不残留）', () => {
    // setInterval 是进程级句柄，热重载后残留的定时器会继续以旧配置访问远端账号。
    const effect = SERVICE.slice(SERVICE.indexOf('ctx.effect'), SERVICE.indexOf('ctx.inject'))
    expect(effect).toContain('this.stopAutoSwitchCycle()')
  })

  it('注释说明了「为何必须轮询」与间隔取舍', () => {
    // 「被动重连能否替代轮询」是个会被反复问起的问题，把结论留在源码里。
    expect(SERVICE).toMatch(/主动切换靠轮询实现/)
    expect(SERVICE).toMatch(/纯被动机制/)
  })
})
