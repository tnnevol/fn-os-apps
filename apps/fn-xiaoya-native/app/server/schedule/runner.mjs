/**
 * 定时任务调度器。
 *
 * 上游 all_in_one.sh 用一个 cron 容器跑定时重启与元数据同步；这里改为进程内
 * 每 60 秒 tick 一次，避免为此再引入一个伴随容器（应用边界只允许 xiaoya-alist
 * 使用 Docker）。
 *
 * 状态集中在 `state/schedule.json`，与用户配置分离：
 * - 用户配置（目录、strm 替换等）在 sync.json / 各凭据文件里；
 * - 调度只是「什么时候跑」，属于运行状态，清掉它不该影响已配置的内容。
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { readCleanerConfig, runCleaner } from '../alist/cleaner.mjs'
import { readSyncConfig } from '../sync/metadata.mjs'
import { startSync, syncRunning } from '../sync/task.mjs'
import { alistAction } from '../docker/manager.mjs'
import { stateDir } from '../paths.mjs'

/** 115 清理间隔：与上游一致，7 小时一次。 */
const CLEANER_INTERVAL_MS = 7 * 60 * 60 * 1000

/**
 * 上次清理时间。
 *
 * 初始化为「现在」而不是 0：进程刚起来就立刻清一次回收站太激进，
 * 用户重启应用不该触发一次网盘清理。
 */
let lastCleanerRun = Date.now()

/** 当前分钟的稳定标识，用于防止同一分钟重复触发。 */
function minuteKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}`
}

/** 上一次触发的分钟；进程重启后重置，最多导致重启当分钟多跑一次。 */
let lastSyncTick = ''

/** 调度器定时器；null 表示未启动。 */
let timer = null

/** 内存中的调度配置，与 schedule.json 保持同步。 */
let state = {
  restart: { enabled: false, hour: 3, minute: 0 },
  metadata: { enabled: false, weekday: 1, hour: 5, minute: 0 },
}

/** 日志文件路径；与任务日志分开放，便于面板单独读取。 */
function logFile() {
  return join(stateDir, 'schedule.log')
}

/** 追加一行日志，带上本地时间戳。 */
function log(message) {
  try {
    mkdirSync(stateDir, { recursive: true })
    const stamp = new Date().toLocaleString('zh-CN', { hour12: false })
    appendFileSync(logFile(), `[${stamp}] ${message}\n`)
  }
  catch {
    // 日志写不进去不该影响调度本身
  }
}

/** 校验：小时 0-23，分钟 0-59，星期 0-6。 */
function assertRange(value, min, max, label) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw Object.assign(new Error(`${label} 必须是 ${min}-${max} 的整数`), { status: 400 })
  }
}

/**
 * 从 schedule.json 载入调度配置。
 *
 * 文件不存在或损坏时回落到默认值：调度配置坏了不该让整个应用起不来。
 */
export function loadSchedule() {
  const file = join(stateDir, 'schedule.json')
  if (!existsSync(file)) {
    state = {
      restart: { enabled: false, hour: 3, minute: 0 },
      metadata: { enabled: false, weekday: 1, hour: 5, minute: 0 },
    }
    return state
  }
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'))
    state = {
      restart: {
        enabled: parsed?.restart?.enabled === true,
        hour: Number.isInteger(parsed?.restart?.hour) ? parsed.restart.hour : 3,
        minute: Number.isInteger(parsed?.restart?.minute) ? parsed.restart.minute : 0,
      },
      metadata: {
        enabled: parsed?.metadata?.enabled === true,
        weekday: Number.isInteger(parsed?.metadata?.weekday) ? parsed.metadata.weekday : 1,
        hour: Number.isInteger(parsed?.metadata?.hour) ? parsed.metadata.hour : 5,
        minute: Number.isInteger(parsed?.metadata?.minute) ? parsed.metadata.minute : 0,
      },
    }
  }
  catch {
    // 损坏的配置当空处理，不阻塞启动
  }
  return state
}

/** 返回当前调度配置（副本，避免调用方直改内部状态）。 */
export function readSchedule() {
  return {
    restart: { ...state.restart },
    metadata: { ...state.metadata },
  }
}

/**
 * 合并并保存调度配置。
 *
 * 只接受已知字段；数值越界抛 400，由路由层转成用户可读的错误。
 *
 * @param {{restart?: object, metadata?: object}} patch 增量配置
 * @returns {object} 合并后的完整配置
 */
export function writeSchedule(patch) {
  const next = readSchedule()

  if (patch?.restart !== undefined) {
    const r = patch.restart ?? {}
    if (r.enabled !== undefined) next.restart.enabled = r.enabled === true
    if (r.hour !== undefined) {
      assertRange(r.hour, 0, 23, '重启小时')
      next.restart.hour = r.hour
    }
    if (r.minute !== undefined) {
      assertRange(r.minute, 0, 59, '重启分钟')
      next.restart.minute = r.minute
    }
  }

  if (patch?.metadata !== undefined) {
    const m = patch.metadata ?? {}
    if (m.enabled !== undefined) next.metadata.enabled = m.enabled === true
    if (m.weekday !== undefined) {
      assertRange(m.weekday, 0, 6, '同步星期')
      next.metadata.weekday = m.weekday
    }
    if (m.hour !== undefined) {
      assertRange(m.hour, 0, 23, '同步小时')
      next.metadata.hour = m.hour
    }
    if (m.minute !== undefined) {
      assertRange(m.minute, 0, 59, '同步分钟')
      next.metadata.minute = m.minute
    }
  }

  state = next
  mkdirSync(stateDir, { recursive: true })
  writeFileSync(join(stateDir, 'schedule.json'), `${JSON.stringify(next, null, 2)}\n`)
  return readSchedule()
}

/** 重启容器；失败只记日志，不抛出（不该打断 tick）。 */
async function runRestart(now) {
  if (minuteKey(now) === lastRestartTick) return
  lastRestartTick = minuteKey(now)
  log('触发定时重启')
  try {
    await alistAction('restart')
    log('定时重启完成')
  }
  catch (error) {
    log(`定时重启失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

