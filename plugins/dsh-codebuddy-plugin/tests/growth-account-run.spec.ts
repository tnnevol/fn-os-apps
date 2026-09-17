import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CodeBuddyAuthService } from '../src/host/auth-service.ts'
import { CodeBuddySession } from '../src/host/session.ts'
import { growthRunRegistry } from '../src/host/growth-run.ts'
import { disableGrowthThrottleForTests } from '../src/host/risk-headers.ts'

/**
 * 单账号「一键完成」与账号级互斥（FNOS-005-15）。
 *
 * 这组用例对着**真实服务**测，因为要验的三件事都跨了单测边界：
 *  1. `growthRunAccount` 只处理目标账号；
 *  2. 同账号第二次触发返回冲突（宿主按账号加锁），
 *     而**另一个账号同时触发是允许的**——这是「其他账号不禁用」能真实成立的
 *     唯一依据（全局锁下其他账号可点但会被拒）；
 *  3. 结果如实汇报未达标项（`pending`），不把「动作已发送」说成「已完成」。
 *
 * 两处测试设施上的取舍：
 *  - **节流置 0 + 真实定时器**：上报间隔 1.05s、召唤间隔 6s、回读间隔 3s 是
 *    **上游实测节奏**而不是逻辑常量，生产默认值由 `growth-risk-control.spec.ts`
 *    直接断言；这里把等待时长置 0 让用例跑完整条链路而不把时间花在等待上。
 *    刻意**不用假定时器**：宿主的链路里有真实文件 I/O（运行态落盘）与
 *    `Response` 流读取，`vi.useFakeTimers()` 会让这些 promise 在假时钟下永不
 *    落定，表现为整条链路静默挂死（实测 30s 超时）。
 *  - **后台周期关掉**：三个 auto* 偏好在测试里 mock 成「关」，否则它们的请求会
 *    与本测试的 fetch 桩交叠，把并发断言测成假的（与 cycles.spec 同做法）。
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

let workdir: string | undefined

function makeCtx(): { logger: { warn: () => void, info: () => void }, effect: (fn: () => () => void) => void, inject: () => void } {
  return {
    logger: { warn: () => {}, info: () => {} },
    effect(fn: () => () => void): void { fn() },
    inject: () => {},
  }
}

/** 写入 `count` 个个人账号及其固定 accessToken（`token-<index>`）。 */
function writeAccounts(count: number): void {
  workdir = mkdtempSync(join(tmpdir(), 'codebuddy-account-run-'))
  const path = join(workdir, 'codebuddy-auth.json')
  process.env.DSH_CODEBUDDY_AUTH_FILE = path
  const accounts = Array.from({ length: count }, (_, index) => ({
    id: `acc-${index}`,
    environment: 'internal',
    account: { uid: `u${index}`, nickname: `账号${index}` },
    auth: { accessToken: `token-${index}`, refreshToken: 'r', expiresAt: Date.now() + 3_600_000, refreshExpiresAt: Date.now() + 86_400_000 },
  }))
  writeFileSync(path, JSON.stringify({ version: 2, activeId: 'acc-0', accounts }), 'utf-8')
  chmodSync(path, 0o600)
}

/** 等构造器内的偏好读取回调落地（偏好被 mock 成「关」，不会启动任何周期）。 */
async function drainPrefs(): Promise<void> {
  for (let i = 0; i < 8; i += 1) await Promise.resolve()
}

async function makeService(): Promise<CodeBuddyAuthService> {
  const service = new CodeBuddyAuthService(makeCtx() as never, new CodeBuddySession())
  await drainPrefs()
  return service
}

/**
 * 最小响应桩（**不是**真实 `Response`）。
 *
 * 为什么不用 `new Response(...)`：本组用例用假定时器推进宿主内部的回读轮询，
 * 而真实 `Response` 的 body 读取依赖流内部的定时/微任务调度——在假定时器下
 * `await response.text()` 永远不落定，表现为整条链路静默挂死（实测）。这里只
 * 提供宿主真正用到的四个成员（`ok` / `status` / `text` / `json`），行为确定。
 */
function jsonResponse(body: unknown): {
  ok: boolean
  status: number
  text: () => Promise<string>
  json: () => Promise<unknown>
} {
  const raw = JSON.stringify(body)
  return {
    ok: true,
    status: 200,
    text: async () => raw,
    json: async () => JSON.parse(raw) as unknown,
  }
}

/** 一个已达标待领奖的自动化任务（走 claim 路径，不需要回读轮询）。 */
function claimableTasksResponse(): ReturnType<typeof jsonResponse> {
  return jsonResponse({
    code: 0,
    msg: 'OK',
    data: {
      tasks: [{
        task_code: 'chat_5',
        title: '聊天 5 次',
        progress: { current: 5, target: 5 },
        reward_credit: 100,
        reward_energy: 5,
        accept_status: 'accepted',
      }],
    },
  })
}

/** 一个永远 0/5 的自动化任务：动作受理但上游不计分 —— 「跑完了但没跑完」。 */
function stuckTasksResponse(): ReturnType<typeof jsonResponse> {
  return jsonResponse({
    code: 0,
    msg: 'OK',
    data: {
      tasks: [{
        task_code: 'chat_5',
        title: '聊天 5 次',
        progress: { current: 0, target: 5 },
        reward_credit: 100,
        accept_status: 'accepted',
      }],
    },
  })
}

