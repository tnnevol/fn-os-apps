/**
 * 主动切换账号的**纯决策**逻辑：给一组账号快照，回答「该不该切、切到谁」。
 *
 * 这个模块刻意不读文件、不发请求、不改当前账号、不起定时器，也不依赖任何全局
 * 状态——`now` 由调用方显式传入。原因有三：
 *
 *  1. **可测**：切换是有代价的操作（切错账号会让请求打到不认这份凭据的平面上），
 *     而它的判定条件很多（阈值、冷却、收益差、活跃请求、探测失败）。把决策抽成
 *     纯函数后，每条规则都能用一组输入直接断言，不必伪造网络和文件系统。
 *  2. **可解释**：返回值带 `reason`，日志和排查能直接说明「为什么没切」——此前
 *     决策散落在 I/O 之间，失败时只能看到「没切换」而不知道是哪一条挡住了。
 *  3. **单向依赖**：session 负责取数（探测额度）、执行切换；policy 只负责判断。
 *     这样新增一条规则不会牵动 I/O 代码。
 *
 * 判定的顺序即下方 `decideProactiveTarget` 的分支顺序，短路的理由都会写进
 * `reason`，便于对照。
 *
 * @module dsh-codebuddy/switch-policy
 */

/** 参与决策的一个账号快照。全部字段都由调用方探测后填入。 */
export interface SwitchCandidate {
  /** 本地账号 id。 */
  id: string
  /** 显示名，仅用于日志与返回值，不参与排序。 */
  nickname: string
  /**
   * 认证凭据是否仍有效（refresh token 未过期）。
   *
   * 这是**认证**层面的有效性，与「额度是否用尽」是两件事：凭据有效但额度为 0
   * 的账号不该被选中，凭据过期的账号则无论额度多少都不能用。
   */
  credentialValid: boolean
  /**
   * 最近一次探测到的剩余额度百分比（0–100）。
   *
   * `undefined` 表示**未知**（探测失败或该账号没有额度信息），与 0 有本质区别：
   * 0 是「查到了，确实没额度」，未知是「没查成」。两者对决策的影响不同——见
   * `decideProactiveTarget` 中关于未知额度的说明。
   */
  remainingPct?: number
}

/** 主动切换的输入。 */
export interface ProactiveSwitchInput {
  candidates: readonly SwitchCandidate[]
  /** 当前账号 id。 */
  activeId: string
  /** 当前账号剩余额度低于此值时才考虑切换（百分点）。 */
  thresholdPct: number
  /** 显式传入的当前时刻（epoch ms），便于测试。 */
  now: number
  /**
   * 冷却截止时间（epoch ms）。`now < cooldownUntil` 时不允许主动切换。
   *
   * 冷却只约束**主动**切换：被动切换（请求被明确拒绝）不受它限制——服务端已经
   * 说了这个账号不能用，再等冷却没有意义。见 `decideReactiveTarget`。
   */
  cooldownUntil?: number
  /**
   * 正在进行中的流式请求数。> 0 时不允许主动切换。
   *
   * 主动切换是「优化下一次请求」的操作，没必要打断正在输出的流；而中途换账号
   * 还可能让已产出的内容与后续内容来自不同账号。
   */
  activeRequestCount?: number
  /**
   * 候选账号相对当前账号所需的**最小收益差**（百分点）。
   *
   * 挡的是「为了 0.3% 的差别换一次账号」：切换本身有成本（重新探测、目录缓存
   * 失效、模型选择器刷新），收益太小就不值得。
   */
  minGapPct?: number
  /**
   * 候选账号自身所需的**最小剩余额度**（百分点）。
   *
   * 挡的是「切到一个同样快用完的账号」。低于此值的候选即使比当前账号好，
   * 也不选——那只是把问题推迟一次请求。
   */
  candidateMinRemainingPct?: number
}

/** 决策结果。 */
export type SwitchDecision =
  | {
      kind: 'switch'
      targetId: string
      targetNickname: string
      /**
       * 目标账号的剩余额度百分比。
       *
       * 可选：凭据失效的强制切换与被动切换都**不要求**额度已知（那时目标是
       * 「能继续」而不是「更优」），因此可能没有这个值。
       */
      remainingPct?: number
      /** 相对当前账号的收益差（百分点）。 */
      gainPct: number
      /** 人类可读的原因，用于日志。 */
      reason: string
    }
  | {
      kind: 'stay'
      /** 机器可判定的原因码，便于测试与统计。 */
      code: StayCode
      /** 人类可读的原因，用于日志。 */
      reason: string
    }

/** 不切换的原因码。 */
export type StayCode =
  | 'no-active-account'
  | 'not-enough-accounts'
  | 'active-remaining-unknown'
  | 'active-above-threshold'
  | 'cooldown'
  | 'active-request'
  | 'no-viable-candidate'

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
 * 被动切换的输入。
 *
 * 与主动切换的差别在于**约束放宽**：请求已经被明确拒绝（额度用尽/被限流），
 * 所以不看阈值、不看冷却、不看收益差——那些是「值不值得优化」的考量，而这里
 * 是「当前账号已经不能用」。
 */
export interface ReactiveSwitchInput {
  candidates: readonly SwitchCandidate[]
  /** 刚失败的账号 id。 */
  failedId: string
  /** 本次请求**已经尝试过**的账号 id，必须排除，避免对同一账号反复重试。 */
  triedIds: readonly string[]
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
