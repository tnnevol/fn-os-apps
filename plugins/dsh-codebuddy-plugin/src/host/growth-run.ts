/**
 * 成长任务执行的持久化运行状态。
 *
 * 为什么需要落盘：一键/单项执行在宿主侧可能要跑几十秒（报名 → 行为上报 →
 * 有界回读 → 领奖）。前端只把 loading 放在组件 state 里，刷新页面就丢，
 * 按钮会显示成可再次点击，用户会重复触发同一批动作。把「正在跑」这一事实
 * 落到凭据文件旁边（与 auto-* 偏好同一目录、同一权限），刷新后客户端读取
 * 宿主状态即可恢复 loading，直到宿主真正跑完。
 *
 * **权威是进程内的账号锁表，不是磁盘**（见 {@link GrowthRunRegistry}）。改成
 * 按账号互斥之后，同一时刻可能有多轮并行（账号 A 的单项 + 账号 B 的一键完成），
 * 而磁盘上只有一个 `GrowthRunState`——单份磁盘快照表达不了「A、B 在跑、C 空闲」。
 * 因此：
 *  - **进程内**：锁表是实时事实，`growthRunStatus` 直接读它；
 *  - **磁盘**：只在 begin/append/finish 时写入一份快照，用于**进程重启后**
 *    恢复（以及保留日志供「查看日志」回看）。
 *
 * 存档只在宿主进程内存活时可信：宿主中途重启会留下 `running: true` 的孤儿
 * 状态，因此读取时对超过预算的 running 直接判定为已结束，避免按钮永久
 * 卡在 loading。
 *
 * @module dsh-codebuddy/growth-run
 */

import { promises as fs } from 'node:fs'
import { dirname } from 'node:path'
import { randomBytes } from 'node:crypto'
import { getStoragePath } from './storage.ts'
import { SerialQueue } from './concurrency.ts'

/** 日志行：一条任务处理结果。 */
export interface GrowthRunLogEntry {
  /** 记录时刻（epoch 毫秒）。 */
  at: number
  /** 账号展示名（备注名优先），让人能分辨是哪个号的哪条任务。 */
  account: string
  /** 任务 code。 */
  code: string
  /** 处理结果；与 `GrowthRunItem.status` 同一套取值。 */
  status: string
  /** 补充说明：奖励数量、失败原因、不可自动化的理由等。 */
  message?: string
  /**
   * 进度（可选，与 `target` 成对）。
   *
   * 客户端据此区分 `pending` 的两种含义：**零进度＝还没开始（红）**、
   * **有进度＝做了一半（黄）**。与具体任务无关的日志（账号级、流程级）不填。
   */
  current?: number
  /** 进度目标。 */
  target?: number
}

/** 一次成长任务执行的运行状态。 */
export interface GrowthRunState {
  running: boolean
  mode: 'all' | 'one'
  /** `mode: 'one'` 时的目标账号本地 id。 */
  accountId?: string
  /** `mode: 'one'` 时的目标任务 code。 */
  taskCode?: string
  /**
   * 当前正在执行成长任务的账号本地 id 集合。
   *
   * 为什么需要它（而不是继续用单个 `accountId`）：宿主对成长任务按账号互斥后，
   * 不同账号可以并行执行；界面要按账号决定「谁在跑」。只知道一个目标账号
   * 无法表达「A、B 在跑、C 空闲」，而禁用范围恰恰以账号为界
   * （在跑账号的按钮禁用，其他账号保持可点）。
   *
   * 进程内以锁表为准（见 {@link GrowthRunRegistry}）；磁盘上这份快照用于
   * 刷新页面与进程重启后的恢复。
   */
  accountIds?: string[]
  /**
   * 本轮中**单账号单项任务**的在跑明细，键为账号 id。
   *
   * 为什么比 `accountIds` 多一层：单项执行时界面只该点亮那一个任务行，
   * 而同一账号的其它任务按钮应保持可用。只知道「这个账号在跑」会把它整行
   * 都点亮，或反过来什么都不点亮。全账号执行不填（那时逐个任务点亮）。
   */
  taskCodes?: Record<string, string>
  /** 开始时间（epoch 毫秒）；用于判定孤儿状态。 */
  startedAt: number
  /** 结束时间（epoch 毫秒）；`running: false` 时有值。 */
  finishedAt?: number
  /** 最近一次执行的逐账号结果，供刷新后回看。 */
  summary?: string
  /**
   * 本轮的逐条执行日志（按发生顺序追加）。
   *
   * 为什么不只留 `summary`：客户端要在抽屉里展示「具体执行了什么」，
   * 而逐条结果原先只在整轮结束时一次性返回、过程不可见。每条处理完就追加并落盘，
   * 客户端轮询 `growthRunStatus` 即可拿到最新进度。
   *
   * 保留策略见 {@link GrowthRunState.previousLog}：**只留「本次 + 上次」两轮**，
   * 不做按条数裁剪——裁剪会把最早账号的日志悄悄丢掉，而这两轮已是有界数量。
   */
  log?: GrowthRunLogEntry[]
  /**
   * 上一轮的日志（只保留一轮）。
   *
   * 新一轮开始时把当时的 `log` 整体降级到这里，更早的那份直接丢弃。因此文件里
   * 最多只有两轮日志，既能让「查看日志」在跑新一轮时仍看得到上一次的结果，
   * 又不会无限增长。
   */
  previousLog?: GrowthRunLogEntry[]
}

