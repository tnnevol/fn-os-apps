import { describe, expect, it } from 'vitest'
import {
  decideProactiveTarget,
  decideReactiveTarget,
  type SwitchCandidate,
  type ProactiveSwitchInput,
} from '../src/host/switch-policy.ts'

/**
 * 主动/被动切换决策是**纯函数**，因此每条规则都能用一组输入直接断言，
 * 不必伪造网络与文件系统。这里的用例即 `decideProactiveTarget` 文档里
 * 列出的判定顺序。
 */

const NOW = 1_700_000_000_000

function candidate(id: string, remainingPct: number | undefined, credentialValid = true): SwitchCandidate {
  return { id, nickname: `账号${id}`, credentialValid, ...remainingPct === undefined ? {} : { remainingPct } }
}

function proactive(over: Partial<ProactiveSwitchInput> = {}): ProactiveSwitchInput {
  return {
    candidates: [candidate('A', 5), candidate('B', 80)],
    activeId: 'A',
    thresholdPct: 10,
    now: NOW,
    ...over,
  }
}

describe('decideProactiveTarget：基本判定', () => {
  it('当前额度高于阈值 → 不切换', () => {
    const d = decideProactiveTarget(proactive({ candidates: [candidate('A', 50), candidate('B', 90)] }))
    expect(d.kind).toBe('stay')
    if (d.kind === 'stay') expect(d.code).toBe('active-above-threshold')
  })

  it('额度恰好等于阈值 → 不切换（判断用 >=）', () => {
    // 边界：等于阈值不算「低于」，避免在阈值附近来回切换。
    const d = decideProactiveTarget(proactive({ candidates: [candidate('A', 10), candidate('B', 90)] }))
    expect(d.kind).toBe('stay')
  })

  it('当前额度低于阈值且存在更优候选 → 切换', () => {
    const d = decideProactiveTarget(proactive())
    expect(d.kind).toBe('switch')
    if (d.kind === 'switch') {
      expect(d.targetId).toBe('B')
      expect(d.remainingPct).toBe(80)
      expect(d.gainPct).toBe(75)
      expect(d.reason).toContain('账号B')
    }
  })

  it('当前账号不在列表中 → 不切换', () => {
    const d = decideProactiveTarget(proactive({ activeId: 'Z' }))
    expect(d.kind).toBe('stay')
    if (d.kind === 'stay') expect(d.code).toBe('no-active-account')
  })

  it('只有一个账号 → 不切换（无处可切）', () => {
    const d = decideProactiveTarget(proactive({ candidates: [candidate('A', 1)] }))
    expect(d.kind).toBe('stay')
    if (d.kind === 'stay') expect(d.code).toBe('not-enough-accounts')
  })
})

describe('decideProactiveTarget：额度未知时不切换', () => {
  it('当前额度未知（探测失败）→ 不切换', () => {
    // 关键设计：把「未知」当作「不足」会让一次 meter 抖动就轮换所有账号。
    const d = decideProactiveTarget(proactive({ candidates: [candidate('A', undefined), candidate('B', 90)] }))
    expect(d.kind).toBe('stay')
    if (d.kind === 'stay') {
      expect(d.code).toBe('active-remaining-unknown')
      expect(d.reason).toContain('未知')
    }
  })

  it('候选额度未知时不被选中', () => {
    const d = decideProactiveTarget(proactive({ candidates: [candidate('A', 5), candidate('B', undefined)] }))
    expect(d.kind).toBe('stay')
    if (d.kind === 'stay') expect(d.code).toBe('no-viable-candidate')
  })

  it('未知与 0 有本质区别：0 是「确实没额度」，会被当作候选排除但不是未知', () => {
    const d = decideProactiveTarget(proactive({ candidates: [candidate('A', 5), candidate('B', 0)] }))
    expect(d.kind).toBe('stay')
    // B 的额度是已知的 0，只是不达标 → no-viable-candidate，而不是 unknown
    if (d.kind === 'stay') expect(d.code).toBe('no-viable-candidate')
  })
})

