import { describe, expect, it } from 'vitest'
import { collectCodeBuddyTokenStats, type SessionQueryService } from '../src/host/token-stats.ts'
import { resolveRange } from '../src/client/token-range.ts'

function event(time: number, provider: string, model: string, input: number, output: number, read = 0, write = 0) {
  return {
    type: 'assistant/message',
    time,
    data: {
      message: { source: { kind: 'model', provider, model } },
      usage: { inputTokens: input, outputTokens: output, cacheReadTokens: read, cacheWriteTokens: write },
    },
  }
}

/**
 * 把「天数」换成服务端入参 `{startTime, endTime}`（毫秒端点）。
 *
 * 这是迁移期测试回写用的适配器：旧调用写的是 `{days: 1}` 这种语义，新接
 * 口要的是端点。两边表达同一窗口；days=1 即「单日窗口，起点终点都 = 今天 00:00」。
 *
 * @param days 服务端窗口包含的天数（≥1）。
 * @param now 便于测试注入当前时间；不传则用真实 `Date.now()`——但默认情况
 *   下都希望稳定，所以传入一个明确的 now 而不是依赖系统时钟。
 */
function windowOfDays(days: number, now: number = Date.now()): { startTime: number, endTime: number } {
  const end = startOfLocalDay(now)
  return { startTime: end - (days - 1) * 86_400_000, endTime: end }
}

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

