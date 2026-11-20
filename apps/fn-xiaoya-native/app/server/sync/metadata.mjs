/**
 * 元数据同步（对齐 xiaoya_db / solid.py）。
 *
 * 用途：把小雅线上元数据（nfo、图片、strm）增量同步到本地媒体目录。
 * 这是「元数据包下载解压」之外的另一条更新路径：后者是全量包，
 * 前者是按文件增量更新，日常定时跑前者代价太大。
 *
 * ## 关键机制（与 solid.py 一致，不能自行简化）
 *
 * **strm 的内容会被替换**：用户的播放地址前缀（`strm_from`）要改成本地可访问的
 * （`strm_to`），否则播放器拿到的是小雅内部地址。替换后文件大小与线上**必然不同**。
 *
 * 因此判断「这个 strm 是否已同步」不能比较本地文件大小，而是看
 * `<文件名>.<线上大小>.meta` 这个空标记文件是否存在：
 * - 存在 → 该文件已按「线上大小 X」同步过，跳过；
 * - 不存在 → 需要下载；下载并替换成功后写入该 meta。
 *
 * 线上大小一旦变化（文件被更新），meta 文件名随之变化，旧 meta 不匹配 → 自动重新下载。
 * 这就是要用「线上 filesize 入文件名」而不是「本地实际大小」的原因。
 *
 * ## 依赖
 *
 * 只依赖 Node 内置能力（fetch + 正则解析），不引入 Python/bs4，
 * 避免在目标 NAS 上多装一套运行时。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { badRequest } from '../http/respond.mjs'
import { stateDir } from '../paths.mjs'
import { resolveMirror } from './mirror.mjs'
import { detectCapacity, MAX_CONCURRENCY, MIN_CONCURRENCY } from '../system/capacity.mjs'


/**
 * 可同步的顶层目录（与 solid.py 的 s_paths_all 对齐）。
 *
 * 用户勾选哪些，就只拉哪些目录的内容；不勾选不下载，避免一次拉全站。
 */
/**
 * 兜底目录清单。
 *
 * 只用于「目录树还没抓取成功」时给前端一个初始值（例如未联网、镜像全挂）。
 * **不是**可接受路径的白名单：真实可选目录由镜像站实时抓取，
 * 用户自建目录（如「测试」）同样合法。
 *
 * 曾经把它当白名单在 readSyncConfig 里过滤，导致用户选了自建目录后
 * 保存成功、刷新却变成空——写端放行、读端静默丢弃。
 */
export const DEFAULT_AVAILABLE_PATHS = [
  '115',
  'PikPak',
  '动漫',
  '每日更新',
  '电影',
  '电视剧',
  '纪录片',
  '纪录片（已刮削）',
  '综艺',
  '音乐',
  '📺画质演示测试（4K，8K，HDR，Dolby）',
]

/** 配置文件名。 */
const CONFIG_NAME = 'sync.json'

/** 同步配置默认值。 */
const DEFAULTS = {
  enabled: false,
  /** 只同步这些顶层目录 */
  paths: ['115', '每日更新', '纪录片（已刮削）', '音乐', '综艺'],
  /** strm 内容替换：把线上地址前缀换成本地可访问的地址 */
  strmFrom: 'http://xiaoya.host:5678/d',
  strmTo: '',
  /** 并发下载数：默认取设备推荐值（见 system/capacity.mjs），用户可覆盖 */
  count: detectCapacity().recommended,
  /** 是否同时更新 nfo */
  nfo: true,
  /**
   * 定时调度。
   *
   * 三种重复模式，覆盖常见诉求：
   * - `daily`  每天 HH:mm
   * - `weekly` 每周 day(0-6) 的 HH:mm
   * - `monthly` 每月 day(1-31) 的 HH:mm
   *
   * 为什么不用「一次性日期+时间」：原生日期面板要求年月日时分五项全选，
   * 对「每天凌晨 3 点更新一次」这类需求是多余负担，也不符合定时器语义。
   * 重复执行天然不会漏跑，也不需要「跑完清空」这类额外状态。
   *
   * mode 为 `off` 表示不定时。
   */
  schedule: {
    mode: 'off',
    hour: 3,
    minute: 0,
    /** weekly 用 0-6（周日 0）；monthly 用 1-31 */
    day: 1,
  },
  /** 最近一次运行信息 */
  lastRun: null,
}

