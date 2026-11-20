/**
 * 任务引擎。
 *
 * 对应脚本里 `download_xiaoya_emby` / `__unzip_metadata` 那一整套流程，
 * 但把「进程内阻塞执行 + exit 1」改成「可查询状态的后台任务」：
 * 面板刷新、网络断开、请求超时都不会打断任务，失败后也能拿到原因。
 *
 * 设计约束：
 * - 单任务串行。脚本时代并发执行会互相覆盖 temp 目录，这里显式排队。
 * - 状态落盘。进程重启后任务列表还在，运行中的任务标记为中断而不是永远 running。
 * - 日志环形。长下载会产出大量进度行，只保留最近若干条，避免把磁盘写满。
 */
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import { badRequest, conflict, notFound } from '../http/respond.mjs'
import { extractWithGlue } from '../docker/manager.mjs'
import { embyConfigDir, ensureDirs, mediaRoot, stateDir, tempDir, xiaoyaMediaDir } from '../paths.mjs'
import { resolveMediaDir } from '../trim/media-dir.mjs'

const LOG_LIMIT = 400
const MAX_TASKS_KEPT = 50

/**
 * 各元数据包的最小合理体积。
 *
 * 照上游 `check_metadata_size`：小雅服务在未授权或容器未就绪时，
 * 下载地址会返回一张 HTML 错误页/提示图而不是压缩包。
 * 这些错误页通常只有几十 KB，落在门槛以下，据此可以识破
 * 「下载成功但内容是网页」的假成功。
 */
const MIN_PACKAGE_BYTES = {
  'all.mp4': 30 * 1000 * 1000,
  '115.mp4': 16 * 1000 * 1000,
  '蓝光原盘.mp4': 4_200_000,
  'config.mp4': 3_200_000,
}

/** 任务表：id → 任务对象。 */
const tasks = new Map()
/** 当前运行中的任务 id。 */
let runningId = null
/** 已请求取消的任务 id。 */
const cancelRequests = new Set()

/**
 * 元数据包定义。
 *
 * `target` 决定解压到 `media/xiaoya` 还是 `media/config`；
 * `dirs` 恒为空：所有元数据包统一解压到用户授权的元数据目录，
 * 不再提供「指定目录解压」（该能力已按用户要求下线）。
 */
export const PACKAGES = [
  {
    name: 'all.mp4',
    label: '全量元数据',
    desc: '普通影视分类的整体元数据',
    target: 'xiaoya',
    dirs: [],
  },
  {
    name: '115.mp4',
    label: '115 元数据',
    desc: '115 网盘相关分类元数据',
    target: 'xiaoya',
    dirs: [],
  },
  {
    name: 'config.mp4',
    label: 'Emby 配置包',
    desc: 'Emby 基础配置与相关数据，解压会覆盖现有配置',
    target: 'config',
    dirs: [],
  },
  {
    name: '蓝光原盘.mp4',
    label: '蓝光原盘元数据',
    desc: '蓝光原盘分类元数据',
    target: 'xiaoya',
    dirs: [],
  },
  {
    name: 'json.mp4',
    label: 'JSON 元数据',
    desc: '结构化元数据补充包',
    target: 'xiaoya',
    dirs: [],
  },
  {
    name: 'music.mp4',
    label: '音乐元数据',
    desc: '音乐库元数据',
    target: 'xiaoya',
    dirs: [],
  },
  {
    name: '短剧.mp4',
    label: '短剧元数据',
    desc: '短剧分类元数据',
    target: 'xiaoya',
    dirs: [],
  },
]

const packageByName = new Map(PACKAGES.map(p => [p.name, p]))

const TASK_TYPES = new Set(['download', 'extract', 'download_extract', 'cleanup'])

/** 取消信号：在阶段边界抛出，由执行主体捕获后落成 cancelled。 */
class CancelledError extends Error {}

/* ── 持久化 ───────────────────────────────────────────── */

const tasksFile = () => join(stateDir, 'tasks.json')

