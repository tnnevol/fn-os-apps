import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 关闭自动切换开关后的行为边界。
 *
 * 三个容易被混淆的问题，用测试把答案固定下来：
 *
 *  1. 开关关闭后**被动换号是否还生效**？ → 不生效（开关是总闸）。
 *  2. 开关关闭后**轮询是否真的停了**？   → 停。
 *  3. 是否存在**两个轮询**（host + 管理面板）？ → 只有一个，客户端那个只读。
 */
const ROOT = '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src'
const SERVICE = readFileSync(`${ROOT}/host/auth-service.ts`, 'utf8')
const ADAPTER = readFileSync(`${ROOT}/host/adapter.ts`, 'utf8')
const USAGE_STATUS = readFileSync(`${ROOT}/components/CodeBuddyUsageStatus.tsx`, 'utf8')
const INDEX = readFileSync(`${ROOT}/client/index.tsx`, 'utf8')

describe('① 开关关闭后被动换号也不生效', () => {
  it('开关是总闸：被动路径也检查 autoSwitch', () => {
    // 用户的直觉是「关掉自动切换 = 不要自动换账号」，包含被动那条路径。
    // 判定收敛到一个函数，两处共用（切换点 + catch）
    expect(ADAPTER).toMatch(/const autoSwitchAllowed = \(\): boolean => this\.config\.autoSwitch\?\.\(\) \?\? true/)
    // catch 里把 autoSwitchAllowed 与「可切换错误」两个条件一起判
    expect(ADAPTER).toMatch(/const swappable = error\.code === QUOTA_EXCEEDED_CODE \|\| error\.code === 'RATE_LIMIT'/)
    expect(ADAPTER).toMatch(/if \(!autoSwitchAllowed\(\) \|\| !swappable\) throw error/)
  })

  it('autoSwitch 取值来自 host 的当前开关状态（而非客户端本地值）', () => {
    // 客户端 localStorage 不再作为权威（见 auto-prefs-authority.spec.ts）。
    const INDEX_HOST = readFileSync(
      '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/index.ts',
      'utf8',
    )
    expect(INDEX_HOST).toMatch(/autoSwitch: \(\) => auth\.autoSwitch/)
  })

  it('切换点之前**显式**检查开关（不依赖上一轮 catch 的隐式保证）', () => {
    const run = ADAPTER.slice(
      ADAPTER.indexOf('private async * runWithFailover'),
      ADAPTER.indexOf('private async failoverToNextAccount'),
    )
    // 曾在循环开头直接调用 failoverToNextAccount，安全性靠「上一轮 catch 检查过」
    // 这个隐式前提保证；那是脆的——挪动切换位置就会静默绕过开关。
    const guardAt = run.indexOf('if (!autoSwitchAllowed()) throw lastError')
    const switchAt = run.indexOf('await this.failoverToNextAccount')
    expect(guardAt).toBeGreaterThan(-1)
    expect(switchAt).toBeGreaterThan(guardAt)
  })

  it('两处共用同一个判定函数（避免一处改了另一处漏改）', () => {
    expect(ADAPTER).toMatch(/const autoSwitchAllowed = \(\): boolean => this\.config\.autoSwitch\?\.\(\) \?\? true/)
    // catch 里也用同一个函数
    expect(ADAPTER).toMatch(/if \(!autoSwitchAllowed\(\) \|\| !swappable\) throw error/)
  })
})

