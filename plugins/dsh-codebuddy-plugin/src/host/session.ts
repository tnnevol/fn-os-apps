/**
 * 已登录会话：token 的新鲜度与缓存的模型目录。
 *
 * 两者由同一个对象持有，因为它们共享同一种失败模式——token 过期会导致目录
 * 不可读——也因为两者都必须先解析出来才能构造请求。刷新是单飞（single-flight）
 * 的：adapter 每次流式调用解析一次身份、每次列表读取解析一次目录，如果不做
 * 合并，一波并发调用会各自消耗一次 refresh token，而且除一个之外全都在竞态
 * 写文件。
 *
 * @module dsh-codebuddy/session
 */

import { getConfig, getEnterpriseModels, refreshAccessToken } from './codebuddy.ts'
import type { CodeBuddyIdentity } from './codebuddy.ts'
import { decideProactiveTarget, type SwitchCandidate } from './switch-policy.ts'
import { UsageProbeCache } from './usage-probe.ts'
import type { UsageSnapshot } from './usage.ts'
import { CODEBUDDY_CLIENT_VERSIONS, normalizeClientId } from '../contracts/constants.ts'
import type { CodeBuddyClientId } from '../contracts/constants.ts'
import { loadStorage, saveStorage, mutateStorage, activeEntry, resolveEntryEndpoint } from './storage.ts'
import type { CodeBuddyAccountEntry, CodeBuddyStorage } from './storage.ts'
import type { CodeBuddyModel } from './types.ts'

/** 比记录的过期时间提前很久刷新，而不是卡着过期点刷新。 */
const REFRESH_SKEW_MS = 60_000

/** 读到的目录复用多久后才重新向服务端请求。 */
const CATALOG_TTL_MS = 5 * 60 * 1000

/**
 * 主动切换所需的最小收益差（百分点）。
 *
 * 挡的是「为了 0.3% 的差别换一次账号」：切换有成本（重新探测、目录缓存失效、
 * 模型选择器刷新），收益太小不值得。
 */
const MIN_SWITCH_GAIN_PCT = 5

/**
 * 候选账号自身所需的最小剩余额度（百分点）。
 *
 * 挡的是「切到一个同样快用完的账号」——那只是把问题推迟一次请求。
 */
const CANDIDATE_MIN_REMAINING_PCT = 1

/** 未登录任何账号时抛出；message 中携带解决办法。 */
export class NotLoggedInError extends Error {
  constructor(detail: string) {
    super(detail)
    this.name = 'NotLoggedInError'
  }
}

/** 与 cordis 兼容的 logger 接口，使 session 可以脱离宿主直接使用。 */
export interface SessionLogger {
  warn: (message: unknown) => void
  error: (message: unknown) => void
}

/**
 * 持有一个插件实例的存储凭据。
 *
 * 存储支持多账号；每个请求都以当前活动条目认证。文档在内存缺失时从磁盘重读，
 * 这正是让在 Web UI 完成的登录或切换无需重启就能触达一个*运行中的* harness
 * 的机制。
 */
export class CodeBuddySession {
  private storage: CodeBuddyStorage | undefined
  /**
   * 在途的 token 刷新，按**账号 id** 隔离。
   *
   * 用一个全局单槽（原先的 `refreshing`）会在切换账号后串味：新当前账号若也
   * 需要刷新，`??=` 会命中旧账号仍在途的 promise，于是**用旧账号的凭据为
   * 新账号发请求**（accessToken / uid / domain 全套都是旧的）。按账号 id 分槽
   * 后，各账号只复用自己那次刷新。
   *
   * 代际（generation）再兜一层：账号被删除或文档被重写后，旧条目即使 id 相同
   * 也不该复用，因此 id 与代际一起作为键。
   */
  private refreshing = new Map<string, Promise<CodeBuddyIdentity>>()
  private catalog: { models: readonly CodeBuddyModel[], readAt: number } | undefined
  /** 在途的目录读取，同样按 `账号 id@代际` 隔离（理由见 refresh 侧注释）。 */
  private catalogRead = new Map<string, Promise<readonly CodeBuddyModel[]>>()
  /**
   * 每次凭据/账号集合发生变化就自增。在途操作返回时用它判断「我出发时的世界
   * 是否还在」——不在就丢弃结果，避免把陈旧快照写回磁盘。
   */
  private generation = 0

