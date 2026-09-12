import { describe, expect, it, vi } from 'vitest'
import { CodeBuddyAuthService } from '../src/host/auth-service.ts'
import { CodeBuddySession } from '../src/host/session.ts'

/**
 * `tokenStats` RPC 的**分发层**守卫（auth-service 的 `dispatch`）。
 *
 * 为什么单测底层 `collectCodeBuddyTokenStats` 不够：那里测的是「拿到非法端点会
 * 抛错」，但客户端拿到的是 RPC 信封（`{ ok: false, error: { code, message } }`）。
 * 中间这一层要把 thrown error 转成 `invalid-request` 信封——它才是浏览器看到
 * 的契约面。这层是 `private dispatch`，只能通过 `connection.rpc.handle` 注册
 * 的 handler 触达，因此本文件用假 ctx 把那个 handler 捕获下来直接调用。
 *
 * 覆盖的三条拒收路径对应的真实故障：
 *  - 缺 `startTime`/`endTime`：旧版本会退化成「以请求时刻为终点推 30 天」的
 *    兜底窗口，同一接口对不同请求得到不同窗口，无法稳定复现；
 *  - `endTime < startTime`：旧版本把负窗口夹到 1 天，端点写错也得到一个**看着
 *    正常但错误**的数字；
 *  - 非数字 / NaN / Infinity：前端换算出错时会传进这些值，必须显式拒收而不是
 *    静默按 0 处理。
 *
 * 注意本组用例**只触碰守卫分支**：合法的端点入参会走到真实聚合（要 DSH 会话
 * 查询服务），那部分由 tests/token-stats.spec.ts 覆盖。
 */

/** 构造一个能捕获 RPC handler 的假 ctx。 */
function makeRpcCtx(): {
  ctx: unknown
  /** 调用被注册的 `/codebuddy` handler，返回 RPC 信封。 */
  call: (endpoint: string, payload: unknown) => Promise<unknown>
} {
  let handler: ((endpoint: string, payload: unknown, signal: AbortSignal) => Promise<unknown>) | undefined
  const connection = {
    rpc: {
      handle: (
        _channel: string,
        next: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<unknown>,
      ): (() => void) => {
        handler = next
        return () => {}
      },
    },
  }
  /** `inject` 的回调拿到的是 connectionCtx，其 `get('connection')` 返回上面那坨。 */
  const connectionCtx = {
    get: (key: string): unknown => (key === 'connection' ? connection : undefined),
    effect: (fn: () => () => void): void => { fn() },
  }
  const ctx = {
    logger: { warn: () => {}, info: () => {} },
    effect: (fn: () => () => void): void => { fn() },
    inject: (deps: string[], cb: (ctx: unknown) => void): void => {
      if (deps.includes('connection')) cb(connectionCtx)
    },
  }
  return {
    ctx,
    call: async (endpoint, payload) => {
      if (handler === undefined) throw new Error('RPC handler 未被注册')
      return handler(endpoint, payload, new AbortController().signal)
    },
  }
}

/**
 * 建立服务并拿到 RPC 调用入口。
 *
 * 构造器会读偏好文件并可能启动后台周期——对守卫测试都是噪声，因此 mock 掉
 * storage 的配置读取（与 tests/cycles.spec.ts 同一策略）。
 */
vi.mock('../src/host/storage.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/host/storage.ts')>()
  return {
    ...actual,
    loadAutoSwitchConfig: async () => ({ enabled: false, thresholdPct: 10 }),
    loadAutoCheckinConfig: async () => ({ enabled: false }),
    loadAutoTravelConfig: async () => ({ enabled: false }),
  }
})

async function makeCaller(): Promise<(endpoint: string, payload: unknown) => Promise<unknown>> {
  const { ctx, call } = makeRpcCtx()
  // 构造器只做注册（不 await），注册在构造期间同步完成。
  void new CodeBuddyAuthService(ctx as never, new CodeBuddySession())
  // 让构造器内几个 then 回调落地，避免遗留微任务跨用例串扰。
  for (let i = 0; i < 8; i += 1) await Promise.resolve()
  return call
}

/** RPC 失败信封的形状断言。 */
async function expectInvalidRequest(payload: unknown): Promise<void> {
  const call = await makeCaller()
  const result = await call('tokenStats', payload)
  expect(result).toMatchObject({
    ok: false,
    error: { code: 'invalid-request' },
  })
  // 错误文案要指明缺的是哪个字段，方便前端定位。
  const error = (result as { error: { message: string } }).error
  expect(error.message).toMatch(/startTime|endTime/)
}

describe('tokenStats 分发层守卫（端点必传）', () => {
  it('payload 为空对象 → 拒收并指明 startTime', async () => {
    const call = await makeCaller()
    const result = await call('tokenStats', {})
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    expect((result as { error: { message: string } }).error.message).toMatch(/startTime/)
  })

  it('payload 为 undefined / null / 非对象 → 拒收而不是崩溃', async () => {
    for (const payload of [undefined, null, 'x', 42, true]) {
      await expectInvalidRequest(payload)
    }
  })

  it('只给 startTime → 拒收并指明 endTime', async () => {
    const call = await makeCaller()
    const result = await call('tokenStats', { startTime: 1_700_000_000_000 })
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    expect((result as { error: { message: string } }).error.message).toMatch(/endTime/)
  })

  it('只给 endTime → 拒收并指明 startTime', async () => {
    const call = await makeCaller()
    const result = await call('tokenStats', { endTime: 1_700_000_000_000 })
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    expect((result as { error: { message: string } }).error.message).toMatch(/startTime/)
  })

  it('endTime < startTime → 拒收（不夹到 1 天糊弄过去）', async () => {
    const call = await makeCaller()
    const end = 1_700_000_000_000
    const result = await call('tokenStats', { startTime: end, endTime: end - 86_400_000 })
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid-request' } })
    expect((result as { error: { message: string } }).error.message).toMatch(/endTime/)
  })

  it('数字字符串 / NaN / Infinity 一律拒收', async () => {
    for (const bad of ['1700000000000', Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      await expectInvalidRequest({ startTime: bad, endTime: 1_700_000_000_000 })
      await expectInvalidRequest({ startTime: 1_700_000_000_000, endTime: bad })
    }
  })

  it('startTime === endTime 是合法单日窗口（边界不误杀）', async () => {
    const call = await makeCaller()
    const at = 1_700_000_000_000
    const result = await call('tokenStats', { startTime: at, endTime: at })
    // 单日窗口能过守卫；后续聚合在无会话服务时返回空统计，因此这里只断言
    // 「不是 invalid-request」——守卫边界是否放行由这一条锁住。
    expect(result).not.toMatchObject({ error: { code: 'invalid-request' } })
  })
})
