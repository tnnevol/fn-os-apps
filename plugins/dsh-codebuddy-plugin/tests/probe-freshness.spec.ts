import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { formatProbeAge, STALE_HINT_AFTER_MS } from '../src/client/format-time.ts'

/**
 * 额度数据的「新鲜度」展示。
 *
 * 背景：面板**没有自动刷新**（只有输入框旁的用量指示器每 60s 拉一次），因此
 * 面板开着不动时额度数据可以陈旧很久；叠加统探测的 30s TTL 缓存后，用户看到
 * 「8649」时无法判断这是 3 秒前还是 5 分钟前的数据。
 *
 * 设计取向：**默认零噪音**——正常情况不显示任何东西，只在陈旧到值得点刷新时提示。
 */
const NOW = 1_700_000_000_000

describe('formatProbeAge：默认不提示', () => {
  it('数据够新时返回 null（不占卡片宽度）', () => {
    // 面板无自动刷新，数据本来就有一定年纪；显示「刚刚」既无信息量又占宽度。
    expect(formatProbeAge(NOW, NOW)).toBeNull()
    expect(formatProbeAge(NOW - 1000, NOW)).toBeNull()
    expect(formatProbeAge(NOW - 60_000, NOW)).toBeNull()
  })

  it('阈值边界：恰好到阈值才开始提示', () => {
    expect(formatProbeAge(NOW - STALE_HINT_AFTER_MS + 1, NOW)).toBeNull()
    expect(formatProbeAge(NOW - STALE_HINT_AFTER_MS, NOW)).toBe('2 分钟前')
  })

  it('缺失或非法时间戳不提示（不是「很久以前」）', () => {
    // host 未透出 probedAt（老版本 host）时不应误报陈旧。
    expect(formatProbeAge(undefined, NOW)).toBeNull()
    expect(formatProbeAge(0, NOW)).toBeNull()
    expect(formatProbeAge(Number.NaN, NOW)).toBeNull()
    expect(formatProbeAge(-1, NOW)).toBeNull()
  })

  it('时钟回拨（age 为负）不提示', () => {
    // 不是「数据陈旧」，提示会误导。
    expect(formatProbeAge(NOW + 60_000, NOW)).toBeNull()
  })
})

describe('formatProbeAge：分档文案', () => {
  it('分钟级', () => {
    expect(formatProbeAge(NOW - 5 * 60_000, NOW)).toBe('5 分钟前')
    expect(formatProbeAge(NOW - 59 * 60_000, NOW)).toBe('59 分钟前')
  })

  it('小时级', () => {
    expect(formatProbeAge(NOW - 60 * 60_000, NOW)).toBe('1 小时前')
    expect(formatProbeAge(NOW - 23 * 3_600_000, NOW)).toBe('23 小时前')
  })

  it('天级（超过一天不再给小时精度）', () => {
    expect(formatProbeAge(NOW - 24 * 3_600_000, NOW)).toBe('1 天前')
    expect(formatProbeAge(NOW - 72 * 3_600_000, NOW)).toBe('3 天前')
  })
})

describe('面板接线', () => {
  const PANEL = readFileSync(
    '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/client/panel.tsx',
    'utf8',
  )

  it('卡片使用 formatProbeAge 且为 null 时不渲染', () => {
    expect(PANEL).toMatch(/const probeAge = formatProbeAge\(row\.probedAt\)/)
    expect(PANEL).toMatch(/\{probeAge !== null && \(/)
  })

  it('区分「来自缓存」与「一直没刷新」两种陈旧', () => {
    // 前者是「刷新了但拿的是缓存快照」，后者是「面板开着没动过」。
    expect(PANEL).toMatch(/row\.probedFromCache === true \? `缓存于 \$\{probeAge\}` : probeAge/)
  })

  it('查询失败与额度为 0 是两种状态', () => {
    // 失败：状态块 + 失败原因 tooltip；额度 0：正常卡片显示 0。
    expect(PANEL).toMatch(/!row\.creditOk/)
    expect(PANEL).toMatch(/DshTooltip content=\{row\.probeError\}/)
  })

  it('行类型透出 host 的三个新字段', () => {
    for (const f of ['probedAt?: number', 'probedFromCache?: boolean', 'probeError?: string | null']) {
      expect(PANEL).toContain(f)
    }
  })
})

describe('host 侧透出', () => {
  const SERVICE = readFileSync(
    '/Users/tnnevol/workspace/fn-packages/fn-os-apps/plugins/dsh-codebuddy-plugin/src/host/auth-service.ts',
    'utf8',
  )

  it('panelStatus 行包含 probedAt / probedFromCache / probeError', () => {
    expect(SERVICE).toMatch(/probedAt: outcome\.probedAt/)
    expect(SERVICE).toMatch(/probedFromCache: outcome\.fromCache/)
    expect(SERVICE).toMatch(/probeError: snapshot === undefined \? \(outcome\.error \?\? 'meter unreachable'\) : null/)
  })

  it('probedAt 取自探测结果，而不是「响应时刻」', () => {
    // 必须来自缓存记录的时间，否则命中缓存时会谎报「刚刚查过」。
    expect(SERVICE).toMatch(/const outcome = await usageResult/)
    expect(SERVICE).not.toMatch(/probedAt: Date\.now\(\),\s*fromCache: true/)
  })
})
