import { describe, expect, it } from 'vitest'
import { collectCodeBuddyTokenStats, type SessionQueryService } from '../src/token-stats.ts'

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
    expect(result.totals.total).toBe(225)
    expect(result.totals.input).toBe(140)
    expect(result.totals.output).toBe(30)
    expect(result.totals.read).toBe(50)
    expect(result.totals.write).toBe(5)
    expect(result.totals.records).toBe(2)
    expect(result.totals.sessions).toBe(2)
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