/** 配置文件路径。 */
function configPath() {
  return join(stateDirOf(), CONFIG_NAME)
}

/** 配置放在应用 state 目录，与任务状态同处。 */
function stateDirOf() {
  return stateDir
}

/**
 * 读取同步配置。
 *
 * 配置文件损坏或不存在时回退默认值，不抛错——
 * 面板需要能正常渲染，让用户重新保存一次即可修复。
 */
export function readSyncConfig() {
  try {
    const raw = JSON.parse(readFileSync(configPath(), 'utf8'))
    return {
      ...DEFAULTS,
      ...raw,
      // schedule 是嵌套对象，浅合并会把缺省字段丢掉（例如旧配置只有 mode）
      schedule: { ...DEFAULTS.schedule, ...(raw?.schedule ?? {}) },
      // 不按白名单过滤：真实可选目录来自镜像站，用户也可能自建目录。
      // 这里只丢掉明显不合法的值，避免脏配置把同步任务带偏。
      paths: Array.isArray(raw?.paths)
        ? raw.paths.filter(p => typeof p === 'string' && p !== '' && !p.startsWith('/') && !p.includes('..'))
        : DEFAULTS.paths,
    }
  }
  catch {
    return { ...DEFAULTS }
  }
}

/**
 * 校验定时调度配置。
 *
 * 只接受三种模式，且各字段取值范围明确——调度器每分钟 tick 一次，
 * 一旦写入非法值就可能在错误时刻触发，所以这里收紧。
 *
 * @param {unknown} raw 前端提交的调度对象
 * @returns {{mode: string, hour: number, minute: number, day: number}} 清洗后的调度配置
 */
function validateSchedule(raw) {
  const input = raw !== null && typeof raw === 'object' ? raw : {}
  const mode = String(input.mode ?? 'off')
  if (!['off', 'daily', 'weekly', 'monthly'].includes(mode)) {
    throw badRequest(`不支持的调度模式：${mode}`, '请选择每天、每周或每月')
  }

  const hour = Number(input.hour ?? 3)
  const minute = Number(input.minute ?? 0)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw badRequest('小时必须在 0-23 之间', '请重新选择时间')
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw badRequest('分钟必须在 0-59 之间', '请重新选择时间')
  }

  const day = Number(input.day ?? 1)
  if (mode === 'weekly' && (!Number.isInteger(day) || day < 0 || day > 6)) {
    throw badRequest('星期必须在 0-6 之间', '0 表示周日')
  }
  if (mode === 'monthly' && (!Number.isInteger(day) || day < 1 || day > 31)) {
    throw badRequest('日期必须在 1-31 之间', '超出当月天数时该月不执行')
  }

  return { mode, hour, minute, day }
}