/** 从磁盘加载任务列表；上次未结束的任务标记为中断。 */
export function loadTasks() {
  ensureDirs()
  let parsed = []
  try {
    parsed = JSON.parse(readFileSync(tasksFile(), 'utf8'))
  }
  catch {
    // 首次启动没有状态文件，或文件损坏；两种都不应阻止服务启动
    parsed = []
  }
  tasks.clear()
  if (!Array.isArray(parsed)) return
  let changed = false
  for (const task of parsed) {
    if (typeof task?.id !== 'string') continue
    if (!Array.isArray(task.logs)) task.logs = []
    if (task.status === 'running' || task.status === 'pending') {
      // 进程已重启，这些任务不可能还在跑；标成中断而不是留着假的 running
      task.status = 'interrupted'
      task.stage = 'interrupted'
      task.finishedAt = task.finishedAt ?? Date.now()
      task.logs.push(`[${stamp()}] 应用重启，任务被中断`)
      changed = true
    }
    tasks.set(task.id, task)
  }
  // 中断状态必须写回磁盘：否则进程再次崩溃时状态文件里仍是 running，
  // 面板会长期显示「运行中」而实际没有任何任务在跑。
  if (changed) persist()
}

/** 落盘（只保留最近若干条，避免状态文件无限增长）。 */
function persist() {
  ensureDirs()
  const kept = [...tasks.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_TASKS_KEPT)
  writeFileSync(tasksFile(), JSON.stringify(kept, null, 2), { mode: 0o600 })
}

/** 时间戳前缀，便于日志对齐。 */
function stamp() {
  return new Date().toISOString().slice(11, 19)
}

/** 追加环形日志。 */
function log(task, line) {
  task.logs.push(`[${stamp()}] ${line}`)
  if (task.logs.length > LOG_LIMIT) task.logs.splice(0, task.logs.length - LOG_LIMIT)
  task.logSeq = (task.logSeq ?? 0) + 1
  task.updatedAt = Date.now()
}

/** 更新任务字段并落盘。 */
function patch(task, fields) {
  Object.assign(task, fields, { updatedAt: Date.now() })
  persist()
}

/* ── 查询 ─────────────────────────────────────────────── */

/** 去掉日志的摘要视图（列表用）。 */
function summary(task) {
  const { logs, ...rest } = task
  return { ...rest, logCount: logs?.length ?? 0 }
}

/** 任务列表，最新在前。 */
export function listTasks() {
  return [...tasks.values()].sort((a, b) => b.createdAt - a.createdAt).map(summary)
}

/** 单任务详情，支持日志增量读取。 */
export function getTask(id, { logOffset = 0 } = {}) {
  const task = tasks.get(id)
  if (task === undefined) throw notFound('任务不存在', '请刷新任务列表')
  const offset = Number.isInteger(logOffset) && logOffset > 0 ? logOffset : 0
  return { ...summary(task), logs: task.logs.slice(offset), logCursor: offset + task.logs.length }
}

/** 是否有任务在运行。 */
export function hasRunningTask() {
  return runningId !== null
}

/* ── 元数据包状态 ─────────────────────────────────────── */

/** 文件大小；不存在返回 0。 */
function sizeOf(path) {
  try {
    return statSync(path).size
  }
  catch {
    return 0
  }
}

/** 安全列目录。 */
function entries(path) {
  try {
    return readdirSync(path)
  }
  catch {
    return []
  }
}

/**
 * 汇总每个元数据包的本地状态。
 *
 * 刻意区分「下载不完整」：存在 `.part`/`.aria2` 说明上次中断，
 * 此时解压只会得到半成品，必须让用户先决定续传还是删除。
 */