/**
 * 孤儿 `running` 的判定预算。
 *
 * 单账号最长路径是若干动作 + 4 次 3 秒回读，多账号虽受并发限制但仍在分钟级；
 * 30 分钟足够覆盖最慢的真实路径，又能在宿主重启后很快把按钮解锁。
 */
const STALE_RUN_MS = 30 * 60_000

/**
 * 日志保留轮数：本次与上次，共两轮。
 *
 * 不用「条数上限 + 丢最早」是因为那个策略会**静默吃掉早期账号的日志**：
 * 新账号首次执行时 4 个账号 × 16 个任务可达 370+ 行，按条裁剪会把最早的
 * 「开始执行」以及第一、二个账号的整段记录删掉，用户既看不到也毫不知情。
 * 按**轮次**保留则是有界且不丢内容的：新一轮开始时把上一轮整体降级到
 * `previousLog`，更早的那份丢弃。
 */
export const RETAINED_LOG_ROUNDS = 2

/** 运行状态文件路径（与凭据同一目录，随 DSH_HOME 迁移）。 */
function growthRunStatePath(): string {
  return `${getStoragePath()}.growth-run.json`
}

/**
 * 读取运行状态。
 * @returns 状态；文件缺失/损坏时为 `undefined`。
 */
export async function loadGrowthRunState(): Promise<GrowthRunState | undefined> {
  try {
    const raw = await fs.readFile(growthRunStatePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<GrowthRunState>
    if (typeof parsed?.running !== 'boolean' || typeof parsed.startedAt !== 'number') return undefined
    const state = parsed as GrowthRunState
    // 宿主重启后的孤儿 running：按已结束处理并落盘，否则按钮永远解不开。
    if (state.running && Date.now() - state.startedAt > STALE_RUN_MS) {
      const settled: GrowthRunState = { ...state, running: false, finishedAt: Date.now(), accountIds: [], taskCodes: {} }
      await saveGrowthRunState(settled)
      return settled
    }
    return state
  } catch {
    return undefined
  }
}

/** 原子地写入运行状态。 */
export async function saveGrowthRunState(state: GrowthRunState): Promise<void> {
  const path = growthRunStatePath()
  await fs.mkdir(dirname(path), { recursive: true })
  const temp = `${path}.${randomBytes(6).toString('hex')}.tmp`
  try {
    await fs.writeFile(temp, JSON.stringify(state, null, 2), { encoding: 'utf-8', mode: 0o600 })
    await fs.rename(temp, path)
  } catch (error) {
    await fs.unlink(temp).catch(() => {})
    throw error
  }
}

/**
 * 追加日志的串行队列。
 *
 * 必须串行：账号可并发执行，多个账号的日志会同时追加。「读-改-写」并发执行会
 * **互相覆盖**（后写的那次以自己读到的旧值为基础，把别人刚追加的行冲掉），
 * 表现为抽屉里日志随机缺失。锁放在这里而不是调用方，因为写入点分散在多处。
 */
const logQueue = new SerialQueue()

/**
 * 进程内的「哪些账号正在跑成长任务」登记表。
 *
 * 这是运行态的**权威**来源：磁盘快照只在 begin/append/finish 时写，两个账号
 * 并行时后写的那次会覆盖前一次，「磁盘上只剩最后一个账号」并不代表其他账号
 * 已经跑完。界面判断禁用范围必须看这张表（经 `growthRunStatus` 暴露），
 * 否则会出现「B 还在跑，但 A 结束时把状态写成了空闲」。
 */
class GrowthRunRegistry {
  /** 账号 id → 正在跑的任务明细（`taskCode` 为空表示全量执行该账号）。 */
  private readonly inFlight = new Map<string, { taskCode?: string }>()
  /** 本轮开始时刻（用于日志轮次判断与孤儿状态）。 */
  private roundStartedAt: number | undefined

  /** 该账号是否正在执行成长任务。 */
  has(accountId: string): boolean {
    return this.inFlight.has(accountId)
  }

  /** 登记：该账号开始执行（`taskCode` 为空表示执行全部可自动化任务）。 */
  add(accountId: string, taskCode?: string): void {
    this.inFlight.set(accountId, taskCode === undefined ? {} : { taskCode })
    this.roundStartedAt ??= Date.now()
  }

  /** 注销：该账号执行结束。 */
  remove(accountId: string): void {
    this.inFlight.delete(accountId)
    if (this.inFlight.size === 0) this.roundStartedAt = undefined
  }

  /** 当前在跑的全部账号 id（稳定顺序，便于测试与展示）。 */
  ids(): string[] {
    return [...this.inFlight.keys()]
  }

  /** 当前单项执行的账号 → 任务 code 映射。 */
  taskCodes(): Record<string, string> {
    const out: Record<string, string> = {}
    for (const [accountId, running] of this.inFlight) {
      if (running.taskCode !== undefined) out[accountId] = running.taskCode
    }
    return out
  }

  /** 是否有任何账号在跑。 */
  get running(): boolean {
    return this.inFlight.size > 0
  }

  /** 本轮是否已经在跑（用于日志轮次判断）。 */
  get startedAt(): number | undefined {
    return this.roundStartedAt
  }
}

/** 进程内运行态登记表（供 auth-service 与状态查询共用）。 */
export const growthRunRegistry = new GrowthRunRegistry()

/**
 * 标记一次执行开始。
 *
 * 日志按**轮次**滚动：把上一轮的 `log` 降级为 `previousLog`（原有的
 * `previousLog` 直接丢弃），再把本轮 `log` 清空。这样抽屉在跑新一轮时仍能回看
 * 上一次的结果，同时文件里最多只留两轮。
 *
 * @param mode - 本轮是单账号（`one`）还是全账号（`all`）。
 * @param target - `mode: 'one'` 时的目标账号与任务。
 */
export async function beginGrowthRun(mode: 'all' | 'one', target?: { accountId: string, taskCode: string }): Promise<void> {
  /**
   * 只有本轮的**第一个**账号开始时才滚动日志轮次。
   *
   * 账号可以并行：若每个账号开始时都调一次 `beginGrowthRun`（并滚动日志），
   * 第二个账号会把第一个账号刚写的整轮日志降级/清空，抽屉里只剩最后开始的那个
   * 账号的记录（表现为「日志随机缺失」）。判据取**在途账号数 ≤ 1**：
   *  - 0（直接调用本函数的路径与首次开始）或 1（本轮第一个账号）→ 滚动；
   *  - ≥ 2（并行加入的后续账号）→ 只刷新在途集合，不动日志。
   *
   * 在 JS 单线程下 `add()` 与这里的判断之间不会被打断，因此两个账号同时开始时
   * 也只有一个会看到 1。
   */
  const rollRound = growthRunRegistry.ids().length <= 1
  // 必须与追加日志共用同一队列：否则「上一轮最后一条日志还在排队」时，
  // begin 先落盘会把那条日志连同一个陈旧的 log 一起写回来。
  await logQueue.runExclusive(async () => {
    const previous = await loadGrowthRunState()
    await saveGrowthRunState({
      // 这个函数就是「一轮开始」本身，因此 running 恒为 true；真正决定它何时
      // 变回 false 的是 `finishGrowthRun`（以登记表为准，见那里的说明）。
      running: true,
      mode,
      startedAt: previous?.startedAt ?? growthRunRegistry.startedAt ?? Date.now(),
      log: rollRound ? [] : previous?.log ?? [],
      accountIds: growthRunRegistry.ids(),
      taskCodes: growthRunRegistry.taskCodes(),
      // 降级只在滚动时发生；不滚动时保留原有 previousLog，避免把它抹掉。
      ...rollRound
        ? (previous?.log === undefined || previous.log.length === 0 ? {} : { previousLog: previous.log })
        : (previous?.previousLog === undefined ? {} : { previousLog: previous.previousLog }),
      ...target === undefined ? {} : { accountId: target.accountId, taskCode: target.taskCode },
    })
  })
}

/**
 * 追加一条执行日志并落盘。
 *
 * 每条任务处理完就调用，而不是等整轮结束：这样客户端轮询时能逐条看到进度。
 *
 * @param entry - 本条记录（`at` 缺省取当前时刻）。
 */
export async function appendGrowthRunLog(entry: Omit<GrowthRunLogEntry, 'at'> & { at?: number }): Promise<void> {
  await logQueue.runExclusive(async () => {
    const previous = await loadGrowthRunState()
    const base: GrowthRunState = previous ?? {
      running: true,
      mode: 'all',
      startedAt: growthRunRegistry.startedAt ?? Date.now(),
    }
    // 不按条数裁剪：条数策略会静默丢掉早期账号的日志（见 RETAINED_LOG_ROUNDS）。
    // 增长由「每轮开始时滚动到 previousLog」封顶，因此这里是追加即可。
    // 同时在途账号集合以登记表为准刷新：并行的另一账号此刻的状态才是真的。
    // `running` 保持 `base` 的原值：追加日志不是一轮的开始，不能把已经
    // `finish` 过的轮次重新写成在跑。
    await saveGrowthRunState({
      ...base,
      accountIds: growthRunRegistry.ids(),
      taskCodes: growthRunRegistry.taskCodes(),
      log: [...base.log ?? [], { ...entry, at: entry.at ?? Date.now() }],
    })
  })
}

/**
 * 取出目前保留的日志轮次（本次在前，上次在后）。
 *
 * 用 `RETAINED_LOG_ROUNDS` 强制封顶，而不是靠调用方自觉：将来若有人再加第三个
 * 日志数组，这里会自动把它排除，保证落盘与渲染都不会突破两轮。
 *
 * @param state - 宿主状态。
 * @returns 各轮日志；无日志的轮次不出现在结果里。
 */
export function retainedLogRounds(state: Pick<GrowthRunState, 'log' | 'previousLog'>): GrowthRunLogEntry[][] {
  return [state.log, state.previousLog]
    .slice(0, RETAINED_LOG_ROUNDS)
    .filter((round): round is GrowthRunLogEntry[] => round !== undefined && round.length > 0)
}

/**
 * 标记一次执行结束，并保留最近一次结果摘要。
 *
 * 与追加日志共用同一队列：否则「最后一条日志还在排队」时结束标记先落盘，
 * 那条日志会以已结束的状态为基础写回，把 `running: true` 覆盖回去。
 *
 * 在途集合取**登记表**而不是调用方传来的列表：并行执行时，只有登记表知道
 * 此刻还有谁在跑，`finish` 绝不能把别的账号的运行态一起清掉。
 *
 * @param summary - 本轮结果摘要。
 */
export async function finishGrowthRun(summary?: string): Promise<void> {
  await logQueue.runExclusive(async () => {
    const previous = await loadGrowthRunState()
    const remaining = growthRunRegistry.ids()
    await saveGrowthRunState({
      running: growthRunRegistry.running,
      mode: previous?.mode ?? 'all',
      startedAt: previous?.startedAt ?? Date.now(),
      ...growthRunRegistry.running ? {} : { finishedAt: Date.now() },
      accountIds: remaining,
      taskCodes: growthRunRegistry.taskCodes(),
      ...previous?.accountId === undefined ? {} : { accountId: previous.accountId },
      ...previous?.taskCode === undefined ? {} : { taskCode: previous.taskCode },
      ...previous?.log === undefined ? {} : { log: previous.log },
      // 上一轮日志要一起带过去：结束标记是「读-改-写」，漏掉它会把
      // previousLog 从文件里抹掉，用户就再也回看不到再上一次的结果了。
      ...previous?.previousLog === undefined ? {} : { previousLog: previous.previousLog },
      ...summary === undefined ? {} : { summary },
    })
  })
}

/**
 * 合并磁盘快照与进程内在跑集合，得到对外报告的状态。
 *
 * 两个来源各有盲区，必须取并集：
 *  - **磁盘**：进程重启后仍有值（以及日志内容），但只反映最后一次写入；
 *  - **登记表**：进程内的实时事实，但重启即丢。
 *
 * @returns 供 RPC 返回的状态；两者皆空时返回空闲态。
 */
export function mergeGrowthRunState(state: GrowthRunState | undefined): GrowthRunState {
  const accountIds = [...new Set([...(state?.accountIds ?? []), ...growthRunRegistry.ids()])]
  const taskCodes = { ...state?.taskCodes, ...growthRunRegistry.taskCodes() }
  if (state === undefined) {
    return {
      running: growthRunRegistry.running,
      mode: 'all',
      startedAt: growthRunRegistry.startedAt ?? Date.now(),
      accountIds,
      taskCodes,
    }
  }
  return {
    ...state,
    running: state.running || growthRunRegistry.running,
    accountIds,
    taskCodes,
  }
}
