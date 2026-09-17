/**
 * 成长任务出站请求的风控指纹与节流口径。
 *
 * 为什么单独成模块：成长任务的效果**不取决于 HTTP 是否 200**，而取决于上游
 * 是否把这些行为事件计入任务进度。来源项目（`workbuddy2api-panel`）用大量
 * 真实账号实测出「哪些头必须带、哪些事件载荷才算判据」，这些结论是**协议
 * 事实**而不是某次调用的细节；散落在各动作函数里最容易在新增任务时漏掉一项，
 * 表现为「接口返回成功、进度却一直不动」——正是「跑完了但实际没跑完」的
 * 主要成因之一。
 *
 * 本模块只保存两类东西：
 *  - **指纹头**：`X-CodeBuddy-Request`、按 uid 稳定派生的 `X-Machine-ID` /
 *    `X-Session-ID`，以及三个客户端身份（CLI / 桌面 / web）各自的 UA 与来源头；
 *  - **节流常量**：来源实测的上报间隔与召唤间隔。
 *
 * 与 `usage.ts` / `travel.ts` 的关系：那两处各自的 `*Headers` 面向计量与成长
 * 中心读接口，本模块面向**行为上报**（`/v2/report`）与任务动作，头族不同，
 * 因此不强行合并，但同样保持「一处定义、动作函数不再各写各的」。
 *
 * @module dsh-codebuddy/risk-headers
 */

import { createHash } from 'node:crypto'

/**
 * 本模块只需要账号唯一的 `uid` 与可选的企业 id。
 *
 * 用结构类型而不是直接引 `CodeBuddyIdentity`：调用方传完整身份即可，而
 * 单测可以只给一个 `{ uid }`，不必为了走通头构造而伪造 token。
 */
export interface RiskIdentity {
  uid: string
  enterpriseId?: string
}

/**
 * 桌面端出站 UA。
 *
 * 来源口径：`WorkBuddy/<clientVersion> <platform>/<clientVersion> CLI/<cliVersion>`，
 * 实测取值 `WorkBuddy/5.5.6 WorkBuddy/5.5.6 CLI/2.137.1`。服务端按 UA 归因
 * 「使用端」；桌面行为链（RichMeow、模板、画布、专家）必须用这一形态。
 */
export const DESKTOP_USER_AGENT = 'WorkBuddy/5.5.6 WorkBuddy/5.5.6 CLI/2.137.1'

/**
 * web 端事件上报的浏览器 UA。
 *
 * 与桌面 UA 分属两条归因路径：`Library_read` 这类页面行为任务认浏览器指纹
 * （来源实测 `library_doc_intro_click` 约 4 秒点亮）。
 */
export const WEB_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36'

/**
 * 按账号稳定派生 36 位 hex 设备/会话标识。
 *
 * 与 `growth-actions.desktopEvent` 原先的 `stableId` 是同一套口径（`sha256(salt:uid)`
 * 取前 18 字节），但**必须跨重启恒定、账号间互异**：上游按设备指纹缺失/漂移
 * 关联风控，随机值或按进程随机盐会让同一账号每次重启都变成一台新设备。
 *
 * 用途成对出现：
 *  - `machine` → `X-Machine-ID`（设备级）；
 *  - `session` → `X-Session-ID`（账号固定会话）。
 *
 * @param identity - 账号身份（只用到 `uid`）。
 * @param purpose - 用途盐；不同用途得到不同值。
 * @returns 36 位 hex 字符串。
 */
export function stableDeviceId(identity: RiskIdentity, purpose: string): string {
  return createHash('sha256').update(`dsh-growth:${purpose}:${identity.uid}`).digest('hex').slice(0, 36)
}