export function packagesStatus() {
  return PACKAGES.map((pkg) => {
    const archive = join(tempDir, pkg.name)
    const size = sizeOf(archive)
    const incomplete = existsSync(`${archive}.part`) || existsSync(`${archive}.aria2`)
    const targetRoot = pkg.target === 'config' ? embyConfigDir : xiaoyaMediaDir
    const extracted = pkg.target === 'config'
      ? entries(targetRoot).length > 0
      : entries(targetRoot).length > 0
    return {
      name: pkg.name,
      label: pkg.label,
      desc: pkg.desc,
      dirs: pkg.dirs,
      target: pkg.target,
      targetPath: targetRoot,
      size,
      downloaded: size > 0,
      incomplete,
      extracted,
    }
  })
}

/* ── 创建与取消 ───────────────────────────────────────── */

/**
 * 创建任务并立即入队执行。
 *
 * @param {{type: string, package: string, dirs?: string[]}} input
 */
export function createTask(input) {
  const { type, package: pkgName } = input ?? {}
  if (!TASK_TYPES.has(type)) {
    throw badRequest('不支持的任务类型', '支持：下载、解压、下载并解压、清理压缩包')
  }
  const pkg = packageByName.get(pkgName)
  if (pkg === undefined) throw badRequest(`未知元数据包：${String(pkgName)}`, '请从列表中选择元数据包')

  if (runningId !== null) {
    const current = tasks.get(runningId)
    throw conflict(
      `已有任务正在运行：${current?.label ?? ''}`,
      '同一时间只允许一个元数据任务，请等待当前任务完成或先取消',
    )
  }

  // 所有下载/解压都落在用户授权的元数据目录；未授权时直接拒绝，
  // 避免任务写到应用自有目录、用户之后找不到文件。
  if (type !== 'cleanup' && resolveMediaDir() === null) {
    throw badRequest(
      '尚未选择元数据目录',
      '请先在页面上方的「元数据目录」中授权一个目录，再执行下载与解压',
    )
  }

  const dirs = Array.isArray(input?.dirs) ? input.dirs.filter(d => typeof d === 'string') : []

  const now = Date.now()
  const task = {
    id: randomUUID(),
    type,
    package: pkg.name,
    label: pkg.label,
    dirs,
    status: 'pending',
    stage: 'queued',
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    speed: 0,
    message: '已加入队列',
    logs: [],
    logSeq: 0,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    finishedAt: null,
  }
  tasks.set(task.id, task)
  persist()
  // 让创建请求先返回，任务在下一个微任务开始，避免请求被长任务拖住
  queueMicrotask(() => {
    void runTask(task)
  })
  return summary(task)
}

/** 请求取消。 */
export function cancelTask(id) {
  const task = tasks.get(id)
  if (task === undefined) throw notFound('任务不存在', '请刷新任务列表')
  if (task.status !== 'running' && task.status !== 'pending') {
    throw conflict('任务已结束，无法取消', '请刷新任务列表')
  }
  cancelRequests.add(id)
  log(task, '收到取消请求，将在当前阶段结束后停止')
  patch(task, { message: '正在取消' })
  return summary(task)
}

/** 删除 temp 下的归档与残留分片，不触碰已解压的媒体目录。 */
function removeArchive(pkgName) {
  const pkg = packageByName.get(pkgName)
  if (pkg === undefined) throw badRequest(`未知元数据包：${pkgName}`, '请从列表中选择元数据包')
  const removed = []
  for (const name of [pkg.name, `${pkg.name}.part`, `${pkg.name}.aria2`]) {
    const path = join(tempDir, name)
    if (existsSync(path)) {
      rmSync(path, { force: true })
      removed.push(name)
    }
  }
  return removed
}

/** 面板手动删除压缩包。 */
export function cleanupArchive(pkgName) {
  if (runningId !== null) throw conflict('有任务正在运行', '请等待任务结束后再删除压缩包')
  return { removed: removeArchive(pkgName) }
}

/* ── 执行 ─────────────────────────────────────────────── */

/** 取消检查点：只在阶段边界检查，避免打断正在写入的文件。 */
function checkpoint(task) {
  if (!cancelRequests.has(task.id)) return
  cancelRequests.delete(task.id)
  throw new CancelledError()
}