/** 上一次触发重启的分钟，防止同一分钟重复重启。 */
let lastRestartTick = ''

/**
 * 判断当前时刻是否命中调度。
 *
 * tick 每 60 秒跑一次，可能在同一分钟内被调用两次，因此这里只管
 * 「是否命中这一分钟」；防重复由 isScheduleDue 之外的上次执行时间控制
 * （见 lastSyncRunAt）。比 tid 秒级差异不该影响判定。
 *
 * @param {{mode: string, hour: number, minute: number, day: number}} schedule 调度配置
 * @param {Date} now 当前时间
 * @returns {boolean} 是否应在此分钟触发
 */
function isScheduleDue(schedule, now) {
  if (schedule === undefined || schedule.mode === 'off') return false
  if (now.getHours() !== schedule.hour || now.getMinutes() !== schedule.minute) return false

  if (schedule.mode === 'daily') return true
  if (schedule.mode === 'weekly') return now.getDay() === schedule.day
  if (schedule.mode === 'monthly') return now.getDate() === schedule.day
  return false
}

/** 生成可读的调度描述，用于日志。 */
function describeSchedule(schedule) {
  const pad = n => String(n).padStart(2, '0')
  const time = `${pad(schedule.hour)}:${pad(schedule.minute)}`
  if (schedule.mode === 'daily') return `每天 ${time}`
  if (schedule.mode === 'weekly') {
    const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    return `每${names[schedule.day] ?? '?'} ${time}`
  }
  if (schedule.mode === 'monthly') return `每月 ${schedule.day} 日 ${time}`
  return '未启用'
}

/** 每分钟执行一次，检查各定时任务是否到点。 */
async function tick() {
  const now = new Date()
  const { restart } = state

  if (restart.enabled && now.getHours() === restart.hour && now.getMinutes() === restart.minute) {
    await runRestart(now)
  }

  // 115 清理：上游是 7 小时一次，这里按「距上次满 7 小时」触发，
  // 不用固定时刻——用户可能随时启用，固定时刻会等到下一个整点才生效。
  try {
    const { mode } = readCleanerConfig()
    if (mode !== 'off' && Date.now() - lastCleanerRun >= CLEANER_INTERVAL_MS) {
      lastCleanerRun = Date.now()
      const result = await runCleaner(mode)
      log(`115 清理完成（${mode}）：删除 ${result.deleted} 个，清空回收站 ${result.clearedBin ? '是' : '否'}`)
    }
  }
  catch (error) {
    // 清理失败不能影响其它定时任务
    log(`115 清理失败：${error instanceof Error ? error.message : String(error)}`)
  }

  // 元数据同步：配置存在 sync.json 里（用户可勾选目录、配置 strm 替换），
  // 这里按调度模式判断是否该跑，具体逻辑交给 sync/task.mjs。
  try {
    const syncConfig = readSyncConfig()
    if (syncConfig.enabled && !syncRunning() && isScheduleDue(syncConfig.schedule, now)
      && lastSyncTick !== minuteKey(now)) {
      // 记下本次命中的分钟：tick 每 60 秒一次，同一分钟内若被调用两次
      // （例如上次 tick 稍有延迟），不能重复触发。
      lastSyncTick = minuteKey(now)
      log(`触发定时元数据同步（${describeSchedule(syncConfig.schedule)}）`)
      startSync()
    }
  }
  catch (error) {
    log(`定时同步失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

/** 启动调度器（幂等）。 */
export function startScheduler() {
  if (timer !== null) return
  loadSchedule()
  timer = setInterval(() => {
    void tick()
  }, 60_000)
  // 不阻止进程退出
  timer.unref?.()
  log('定时任务调度器已启动')
}

/** 供测试重置状态。 */
export function stopScheduler() {
  if (timer !== null) clearInterval(timer)
  timer = null
}

/** 判断调度器是否在运行。 */
export function schedulerRunning() {
  return timer !== null
}

/** 暴露日志文件路径给面板。 */
export function scheduleLogPath() {
  return logFile()
}

/** 日志文件是否已存在（决定面板要不要显示「查看日志」）。 */
export function hasScheduleLog() {
  return existsSync(logFile())
}

/**
 * 读取调度日志末尾若干行。
 *
 * @param {number} tail 返回的最大行数
 * @returns {string[]} 日志行
 */
export function readScheduleLog(tail = 200) {
  const file = logFile()
  if (!existsSync(file)) return []
  const all = readFileSync(file, 'utf8').split('\n').filter(Boolean)
  return all.slice(-Math.max(1, tail))
}
