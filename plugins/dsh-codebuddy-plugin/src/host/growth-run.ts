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
}

/**
 * 孤儿 `running` 的判定预算。
 *
 * 单账号最长路径是若干动作 + 4 次 3 秒回读，多账号虽受并发限制但仍在分钟级；
 * 30 分钟足够覆盖最慢的真实路径，又能在宿主重启后很快把按钮解锁。
 */
const STALE_RUN_MS = 30 * 60_000

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

/** 标记一次执行开始。 */
export async function beginGrowthRun(mode: 'all' | 'one', target?: { accountId: string, taskCode: string }): Promise<void> {
  await saveGrowthRunState({
    running: true,
    mode,
    startedAt: Date.now(),
    ...target === undefined ? {} : { accountId: target.accountId, taskCode: target.taskCode },
  })
}

/** 标记一次执行结束，并保留最近一次结果摘要。 */
export async function finishGrowthRun(summary?: string): Promise<void> {
  const previous = await loadGrowthRunState()
  await saveGrowthRunState({
    running: false,
    mode: previous?.mode ?? 'all',
    startedAt: previous?.startedAt ?? Date.now(),
    finishedAt: Date.now(),
    ...previous?.accountId === undefined ? {} : { accountId: previous.accountId },
    ...previous?.taskCode === undefined ? {} : { taskCode: previous.taskCode },
    ...summary === undefined ? {} : { summary },
  })
}