  /**
   * 正在进行中的流式请求数。
   *
   * 主动切换据此避让：切换是「优化下一次请求」的操作，没必要打断正在输出的流，
   * 中途换账号还可能让已产出内容与后续内容来自不同账号。由 adapter 在 stream 的
   * 开始与结束处增减（见 beginRequest / endRequest）。
   */
  private inFlightRequests = 0

  /**
   * 额度探测缓存：与面板、切换周期共用**同一份**快照。
   *
   * 引入它之前，额度有 5 个各自独立的探测点（面板两处、主动周期、被动切换、
   * 本类的 remainingPercentOf），同一账号常在一轮里被探 2–3 次；更要紧的是
   * 面板显示的额度与策略决策用的额度来自两次不同探测，meter 一抖动就会出现
   * 「面板说还剩 60%，策略却判不足」。
   */
  private readonly probes = new UsageProbeCache()

  constructor(private readonly logger?: SessionLogger) {}

  /** 进行中的流式请求数，供主动切换判定是否避让。 */
  get activeRequestCount(): number {
    return this.inFlightRequests
  }

  /**
   * 额度探测缓存（与面板共用**同一实例**）。
   *
   * 暴露出来而不是让 auth-service 自建一个：面板显示的额度与策略决策用的额度
   * 必须来自同一次探测，否则 meter 一抖动就会出现两者自相矛盾的表现。
   */
  get usageProbes(): UsageProbeCache {
    return this.probes
  }

  /** 标记一个流式请求开始；调用方必须在结束时 endRequest（用 finally）。 */
  beginRequest(): void {
    this.inFlightRequests += 1
  }

  /** 标记一个流式请求结束；幂等由调用方的 finally 保证。 */
  endRequest(): void {
    this.inFlightRequests = Math.max(0, this.inFlightRequests - 1)
  }

  /**
   * 忘记内存中的凭据与目录，强制从磁盘重读。
   *
   * 同时自增代际：在途的刷新/目录读取据此判定自己已过期，**既不复用也不回写**。
   * 只清 `storage`/`catalog` 是不够的——在途 promise 仍会把陈旧快照落地。
   */
  invalidate(): void {
    this.storage = undefined
    this.catalog = undefined
    this.generation += 1
    this.refreshing.clear()
    this.catalogRead.clear()
  }

  /**
   * 单个账号的剩余额度百分比，供被动切换决策取数。
   *
   * 与主动路径共用 `remainingPercentOf`（同一套窗口聚合规则），保证两条路径
   * 对「还剩多少」的判断一致——否则同一次请求里主动与被动会得出不同结论。
   * @param entry - 目标账号条目。
   * @param signal - 可选取消。
   * @returns 0–100 的百分比，或 `undefined` 表示未知。
   */
  async remainingPercentFor(entry: CodeBuddyAccountEntry, signal?: AbortSignal): Promise<number | undefined> {
    return this.remainingPercentOf(entry, signal)
  }

  /** 面板探测用的公开身份解析（按条目、不触发刷新）。 */
  identityFor(entry: CodeBuddyAccountEntry): CodeBuddyIdentity {
    return this.identityOf(entry)
  }

  private identityOf(entry: CodeBuddyAccountEntry): CodeBuddyIdentity {
    return {
      accessToken: entry.auth.accessToken,
      domain: entry.auth.domain,
      uid: entry.account.uid,
      ...entry.account.enterpriseId === undefined
        ? {}
        : { enterpriseId: entry.account.enterpriseId },
      ...entry.account.departmentFullName === undefined
        ? {}
        : { departmentFullName: entry.account.departmentFullName },
    }
  }

