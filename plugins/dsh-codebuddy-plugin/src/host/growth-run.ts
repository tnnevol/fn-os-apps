/**
 * 成长任务执行的持久化运行状态。
 *
 * 为什么需要落盘：一键/单项执行在宿主侧可能要跑几十秒（报名 → 行为上报 →
 * 有界回读 → 领奖）。前端只把 loading 放在组件 state 里，刷新页面就丢，
 * 按钮会显示成可再次点击，用户会重复触发同一批动作。把「正在跑」这一事实
 * 落到凭据文件旁边（与 auto-* 偏好同一目录、同一权限），刷新后客户端读取
 * 宿主状态即可恢复 loading，直到宿主真正跑完。
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
      const settled: GrowthRunState = { ...state, running: false, finishedAt: Date.now() }
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
 * 标记一次执行开始。
 *
 * 日志按**轮次**滚动：把上一轮的 `log` 降级为 `previousLog`（原有的
 * `previousLog` 直接丢弃），再把本轮 `log` 清空。这样抽屉在跑新一轮时仍能回看
 * 上一次的结果，同时文件里最多只留两轮。
 */
export async function beginGrowthRun(mode: 'all' | 'one', target?: { accountId: string, taskCode: string }): Promise<void> {
  // 必须与追加日志共用同一队列：否则「上一轮最后一条日志还在排队」时，
  // begin 先落盘会把那条日志连同一个陈旧的 log 一起写回来。
  await logQueue.runExclusive(async () => {
    const previous = await loadGrowthRunState()
    await saveGrowthRunState({
      running: true,
      mode,
      startedAt: Date.now(),
      log: [],
      ...previous?.log === undefined || previous.log.length === 0 ? {} : { previousLog: previous.log },
      ...target === undefined ? {} : { accountId: target.accountId, taskCode: target.taskCode },
    })
  })
}

/**
 * 追加日志的串行队列。
 *
 * 必须串行：`forEachAccount` 以并发 4 处理账号，多个账号的日志会同时追加。
 * 「读-改-写」并发执行会**互相覆盖**（后写的那次以自己读到的旧值为基础，把
 * 别人刚追加的行冲掉），表现为抽屉里日志随机缺失。锁放在这里而不是调用方，
 * 因为写入点分散在 growthRunAll / growthRunOne 两处。
 */
const logQueue = new SerialQueue()

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
    if (previous === undefined) return
    // 不按条数裁剪：条数策略会静默丢掉早期账号的日志（见 RETAINED_LOG_ROUNDS）。
    // 增长由「每轮开始时滚动到 previousLog」封顶，因此这里是追加即可。
    await saveGrowthRunState({
      ...previous,
      log: [...previous.log ?? [], { ...entry, at: entry.at ?? Date.now() }],
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
 * 那条日志会以已结束的状态为基础写回，把 `running: false` 覆盖回 `true`。
 */
export async function finishGrowthRun(summary?: string): Promise<void> {
  await logQueue.runExclusive(async () => {
    const previous = await loadGrowthRunState()
    await saveGrowthRunState({
      running: false,
      mode: previous?.mode ?? 'all',
      startedAt: previous?.startedAt ?? Date.now(),
      finishedAt: Date.now(),
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