describe('decideProactiveTarget：冷却与活跃请求', () => {
  it('冷却期内不切换', () => {
    const d = decideProactiveTarget(proactive({ cooldownUntil: NOW + 60_000 }))
    expect(d.kind).toBe('stay')
    if (d.kind === 'stay') {
      expect(d.code).toBe('cooldown')
      expect(d.reason).toContain('60s')
    }
  })

  it('冷却已过 → 可以切换', () => {
    const d = decideProactiveTarget(proactive({ cooldownUntil: NOW - 1 }))
    expect(d.kind).toBe('switch')
  })

  it('有进行中的请求时不切换（不打断输出中的流）', () => {
    const d = decideProactiveTarget(proactive({ activeRequestCount: 1 }))
    expect(d.kind).toBe('stay')
    if (d.kind === 'stay') expect(d.code).toBe('active-request')
  })

  it('活跃请求数为 0 时不阻挡', () => {
    expect(decideProactiveTarget(proactive({ activeRequestCount: 0 })).kind).toBe('switch')
  })
})

describe('decideProactiveTarget：收益差与候选下限', () => {
  it('收益差不足 → 不切换（不为 0.3% 换一次账号）', () => {
    const d = decideProactiveTarget(proactive({
      candidates: [candidate('A', 5), candidate('B', 5.3)],
      minGapPct: 5,
    }))
    expect(d.kind).toBe('stay')
    if (d.kind === 'stay') expect(d.code).toBe('no-viable-candidate')
  })

  it('收益差恰好等于阈值 → 不切换（用 > 而非 >=）', () => {
    const d = decideProactiveTarget(proactive({
      candidates: [candidate('A', 5), candidate('B', 10)],
      minGapPct: 5,
    }))
    expect(d.kind).toBe('stay')
  })

  it('收益差超过阈值 → 切换', () => {
    const d = decideProactiveTarget(proactive({
      candidates: [candidate('A', 5), candidate('B', 10.1)],
      minGapPct: 5,
    }))
    expect(d.kind).toBe('switch')
  })

  it('候选自身低于下限 → 不选（切过去同样快用完）', () => {
    const d = decideProactiveTarget(proactive({
      candidates: [candidate('A', 1), candidate('B', 2)],
      candidateMinRemainingPct: 10,
    }))
    expect(d.kind).toBe('stay')
  })

  it('候选下限只约束候选，不约束当前账号', () => {
    // 当前账号 1% 低于候选下限 10%，但那是「该切」的理由，不是阻挡。
    const d = decideProactiveTarget(proactive({
      candidates: [candidate('A', 1), candidate('B', 50)],
      candidateMinRemainingPct: 10,
    }))
    expect(d.kind).toBe('switch')
  })
})

describe('decideProactiveTarget：候选过滤与排序', () => {
  it('凭据失效的候选被排除', () => {
    const d = decideProactiveTarget(proactive({
      candidates: [candidate('A', 5), candidate('B', 90, false)],
    }))
    expect(d.kind).toBe('stay')
  })

  it('多个候选取剩余额度最高者', () => {
    const d = decideProactiveTarget(proactive({
      candidates: [candidate('A', 5), candidate('B', 30), candidate('C', 90), candidate('D', 60)],
    }))
    expect(d.kind).toBe('switch')
    if (d.kind === 'switch') expect(d.targetId).toBe('C')
  })

  it('额度相同时按输入顺序（稳定），结果可复现', () => {
    const input = proactive({
      candidates: [candidate('A', 5), candidate('B', 50), candidate('C', 50)],
    })
    const first = decideProactiveTarget(input)
    const second = decideProactiveTarget(input)
    expect(first).toEqual(second)
    if (first.kind === 'switch') expect(first.targetId).toBe('B')
  })

  it('同样的输入与 now 得到稳定结果（纯函数）', () => {
    const input = proactive({ cooldownUntil: NOW + 1000 })
    expect(decideProactiveTarget(input)).toEqual(decideProactiveTarget(input))
  })
})