describe('CodeBuddy token analytics', () => {
  it('filters the CodeBuddy route and aggregates sessions by day, workspace and model', async () => {
    const now = Date.now()
    const sessions = [
      { header: { id: 'session-a', cwd: '/work/alpha' }, live: false, persisted: true },
      { header: { id: 'session-b', cwd: '/work/beta' }, live: true, persisted: true },
    ]
    const observations = new Map([
      ['session-a', {
        header: sessions[0]!.header,
        events: [
          // 真实结构：user/message 的正文在 data.content，没有 data.message 这一层。
          // （此前 fixture 用的是 assistant 的形状，于是盖住了线上取不到标题的缺陷。）
          { type: 'user/message', time: now, data: { role: 'user', content: [{ type: 'text', text: 'alpha task' }] } },
          event(now, 'codebuddy', 'deepseek-v4-flash', 100, 20, 50, 5),
          event(now - 30 * 86_400_000, 'codebuddy', 'deepseek-v4-flash', 8, 2),
          event(now, 'openai', 'gpt-4o', 999, 999),
        ],
      }],
      ['session-b', {
        header: sessions[1]!.header,
        events: [event(now - 86_400_000, 'codebuddy', 'kimi-k3-1', 40, 10)],
      }],
    ])
    let disposed = 0
    const query: SessionQueryService = {
      async listSessions() { return sessions },
      async observeSession(id) {
        const observation = observations.get(id)
        if (observation === undefined) throw new Error('missing session')
        return { ...observation, [Symbol.dispose]: () => { disposed += 1 } }
      },
    }

    const result = await collectCodeBuddyTokenStats(query, windowOfDays(2))
    expect(result.provider).toBe('codebuddy')
    // 缓存**写**（fixture 里的 5）不计入任何合计；缓存读（50）仍计入：
    // 总量 = 输入 140 + 输出 30 + 缓存读 50 = 220（旧口径含缓存写得 225）。
    expect(result.totals.total).toBe(220)
    expect(result.totals.input).toBe(140)
    expect(result.totals.output).toBe(30)
    // 缓存读保留为独立指标，供总览分段条与命中率使用。
    expect(result.totals.read).toBe(50)
    expect(result.totals.records).toBe(2)
    expect(result.totals.sessions).toBe(2)
    // 命中率只与输入侧有关，因此不受「缓存写已移出统计」影响。
    expect(result.totals.cacheHitRate).toBeCloseTo(50 / 190)
    expect(result.models[0]?.name).toBe('deepseek-v4-flash')
    expect(result.workspaces[0]?.name).toBe('alpha')
    expect(result.sessions[0]?.title).toBe('alpha task')
    expect(result.activity).toHaveLength(365)
    expect(result.activity.reduce((sum, row) => sum + row.calls, 0)).toBe(3)
    expect(disposed).toBe(2)
  })

  it('supports an explicit session allow-list', async () => {
    const query: SessionQueryService = {
      async listSessions() {
        return [
          { header: { id: 'keep' }, live: false, persisted: true },
          { header: { id: 'skip' }, live: false, persisted: true },
        ]
      },
      async observeSession(id) {
        return {
          header: { id },
          events: [event(Date.now(), 'codebuddy', 'model', id === 'keep' ? 5 : 50, 1)],
        }
      },
    }
    const result = await collectCodeBuddyTokenStats(query, { ...windowOfDays(1), sessionIds: ['keep'] })
    expect(result.totals.total).toBe(6)
    expect(result.sessions.map(row => row.id)).toEqual(['keep'])
  })

  it('skips a corrupt session log instead of failing the whole aggregation', async () => {
    const query: SessionQueryService = {
      async listSessions() {
        return [
          { header: { id: 'broken' }, live: false, persisted: true },
          { header: { id: 'healthy' }, live: false, persisted: true },
        ]
      },
      async observeSession(id) {
        if (id === 'broken') throw new Error('corrupt session log: seq gap')
        return {
          header: { id },
          events: [event(Date.now(), 'codebuddy', 'deepseek-v4-flash', 100, 20)],
        }
      },
    }
    const result = await collectCodeBuddyTokenStats(query, windowOfDays(1))
    expect(result.totals.total).toBe(120)
    expect(result.sessions.map(row => row.id)).toEqual(['healthy'])
  })

  it('聚合中途抛错时仍然释放已取得的 observation（不泄漏会话句柄）', async () => {
    /**
     * `observeSession` 返回带 `[Symbol.dispose]` 的观察对象——它持有会话的重放
     * 游标/文件句柄。正常路径的释放由上面那条 `disposed === 2` 守住，但**异常
     * 路径**同样要释放：聚合中途某个会话的事件读取炸了，不能把那批已经打开的
     * 观察对象留在那里。
     *
     * 实现形态：整段聚合包在 `try { ... } finally { 逐个 disposeObservation }`。
     * 这条用例用一个「迭代 events 就抛错」的观察对象触发异常，断言：
     *  1. 错误照常向上抛（不吞掉）；
     *  2. `[Symbol.dispose]` 已被调用。
     */
    let disposed = 0
    const query: SessionQueryService = {
      async listSessions() { return [{ header: { id: 'boom' }, live: false, persisted: true }] },
      async observeSession(id) {
        return {
          header: { id },
          // events 用 getter：一旦被迭代就抛错，模拟损坏日志在聚合中途炸开。
          get events(): never { throw new Error('corrupt event stream') },
          [Symbol.dispose]: () => { disposed += 1 },
        }
      },
    }
    await expect(collectCodeBuddyTokenStats(query, windowOfDays(1))).rejects.toThrow('corrupt event stream')
    expect(disposed).toBe(1)
  })
})

