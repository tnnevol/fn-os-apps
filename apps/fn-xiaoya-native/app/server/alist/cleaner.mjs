/**
 * 115 回收站与「最近接收」清理（原生实现）。
 *
 * 对应上游伴随容器 `ddsderek/xiaoya-115cleaner`。本应用不引入伴随容器
 * （边界只允许 xiaoyaliu/alist 使用 Docker），改为后端直接调 115 官方接口。
 *
 * ## 上游的四种模式
 *
 * 1. 标准：清「最近接收」并清理回收站中对应文件；7 小时一次
 * 2. only_recyclebin：只清回收站，不限制数量
 * 3. all_recyclebin：清「最近接收」并清空整个回收站
 * 4. only_receive：只清「最近接收」
 *
 * ## 数量限制
 *
 * 上游按会员等级限制单次清理数量（会员 105 / 普通 5），避免请求过密被风控。
 * 这里沿用同样的上限。
 *
 * ## 与上游的差异
 *
 * 上游是常驻容器、内部自己计时；本应用复用已有的调度器按间隔触发，
 * 不在进程里开常驻循环——应用停掉就不该继续调网盘接口。
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { badRequest } from '../http/respond.mjs'
import { configDir } from '../paths.mjs'
import { readSecret } from '../config/store.mjs'

/** 115 的 Web API 基址 */
const API_BASE = 'https://webapi.115.com'

/** 清理单次上限：与上游一致，避免请求过密触发风控 */
const LIMIT_VIP = 105
const LIMIT_NORMAL = 5

/** 上游请求 UA */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** 单次请求超时 */
const TIMEOUT_MS = 15_000

/** 清理模式。 */
export const CLEANER_MODES = {
  off: '关闭',
  standard: '标准（清理最近接收 + 对应回收站）',
  only_recyclebin: '只清回收站',
  all_recyclebin: '清最近接收 + 清空回收站',
  only_receive: '只清最近接收',
}

/** 取 115 Cookie；未配置时返回空串。 */
function cookie() {
  const value = readSecret('cookie115')
  return typeof value === 'string' ? value : ''
}

