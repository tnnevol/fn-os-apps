

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