describe('会话标题取自真实用户输入', () => {
  /**
   * 这组守的是一个真实缺陷：`user/message` 的正文在 `data.content`，而代码读的是
   * `data.message`（那是 `assistant/message` 的形状），于是永远取不到标题、回退成
   * 会话 id，界面上「会话排名」显示一串 uuid。
   *
   * 关键点：测试 fixture 必须用**真实事件结构**。原 fixture 恰好写成了错误结构，
   * 于是断言一直通过，缺陷因此蒙混过关。
   */
  function queryWith(events: unknown[]): SessionQueryService {
    return {
      async listSessions() { return [{ header: { id: 'session-x', cwd: '/w/demo' }, live: false, persisted: true }] },
      async observeSession(id: string) { return { header: { id, cwd: '/w/demo' }, events } as never },
    }
  }

  it('从 data.content 取标题（真实结构）', async () => {
    const result = await collectCodeBuddyTokenStats(queryWith([
      { type: 'user/message', time: Date.now(), data: { role: 'user', content: [{ type: 'text', text: '更新 codex 插件' }] } },
      event(Date.now(), 'codebuddy', 'm', 10, 1),
    ]), windowOfDays(7))
    expect(result.sessions[0]?.title).toBe('更新 codex 插件')
  })

  it('跳过 DSH 注入的 system-reminder / 运行时上下文', async () => {
    const now = Date.now()
    const result = await collectCodeBuddyTokenStats(queryWith([
      { type: 'user/message', time: now, data: { role: 'user', content: [{ type: 'text', text: '<system-reminder>\nworkspace instructions…' }] } },
      { type: 'user/message', time: now, data: { role: 'user', content: [{ type: 'text', text: 'Current runtime context. This snapshot…' }] } },
      { type: 'user/message', time: now, data: { role: 'user', content: [{ type: 'text', text: '真正的用户问题' }] } },
      event(now, 'codebuddy', 'm', 10, 1),
    ]), windowOfDays(7))
    expect(result.sessions[0]?.title).toBe('真正的用户问题')
  })

  it('没有真实用户输入时标题为空串，而不是会话 id', async () => {
    const result = await collectCodeBuddyTokenStats(queryWith([
      { type: 'user/message', time: Date.now(), data: { role: 'user', content: [{ type: 'text', text: '<system-reminder>\nonly injected…' }] } },
      event(Date.now(), 'codebuddy', 'm', 10, 1),
    ]), windowOfDays(7))
    const title = result.sessions[0]?.title
    // 不能是 uuid：界面由客户端用本地化占位呈现。
    expect(title).toBe('')
    expect(title).not.toMatch(/^session-/)
  })

  it('标题压缩空白并截断，避免超长首行撑破布局', async () => {
    const result = await collectCodeBuddyTokenStats(queryWith([
      { type: 'user/message', time: Date.now(), data: { role: 'user', content: [{ type: 'text', text: `  多   空格\n换行 ${'x'.repeat(200)}` }] } },
      event(Date.now(), 'codebuddy', 'm', 10, 1),
    ]), windowOfDays(7))
    const title = result.sessions[0]?.title ?? ''
    expect(title.startsWith('多 空格 换行')).toBe(true)
    expect(title.length).toBeLessThanOrEqual(80)
  })
})

