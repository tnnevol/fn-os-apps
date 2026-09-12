import type { SwitchCandidate, ProactiveSwitchInput, SwitchDecision, ReactiveSwitchInput } from '../types/host/switch-policy'
export type { SwitchCandidate, ProactiveSwitchInput, SwitchDecision, StayCode, ReactiveSwitchInput } from '../types/host/switch-policy'


/**
 * 主动切换决策：当前账号额度偏低时是否切到更好的账号。
 *
 * 判定顺序（任一条不满足即返回 `stay`，并给出对应 `code`）：
 *
 *  1. 当前账号必须存在；
 *  2. 除当前账号外至少还有一个账号；
 *  3. 当前账号的额度必须是**已知**的——探测失败时不切换。
 *     这是刻意的保守选择：额度未知时切换等于在信息不足的情况下改变行为，
 *     而请求真正失败时还有被动切换兜底。若把「未知」当作「不足」，一次 meter
 *     抖动就会让所有账号轮换一遍；
 *  4. 当前账号额度低于阈值（阈值判断只在已知时进行）；
 *  5. 不在冷却期；
 *  6. 没有进行中的流式请求；
 *  7. 存在满足约束的候选（凭据有效、额度已知、达标、收益差足够）。
 *
 * 排序规则见 `pickBest`：先按剩余额度降序，额度相同时按账号在文档中的**稳定
 * 顺序**（即输入顺序）兜底，保证同样的输入永远得到同样的结果。
 *
 * @param input - 决策输入；全部为已探测好的数据。
 * @returns 切换或保持的决策，含原因。
 */
export function decideProactiveTarget(input: ProactiveSwitchInput): SwitchDecision {
  const {
    candidates, activeId, thresholdPct, now,
    cooldownUntil, activeRequestCount = 0, minGapPct = 0, candidateMinRemainingPct = 0,
  } = input

  const active = candidates.find(candidate => candidate.id === activeId)
  if (active === undefined) {
    return { kind: 'stay', code: 'no-active-account', reason: '当前账号不在账号列表中' }
  }
  if (candidates.length < 2) {
    return { kind: 'stay', code: 'not-enough-accounts', reason: '只有一个账号，无处可切' }
  }

  /**
   * 当前账号凭据已失效时走**强制切换**：此时不需要看额度，因为凭据过期意味着
   * 任何请求都会失败，能用的候选就是更好的选择。
   */
  if (!active.credentialValid) {
    const viable = candidates.find(candidate => candidate.id !== activeId && candidate.credentialValid)
    if (viable === undefined) {
      return { kind: 'stay', code: 'no-viable-candidate', reason: '当前账号凭据已失效，但没有凭据有效的候选账号' }
    }
    return {
      kind: 'switch',
      targetId: viable.id,
      targetNickname: viable.nickname,
      ...viable.remainingPct === undefined ? {} : { remainingPct: viable.remainingPct },
      gainPct: 0,
      reason: `当前账号凭据已失效，切到「${viable.nickname}」`,
    }
  }

  if (active.remainingPct === undefined) {
    return { kind: 'stay', code: 'active-remaining-unknown', reason: '当前账号额度未知（探测失败），不据未知状态切换' }
  }
  if (active.remainingPct >= thresholdPct) {
    return {
      kind: 'stay',
      code: 'active-above-threshold',
      reason: `当前额度 ${format(active.remainingPct)}% 不低于阈值 ${format(thresholdPct)}%`,
    }
  }
  if (cooldownUntil !== undefined && now < cooldownUntil) {
    const seconds = Math.ceil((cooldownUntil - now) / 1000)
    return { kind: 'stay', code: 'cooldown', reason: `主动切换冷却中，还需 ${seconds}s` }
  }
  if (activeRequestCount > 0) {
    return { kind: 'stay', code: 'active-request', reason: `有 ${activeRequestCount} 个进行中的请求，不打断` }
  }

  const best = pickBest({
    candidates,
    activeId,
    activeRemaining: active.remainingPct,
    minGapPct,
    candidateMinRemainingPct,
  })
  if (best === undefined) {
    return {
      kind: 'stay',
      code: 'no-viable-candidate',
      reason: `没有满足条件的候选（需剩余 ≥ ${format(candidateMinRemainingPct)}%、收益差 > ${format(minGapPct)}%）`,
    }
  }
  return {
    kind: 'switch',
    targetId: best.candidate.id,
    targetNickname: best.candidate.nickname,
    remainingPct: best.remainingPct,
    gainPct: best.gainPct,
    reason: `当前额度 ${format(active.remainingPct)}% 低于阈值 ${format(thresholdPct)}%，切到「${best.candidate.nickname}」（${format(best.remainingPct)}%）`,
  }
}