/** 保存同步配置（带校验）。 */
export function writeSyncConfig(input) {
  const next = { ...readSyncConfig() }

  if (input?.enabled !== undefined) next.enabled = input.enabled === true

  if (input?.paths !== undefined) {
    if (!Array.isArray(input.paths)) throw badRequest('paths 必须是数组', '请重新选择要同步的目录')
    // 目录树允许选到任意层级（例如「每日更新/电影」），不能只认顶层 11 个。
    // 这里只做「相对路径 + 不含 ..」的安全校验，是否存在交给抓取时判断。
    const invalid = input.paths.filter((p) => {
      if (typeof p !== 'string' || p === '') return true
      if (p.startsWith('/') || p.includes('..')) return true
      return p.split('/').length > 4
    })
    if (invalid.length > 0) {
      throw badRequest(`目录路径不合法：${invalid.join('、')}`, '请通过目录树重新选择')
    }
    next.paths = [...new Set(input.paths)]
  }

  if (input?.strmFrom !== undefined) next.strmFrom = String(input.strmFrom).trim()
  if (input?.strmTo !== undefined) next.strmTo = String(input.strmTo).trim()

  if (input?.count !== undefined) {
    const n = Number(input.count)
    if (!Number.isInteger(n) || n < MIN_CONCURRENCY || n > MAX_CONCURRENCY) {
      throw badRequest(
        `并发数必须是 ${MIN_CONCURRENCY}-${MAX_CONCURRENCY} 的整数`,
        '面板会按设备性能给出推荐值，你可以按需调高；过高的并发可能被小雅站限速',
      )
    }
    next.count = n
  }

  if (input?.nfo !== undefined) next.nfo = input.nfo === true

  if (input?.schedule !== undefined) {
    next.schedule = validateSchedule(input.schedule)
  }

  mkdirSync(dirname(configPath()), { recursive: true })
  writeFileSync(configPath(), JSON.stringify(next, null, 2), { mode: 0o600 })
  return next
}

/**
 * 解析扫描列表。
 *
 * 与 solid.py 的 `current_amount` / 目录遍历等价：小雅提供 `.scan.list.gz`，
 * 但格式在不同版本间有差异。这里直接抓目录 HTML 并解析出
 * `(文件名, 时间戳, 线上大小)`，失败时明确返回原因。
 */
export async function fetchScanEntries(mediaBase, paths) {
  // 用测速选出的镜像，而不是写死一个域名：镜像可达性差异很大
  const source = await resolveMirror()
  const entries = []

  for (const dir of paths) {
    const url = new URL(encodeURI(dir) + '/', source).toString()
    let html
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; fn-xiaoya-native)' },
        signal: AbortSignal.timeout(20_000),
      })
      if (!response.ok) {
        return { ok: false, reason: `拉取 ${dir} 失败（HTTP ${response.status}）`, entries }
      }
      html = await response.text()
    }
    catch (error) {
      return { ok: false, reason: `拉取 ${dir} 失败：${error.message}`, entries }
    }

    parseDirectoryListing(html, dir, entries)
  }

  return { ok: true, entries, total: entries.length }
}

/**
 * 从目录页解析文件条目。
 *
 * 小雅站点是 nginx 自动索引，形如：
 *   <a href="x.nfo">x.nfo</a>  18-Nov-2025 10:00  1024
 * 这里用宽松匹配抽取，解析不出的行直接跳过（不因单个文件格式异常中断整次同步）。
 */
function parseDirectoryListing(html, dir, out) {
  // 匹配 <a href="...">...</a> 后面紧跟的时间与大小
  const rowPattern = /<a\s+href="([^"]+)"[^>]*>[^<]+<\/a>\s*([0-9]{1,2}-[A-Za-z]{3}-[0-9]{4}\s+[0-9]{2}:[0-9]{2})\s+([0-9]+)/g
  let match = rowPattern.exec(html)
  while (match !== null) {
    const [, href, timeText, sizeText] = match
    if (href.startsWith('../') || href.endsWith('/') || href.startsWith('?')) continue
    const name = decodeURIComponent(href)
    // 只关心元数据文件，跳过压缩包与列表文件
    if (/\.(?:mp4|tgz|gz|txt|list)$/i.test(name)) continue
    out.push({
      dir,
      name,
      remoteSize: Number(sizeText),
      remoteTime: timeStrToUnix(timeText),
    })
    match = rowPattern.exec(html)
  }
}

/** `18-Nov-2025 10:00` → unix 秒。 */
function timeStrToUnix(text) {
  const parsed = Date.parse(text.replace(/-/g, ' '))
  return Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000)
}

/**
 * 条目在本地媒体目录中的落地路径。
 *
 * 目录层级必须保留：小雅按分类目录组织，同名文件在不同目录下是不同资源。
 */
