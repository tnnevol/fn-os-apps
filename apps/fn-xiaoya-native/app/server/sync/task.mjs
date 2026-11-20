/**
 * 元数据同步任务。
 *
 * 与 tasks/engine.mjs（元数据包下载解压）分开：
 * 那套是「整包下载 + 解压」，这套是「按文件增量同步」，
 * 目标目录、进度口径、并发模型都不同，混在一起会让状态机难以维护。
 *
 * 但两者共用同一个串行约束：同一时间只跑一个重任务，
 * 否则两条路径同时写媒体目录，用户很难判断是哪边在动。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { badRequest, conflict, notFound } from '../http/respond.mjs'
import { stateDir } from '../paths.mjs'
import { resolveMediaDir } from '../trim/media-dir.mjs'
import {
  fetchScanEntries,
  needsSync,
  readSyncConfig,
  syncEntry,
} from './metadata.mjs'

/** 状态文件名。 */
const STATE_NAME = 'sync-state.json'

/** 单次任务最多保留的日志行数。 */
const LOG_LIMIT = 300

/** 当前运行中的同步任务；null 表示空闲。 */
let running = null

/** 提供的任务状态。 */
function statePath() {
  return join(stateDir, STATE_NAME)
}

/** 读取最近一次结果（供面板展示）。 */
export function readSyncState() {
  try {
    const raw = JSON.parse(readFileSync(statePath(), 'utf8'))
    return {
      status: raw?.status ?? 'idle',
      startedAt: raw?.startedAt ?? null,
      finishedAt: raw?.finishedAt ?? null,
      total: raw?.total ?? 0,
      done: raw?.done ?? 0,
      downloaded: raw?.downloaded ?? 0,
      skipped: raw?.skipped ?? 0,
      failed: raw?.failed ?? 0,
      message: raw?.message ?? '',
      logs: Array.isArray(raw?.logs) ? raw.logs : [],
    }
  }
  catch {
    return {
      status: 'idle',
      startedAt: null,
      finishedAt: null,
      total: 0,
      done: 0,
      downloaded: 0,
      skipped: 0,
      failed: 0,
      message: '',
      logs: [],
    }
  }
}

/** 写入状态。 */
function writeState(patch) {
  mkdirSync(stateDir, { recursive: true })
  const next = { ...readSyncState(), ...patch }
  writeFileSync(statePath(), JSON.stringify(next, null, 2), { mode: 0o600 })
  return next
}

/** 追加日志（环形）。 */
function log(line) {
  const state = readSyncState()
  const logs = [...state.logs, `[${new Date().toISOString().slice(11, 19)}] ${line}`]
  writeState({ logs: logs.slice(-LOG_LIMIT) })
}

/** 是否有同步任务在跑。 */
export function syncRunning() {
  return running !== null
}

/**
 * 启动一次同步。
 *
 * 立即返回，任务在后台推进；调用方（前端）轮询 readSyncState 获取进度。
 */
export function startSync() {
  if (running !== null) {
    throw conflict('已有同步任务在运行', '请等待当前同步完成，或稍后重试')
  }

  const mediaBase = resolveMediaDir()
  if (mediaBase === null) {
    throw badRequest('尚未配置元数据目录', '请先在「设置 → 常规设置」授权一个元数据目录')
  }

  const config = readSyncConfig()
  if (config.enabled !== true) {
    throw badRequest('元数据同步未启用', '请先在同步设置中开启并保存')
  }
  if (config.paths.length === 0) {
    throw badRequest('没有选择要同步的目录', '请至少勾选一个目录')
  }

  writeState({
    status: 'running',
    startedAt: Date.now(),
    finishedAt: null,
    total: 0,
    done: 0,
    downloaded: 0,
    skipped: 0,
    failed: 0,
    message: '正在拉取线上文件列表',
    logs: [],
  })

  running = 'sync'
  log(`开始同步，目录：${config.paths.join('、')}`)

  // 后台执行，不阻塞 HTTP 响应
  void runSync(mediaBase, config).finally(() => {
    running = null
  })

  return readSyncState()
}

/** 同步主流程。 */
async function runSync(mediaBase, config) {
  try {
    const scan = await fetchScanEntries(mediaBase, config.paths)
    if (!scan.ok) {
      log(`拉取列表失败：${scan.reason}`)
      writeState({ status: 'failed', finishedAt: Date.now(), message: scan.reason })
      return
    }

    const entries = scan.entries
    log(`共发现 ${entries.length} 个条目`)

    // 先整体判断哪些需要下载：让用户尽早看到「实际工作量」
    const pending = entries.filter(entry => needsSync(mediaBase, entry, { nfo: config.nfo }))
    writeState({ total: pending.length })
    log(`需要更新 ${pending.length} 个文件，跳过 ${entries.length - pending.length} 个已同步文件`)

    let done = 0
    let downloaded = 0
    let failed = 0
    writeState({ skipped: entries.length - pending.length })

    // 固定并发，避免对小雅站点造成过大压力
    const queue = [...pending]
    const workers = Array.from({ length: Math.min(config.count, queue.length) }, async () => {
      while (queue.length > 0) {
        const entry = queue.shift()
        if (entry === undefined) return
        try {
          await syncEntry(mediaBase, entry, config)
          downloaded += 1
        }
        catch (error) {
          failed += 1
          log(`下载失败 ${entry.dir}/${entry.name}：${error.message}`)
        }
        done += 1
        // 每 10 个落一次盘，减少写放大又不至于丢太多进度
        if (done % 10 === 0 || done === pending.length) {
          writeState({
            done,
            downloaded,
            failed,
            message: `已处理 ${done}/${pending.length}`,
          })
        }
      }
    })

    await Promise.all(workers)

    log(`同步完成：更新 ${downloaded} 个，失败 ${failed} 个`)
    writeState({
      status: failed > 0 && downloaded === 0 ? 'failed' : 'succeeded',
      finishedAt: Date.now(),
      done,
      downloaded,
      failed,
      message: failed > 0 ? `完成，${failed} 个文件失败` : '同步完成',
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log(`同步异常：${message}`)
    writeState({ status: 'failed', finishedAt: Date.now(), message })
  }
}

/** 供路由读取「上次结果」。 */
export function syncSnapshot() {
  const state = readSyncState()
  return { ...state, running: running !== null }
}

/** 取消/清理：同步本身不中断，仅用于面板判断。 */
export function assertNotRunning() {
  if (running !== null) throw conflict('同步任务运行中', '请等待当前同步结束后再操作')
}

/** 状态文件是否存在（首次运行前为 false）。 */
export function hasSyncState() {
  return existsSync(statePath())
}