  /**
   * 存储的凭据文档，首次使用及失效后从磁盘读取。
   * @throws NotLoggedInError 未存储任何凭据时抛出。
   */
  private async require(): Promise<CodeBuddyStorage> {
    this.storage ??= await loadStorage()
    if (this.storage === undefined) {
      throw new NotLoggedInError(
        'CodeBuddy is not signed in. Sign in through Settings → CodeBuddy in the'
        + ' Web UI (no API key is required).',
      )
    }
    return this.storage
  }

  /** 是否存在任意账号凭据，但不强制要求有。 */
  async isLoggedIn(): Promise<boolean> {
    this.storage ??= await loadStorage()
    return this.storage !== undefined
  }

  /** 存在凭据时，当前活动账号的昵称。 */
  async nickname(): Promise<string | undefined> {
    this.storage ??= await loadStorage()
    return this.storage !== undefined ? activeEntry(this.storage).account.nickname : undefined
  }

  /**
   * 当前活动账号的可用身份，token 已到或临近过期时刷新。并发调用方共享同一次
   * 刷新。
   * @returns 用于认证请求的身份。
   * @throws NotLoggedInError 未存储任何凭据时抛出；或 refresh token 本身已过期、
   *   只能重新走浏览器登录才能恢复时抛出。
   */
  async identity(): Promise<CodeBuddyIdentity> {
    const storage = await this.require()
    const entry = activeEntry(storage)
    const now = Date.now()
    if (now < entry.auth.expiresAt - REFRESH_SKEW_MS) {
      return this.identityOf(entry)
    }
    if (now >= entry.auth.refreshExpiresAt) {
      throw new NotLoggedInError(
        'The CodeBuddy session has expired. Sign in again through Settings →'
        + ' CodeBuddy in the Web UI.',
      )
    }
    const key = `${entry.id}@${this.generation}`
    const inFlight = this.refreshing.get(key)
    if (inFlight !== undefined) return inFlight
    const started = this.refresh(storage, entry, this.generation)
    this.refreshing.set(key, started)
    void started.finally(() => {
      // 只清自己那一槽：期间可能已有别的账号/代际的刷新在跑。
      if (this.refreshing.get(key) === started) this.refreshing.delete(key)
    })
    return started
  }

  private async refresh(
    storage: CodeBuddyStorage,
    entry: CodeBuddyAccountEntry,
    /** 出发时的代际；返回时若已变化，说明账号集合被改过，结果不再可信。 */
    startedAt: number,
  ): Promise<CodeBuddyIdentity> {
    const endpoint = resolveEntryEndpoint(entry)
    const refreshed = await refreshAccessToken(endpoint, this.identityOf(entry), entry.auth.refreshToken)
    if (refreshed === undefined) {
      throw new NotLoggedInError(
        'Refreshing the CodeBuddy session failed. Sign in again through Settings →'
        + ' CodeBuddy in the Web UI.',
      )
    }
    const refreshedEntry: CodeBuddyAccountEntry = {
      ...entry,
      auth: {
        accessToken: refreshed.accessToken,
        // 时长缺失按 0 处理，避免 NaN 让「已过期」判断失效（NaN 比较恒为 false）。
        expiresAt: Date.now() + (refreshed.expiresIn ?? 0) * 1000,
        // 刷新响应若未带回 refreshToken，保留原有的——直接写 undefined 会把
        // 可用凭据抹掉。
        refreshToken: refreshed.refreshToken ?? entry.auth.refreshToken,
        refreshExpiresAt: Date.now() + (refreshed.refreshExpiresIn ?? 0) * 1000,
        domain: refreshed.domain,
      },
    }
    // 代际变化 = 期间发生过切换/删除/登出。此时**绝不回写**：`storage` 是刷新
    // 开始前的快照，整份写回会把已删除的账号复活、把 activeId 改回旧值，
    // 或撤销一次登出。刷新结果只用于本次请求的凭据。
    if (startedAt !== this.generation) {
      this.logger?.warn?.('dsh-codebuddy: discarded a session refresh that finished after the account set changed')
      return this.identityOf(refreshedEntry)
    }
    const next: CodeBuddyStorage = {
      activeId: storage.activeId,
      accounts: storage.accounts.map(candidate => candidate.id === entry.id ? refreshedEntry : candidate),
    }
    this.storage = next
    // 旧 token 下读到的目录仍然有效，但下面的写入可能失败，导致下一个进程拿
    // 到陈旧 token；目录重读代价很小，所以直接丢弃而不是去推理各种情况。
    this.catalog = undefined
    try {
      await saveStorage(next)
    } catch (error) {
      // 即使未能持久化，刷新出的 token 对本进程依然可用；让请求失败会把一个
      // 存储问题变成一次服务中断。
      this.logger?.warn('dsh-codebuddy: refreshed the session but could not persist it')
      this.logger?.warn(error)
    }
    return this.identityOf(refreshedEntry)
  }

