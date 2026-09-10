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

    const result = await collectCodeBuddyTokenStats(query, { days: 2 })
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
    const result = await collectCodeBuddyTokenStats(query, { days: 1, sessionIds: ['keep'] })
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
    const result = await collectCodeBuddyTokenStats(query, { days: 1 })
    expect(result.totals.total).toBe(120)
    expect(result.sessions.map(row => row.id)).toEqual(['healthy'])
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
    ]), { days: 7 })
    expect(result.sessions[0]?.title).toBe('更新 codex 插件')
  })

  it('跳过 DSH 注入的 system-reminder / 运行时上下文', async () => {
    const now = Date.now()
    const result = await collectCodeBuddyTokenStats(queryWith([
      { type: 'user/message', time: now, data: { role: 'user', content: [{ type: 'text', text: '<system-reminder>\nworkspace instructions…' }] } },
      { type: 'user/message', time: now, data: { role: 'user', content: [{ type: 'text', text: 'Current runtime context. This snapshot…' }] } },
      { type: 'user/message', time: now, data: { role: 'user', content: [{ type: 'text', text: '真正的用户问题' }] } },
      event(now, 'codebuddy', 'm', 10, 1),
    ]), { days: 7 })
    expect(result.sessions[0]?.title).toBe('真正的用户问题')
  })

  it('没有真实用户输入时标题为空串，而不是会话 id', async () => {
    const result = await collectCodeBuddyTokenStats(queryWith([
      { type: 'user/message', time: Date.now(), data: { role: 'user', content: [{ type: 'text', text: '<system-reminder>\nonly injected…' }] } },
      event(Date.now(), 'codebuddy', 'm', 10, 1),
    ]), { days: 7 })
    const title = result.sessions[0]?.title
    // 不能是 uuid：界面由客户端用本地化占位呈现。
    expect(title).toBe('')
    expect(title).not.toMatch(/^session-/)
  })

  it('标题压缩空白并截断，避免超长首行撑破布局', async () => {
    const result = await collectCodeBuddyTokenStats(queryWith([
      { type: 'user/message', time: Date.now(), data: { role: 'user', content: [{ type: 'text', text: `  多   空格\n换行 ${'x'.repeat(200)}` }] } },
      event(Date.now(), 'codebuddy', 'm', 10, 1),
    ]), { days: 7 })
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
    const bounded = await collectCodeBuddyTokenStats(query, { days: 30 })
    // 只有近一天那条被计入。
    expect(bounded.totals.input).toBe(5)
  })

  it('allTime 不受 365 天上限影响，计入全部历史', async () => {
    const { query } = queryWithOldEvent()
    const all = await collectCodeBuddyTokenStats(query, { allTime: true })
    // 3 年前那条也计入：100 + 5。
    expect(all.totals.input).toBe(105)
    expect(all.totals.total).toBeGreaterThan(105)
  })

  it('allTime 的结果严格大于受限范围（证明不是同一个窗口）', async () => {
    const { query } = queryWithOldEvent()
    const bounded = await collectCodeBuddyTokenStats(query, { days: 365 })
    const all = await collectCodeBuddyTokenStats(query, { allTime: true })
    expect(all.totals.input).toBeGreaterThan(bounded.totals.input)
  })

  it('allTime 仍然保留逐日分布，且日期键合法', async () => {
    const { query } = queryWithOldEvent()
    const all = await collectCodeBuddyTokenStats(query, { allTime: true })
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
            event(now - 3 * 86_400_000, 'codebuddy', 'm', 7, 0),      // 3 天前
            event(now - 20 * 86_400_000, 'codebuddy', 'm', 30, 0),    // 20 天前
            event(now - 60 * 86_400_000, 'codebuddy', 'm', 90, 0),    // 60 天前
            event(now - 400 * 86_400_000, 'codebuddy', 'm', 400, 0),  // 一年多前
          ],
        } as never
      },
    }
  }

  it('近 7 天只算 7 天内的用量', async () => {
    const s = await collectCodeBuddyTokenStats(spreadQuery(), resolveRange('7d'))
    expect(s.totals.input).toBe(7)
  })

  it('近 30 天纳入 20 天前那条', async () => {
    const s = await collectCodeBuddyTokenStats(spreadQuery(), resolveRange('30d'))
    expect(s.totals.input).toBe(7 + 30)
  })

  it('近 90 天纳入 60 天前那条', async () => {
    const s = await collectCodeBuddyTokenStats(spreadQuery(), resolveRange('90d'))
    expect(s.totals.input).toBe(7 + 30 + 90)
  })

  it('总计纳入一年多前那条（说明 allTime 真的不受上限影响）', async () => {
    const s = await collectCodeBuddyTokenStats(spreadQuery(), resolveRange('all'))
    expect(s.totals.input).toBe(7 + 30 + 90 + 400)
  })

  it('范围为单调不减：7d ≤ 30d ≤ 90d ≤ 总计', async () => {
    const query = spreadQuery()
    const totals: number[] = []
    for (const key of ['7d', '30d', '90d', 'all'] as const) {
      totals.push((await collectCodeBuddyTokenStats(query, resolveRange(key))).totals.input)
    }
    const sorted = [...totals].sort((a, b) => a - b)
    expect(totals).toEqual(sorted)
  })

  it('本月的窗口不超过近 30 天（日历月最多 31 天）', async () => {
    const s = await collectCodeBuddyTokenStats(spreadQuery(), resolveRange('month'))
    // 3 天前的那条必在；20 天前那条取决于今天几号。
    expect(s.totals.input).toBeGreaterThanOrEqual(7)
    expect(s.totals.input).toBeLessThanOrEqual(7 + 30)
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
    const result = await collectCodeBuddyTokenStats(query, { days: 1 })
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
    const result = await collectCodeBuddyTokenStats(query, { days: 1 })
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
    const result = await collectCodeBuddyTokenStats(query, { days: 1 })
    expect(result.totals).not.toHaveProperty('write')
    for (const day of result.days) expect(day).not.toHaveProperty('write')
  })
})