/**
 * 所有行为上报共享的账号级指纹头。
 *
 * `X-CodeBuddy-Request: 1` 是官方客户端的风控闸门头，来源实测**所有** API
 * 请求都必带；`X-Machine-ID` / `X-Session-ID` 是按 uid 稳定派生的「每账号一台
 * 固定虚拟设备」，与登录时上游签发的 `X-Device-Token` 属不同头族、互不冲突。
 *
 * @param identity - 账号身份。
 * @returns 可直接合并进请求头的键值集合。
 */
export function accountRiskHeaders(identity: RiskIdentity): Record<string, string> {
  return {
    'X-CodeBuddy-Request': '1',
    'X-Machine-ID': stableDeviceId(identity, 'machine'),
    'X-Session-ID': stableDeviceId(identity, 'session'),
    ...identity.enterpriseId === undefined
      ? {}
      : { 'X-Enterprise-Id': identity.enterpriseId, 'X-Tenant-Id': identity.enterpriseId },
  }
}

/**
 * 节流间隔的**单一可调来源**。
 *
 * 为什么做成可变对象而不是一组 `const`：这些数字是**实测出来的上游节奏**，
 * 不是逻辑常量——集成测试要跑完整条链路（报名 → 多次上报 → 有界回读 → 领奖）
 * 时，真等 1.05s × N + 3s × 4 会让单个用例跑十几秒，而等待本身不是被测对象。
 * 来源项目同样把 `reportGap` / `claimPollGap` 做成可置 0 的变量（见其
 * `internal/panel/autotask.go` 的注释「测试可置 0」）。
 *
 * 生产路径一律使用这里的默认值；测试可以整体置 0（见 `tests` 里的用法）。
 */
export const growthThrottle = {
  /**
   * 连续上报之间的间隔。来源口径（其 Python 脚本实测的 1.05s）：`chat_5`
   * 逐条补报、夜间补足、任务项之间都按这个节奏。一次性连发会被上游按异常
   * 流量处理（受理但不计分，或直接限流）。
   */
  reportGapMs: 1_050,
  /**
   * `template_5` 五组模板事件之间的间隔。比通用上报间隔短：来源把模板链作为
   * **五个独立的批量上报**发送（每组自带一条完整 chat 链），组间取 300ms。
   */
  templateGapMs: 300,
  /**
   * 专家召唤链之间的间隔。来源实测 6s 时三账号成功率 100%。一次「召唤 +
   * 真实对话 + 使用事件」是完整一组，组间必须留足。
   */
  expertSummonGapMs: 6_000,
  /**
   * 账号之间的执行间隔。成长任务不是纯读请求：每个账号会依次打出多次上报与
   * 真实对话，来源对批量路径明确按账号限速（其调度器取 800ms）。
   */
  accountGapMs: 800,
  /** `accept`（报名）批量提交的批间间隔（同 1.05s 口径）。 */
  acceptGapMs: 1_050,
  /**
   * 达标回读的轮询间隔。
   *
   * 上游计分是**异步**的：行为事件上报后进度要数秒才刷新（来源实测
   * `Model_chat` 对话完成后立即回读仍是 0/1，约 5–8 秒后才变 1/1）。一次性
   * 回读会把「还没计分」误判成「没完成」而跳过自动领奖，因此必须轮询等待。
   * 取 3s 与来源一致（其 `claimPollGap`）。
   */
  pollGapMs: 3_000,
} as const

/**
 * 把全部节流间隔置为 0（仅供测试）。
 *
 * 测试必须能跑完整条链路而不把时间花在等待上；间隔本身由
 * `growth-risk-control.spec.ts` 直接断言默认值，因此置 0 不会让「口径忘了配」
 * 这类回归漏网。
 */
export function disableGrowthThrottleForTests(): void {
  for (const key of Object.keys(growthThrottle) as Array<keyof typeof growthThrottle>) {
    ;(growthThrottle as Record<string, number>)[key] = 0
  }
}


/** 可取消的等待；`signal` 已中止时立即抛出。 */
export function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('aborted'))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(signal.reason ?? new Error('aborted'))
    }, { once: true })
  })
}
