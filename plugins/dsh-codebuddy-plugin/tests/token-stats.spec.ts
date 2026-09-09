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
          { type: 'user/message', time: now, data: { message: { content: [{ type: 'text', text: 'alpha task' }] } } },
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