function localPathOf(mediaBase, entry) {
  const safeName = entry.name.replace(/^\.\.?\//, '').replace(/^\//, '')
  return join(mediaBase, entry.dir, safeName)
}

/**
 * 判断一个条目是否需要下载。
 *
 * strm 用 meta 文件判断（内容被替换过，大小必然不同）；
 * 其它文件比较本地大小与修改时间。
 */
export function needsSync(mediaBase, entry, options = {}) {
  // 必须带上目录：小雅线上是同名文件分布在不同分类目录下，
  // 只用文件名会把「电影/xxx.strm」和「电视剧/xxx.strm」写到同一处。
  const localPath = localPathOf(mediaBase, entry)

  if (entry.name.toLowerCase().endsWith('.strm')) {
    // 关键：meta 文件名里带「线上大小」，线上变了就不会命中
    const metaPath = `${localPath}.${entry.remoteSize}.meta`
    return !existsSync(metaPath)
  }

  if (!existsSync(localPath)) return true
  if (entry.name.toLowerCase().endsWith('.nfo') && options.nfo === false) return false

  try {
    const stat = statSync(localPath)
    // 大小一致且本地更新时间不早于线上，视为已同步
    if (stat.size === entry.remoteSize && entry.remoteTime <= Math.floor(stat.mtimeMs / 1000)) {
      return false
    }
  }
  catch {
    return true
  }
  return true
}

/**
 * 下载单个条目；strm 按配置做内容替换。
 *
 * 替换成功后写入 `<path>.<线上大小>.meta` 空标记，
 * 下次 `needsSync` 据此跳过——这是保证「不重复下载」的唯一依据。
 */
export async function syncEntry(mediaBase, entry, config) {
  const source = await resolveMirror()
  const url = `${source}/${encodeURI(entry.dir)}/${encodeURI(entry.name)}`
  const localPath = localPathOf(mediaBase, entry)

  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; fn-xiaoya-native)' },
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  let buffer = Buffer.from(await response.arrayBuffer())

  const isStrm = entry.name.toLowerCase().endsWith('.strm')
  if (isStrm && config.strmFrom !== '' && config.strmTo !== '') {
    const text = buffer.toString('utf8')
    if (text.includes(config.strmFrom)) {
      buffer = Buffer.from(text.split(config.strmFrom).join(config.strmTo), 'utf8')
    }
  }

  mkdirSync(dirname(localPath), { recursive: true })
  writeFileSync(localPath, buffer)

  if (isStrm) {
    // 标记「已按线上大小 N 同步」，内容已被替换故不能用本地大小比较
    const metaPath = `${localPath}.${entry.remoteSize}.meta`
    writeFileSync(metaPath, '')
  }

  return { path: localPath, bytes: buffer.length }
}

/**
 * 清理失效的 strm meta 标记。
 *
 * 线上文件更新后旧 meta 不再匹配，会一直残留；
 * 这里按「同目录下 meta 前缀」清理，避免长期堆积。
 */
export function pruneMeta(mediaBase) {
  // 简化实现：只在实际同步过的目录里递归查找，避免遍历整个媒体库
  let removed = 0
  const walk = (dir) => {
    if (!existsSync(dir)) return
    for (const name of readdirNames(dir)) {
      const full = join(dir, name)
      try {
        if (statSync(full).isDirectory()) {
          walk(full)
          continue
        }
        // 形如 x.strm.12345.meta，且对应 strm 已不存在时删除
        const match = /^(.+\.strm)\.\d+\.meta$/.exec(name)
        if (match && !existsSync(join(dir, match[1]))) {
          unlinkSync(full)
          removed += 1
        }
      }
      catch {
        // 单个文件异常不影响整体清理
      }
    }
  }
  walk(mediaBase)
  return removed
}

/** 安全列目录（供 pruneMeta 使用）。 */
function readdirNames(dir) {
  try {
    return readdirSync(dir)
  }
  catch {
    return []
  }
}