/** 执行任务主体。 */
async function runTask(task) {
  runningId = task.id
  patch(task, { status: 'running', stage: 'starting', startedAt: Date.now(), message: '开始执行' })
  try {
    const pkg = packageByName.get(task.package)
    if (pkg === undefined) throw new Error('元数据包定义丢失')
    checkpoint(task)

    if (task.type === 'cleanup') {
      const removed = removeArchive(task.package)
      log(task, `已删除：${removed.join('、') || '无残留文件'}`)
      patch(task, { status: 'succeeded', stage: 'completed', progress: 100, message: '清理完成', finishedAt: Date.now() })
      return
    }

    if (pkg.target === 'config' && task.type !== 'download') {
      log(task, '注意：配置包解压会覆盖现有 Emby 配置目录')
    }

    if (task.type === 'download' || task.type === 'download_extract') {
      await downloadStage(task, pkg)
      checkpoint(task)
    }

    if (task.type !== 'download') {
      await extractStage(task, pkg)
      checkpoint(task)
    }

    log(task, '任务完成')
    patch(task, { status: 'succeeded', stage: 'completed', progress: 100, message: '任务完成', finishedAt: Date.now() })
  }
  catch (error) {
    // 无论成功失败都清掉配置包的临时解压目录，避免残留占用空间
    cleanupConfigStaging()
    if (error instanceof CancelledError) {
      log(task, '任务已取消')
      patch(task, { status: 'cancelled', stage: 'cancelled', message: '任务已取消', finishedAt: Date.now() })
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    log(task, `失败：${message}`)
    patch(task, { status: 'failed', stage: 'failed', message, finishedAt: Date.now() })
  }
  finally {
    runningId = null
    persist()
  }
}

/**
 * 下载阶段。
 *
 * 用内置 fetch 流式写盘，并按 Range 续传：
 * 元数据动辄数 GB，断线重下对用户不可接受。
 */
async function downloadStage(task, pkg) {
  const archive = join(tempDir, pkg.name)
  const partial = `${archive}.part`

  if (existsSync(archive)) {
    log(task, '压缩包已存在，跳过下载')
    patch(task, { stage: 'downloaded', progress: 100, message: '压缩包已存在' })
    return
  }

  const url = `${alistBaseUrl()}/d/${encodeURIComponent('元数据')}/${encodeURIComponent(pkg.name)}`
  log(task, `下载地址：${url}`)

  const existing = sizeOf(partial)
  const headers = existing > 0 ? { Range: `bytes=${existing}-` } : {}
  if (existing > 0) log(task, `从 ${existing} 字节续传`)

  const response = await fetch(url, { headers, redirect: 'follow' })
  if (!response.ok && response.status !== 206) {
    throw new Error(`下载失败（HTTP ${response.status}），请确认小雅服务已启动且账号授权有效`)
  }
  if (response.body === null) throw new Error('下载响应为空，请检查小雅服务状态')

  /**
   * 下载前先按响应头判断：体积明显偏小就不必白下。
   *
   * 小雅未就绪时返回的是 HTML 页面，content-length 只有几十 KB。
   */
  const expectLength = Number(response.headers.get('content-length') ?? 0)
  const minimumBytes = MIN_PACKAGE_BYTES[pkg.name]
  if (minimumBytes !== undefined && expectLength > 0 && expectLength < minimumBytes) {
    throw new Error(
      `下载地址返回的内容只有 ${formatBytes(expectLength)}，远小于正常的 ${formatBytes(minimumBytes)}。`
      + '实际返回的是错误页或提示图（不是压缩包），通常因小雅容器尚未就绪或账号授权失效。'
      + '请先到「小雅服务」确认容器状态与账号授权，等容器就绪后重试',
    )
  }

  const total = existing + Number(response.headers.get('content-length') ?? 0)
  patch(task, { stage: 'downloading', totalBytes: total })

  // 拿到真实大小后再校验一次剩余空间。
  // 创建任务时的 300G 是上游脚本沿用的粗粒度门槛，但单个包的实际大小
  // 只有响应头才知道；这里按「剩余空间要够装下整个包并留出解压余量」再判一次，
  // 避免下载到 99% 才因空间不足失败。
  if (!isDev && total > 0) {
    const free = freeBytes()
    // 解压后的体积通常是压缩包的数倍，按 2 倍预留
    const needed = Math.max(total, total * 2 - existing)
    if (free !== null && free < needed) {
      throw new Error(
        `剩余空间不足：需要约 ${formatBytes(needed)}（含解压余量），当前仅 ${formatBytes(free)}。`
        + '请清理空间后重试',
      )
    }
  }

  const sink = createWriteStream(partial, { flags: existing > 0 ? 'a' : 'w' })
  let received = existing
  let tickAt = Date.now()
  let tickBytes = received

  try {
    for await (const chunk of response.body) {
      // 下载过程中不中断，只在块之间响应取消，保证落盘内容连续
      if (cancelRequests.has(task.id)) break
      sink.write(chunk)
      received += chunk.length
      const now = Date.now()
      if (now - tickAt >= 1000) {
        patch(task, {
          downloadedBytes: received,
          totalBytes: total,
          speed: Math.round(((received - tickBytes) * 1000) / (now - tickAt)),
          progress: total > 0 ? Math.min(99, Math.round((received / total) * 100)) : 0,
        })
        tickAt = now
        tickBytes = received
      }
    }
  }
  finally {
    await new Promise(resolve => sink.end(resolve))
  }

  checkpoint(task)

  if (total > 0 && received < total) {
    throw new Error(`下载不完整：已获取 ${received} / ${total} 字节，可稍后重试续传`)
  }

  /**
   * 体积门槛：挡掉「下载到的是网页」这种假成功。
   *
   * 那种情况 HTTP 状态是 200、字节数也收得完整，只有体积能识破。
   */
  const minimum = MIN_PACKAGE_BYTES[pkg.name]
  if (minimum !== undefined && received < minimum) {
    rmSync(partial, { force: true })
    throw new Error(
      `下载内容异常：${pkg.name} 只有 ${formatBytes(received)}，`
      + `远小于正常的 ${formatBytes(minimum)}。`
      + '实际拿到的是错误页或提示图而非压缩包，通常因小雅容器尚未就绪或账号授权失效。'
      + '请确认「小雅服务」运行正常且账号授权有效后重新下载',
    )
  }

  renameSync(partial, archive)
  log(task, `下载完成：${received} 字节`)
  patch(task, { stage: 'downloaded', progress: 100, speed: 0, downloadedBytes: received, message: '下载完成' })
}

/** 小雅服务地址：容器固定映射 5678，可被环境变量覆盖以便调试。 */
function alistBaseUrl() {
  return process.env.XIAOYA_ALIST_URL ?? 'http://127.0.0.1:5678'
}

/** 解压阶段。 */
async function extractStage(task, pkg) {
  const archive = join(tempDir, pkg.name)
  if (!existsSync(archive)) throw new Error('压缩包不存在，请先下载')
  if (existsSync(`${archive}.aria2`) || existsSync(`${archive}.part`)) {
    throw new Error('检测到未完成的下载文件，请先续传完成或删除后重新下载')
  }

  /**
   * 选解压方式：宿主机有 7z 就用它，否则回退到官方 glue 容器。
   *
   * 上游脚本的默认路径就是容器：拉 xiaoyaliu/glue 跑 7z，
   * 而不是要求用户额外装 p7zip。之前只找宿主机 7z，
   * 飞牛默认不带 p7zip，于是解压必然失败并报「未找到 7z」。
   */
  const sevenZip = findSevenZip()

  const targetRoot = pkg.target === 'config' ? embyConfigDir : xiaoyaMediaDir
  mkdirSync(targetRoot, { recursive: true })

  // 所有包都解压到元数据目录根，目标目录已由 targetRootFor 决定
  const selected = []
  const batches = selected.length > 0 ? selected : [null]

  let done = 0
  for (const dir of batches) {
    checkpoint(task)
    const label = dir === null ? '全部目录' : dir
    log(task, `解压 ${pkg.name} → ${label}`)
    patch(task, {
      stage: 'extracting',
      progress: Math.round((done / batches.length) * 100),
      message: `正在解压：${label}`,
    })
    if (sevenZip !== null) {
      await runSevenZip(sevenZip, archive, targetRoot, dir, task)
    }
    else {
      // 宿主机没有 7z：用官方 glue 容器解压，与上游脚本的默认路径一致。
      // 容器内自带 7z，用户不需要额外装 p7zip。
      await extractWithGlueContainer({ archive, mediaRoot, workdir: targetRoot, member: dir, task })
    }
    done += 1
    patch(task, { progress: Math.round((done / batches.length) * 100) })
  }

  log(task, `解压完成 → ${targetRoot}`)
  patch(task, { stage: 'extracted', progress: 100, message: '解压完成' })
}

/** 清理配置包的临时解压目录（失败或取消时调用）。 */
function cleanupConfigStaging() {
  const staging = join(mediaRoot, '.config-staging')
  if (existsSync(staging)) {
    try {
      rmSync(staging, { recursive: true, force: true })
    }
    catch {
      // 清理失败不影响任务结论；下次解压开始时会再试一次
    }
  }
}

/**
 * 用官方 glue 容器解压。
 *
 * 容器只挂载 mediaRoot 到 /media，因此要先把「宿主机目标目录」
 * 换算成「容器内相对路径」。
 *
 * @param {object} options 参数
 * @param {string} options.archive 压缩包绝对路径
 * @param {string} options.mediaRoot 媒体根目录
 * @param {string} options.workdir 解压目标根（宿主机路径）
 * @param {string|null} options.member 成员过滤
 * @param {object} options.task 任务对象
 */
async function extractWithGlueContainer({ archive, mediaRoot: root, workdir, member, task }) {
  const relTarget = relative(root, workdir)
  if (relTarget.startsWith('..') || isAbsolute(relTarget)) {
    throw new Error('解压目标不在媒体目录内，无法用容器解压')
  }

  log(task, `宿主机没有 7z，改用官方 glue 容器解压（目标 /media/${relTarget || '.'}）`)

  const result = await extractWithGlue({
    archive,
    mediaRoot: root,
    workdir: relTarget,
    member,
  })

  if (result.code !== 0) {
    const detail = firstLine(result.stderr) || firstLine(result.stdout) || `退出码 ${result.code}`
    throw new Error(`容器解压失败：${detail}`)
  }
}

/** 取文本首行，用于把容器报错压缩成一句。 */
function firstLine(text) {
  const line = String(text ?? '').split('\n').map(item => item.trim()).find(item => item !== '')
  return line ?? ''
}

/** 查找 7z 可执行文件。 */
function findSevenZip() {
  const names = ['7z', '7zz', '7za', '7zr']
  for (const dir of ['/usr/bin', '/usr/local/bin', '/bin']) {
    for (const name of names) {
      const path = join(dir, name)
      if (existsSync(path)) return path
    }
  }
  return null
}

/**
 * 执行 7z。
 *
 * 参数以数组传递，路径含空格或中文时不会被 shell 拆开。
 * 输出按行并入任务日志，便于失败时定位是哪个成员出错。
 */
function runSevenZip(binary, archive, targetRoot, dir, task) {
  return new Promise((resolve, reject) => {
    const args = ['x', '-aoa', '-y', '-mmt=16', archive, `-o${targetRoot}`]
    if (dir !== null) args.push(dir)

    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const onData = (chunk) => {
      const text = chunk.toString()
      // 7z 正常输出极多，只记录关键行，避免日志被刷屏
      for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (/^(Error|ERROR|Cannot|No space|Disk full)/.test(trimmed)) log(task, trimmed)
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('error', error => reject(new Error(`无法执行 ${binary}：${error.message}`)))
    child.on('close', code => (code === 0 ? resolve() : reject(new Error(`7z 退出码 ${code}，可能是磁盘空间不足或压缩包损坏`))))
  })
}