/** 调用 115 接口并解析 JSON。 */
async function call115(path, params = {}) {
  const search = new URLSearchParams(params).toString()
  const url = `${API_BASE}${path}${search === '' ? '' : `?${search}`}`
  const response = await fetch(url, {
    headers: {
      Cookie: cookie(),
      'User-Agent': UA,
      Referer: 'https://115.com/',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const payload = await response.json().catch(() => null)
  if (payload === null) {
    throw badRequest('115 返回了非 JSON 响应', 'Cookie 可能已失效，请重新授权')
  }
  return payload
}

/**
 * 判断是否为会员。
 *
 * 会员与非会员的单次清理上限不同（105 / 5），这个值决定一轮能清多少。
 *
 * @returns {Promise<boolean>} 是否会员
 */
async function isVip() {
  try {
    const payload = await call115('/5/1/user/info')
    const level = payload?.data?.vip_info?.level_name ?? payload?.data?.level_name ?? ''
    return typeof level === 'string' && level !== '' && level !== '普通用户'
  }
  catch {
    // 判断不出就按普通用户处理：少清一点比触发风控好
    return false
  }
}

/**
 * 列出「最近接收」中的文件。
 *
 * @param {number} limit 最多取多少条
 * @returns {Promise<Array<{id: string, name: string}>>} 文件列表
 */
async function listRecentReceive(limit) {
  // cid=0 表示根目录；/files 接口配合 cid 与 limit 列出内容
  const payload = await call115('/files', {
    aid: '1',
    cid: '0',
    o: 'user_ptime',
    asc: '0',
    offset: '0',
    show_dir: '1',
    limit: String(limit),
    type: '0',
  })

  if (payload?.state === false) {
    throw badRequest(
      `读取「最近接收」失败：${payload?.error ?? '未知原因'}`,
      'Cookie 可能已失效，请重新授权 115',
    )
  }

  const items = Array.isArray(payload?.data) ? payload.data : []
  return items
    .filter(item => typeof item?.fid === 'string' || typeof item?.fid === 'number')
    .map(item => ({ id: String(item.fid), name: String(item.n ?? item.name ?? '未知') }))
}

/**
 * 删除指定文件。
 *
 * @param {string[]} ids 文件 id 列表
 * @returns {Promise<void>} 完成即成功，失败抛错
 */
async function deleteFiles(ids) {
  if (ids.length === 0) return
  const response = await fetch(`${API_BASE}/rb/delete`, {
    method: 'POST',
    headers: {
      Cookie: cookie(),
      'User-Agent': UA,
      Referer: 'https://115.com/',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    // 115 这个接口要求 id 以英文逗号拼接的字符串
    body: `fid[0]=${ids.join(',')}`,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const payload = await response.json().catch(() => null)
  if (payload?.state === false) {
    throw badRequest(
      `删除文件失败：${payload?.error ?? '未知原因'}`,
      'Cookie 可能已失效或权限不足',
    )
  }
}

/**
 * 清空 115 回收站。
 *
 * @returns {Promise<void>} 完成即成功
 */
async function clearRecycleBin() {
  const response = await fetch(`${API_BASE}/rb/clean`, {
    method: 'POST',
    headers: {
      Cookie: cookie(),
      'User-Agent': UA,
      Referer: 'https://115.com/',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: '',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const payload = await response.json().catch(() => null)
  if (payload?.state === false) {
    throw badRequest(
      `清空回收站失败：${payload?.error ?? '未知原因'}`,
      'Cookie 可能已失效或权限不足',
    )
  }
}

/**
 * 执行一次清理。
 *
 * @param {string} mode 清理模式，见 CLEANER_MODES
 * @returns {Promise<{mode: string, deleted: number, clearedBin: boolean}>} 清理结果
 */
export async function runCleaner(mode) {
  if (cookie() === '') {
    throw badRequest('尚未配置 115 Cookie', '请先在「账号配置 → 网盘授权」完成扫码或粘贴')
  }
  if (mode === 'off' || mode === undefined) {
    return { mode: 'off', deleted: 0, clearedBin: false }
  }
  if (CLEANER_MODES[mode] === undefined) {
    throw badRequest(`不支持的清理模式：${mode}`, '请从设置中选择')
  }

  const vip = await isVip()
  const limit = vip ? LIMIT_VIP : LIMIT_NORMAL

  let deleted = 0
  let clearedBin = false

  // 需要动「最近接收」的模式
  if (mode === 'standard' || mode === 'all_recyclebin' || mode === 'only_receive') {
    const files = await listRecentReceive(limit)
    if (files.length > 0) {
      await deleteFiles(files.map(f => f.id))
      deleted = files.length
    }
  }

  // 需要动回收站的模式
  if (mode === 'all_recyclebin' || mode === 'only_recyclebin') {
    await clearRecycleBin()
    clearedBin = true
  }

  return { mode, deleted, clearedBin }
}

/**
 * 读取清理配置。
 *
 * 模式存在 `115_cleaner_mode.txt`：与上游用不同标记文件表示模式不同，
 * 这里改成一个文件存模式名，可读性更好，也少三类文件要同步。
 *
 * @returns {{mode: string, enabled: boolean}} 清理配置
 */
export function readCleanerConfig() {
  try {
    const raw = readFileSync(cleanerConfigPath(), 'utf8').trim()
    return { mode: raw === '' ? 'off' : raw, enabled: raw !== '' && raw !== 'off' }
  }
  catch {
    return { mode: 'off', enabled: false }
  }
}

/**
 * 保存清理配置。
 *
 * @param {string} mode 清理模式
 * @returns {{mode: string, enabled: boolean}} 保存后的配置
 */
export function writeCleanerConfig(mode) {
  if (mode !== 'off' && CLEANER_MODES[mode] === undefined) {
    throw badRequest(`不支持的清理模式：${mode}`, '请从设置中选择')
  }
  mkdirSync(configDir, { recursive: true })
  if (mode === 'off') {
    rmSync(cleanerConfigPath(), { force: true })
    return { mode: 'off', enabled: false }
  }
  writeFileSync(cleanerConfigPath(), mode, { mode: 0o600 })
  return { mode, enabled: true }
}

/** 配置文件路径（放在小雅配置目录下，应用与容器共享同一份）。 */
function cleanerConfigPath() {
  return join(configDir, '115_cleaner_mode.txt')
}
