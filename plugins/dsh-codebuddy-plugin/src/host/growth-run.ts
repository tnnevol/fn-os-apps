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
   * 逐条执行日志（按发生顺序追加）。
   *
   * 为什么不只留 `summary`：客户端要在抽屉里展示「具体执行了什么」，
   * 而逐条结果原先只在整轮结束时一次性返回、过程不可见。每条处理完就追加并落盘，
   * 客户端轮询 `growthRunStatus` 即可拿到最新进度。
   *
   * 有上限（见 {@link MAX_LOG_ENTRIES}）：多账号 × 17 个任务的日志会无限增长，
   * 而这是**运维观察**用的短期记录，不需要长期保留。
   */
  log?: GrowthRunLogEntry[]
}

/**
 * 孤儿 `running` 的判定预算。
 *
 * 单账号最长路径是若干动作 + 4 次 3 秒回读，多账号虽受并发限制但仍在分钟级；
 * 30 分钟足够覆盖最慢的真实路径，又能在宿主重启后很快把按钮解锁。
 */
const STALE_RUN_MS = 30 * 60_000

/**
 * 日志行数上限。
 *
 * 4 个账号 × 17 个可自动化任务 ≈ 68 条，再加上账号级错误就接近 80；留 200 的余量
 * 既能容纳更多账号，又不会让落盘文件无限膨胀。超出后**丢最早的**（保留最近进度，
 * 因为用户看的是「现在跑到哪了」）。
 */
export const MAX_LOG_ENTRIES = 200

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

/** 标记一次执行开始（清空上一轮的日志）。 */
export async function beginGrowthRun(mode: 'all' | 'one', target?: { accountId: string, taskCode: string }): Promise<void> {
  await saveGrowthRunState({
    running: true,
    mode,
    startedAt: Date.now(),
    // 日志按轮次隔离：新一轮开始时清空，否则抽屉会把上一轮的结果混进来。
    log: [],
    ...target === undefined ? {} : { accountId: target.accountId, taskCode: target.taskCode },
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
    const next = [...previous.log ?? [], { ...entry, at: entry.at ?? Date.now() }]
    await saveGrowthRunState({
      ...previous,
      // 超出上限丢最早的：用户关心的是最近进度，保留头部老日志没有价值。
      log: next.length > MAX_LOG_ENTRIES ? next.slice(next.length - MAX_LOG_ENTRIES) : next,
    })
  })
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
      ...summary === undefined ? {} : { summary },
    })
  })
}