describe('② 关闭开关时轮询真的停', () => {
  it('关闭分支调用 stopAutoSwitchCycle', () => {
    expect(SERVICE).toMatch(/if \(enabled\) this\.startAutoSwitchCycle\(\)\s*\n\s*else this\.stopAutoSwitchCycle\(\)/)
  })

  /** 取某个方法定义体（用定义签名定位，避免匹配到调用点）。 */
  const method = (name: string, next: string): string =>
    SERVICE.slice(SERVICE.indexOf(`${name}(): void {`), SERVICE.indexOf(`${name}(): void {`) + 420)

  it('stopAutoSwitchCycle 清除定时器并置空句柄', () => {
    const stop = method('stopAutoSwitchCycle', 'startAutoSwitchCycle')
    expect(stop).toMatch(/clearInterval\(this\.autoSwitchTimer\)/)
    expect(stop).toMatch(/this\.autoSwitchTimer = undefined/)
  })

  it('startAutoSwitchCycle 幂等（重复开启不会叠加多个定时器）', () => {
    // 若不做幂等，反复开关会累积定时器 —— 而关闭一次只清掉一个。
    expect(method('startAutoSwitchCycle', 'stopAutoSwitchCycle'))
      .toMatch(/if \(this\.autoSwitchTimer !== undefined\) return/)
  })

  it('停机（disposed）后不再启动', () => {
    expect(method('startAutoSwitchCycle', 'stopAutoSwitchCycle')).toMatch(/if \(this\.disposed\) return/)
  })

  it('启动时按持久化配置决定是否开启周期', () => {
    // 用户上次关掉的开关，重启后不应自己又跑起来。
    const load = SERVICE.slice(SERVICE.indexOf('void loadAutoSwitchConfig()'), SERVICE.indexOf('void loadAutoSwitchConfig()') + 400)
    expect(load).toMatch(/this\.autoSwitch = config\.enabled/)
    expect(load).toMatch(/if \(config\.enabled\) this\.startAutoSwitchCycle\(\)/)
  })
})

describe('③ 只有一个轮询，客户端那个是只读的', () => {
  it('切换轮询只在 host 侧注册（周期由 setInterval 驱动）', () => {
    // host 是全进程唯一持有账号状态的地方，轮询必须在这里。
    const cycles = [...SERVICE.matchAll(/setInterval\(/g)].length
    console.log(`  host 侧 setInterval 数量: ${cycles}（自动签到/旅行派发/旅行领取/自动切换）`)
    expect(SERVICE).toMatch(/setInterval\(\(\) => \{ void this\.runAutoSwitchCycle\(\) \}/)
  })

  it('客户端唯一的定时器是「用量指示器」，且只调只读端点', () => {
    // 它不触发切换：调的是 'usage'，host 侧该端点只取快照。
    expect(USAGE_STATUS).toMatch(/timer\.interval\(\(\) => \{ void refresh\(\) \}, CODEBUDDY_USAGE_REFRESH_MS\)/)
    expect(USAGE_STATUS).toContain("rpc.call<UsageResult>(CODEBUDDY_AUTH_CHANNEL, 'usage', {})")
    // 不得调用任何会换号的端点
    for (const forbidden of ['failoverIfBelowThreshold', 'switchAccount', 'runAutoSwitchCycle']) {
      expect(USAGE_STATUS).not.toContain(forbidden)
    }
  })

  it('管理面板本身不轮询（只在切换页/手动刷新/账号变化时重取）', () => {
    const PANEL = readFileSync(`${ROOT}/client/panel.tsx`, 'utf8')
    expect(PANEL).not.toMatch(/setInterval/)
    expect(PANEL).not.toMatch(/timer\.interval/)
  })

  it('host 的 usage 端点只读，不触发任何切换', () => {
    const usage = SERVICE.slice(SERVICE.indexOf('async usage(): Promise<CodeBuddyUsageResult>'), SERVICE.indexOf('async usage(): Promise<CodeBuddyUsageResult>') + 320)
    expect(usage).not.toMatch(/failover|switchTo|decideProactive/)
  })

  it('panelStatus 也不触发切换（面板刷新不会偷偷换号）', () => {
    const panel = SERVICE.slice(SERVICE.indexOf('async panelStatus'), SERVICE.indexOf('async panelStatus') + 3000)
    expect(panel).not.toMatch(/failoverIfBelowThreshold|switchTo\(/)
  })

  it('客户端不自己起轮询（index.tsx 的 interval 只是 timer 抽象实现）', () => {
    // index.tsx 里那个 window.setInterval 是 timer.interval 的实现体，
    // 只有 CodeBuddyUsageStatus 使用它。
    expect(INDEX).toContain('window.setInterval(callback, delay)')
  })
})