/**
 * 被动切换决策：请求被拒后选下一个可以立刻接手的账号。
 *
 * 与主动切换共用候选过滤（凭据有效、额度已知），但：
 *
 *  - **不看阈值与冷却**：服务端已明确拒绝，等待无益；
 *  - **排除已尝试过的账号**：同一次请求内不得重复使用同一账号；
 *  - **不要求收益差**：能继续完成请求就是唯一目标。
 *
 * @param input - 决策输入。
 * @returns 切换或保持的决策。
 */
export function decideReactiveTarget(input: ReactiveSwitchInput): SwitchDecision {
  const { candidates, failedId, triedIds } = input
  const tried = new Set(triedIds)
  tried.add(failedId)

  const remaining = candidates.filter(candidate => !tried.has(candidate.id))
  if (remaining.length === 0) {
    return { kind: 'stay', code: 'no-viable-candidate', reason: '没有未尝试过的账号可切' }
  }
  // 被动切换同样要求额度已知：未知额度的账号可能同样被拒，切过去只是浪费一次尝试。
  // 但在**没有**任何已知额度账号时放宽——有凭据有效且未尝试的账号总比直接失败好。
  const known = remaining.filter(candidate => candidate.credentialValid && candidate.remainingPct !== undefined)
  const pool = known.length > 0 ? known : remaining.filter(candidate => candidate.credentialValid)
  if (pool.length === 0) {
    return { kind: 'stay', code: 'no-viable-candidate', reason: '未尝试过的账号凭据都已失效' }
  }

  const best = [...pool].sort((a, b) => {
    // 剩余额度降序；未知排最后。额度相同按输入顺序（稳定），保证结果可复现。
    const left = a.remainingPct ?? -1
    const right = b.remainingPct ?? -1
    return right - left
  })[0]!

  return {
    kind: 'switch',
    targetId: best.id,
    targetNickname: best.nickname,
    ...best.remainingPct === undefined ? {} : { remainingPct: best.remainingPct },
    gainPct: 0,
    reason: `当前账号被拒，切到「${best.nickname}」继续本次请求`,
  }
}

/** 候选筛选与排序。抽出来便于单独测试排序规则。 */
function pickBest(args: {
  candidates: readonly SwitchCandidate[]
  activeId: string
  activeRemaining: number
  minGapPct: number
  candidateMinRemainingPct: number
}): { candidate: SwitchCandidate, remainingPct: number, gainPct: number } | undefined {
  const viable = args.candidates.filter((candidate) => {
    if (candidate.id === args.activeId) return false
    if (!candidate.credentialValid) return false
    // 额度未知的候选不参与主动切换：切过去可能同样不足。
    if (candidate.remainingPct === undefined) return false
    if (candidate.remainingPct < args.candidateMinRemainingPct) return false
    // 收益差用 `>`：恰好等于阈值不算「更好」，避免来回抖动。
    return candidate.remainingPct - args.activeRemaining > args.minGapPct
  })
  if (viable.length === 0) return undefined

  const sorted = [...viable].sort((a, b) => {
    const left = a.remainingPct as number
    const right = b.remainingPct as number
    if (right !== left) return right - left
    // 额度相同：按输入顺序（账号在文档中的位置）兜底，结果稳定可复现。
    return args.candidates.indexOf(a) - args.candidates.indexOf(b)
  })
  const candidate = sorted[0]!
  const remainingPct = candidate.remainingPct as number
  return { candidate, remainingPct, gainPct: remainingPct - args.activeRemaining }
}

/** 百分比展示：整数省掉小数位，非整数保留一位。 */
function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}
