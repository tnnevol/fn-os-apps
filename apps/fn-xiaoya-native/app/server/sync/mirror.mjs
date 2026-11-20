/**
 * 小雅元数据镜像的探测与选择。
 *
 * 小雅有多个镜像站（官方池 + 各社区镜像），可达性和速度差异很大。
 * 让用户在面板里手填或死用一个默认域名都不合适：换网络环境后可能直接不可用。
 *
 * 这里在服务端做两件事：
 * 1. 维护候选镜像列表（优先从官方 crawlerlist 拉，失败用内置回退表）；
 * 2. 并发探测每个镜像的首页响应时间，挑最快且可用的那个。
 *
 * 探测结果缓存一段时间，避免每次打开页面都跑一轮（十几个域名 × 超时 3s）。
 */
import { serverError } from '../http/respond.mjs'

/** 官方镜像池列表（与 solid.py 的 fetch_pool_from_url 一致）。 */
const POOL_URL = 'https://img.xiaoya.pro/crawlerlist.txt'

/**
 * 内置回退镜像表。
 *
 * 与 solid.py 的 fallback 列表保持一致；网络取不到官方池时用它。
 * 这些域名由社区维护，可能随时失效——所以必须做可达性探测，
 * 不能直接取第一个。
 */
const FALLBACK_MIRRORS = [
  'https://emby.xiaoya.pro/',
  'https://icyou.eu.org/',
  'https://emby.8.net.co/',
  'https://emby.raydoom.tk/',
  'https://emby.kaiserver.uk/',
  'https://embyxiaoya.laogl.top/',
  'https://emby-data.poxi1221.eu.org/',
  'https://emby-data.ermaokj.cn/',
  'https://emby-data.bdbd.fun/',
  'https://emby-data.wwwh.eu.org/',
  'https://emby-data.f1rst.top/',
  'https://emby-data.ymschh.top/',
  'https://emby-data.wx1.us.kg/',
  'https://emby-data.r2s.site/',
  'https://emby-data.neversay.eu.org/',
  'https://emby-data.800686.xyz/',
]

/** 单个镜像的探测超时；过长会让整个选择过程卡住。 */
const PROBE_TIMEOUT_MS = 4000

/** 探测结果缓存时长：避免频繁打开页面就重新跑一轮。 */
const CACHE_TTL_MS = 10 * 60 * 1000

/** 缓存的探测结果。 */
let cache = null

/** 规范化：补全协议、去掉末尾斜杠。 */
function normalizeMirror(raw) {
  let value = String(raw).trim()
  if (value === '' || value.startsWith('#')) return null
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}`
  }
  catch {
    return null
  }
}

/**
 * 拉取官方镜像池。
 *
 * 失败不是错误：直接用回退表即可，不值得让面板报错。
 */
async function fetchPool() {
  try {
    const response = await fetch(POOL_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; fn-xiaoya-native)' },
      signal: AbortSignal.timeout(6000),
    })
    if (!response.ok) return []
    const text = await response.text()
    return text
      .split('\n')
      .map(normalizeMirror)
      .filter(item => item !== null)
  }
  catch {
    return []
  }
}

/** 候选镜像列表（去重，官方池优先）。 */
async function candidateMirrors() {
  const pool = await fetchPool()
  const merged = [...pool, ...FALLBACK_MIRRORS.map(normalizeMirror).filter(Boolean)]
  return [...new Set(merged)]
}

/**
 * 探测单个镜像。
 *
 * 只请求首页且不读 body：目标是「能不能快速拿到响应」，
 * 不是内容正确性。读 body 会让慢镜像拖到超时。
 */
async function probeMirror(base) {
  const started = Date.now()
  try {
    const response = await fetch(`${base}/`, {
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; fn-xiaoya-native)' },
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      redirect: 'follow',
    })
    // 目录列表页应该返回 200；其余状态视为不可用
    if (!response.ok) return { base, ok: false, ms: null, status: response.status }
    // 不读整个 body，但要消费掉，避免连接悬挂
    await response.body?.cancel()
    return { base, ok: true, ms: Date.now() - started, status: response.status }
  }
  catch {
    return { base, ok: false, ms: null, status: null }
  }
}

/**
 * 选出当前网络下最快的可用镜像。
 *
 * 并发探测所有候选，取响应最快的那个；全部失败时抛错由调用方提示。
 *
 * @returns {Promise<{base: string, ms: number, probed: number}>} 选中的镜像与探测统计
 */
export async function pickFastestMirror() {
  if (cache !== null && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.value
  }

  const candidates = await candidateMirrors()
  if (candidates.length === 0) {
    throw serverError('没有可用的元数据镜像', '请检查 NAS 的网络连接后重试')
  }

  // 并发探测：串行十几个域名会等到天荒地老
  const results = await Promise.all(candidates.map(probeMirror))
  const usable = results.filter(item => item.ok && item.ms !== null)
  if (usable.length === 0) {
    throw serverError('所有元数据镜像都不可达', '请检查 NAS 的网络连接后重试')
  }

  usable.sort((a, b) => a.ms - b.ms)
  const best = usable[0]
  const value = { base: best.base, ms: best.ms, probed: candidates.length }

  // 缓存里同时保存逐项探测结果：否则 listMirrors 命中缓存时拿不到详情
  cache = { at: Date.now(), value, mirrors: results }
  return value
}

/**
 * 拿到可用镜像；探测失败时回退到环境变量或官方域名。
 *
 * 同步任务用它取源站：不能因为探测失败就让用户的定时同步彻底停掉。
 */
export async function resolveMirror() {
  try {
    const { base } = await pickFastestMirror()
    return base
  }
  catch {
    return (process.env.XIAOYA_SYNC_SOURCE ?? FALLBACK_MIRRORS[0]).replace(/\/+$/, '')
  }
}

/** 清空缓存，供「重新测速」按钮使用。 */
export function resetMirrorCache() {
  cache = null
}

/**
 * 列出所有候选镜像及其探测结果，供面板展示。
 *
 * @returns {Promise<{mirrors: Array<{base: string, ok: boolean, ms: number|null}>, fastest: string|null}>} 每个候选镜像的探测结果，以及最快的那个（全部失败为 null）
 */
export async function listMirrors() {
  const cached = cache !== null && Date.now() - cache.at < CACHE_TTL_MS
  if (cached) {
    return { mirrors: cache.mirrors ?? [], fastest: cache.value.base }
  }

  const candidates = await candidateMirrors()
  const results = await Promise.all(candidates.map(probeMirror))
  const usable = results.filter(item => item.ok).sort((a, b) => (a.ms ?? 0) - (b.ms ?? 0))
  const fastest = usable[0]?.base ?? null

  if (fastest !== null) {
    cache = { at: Date.now(), value: { base: fastest, ms: usable[0].ms, probed: candidates.length }, mirrors: results }
  }
  return { mirrors: results, fastest }
}