  /**
   * 每个已认证的 CodeBuddy 请求都会携带的请求头。
   * @returns 身份请求头；必要时会先刷新会话。
   */
  async authHeaders(): Promise<Record<string, string>> {
    const identity = await this.identity()
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${identity.accessToken}`,
      'X-Domain': identity.domain,
      'X-User-Id': identity.uid,
    }
    if (identity.enterpriseId !== undefined) headers['X-Enterprise-Id'] = identity.enterpriseId
    return headers
  }

  /**
   * 当前**活动账号**的 OpenAI 兼容聊天基址（`<entry endpoint>/v2`）；未存储
   * 任何凭据时为 `undefined`——调用方随即回退到其配置的默认值。
   * @returns 聊天基址 URL；未登录时为 `undefined`。
   */
  chatBase(): string | undefined {
    return this.storage !== undefined ? `${resolveEntryEndpoint(activeEntry(this.storage))}/v2` : undefined
  }

  /**
   * 当前**活动账号**的客户端身份（`cli` 或 `workbuddy`）。
   *
   * 请求要带哪个客户端的标识与版本，取决于**这个账号是用哪个客户端登录的**，
   * 而不是插件级的默认值。用 CLI 标识发 WorkBuddy 账号的请求，服务端仍会受理
   * （实测三种组合都返回 200），但会把流量**归因到错误的客户端**——客户端侧的
   * 用量/统计会记错，服务端若按客户端做策略也会判错。
   *
   * 与 {@link chatBase} 不同的一点：这里**自己做一次读盘**，不依赖调用方先通过
   * `authHeaders()` 把 `this.storage` 填好。原先两者都读内存态，导致结果取决于
   * 调用顺序（测试里直接调用就会拿到 `undefined`）——而「标识必须跟账号一致」是
   * 正确性要求，不该由调用顺序决定。
   * @returns 客户端 id；未登录时为 `undefined`（调用方回退到默认）。
   */
  activeClient(): CodeBuddyClientId | undefined {
    const storage = this.storage
    if (storage !== undefined) return normalizeClientId(activeEntry(storage).client)
    return undefined
  }

  /**
   * 当前活动账号应声明的客户端**版本**。
   *
   * 与 `activeClient()` 配套：版本必须跟着客户端走（CLI 是 `2.148.0`、WorkBuddy
   * 是 `5.5.6`），两者都不随会话随机化——服务端以此把请求归因到具体客户端版本。
   * @returns 版本号；未登录时为 `undefined`。
   */
  activeClientVersion(): string | undefined {
    const client = this.activeClient()
    return client === undefined ? undefined : CODEBUDDY_CLIENT_VERSIONS[client]
  }

  /**
   * 此刻能够接管流量的账号：凭据已存储且 refresh token 尚未过期。顺序跟随
   * 存储的花名册，因此调用方的第一个候选就是最近添加的备用账号。
   * @returns 候选账号条目；未登录时为 `undefined`。
   */
  async failoverCandidates(): Promise<readonly CodeBuddyAccountEntry[] | undefined> {
    const storage = await loadStorage()
    if (storage === undefined) return undefined
    const now = Date.now()
    return storage.accounts.filter(entry => entry.auth.refreshExpiresAt > now)
  }

  /**
   * 凭据文档中的账号总数。
   *
   * 供 adapter 决定内层尝试上限：内层语义是「每个账号试一次」，上限因此天然由
   * 账号数决定，不写死魔数。无文档时返回 1（按「只有当前账号」处理）。
   */
  async accountCount(): Promise<number> {
    const storage = await loadStorage()
    return storage === undefined ? 1 : Math.max(1, storage.accounts.length)
  }

  /**
   * 单个账号的剩余额度百分比，针对其自身端点探测：跨合计计量窗口取
   * 100 − 已用百分比；meter 平面不可达或没有返回可用数据时为 `undefined`。
   * 探测失败不等于额度判决——该账号仍是候选。
   * @param entry - 要探测的账号。
   * @param signal - 可选取消。
   */
  private async remainingPercentOf(entry: CodeBuddyAccountEntry, signal?: AbortSignal): Promise<number | undefined> {
    // 走统一探测缓存：与面板共享同一份快照，避免「面板说还剩 60%，策略却判不足」。
    const result = await this.probes.probeAccount(
      entry.id,
      resolveEntryEndpoint(entry),
      this.identityOf(entry),
      signal === undefined ? {} : { signal },
    )
    return result.remainingPct
  }

  /**
   * 主动故障转移：由自动切换周期（设置开关 + 用量轮询）调用。探测所有非活动、
   * 未过期的账号，当活动账号的剩余百分比跌破 `thresholdPct` 时，切换到剩余
   * 额度最多的那一个。探测失败的账号会被跳过而不是受罚；没有候选能胜过阈值时
   * 活动账号保持不动——面对真实的额度拒绝，adapter 的被动故障转移仍是最后
   * 一道防线。
   * @param thresholdPct - 活动账号的剩余额度低于该百分比（0–100）即切换。
   * @param signal - 探测的可选取消。
   * @returns 接管的账号名；未发生切换时为 `undefined`（尚未跌破阈值、没有候选、
   *   或所有探测都失败）。
   */
  async failoverIfBelowThreshold(
    thresholdPct: number,
    signal?: AbortSignal,
  ): Promise<{ from: string, to: string, remaining: number } | undefined> {
    const storage = await loadStorage()
    if (storage === undefined || storage.accounts.length < 2) return undefined
    const active = activeEntry(storage)

    // 探测**全部**账号后交给纯函数决策：把「取数」与「判断」分开，判断规则
    // 因此可以单独测（见 switch-policy.ts 与 tests/switch-policy.spec.ts）。
    //
    // 这里一次性探测所有账号（原先只探测到第一个更优的就停）是为了让候选排序
    // 拿到完整数据——多探几次的代价远小于切错账号。
    const candidates: SwitchCandidate[] = []
    for (const entry of storage.accounts) {
      const credentialValid = entry.auth.refreshExpiresAt > Date.now()
      // 凭据已失效的账号不必探测额度（既不能选中，也不该浪费一次请求）。
      const remainingPct = credentialValid
        ? await this.remainingPercentOf(entry, signal)
        : undefined
      candidates.push({
        id: entry.id,
        nickname: entry.account.nickname,
        credentialValid,
        ...remainingPct === undefined ? {} : { remainingPct },
      })
    }

    const decision = decideProactiveTarget({
      candidates,
      activeId: active.id,
      thresholdPct,
      now: Date.now(),
      activeRequestCount: this.activeRequestCount,
      minGapPct: MIN_SWITCH_GAIN_PCT,
      candidateMinRemainingPct: CANDIDATE_MIN_REMAINING_PCT,
    })
    if (decision.kind === 'stay') {
      // 说明「为什么没切」——此前只能看到「没切换」，排查时缺少依据。
      this.logger?.warn(`dsh-codebuddy: 未切换账号：${decision.reason}`)
      return undefined
    }

    /**
     * 带 CAS 切换：探测期间当前账号可能已被别的路径改掉（例如用户在面板里手动
     * 切了、或并发的被动切换生效了）。不匹配时放弃并让调用方下一轮重新决策，
     * 避免「拿着过期状态把账号切回去」。
     */
    const applied = await this.switchTo(decision.targetId, active.id)
    if (!applied) return undefined
    return {
      from: active.account.nickname,
      to: decision.targetNickname,
      remaining: decision.remainingPct ?? 0,
    }
  }

  /**
   * 把一个已存储的账号置为活动账号并持久化切换。
   * @param id - 本地账号 id。
   * @returns 切换是否生效。
   */
  async switchTo(id: string, expectedActiveId?: string): Promise<boolean> {
    /**
     * 整个「读 → 判断 → 写」必须在同一把锁内完成。
     *
     * 凭据文档是**单个 JSON**（所有账号共处一份），写入点却分散在 session 与
     * auth-service 两处。两个并发写各读一次旧值再各自写回时，后写的那次会整体
     * 覆盖前一次——表现为「刚切过去的账号又变回去」「刚删掉的账号复活」。
     * 同类竞态此前已在 token 刷新路径上真实发生过（见 refresh 的代际守卫）。
     */
    // 走 storage 层的事务：锁在**文档**上，因此与 auth-service 的改名/删除/登录
    // 写入互斥。锁放在本类里只能串行本类的写入，挡不住跨模块竞态。
    let switched = false
    await mutateStorage((current) => {
      if (current === undefined) return undefined
      if (!current.accounts.some(entry => entry.id === id)) return undefined
      /**
       * CAS：调用方若带上「它认为的当前账号」，而实际已被别人改掉，则**放弃**本次
       * 切换而不是覆盖。
       *
       * 挡的是这个序列：请求 A 看到当前是账号 1 → 请求 B 把当前切到账号 2 →
       * 请求 A 拿着旧状态又把当前切回账号 3。放弃后由调用方重新读状态再决策，
       * 保证「最后一次用户操作」获胜。
       */
      if (expectedActiveId !== undefined && current.activeId !== expectedActiveId) {
        return undefined
      }
      if (current.activeId === id) {
        // 已经是目标账号：无需写入，但算作成功。
        switched = true
        return undefined
      }
      switched = true
      return { ...current, activeId: id }
    })
    if (!switched) return false
    // 丢弃内存缓存，让下一个请求重读磁盘，取到新的凭据、端点与目录。
    this.invalidate()
    return true
  }

  /** 当前活动账号的展示信息，供接管通知使用。 */
  async activeAccountSummary(): Promise<{ id: string, nickname: string } | undefined> {
    const storage = await loadStorage()
    if (storage === undefined) return undefined
    const entry = activeEntry(storage)
    return { id: entry.id, nickname: entry.account.nickname }
  }

  /**
   * CodeBuddy 模型目录，短暂缓存并在并发读取者之间共享。
   * @param signal - 底层读取的可选取消。
   * @returns 按服务端顺序排列的目录模型。
   */
  async models(signal?: AbortSignal): Promise<readonly CodeBuddyModel[]> {
    const cached = this.catalog
    if (cached !== undefined && Date.now() - cached.readAt < CATALOG_TTL_MS) {
      return cached.models
    }
    // 目录是**按账号**取的（企业账号与个人账号返回不同集合），因此缓存键必须
    // 含账号 id；再加代际，让切换/删除后不再复用旧账号那次读取。
    const storage = await this.require()
    const key = `${activeEntry(storage).id}@${this.generation}`
    const inFlight = this.catalogRead.get(key)
    if (inFlight !== undefined) return inFlight
    const started = this.readModels(signal)
    this.catalogRead.set(key, started)
    void started.finally(() => {
      if (this.catalogRead.get(key) === started) this.catalogRead.delete(key)
    })
    return started
  }

  private async readModels(signal?: AbortSignal): Promise<readonly CodeBuddyModel[]> {
    const storage = await this.require()
    const endpoint = resolveEntryEndpoint(activeEntry(storage))
    const identity = await this.identity()
    const [config, enterpriseModels] = await Promise.all([
      getConfig(endpoint, identity, signal),
      getEnterpriseModels(endpoint, identity, signal),
    ])
    const personal = config.models.filter(model => typeof model.id === 'string' && model.id.length > 0)
    // 企业自定义模型走独立的控制台端点（个人目录不列出它们）。其容量字段是
    // `maxInputTokens`，因此归一化到列表与解析路径已经在消费的共享拼写
    // `maxAllowedSize` 上。重复的 id 会被丢弃、以个人条目为准，后者携带更丰富的
    // 能力/推理元数据。
    const seen = new Set<string>(personal.map(model => model.id))
    const custom: CodeBuddyModel[] = []
    for (const model of enterpriseModels) {
      if (typeof model.id !== 'string' || model.id.length === 0 || seen.has(model.id)) continue
      // `disabledMultiModel` 标记控制台多模型选择器不提供的模型（例如仅补全的
      // 模型）；官方客户端同样不把它放进选择器。
      if (model.disabledMultiModel === true) continue
      seen.add(model.id)
      custom.push({
        id: model.id,
        name: model.name || model.id,
        ...model.maxInputTokens !== undefined && model.maxInputTokens > 0
          ? { maxAllowedSize: model.maxInputTokens }
          : {},
        ...model.maxOutputTokens !== undefined && model.maxOutputTokens > 0
          ? { maxOutputTokens: model.maxOutputTokens }
          : {},
        ...model.supportsToolCall === undefined ? {} : { supportsToolCall: model.supportsToolCall },
        ...model.supportsImages === undefined ? {} : { supportsImages: model.supportsImages },
      })
    }
    const models = [...personal, ...custom]
    this.catalog = { models, readAt: Date.now() }
    return models
  }

  /**
   * 模型目录；无法读取时返回空列表。
   *
   * 列出模型是设置页上的浏览动作，因此失败必须降级为「没有可展示的内容」，
   * 而不是弄坏页面。请求路径直接使用 {@link models} 并保留真实错误。
   * @param signal - 可选取消。
   * @returns 目录；或空列表。
   */
  async modelsOrEmpty(signal?: AbortSignal): Promise<readonly CodeBuddyModel[]> {
    try {
      return await this.models(signal)
    } catch (error) {
      if (error instanceof NotLoggedInError) return []
      this.logger?.warn('dsh-codebuddy: could not read the model catalog')
      this.logger?.warn(error)
      return []
    }
  }

  /**
   * CodeBuddy 用量/额度快照；无法读取时为 `undefined`。
   *
   * 用量是设置界面上的提示性读取，因此 meter 故障必须降级为「没有可展示的
   * 内容」而不是向上传播：{@link NotLoggedInError} 表现为未登录状态，其余一切
   * 失败（传输、解析、refresh token 过期）在告警后解析为 `undefined`。身份与
   * 聊天请求走同一个单飞刷新解析，因此并发的 meter 读取绝不会把 refresh token
   * 消耗两次。
   * @param signal - 可选取消。
   * @returns 快照；未存储任何凭据或 meter 平面不可达时为 `undefined`。
   */
  async usage(signal?: AbortSignal): Promise<UsageSnapshot | undefined> {
    let identity: CodeBuddyIdentity
    let endpoint: string
    let accountId: string
    try {
      const storage = await this.require()
      const active = activeEntry(storage)
      accountId = active.id
      endpoint = resolveEntryEndpoint(active)
      identity = await this.identity()
    } catch (error) {
      if (error instanceof NotLoggedInError) return undefined
      this.logger?.warn('dsh-codebuddy: could not resolve identity for usage read')
      this.logger?.warn(error)
      return undefined
    }
    // 也走统一缓存：输入框旁的用量指示器与面板/策略读到的应是同一份数据。
    const result = await this.probes.probeAccount(
      accountId,
      endpoint,
      identity,
      signal === undefined ? {} : { signal },
    )
    return result.snapshot
  }
}