describe('decideProactiveTarget：当前账号凭据失效时的强制切换', () => {
  it('凭据失效 → 不看额度、不看阈值，直接切到凭据有效的候选', () => {
    const d = decideProactiveTarget(proactive({
      candidates: [candidate('A', 90, false), candidate('B', 1)],
    }))
    // A 额度 90% 但凭据失效：必须切走，因为任何请求都会失败。
    expect(d.kind).toBe('switch')
    if (d.kind === 'switch') {
      expect(d.targetId).toBe('B')
      expect(d.reason).toContain('凭据已失效')
    }
  })

  it('凭据失效且候选也失效 → 不切换（无处可去）', () => {
    const d = decideProactiveTarget(proactive({
      candidates: [candidate('A', 90, false), candidate('B', 1, false)],
    }))
    expect(d.kind).toBe('stay')
    if (d.kind === 'stay') expect(d.code).toBe('no-viable-candidate')
  })

  it('凭据失效的强制切换不受冷却与活跃请求阻挡', () => {
    // 凭据失效意味着请求必然失败，冷却和「不打断流」都不构成理由。
    const d = decideProactiveTarget(proactive({
      candidates: [candidate('A', 90, false), candidate('B', 1)],
      cooldownUntil: NOW + 999_999,
      activeRequestCount: 3,
    }))
    expect(d.kind).toBe('switch')
  })
})

describe('decideReactiveTarget：被动切换', () => {
  it('排除已尝试过的账号', () => {
    const d = decideReactiveTarget({
      candidates: [candidate('A', 90), candidate('B', 50), candidate('C', 30)],
      failedId: 'A',
      triedIds: ['A'],
    })
    expect(d.kind).toBe('switch')
    if (d.kind === 'switch') expect(d.targetId).toBe('B')
  })

  it('同一次请求内不重复使用同一账号', () => {
    const d = decideReactiveTarget({
      candidates: [candidate('A', 90), candidate('B', 50)],
      failedId: 'B',
      triedIds: ['A', 'B'],
    })
    expect(d.kind).toBe('stay')
    if (d.kind === 'stay') expect(d.code).toBe('no-viable-candidate')
  })

  it('failedId 自动算作已尝试（调用方漏传也不会重用）', () => {
    const d = decideReactiveTarget({
      candidates: [candidate('A', 90), candidate('B', 50)],
      failedId: 'A',
      triedIds: [],   // 故意不传 A
    })
    expect(d.kind).toBe('switch')
    if (d.kind === 'switch') expect(d.targetId).toBe('B')
  })

  it('取剩余额度最高者', () => {
    const d = decideReactiveTarget({
      candidates: [candidate('A', 90), candidate('B', 50), candidate('C', 70)],
      failedId: 'A',
      triedIds: ['A'],
    })
    if (d.kind === 'switch') expect(d.targetId).toBe('C')
  })

  it('不受阈值、冷却、收益差限制（服务端已明确拒绝）', () => {
    // 被动切换接口本身没有这些参数 —— 用测试固定这个设计。
    const d = decideReactiveTarget({
      candidates: [candidate('A', 90), candidate('B', 1)],
      failedId: 'A',
      triedIds: ['A'],
    })
    // B 只有 1%，在主动路径下会被 candidateMinRemainingPct 挡掉；被动路径要切。
    expect(d.kind).toBe('switch')
  })

  it('额度过高者优先，未知额度排最后', () => {
    const d = decideReactiveTarget({
      candidates: [candidate('A', 90), candidate('B', undefined), candidate('C', 20)],
      failedId: 'A',
      triedIds: ['A'],
    })
    if (d.kind === 'switch') expect(d.targetId).toBe('C')
  })

  it('全部候选额度未知时放宽：仍切到凭据有效者', () => {
    // 未知额度可能同样被拒，但「有凭据有效且未尝试的账号」总比直接失败好。
    const d = decideReactiveTarget({
      candidates: [candidate('A', 90), candidate('B', undefined)],
      failedId: 'A',
      triedIds: ['A'],
    })
    expect(d.kind).toBe('switch')
    if (d.kind === 'switch') expect(d.targetId).toBe('B')
  })

  it('候选凭据全部失效 → 不切换', () => {
    const d = decideReactiveTarget({
      candidates: [candidate('A', 90), candidate('B', 50, false)],
      failedId: 'A',
      triedIds: ['A'],
    })
    expect(d.kind).toBe('stay')
  })
})