describe('allTime 统计全部历史', () => {
  /**
   * 「总计」不能用一个很大的 days 近似：days 有上限（MAX_RANGE_DAYS=365），
   * 超过一年的历史会被静默截断，而「总计」的语义是「全部」——显示一个被截断的
   * 数字却不给任何迹象，比报错更糟。因此 allTime 走 -Infinity 下界。
   */
  function queryWithOldEvent(): { query: SessionQueryService, now: number } {
    const now = Date.now()
    const header = { id: 's-old', cwd: '/w/demo' }
    return {
      now,
      query: {
        async listSessions() { return [{ header, live: false, persisted: true }] },
        async observeSession(id: string) {
          return {
            header: { id, cwd: '/w/demo' },
            events: [
              // 3 年前的事件：远超 MAX_RANGE_DAYS(365)，任何 days 都覆盖不到。
              event(now - 3 * 365 * 86_400_000, 'codebuddy', 'm', 100, 10),
              event(now - 86_400_000, 'codebuddy', 'm', 5, 1),
            ],
          } as never
        },
      },
    }
  }

  it('默认（有 days）会漏掉超出范围的历史', async () => {
    const { query } = queryWithOldEvent()
    const bounded = await collectCodeBuddyTokenStats(query, windowOfDays(30))
    // 只有近一天那条被计入。
    expect(bounded.totals.input).toBe(5)
  })

  it('allTime 不受 365 天上限影响，计入全部历史', async () => {
    // allTime 与端点正交：端点（仍必传）决定活动热力图与逐日行数，allTime
    // 仅放宽 totals 的下界过滤。所以这里传 365 天窗口 + allTime= true。
    const { query } = queryWithOldEvent()
    const all = await collectCodeBuddyTokenStats(query, { ...windowOfDays(365), allTime: true })
    // 3 年前那条也计入：100 + 5。
    expect(all.totals.input).toBe(105)
    expect(all.totals.total).toBeGreaterThan(105)
  })

  it('allTime 的结果严格大于受限范围（证明不是同一个窗口）', async () => {
    const { query } = queryWithOldEvent()
    const bounded = await collectCodeBuddyTokenStats(query, windowOfDays(365))
    const all = await collectCodeBuddyTokenStats(query, { ...windowOfDays(365), allTime: true })
    expect(all.totals.input).toBeGreaterThan(bounded.totals.input)
  })

  it('allTime 仍然保留逐日分布，且日期键合法', async () => {
    const { query } = queryWithOldEvent()
    const all = await collectCodeBuddyTokenStats(query, { ...windowOfDays(365), allTime: true })
    expect(all.days.length).toBeGreaterThan(0)
    // 每条逐日行的日期都必须是真实日期。
    // 这条曾漏网：把 -Infinity 直接当逐日行起点做 `起点 + i*DAY_MS` 会算出
    // 'NaN-NaN-NaN'——结构与长度看起来都对，只有日期是坏的。
    for (const row of all.days) expect(row.day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(all.activity).toHaveLength(365)
    for (const row of all.activity) {
      expect(row.day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isFinite(row.tokens)).toBe(true)
    }
  })
})

describe('端点化入参（{startTime, endTime} 真正生效）', () => {
  /**
   * 把请求入参从 `{days}` 切到 `{startTime, endTime}` 后，最值得守住的点是
   * 「端点是真的被服务端用来过滤的」——否则退化成「总取 30 天窗口」的回归
   * 也跑得通（合成数据没有几年之外的样本）。这里固定一组合成数据，主动构造
   * 「14 天窗口」「今天」「超过 MAX_RANGE_DAYS 截断」三组不同端点，看 totals
   * 是否分别命中预期。
   */
  function windowedQuery(): SessionQueryService {
    const now = Date.now()
    const header = { id: 's-w', cwd: '/w/demo' }
    return {
      async listSessions() { return [{ header, live: false, persisted: true }] },
      async observeSession(id: string) {
        return {
          header: { id, cwd: '/w/demo' },
          events: [
            event(now, 'codebuddy', 'm', 100, 0),                          // 今天
            event(now - 10 * 86_400_000, 'codebuddy', 'm', 10, 0),        // 10 天前
            event(now - 40 * 86_400_000, 'codebuddy', 'm', 1, 0),         // 40 天前（默认窗口外）
          ],
        } as never
      },
    }
  }

  it('startTime/endTime 端点决定窗口（14 天窗口只收今天 + 10 天前）', async () => {
    const result = await collectCodeBuddyTokenStats(windowedQuery(), windowOfDays(14))
    // 40 天前那条超窗被丢弃：100 + 10 = 110（输入），总量 = 110（无输出、缓存读）。
    expect(result.totals.input).toBe(110)
    expect(result.totals.total).toBe(110)
  })

  it('端点化后的窗口不再依赖服务端 now（请求时刻漂移不影响窗口）', async () => {
    /**
     * 关键回归：旧版本服务端会在缺端点时按 now 推窗口，现在即使端点齐全，
     * 服务端整段计算也不该读 `Date.now()`。
     *
     * 模拟实现：把 `collectCodeBuddyTokenStats` 内部的 `Date.now()` 替换成
     * 「由 `request.endTime` 隐含的请求时刻」，断言 totals 仅由端点决定、
     * 不会因调用时机不同而漂移。`windowedQuery` 拿测试运行时的 `Date.now()`
     * 造数据，端点也按同一 `now` 算——这种漂移是 clock 漂移（毫秒级）而不是
     * 「按请求时刻推窗口」漂移。即使测试运行在 23:59:59.999 触发跨日 cut
     * 也不应该让数额有量级变化（窗口最多差一天）。
     */
    const t0 = Date.now()
    const result1 = await collectCodeBuddyTokenStats(windowedQuery(), windowOfDays(14, t0))
    await new Promise(resolve => setTimeout(resolve, 5))
    const result2 = await collectCodeBuddyTokenStats(windowedQuery(), windowOfDays(14, t0))
    // 端点都用 t0 计算，totals 完全一致：没有服务端 now 介入。
    expect(result1.totals.input).toBe(result2.totals.input)
    expect(result1.totals.input).toBe(110)
  })

  it('startTime 缺失必须抛错（不得退化到固定窗口）', async () => {
    // 旧版本在缺端点时退化到 DEFAULT_RANGE_DAYS=30——同一接口对不同请求得到
    // 不同窗口，调试时无法定位。新版本拒绝缺端点，让故障面立刻可见。
    await expect(
      collectCodeBuddyTokenStats(windowedQuery(), { endTime: windowOfDays(1).endTime } as never),
    ).rejects.toThrow(/startTime/)
  })

  it('endTime 缺失必须抛错', async () => {
    await expect(
      collectCodeBuddyTokenStats(windowedQuery(), { startTime: windowOfDays(1).endTime } as never),
    ).rejects.toThrow(/endTime/)
  })

  it('endTime < startTime 必须抛错（不允许把窗口夹到 1 天糊弄过去）', async () => {
    // 端点写反：之前是「宽容到 1 天窗口」，结果是端点写错也会得到一个**错误**
    // 数字而不会报错。新版本要求显式抛错，把故障暴露给调用方。
    // 构造一个明确的倒序：startTime = 14 天窗口的终点，endTime = 1 天窗口的起点。
    const start = windowOfDays(14).endTime          // 今天 00:00
    const end = start - 86_400_000                  // 昨天 00:00（明显更早）
    await expect(
      collectCodeBuddyTokenStats(windowedQuery(), { startTime: start, endTime: end }),
    ).rejects.toThrow(/endTime/)
  })

  it('服务端内部使用 `Date.now()` 不参与窗口计算（白盒）', async () => {
    /**
     * 这条守的是实现细节：`collectCodeBuddyTokenStats` 整段逻辑不该再读
     * `Date.now()`——即使 `generatedAt`（响应时间戳）保留 `now`，窗口端点
     * 必须只来自 request。如果哪天有人把 `now` 偷塞回端点解析，这条会立刻
     * 露馅。办法：用一个明确过去 / 未来的端点，看 totals 是否与「
     * `windowOfDays` 重新计算」得到同一数值。
     */
    const past = windowOfDays(7, new Date('2024-01-15T12:00:00').getTime())
    const query: SessionQueryService = {
      async listSessions() { return [{ header: { id: 's-fake', cwd: '/w/demo' }, live: false, persisted: true }] },
      async observeSession(id: string) {
        // 事件全部落在 past 区间内：today（= 2024-01-15）100、3 天前 = 2024-01-12。
        const end = past.endTime
        return {
          header: { id, cwd: '/w/demo' },
          events: [
            event(end, 'codebuddy', 'm', 100, 0),
            event(end - 3 * 86_400_000, 'codebuddy', 'm', 50, 0),
          ],
        } as never
      },
    }
    const result = await collectCodeBuddyTokenStats(query, past)
    // 两条都进：100 + 50 = 150。如果服务端偷偷把端点替换成「真实的 now 推窗口」，
    // 这两条事件很可能落不到端点定义的区间，结果会不同。
    expect(result.totals.input).toBe(150)
  })
})

describe('各范围窗口确实生效（合成跨年数据）', () => {
  /**
   * 本地真实数据只跨越十几天，所以各范围算出的数字完全相同——这掩盖不了实现
   * 问题。这里造一份跨越两年的数据，逐个范围核对，确保窗口真的在过滤。
   */
  function spreadQuery(): SessionQueryService {
    const now = Date.now()
    const header = { id: 's-spread', cwd: '/w/demo' }
    return {
      async listSessions() { return [{ header, live: false, persisted: true }] },
      async observeSession(id: string) {
        return {
          header: { id, cwd: '/w/demo' },
          events: [
            event(now, 'codebuddy', 'm', 2, 0),                        // 今天
            event(now - 3 * 86_400_000, 'codebuddy', 'm', 7, 0),      // 3 天前
            event(now - 20 * 86_400_000, 'codebuddy', 'm', 30, 0),    // 20 天前
            event(now - 60 * 86_400_000, 'codebuddy', 'm', 90, 0),    // 60 天前
            event(now - 400 * 86_400_000, 'codebuddy', 'm', 400, 0),  // 一年多前
          ],
        } as never
      },
    }
  }

  it('近 7 天只算 7 天内的用量（今天 + 3 天前）', async () => {
    const s = await collectCodeBuddyTokenStats(spreadQuery(), resolveRange('7d'))
    expect(s.totals.input).toBe(2 + 7)
  })

  it('近 30 天纳入 20 天前那条', async () => {
    const s = await collectCodeBuddyTokenStats(spreadQuery(), resolveRange('30d'))
    expect(s.totals.input).toBe(2 + 7 + 30)
  })

  it('今天只纳入今天那条', async () => {
    // days=1 → 服务端起点 = 今天 00:00。
    const s = await collectCodeBuddyTokenStats(spreadQuery(), resolveRange('today'))
    expect(s.totals.input).toBe(2)
  })

  it('范围为单调不减：今天 ≤ 7d ≤ 30d', async () => {
    const query = spreadQuery()
    const totals: number[] = []
    for (const key of ['today', '7d', '30d'] as const) {
      totals.push((await collectCodeBuddyTokenStats(query, resolveRange(key))).totals.input)
    }
    const sorted = [...totals].sort((a, b) => a - b)
    expect(totals).toEqual(sorted)
  })
})

describe('缓存写已移出统计口径', () => {
  /** 只发一条「纯缓存写」的事件：没有任何输入/输出/缓存读。 */
  function cacheWriteOnlyEvent(time: number) {
    return {
      type: 'assistant/message',
      time,
      data: {
        message: { source: { kind: 'model', provider: 'codebuddy', model: 'kimi-k3-1' } },
        usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 999 },
      },
    }
  }

  it('只有缓存写的事件被丢弃，不计入记录数', async () => {
    // 若把它当成有效事件收下，「记录数」会增加而总量不增，让「平均每次调用」偏小。
    const now = Date.now()
    const header = { id: 's-w', cwd: '/work/w' }
    const query: SessionQueryService = {
      async listSessions() { return [{ header, live: false, persisted: true }] },
      async observeSession() {
        return {
          header,
          events: [cacheWriteOnlyEvent(now)],
          [Symbol.dispose]: () => {},
        }
      },
    }
    const result = await collectCodeBuddyTokenStats(query, windowOfDays(1))
    expect(result.totals.total).toBe(0)
    expect(result.totals.records).toBe(0)
  })

  it('同一事件的缓存读仍被计入（只去掉写）', async () => {
    const now = Date.now()
    const header = { id: 's-r', cwd: '/work/r' }
    const query: SessionQueryService = {
      async listSessions() { return [{ header, live: false, persisted: true }] },
      async observeSession() {
        return {
          header,
          events: [{
            type: 'assistant/message',
            time: now,
            data: {
              message: { source: { kind: 'model', provider: 'codebuddy', model: 'kimi-k3-1' } },
              usage: { inputTokens: 10, outputTokens: 2, cacheReadTokens: 88, cacheWriteTokens: 7 },
            },
          }],
          [Symbol.dispose]: () => {},
        }
      },
    }
    const result = await collectCodeBuddyTokenStats(query, windowOfDays(1))
    // 10 + 2 + 88 = 100；缓存写 7 不计入。
    expect(result.totals.total).toBe(100)
    expect(result.totals.read).toBe(88)
    // 命中率 = 88 / (10 + 88)，与缓存写无关。
    expect(result.totals.cacheHitRate).toBeCloseTo(88 / 98)
  })

  it('统计结果里没有 write 字段（避免调用方误用）', async () => {
    const query: SessionQueryService = {
      async listSessions() { return [] },
      async observeSession() { throw new Error('unused') },
    }
    const result = await collectCodeBuddyTokenStats(query, windowOfDays(1))
    expect(result.totals).not.toHaveProperty('write')
    for (const day of result.days) expect(day).not.toHaveProperty('write')
  })
})