/** 默认 fetch 桩：任务列表按传入响应，其余（accept/report/claim）一律成功。 */
function stubFetch(tasks: () => ReturnType<typeof jsonResponse>): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockImplementation(async (url: string) => {
    const target = String(url)
    if (target.includes('/activity/growth/tasks') && target.includes('/claim')) {
      return jsonResponse({ code: 0, msg: 'OK', data: { already_claimed: false, credit: 100, energy: 5 } })
    }
    if (target.includes('/activity/growth/tasks')) return tasks()
    return jsonResponse({ code: 0, msg: 'OK', data: {} })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  // 节流置 0：等待节奏是上游口径而不是本测试的对象，真等会让单个用例跑十几秒。
  disableGrowthThrottleForTests()
})

afterEach(() => {
  vi.unstubAllGlobals()
  // 登记表是模块级的：测试之间必须清干净，否则「在跑」状态会串台。
  for (const id of growthRunRegistry.ids()) growthRunRegistry.remove(id)
  delete process.env.DSH_CODEBUDDY_AUTH_FILE
  if (workdir !== undefined) {
    rmSync(workdir, { recursive: true, force: true })
    workdir = undefined
  }
})

describe('单账号一键完成', () => {
  it('只处理目标账号，且不排队其他账号', async () => {
    writeAccounts(2)
    const service = await makeService()
    const fetchMock = stubFetch(claimableTasksResponse)

    const result = await service.growthRunAccount('acc-1') as {
      id: string
      status: string
      items: Array<{ code: string, status: string }>
    }

    expect(result.id).toBe('acc-1')
    expect(result.items.find(item => item.code === 'chat_5')?.status).toBe('claimed')
    // 全部出站请求都属于 acc-1 的凭据（accessToken 与账号一一对应），
    // 证明没有触碰 acc-0。
    const authorizations = new Set<string>()
    for (const call of fetchMock.mock.calls) {
      const headers = (call[1] as RequestInit | undefined)?.headers as Record<string, string> | undefined
      if (headers?.Authorization !== undefined) authorizations.add(headers.Authorization)
    }
    expect([...authorizations]).toEqual(['Bearer token-1'])
  }, 30_000)

  it('未达标时如实记 pending，而不是汇报成已完成', async () => {
    writeAccounts(1)
    const service = await makeService()
    stubFetch(stuckTasksResponse)

    const result = await service.growthRunAccount('acc-0') as {
      status: string
      pending?: number
      items: Array<{ code: string, status: string, current?: number, target?: number }>
    }

    // 关键：动作发了（上报 200）但进度不动 → pending，且带进度供界面区分
    // 「没开始」与「做了一半」。
    const chat = result.items.find(item => item.code === 'chat_5')
    expect(chat?.status).toBe('pending')
    expect(chat?.current).toBe(0)
    expect(chat?.target).toBe(5)
    expect(result.pending).toBe(1)
  }, 30_000)

  it('执行结束后登记表清空、宿主状态报空闲（按钮不会永久 loading）', async () => {
    writeAccounts(1)
    const service = await makeService()
    stubFetch(claimableTasksResponse)

    await service.growthRunAccount('acc-0')

    expect(growthRunRegistry.running).toBe(false)
    expect(growthRunRegistry.ids()).toEqual([])
    const status = await service.growthRunStatus() as { running: boolean }
    expect(status.running).toBe(false)
  }, 30_000)
})

describe('账号级互斥与并行', () => {
  it('同账号第二次触发返回冲突（不排队重跑）', async () => {
    writeAccounts(2)
    const service = await makeService()
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      const target = String(url)
      if (target.includes('/activity/growth/tasks')) {
        await gate
        return claimableTasksResponse()
      }
      return jsonResponse({ code: 0, msg: 'OK', data: {} })
    }))

    const first = service.growthRunAccount('acc-0')
    // 让 acc-0 的请求真正进入挂起（真实定时器下用微任务让出即可）。
    await new Promise(resolve => setImmediate(resolve))
    expect(growthRunRegistry.ids()).toEqual(['acc-0'])

    const second = await service.growthRunAccount('acc-0') as { status?: string, error?: string }
    expect(second.status).toBe('skipped')
    expect(second.error).toContain('已有成长任务在执行')

    // 另一个账号此刻仍可开始（不是全局拒绝）。
    const other = service.growthRunAccount('acc-1')
    await new Promise(resolve => setImmediate(resolve))
    expect(new Set(growthRunRegistry.ids())).toEqual(new Set(['acc-0', 'acc-1']))

    release?.()
    await Promise.all([first, other])
    expect(growthRunRegistry.running).toBe(false)
  }, 30_000)

  it('全量执行遇到已被单账号执行占用的账号是跳过，不是整轮失败', async () => {
    writeAccounts(2)
    const service = await makeService()
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => { release = resolve })
    let gated = false
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => {
      const target = String(url)
      if (target.includes('/activity/growth/tasks')) {
        // 只挂住第一次（acc-0 的单账号执行）；其余立刻返回，避免全量轮次也卡住。
        if (!gated) {
          gated = true
          await gate
        }
        return claimableTasksResponse()
      }
      return jsonResponse({ code: 0, msg: 'OK', data: {} })
    }))

    const single = service.growthRunAccount('acc-0')
    await new Promise(resolve => setImmediate(resolve))
    expect(growthRunRegistry.ids()).toEqual(['acc-0'])

    // 全量执行：acc-0 已被占用 → 跳过；acc-1 正常处理。
    const all = await service.growthRunAll(new AbortController().signal) as {
      accounts: Array<{ id: string, skipped?: boolean }>
    }
    const skipped = all.accounts.find(row => row.id === 'acc-0')
    expect(skipped?.skipped).toBe(true)
    expect(skipped?.id).toBe('acc-0')
    expect(all.accounts.find(row => row.id === 'acc-1')?.skipped).toBeUndefined()

    release?.()
    await single
    expect(growthRunRegistry.running).toBe(false)
  }, 30_000)
})