describe('超长窗口的截断方向：保住最新数据（回归）', () => {
  /**
   * 上游缺陷：逐日行曾「从 `clientStart` 往后铺 `dayCount` 行」，超长窗口被
   * 截掉的是**尾部**——最靠近今天的那几十天没有对应日行槽位，
   * `dayRows.get(eventDay)` 返回 undefined，这些事件一天都进不去；而 `totals`
   * 照常累加（它用的是独立下界）。结果是「总量对、逐日图少一截最新数据」，
   * 且两者来自同一次请求、界面上看不出任何异常。
   *
   * 修复后逐日行从 `clientEnd` 往回铺（丢弃最早），并且 totals 的下界与逐日行
   * 覆盖范围对齐，两个口径永远一致。
   *
   * 虽然客户端范围键最长只有 90d（该分支不可达），但 host 接受任意时间戳，
   * 直接调 RPC 就能触发——这组测试锁住行为。
   */
  const DAY = 86_400_000
  const MAX_RANGE_DAYS = 365

  /** 一个含「很旧」与「今天」两条事件、窗口远超上限的会话。 */
  function overlongQuery(): { query: SessionQueryService, now: number } {
    const now = Date.now()
    const header = { id: 's-overlong', cwd: '/w/demo' }
    return {
      now,
      query: {
        async listSessions() { return [{ header, live: false, persisted: true }] },
        async observeSession(id: string) {
          return {
            header: { id, cwd: '/w/demo' },
            events: [
              // 500 天前：超出 365 行上限，且是最早的一端 —— 应当被丢弃。
              event(now - 500 * DAY, 'codebuddy', 'm', 1, 0),
              // 60 天前：在「最新 365 天」里，必须被逐日行接住。
              event(now - 60 * DAY, 'codebuddy', 'm', 10, 0),
              // 今天：最近的数据，**绝不能**因为截断而丢失。
              event(now, 'codebuddy', 'm', 100, 0),
            ],
          } as never
        },
      },
    }
  }

  /** 逐日行数固定为上限，且覆盖到「今天」。 */
  it('逐日行数夹到 365，而不是按请求天数铺满数万行', async () => {
    const { query } = overlongQuery()
    const result = await collectCodeBuddyTokenStats(query, windowOfDays(1000))
    expect(result.days).toHaveLength(MAX_RANGE_DAYS)
    expect(result.rangeDays).toBe(MAX_RANGE_DAYS)
  })

  it('截断后仍覆盖「今天」（丢弃最早的天，而不是砍掉最近的）', async () => {
    const { query } = overlongQuery()
    const result = await collectCodeBuddyTokenStats(query, windowOfDays(1000))
    const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD（本地）
    const last = result.days[result.days.length - 1]
    expect(last?.day).toBe(today)
    // 60 天前那条也必须落在逐日行里（它距终点 60 天 ≤ 365）。
    const sixtyAgo = new Date(Date.now() - 60 * DAY).toLocaleDateString('en-CA')
    expect(result.days.some(row => row.day === sixtyAgo)).toBe(true)
  })

  it('逐日行之和与 totals 口径一致（截断不再让两者分叉）', async () => {
    const { query } = overlongQuery()
    const result = await collectCodeBuddyTokenStats(query, windowOfDays(1000))
    const daySum = result.days.reduce((sum, row) => sum + row.total, 0)
    // 500 天前那条被逐日行丢弃，totals 也必须丢弃它 —— 两者同为 110。
    expect(daySum).toBe(110)
    expect(result.totals.total).toBe(110)
  })

  it('窗口不超过上限时不发生任何截断（正常路径行为不变）', async () => {
    const { query } = overlongQuery()
    const result = await collectCodeBuddyTokenStats(query, windowOfDays(90))
    expect(result.days).toHaveLength(90)
    // 90 天窗口里只有「今天」那条（60 天前也在窗口内 → 两条）。
    expect(result.totals.total).toBe(110)
  })
})
