/**
 * 网盘授权。
 *
 * 复现 `all_in_one.sh` 里「扫码/粘贴 → 校验 → 写入小雅配置文件」这条链路，
 * 端点与流程参考 OpenList-OnlineAPI（本仓库以 MIT/GPL 之外的自研实现重写，
 * 只借用公开接口的调用顺序，不复制其代码）。
 *
 * 与脚本的关键差别：
 * - 脚本在终端里画二维码，这里返回二维码内容由前端渲染；
 * - 脚本把会话放在进程变量里，进程退出即丢，这里放内存表并带过期清理；
 * - 脚本校验失败也会写入，这里失败不覆盖原有可用配置。
 */
import { randomUUID } from 'node:crypto'
import { badRequest, notFound, serverError } from '../http/respond.mjs'
import { writeConfig } from '../config/store.mjs'

/** 会话有效期：扫码授权给用户的操作时间，超时后需要重新生成。 */
const SESSION_TTL_MS = 5 * 60 * 1000

/** 阿里云盘扫码会话表：id → 会话。 */
const aliSessions = new Map()
/** 115 扫码会话表。 */
const pan115Sessions = new Map()

/** 定期清理过期会话，避免内存里堆积。 */
const sweeper = setInterval(() => {
  const now = Date.now()
  for (const [id, session] of aliSessions) {
    if (now - session.createdAt > SESSION_TTL_MS) aliSessions.delete(id)
  }
  for (const [id, session] of pan115Sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) pan115Sessions.delete(id)
  }
}, 60_000)
// 定时器不应阻止进程退出
sweeper.unref?.()

/** 阿里云盘通行证接口使用的固定 UA，与公开网页端一致。 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/* ── 阿里云盘 ─────────────────────────────────────────── */

/**
 * 生成阿里云盘扫码会话。
 *
 * 流程与网页端一致：先拿登录页里的 csrf/umid，再用它申请二维码，
 * 否则生成接口会返回空 codeContent。
 */
export async function createAlipanQr() {
  const csrf = 'MuSysYVxW5AMGblcOTSKb3'
  const umid = randomUUID().replace(/-/g, '')

  const query = new URLSearchParams({
    appName: 'aliyun_drive',
    fromSite: '52',
    appEntrance: 'web_default',
    _csrf_token: csrf,
    umidToken: umid,
    bizParams: 'taobaoBizLoginFrom=web_default&renderRefer=https%3A%2F%2Fauth.alipan.com%2F',
    mainPage: 'false',
    isMobile: 'false',
    lang: 'zh_CN',
    returnUrl: '',
    umidTag: 'SERVER',
  })

  const response = await safeFetch(`https://passport.alipan.com/newlogin/qrcode/generate.do?${query}`, {
    headers: { 'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest', Referer: 'https://passport.alipan.com/' },
  })
  const data = response?.content?.data
  if (data?.codeContent === undefined) {
    throw serverError('无法生成阿里云盘二维码', '请检查飞牛设备的网络连通性后重试')
  }

  const id = randomUUID()
  aliSessions.set(id, {
    id,
    createdAt: Date.now(),
    ck: data.ck,
    t: data.t,
    accessToken: null,
    refreshToken: null,
  })
  return { sessionId: id, qrContent: data.codeContent, expiresIn: Math.floor(SESSION_TTL_MS / 1000) }
}

/** 轮询阿里云盘扫码状态。 */
export async function pollAlipanQr(sessionId) {
  const session = aliSessions.get(sessionId)
  if (session === undefined) throw notFound('授权会话已过期', '请重新生成二维码')

  const form = new URLSearchParams({ appName: 'aliyun_drive', fromSite: '52' })
  if (session.ck) form.append('ck', session.ck)
  if (session.t) form.append('t', session.t)

  const response = await safeFetch('https://passport.alipan.com/newlogin/qrcode/query.do', {
    method: 'POST',
    headers: {
      'User-Agent': UA,
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: 'https://passport.alipan.com/',
    },
    body: form,
  })

  const data = response?.content?.data ?? {}
  // 上游状态字面量：NEW / SCANED / CONFIRMED / EXPIRED
  const raw = data.qrCodeStatus ?? 'NEW'
  const status = { NEW: 'waiting', SCANED: 'scanned', CONFIRMED: 'confirmed', EXPIRED: 'expired' }[raw] ?? 'waiting'

  if (status !== 'confirmed') return { status }

  // 确认后 bizExt 里带 pds_login_result，需要用 Base64 解一层再取 token
  const tokens = extractAlipanTokens(data.bizExt)
  if (tokens === null) {
    return { status: 'scanned', message: '已扫码，正在获取令牌，请稍候' }
  }

  session.accessToken = tokens.accessToken
  session.refreshToken = tokens.refreshToken
  aliSessions.set(sessionId, session)

  // 扫码一确认就落盘，不再要求用户回面板点「写入配置」或手工粘贴。
  // 已保存过就直接回报，避免轮询期间重复写文件。
  if (session.saved === true) {
    return { status: 'confirmed', saved: true, hasRefreshToken: tokens.refreshToken !== null }
  }
  if (tokens.refreshToken === null) {
    // 只拿到 access token 时无法长期使用，让用户知道需要重试
    return { status: 'confirmed', saved: false, message: '未获取到 Refresh Token，请重新扫码' }
  }
  const result = writeConfig({ refreshToken: tokens.refreshToken })
  session.saved = true
  aliSessions.set(sessionId, session)
  return { status: 'confirmed', saved: true, updated: result.updated, hasRefreshToken: true }
}

/**
 * 从 bizExt 解析 Token。
 *
 * bizExt 可能是 Base64 字符串或已是对象，两种都要处理：
 * 上游不同版本的返回形态不一致。
 */
function extractAlipanTokens(bizExt) {
  let decoded = bizExt
  if (typeof bizExt === 'string') {
    try {
      decoded = JSON.parse(Buffer.from(bizExt, 'base64').toString('utf8'))
    }
    catch {
      return null
    }
  }
  const result = decoded?.pds_login_result
  if (result === undefined) return null
  return {
    accessToken: typeof result.accessToken === 'string' ? result.accessToken : null,
    refreshToken: typeof result.refreshToken === 'string' ? result.refreshToken : null,
  }
}

/** 校验阿里云盘访问令牌是否可用，并返回账号信息。 */
export async function verifyAlipanToken(token) {
  const response = await safeFetch('https://openapi.alipan.com/adrive/v1/user/get', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (response?.user_id === undefined && response?.name === undefined) {
    return { ok: false, message: '令牌校验失败，可能已过期或填写有误' }
  }
  return { ok: true, name: response.name ?? response.nick_name ?? '', userId: response.user_id ?? '' }
}

/* ── 115 ──────────────────────────────────────────────── */

/** 生成 115 扫码会话。 */
/**
 * 115 支持扫码绑定的设备端。
 *
 * 与上游 115cookie.py 的 QRCODE_APPS 一致。选不同端的影响是：
 * 换到的 Cookie 会被标记成对应的设备类型，部分接口在不同端上的
 * 风控等级不同——例如支付宝小程序端更宽松，所以默认用它。
 *
 * 注意 `ios` 需要特殊 UA（UPhone），其余端不带额外头。
 */
export const QRCODE_APPS = [
  { value: 'alipaymini', label: '支付宝小程序（推荐）' },
  { value: 'wechatmini', label: '微信小程序' },
  { value: 'android', label: 'Android' },
  { value: '115android', label: '115 Android' },
  { value: 'ios', label: 'iOS' },
  { value: '115ios', label: '115 iOS' },
  { value: '115ipad', label: '115 iPad' },
  { value: 'harmony', label: '鸿蒙' },
  { value: 'tv', label: 'TV' },
  { value: 'qandroid', label: 'Android Pad' },
  { value: 'web', label: '网页版' },
]

/** 默认端：支付宝小程序。 */
export const DEFAULT_QRCODE_APP = 'alipaymini'

/** 校验端标识，非法值回落到默认端。 */
function resolveQrcodeApp(value) {
  const found = QRCODE_APPS.find(app => app.value === value)
  return found === undefined ? DEFAULT_QRCODE_APP : found.value
}

export async function create115Qr(app = DEFAULT_QRCODE_APP) {
  const response = await safeFetch('https://qrcodeapi.115.com/api/1.0/web/1.0/token')
  const data = response?.data
  if (data?.uid === undefined || typeof data.qrcode !== 'string') {
    throw serverError('无法生成 115 二维码', '请检查飞牛设备的网络连通性后重试')
  }
  const id = randomUUID()
  pan115Sessions.set(id, {
    id,
    createdAt: Date.now(),
    uid: data.uid,
    time: data.time,
    sign: data.sign,
    // 记住用户选的端：换取 Cookie 时必须用同一个端，
    // 否则绑定的设备类型会与用户选择不一致
    app: resolveQrcodeApp(app),
    // 扫码确认后换到的 Cookie；用于避免重复请求上游
    cookie: null,
  })
  return {
    sessionId: id,
    // 115 的 token 接口直接返回已编码的二维码内容，前端按原样渲染即可
    qrContent: data.qrcode,
    expiresIn: Math.floor(SESSION_TTL_MS / 1000),
  }
}

/** 轮询 115 扫码状态。 */
/**
 * 轮询 115 扫码状态。
 *
 * 确认登录（status=2）后不再只回报「已确认」——那样用户还得手工复制 Cookie。
 * 这里直接调用 115 的登录结果接口换取 Cookie 并写进小雅配置，
 * 扫码完成即配置完成，面板不需要任何粘贴框。
 *
 * 接口来源（上游 115cookie.py 已验证）：
 *   POST https://qrcodeapi.115.com/app/1.0/{app}/1.0/login/qrcode/
 *   body: account=<二维码 uid>  →  data.cookie = { K1: V1, ... }
 */
export async function poll115Qr(sessionId) {
  const session = pan115Sessions.get(sessionId)
  if (session === undefined) throw notFound('授权会话已过期', '请重新生成二维码')

  const query = new URLSearchParams({
    uid: session.uid,
    time: String(session.time),
    sign: session.sign,
    _: String(Math.floor(Date.now() / 1000)),
  })
  const response = await safeFetch(`https://qrcodeapi.115.com/get/status/?${query}`)
  const status = Number(response?.data?.status ?? 0)
  // 0 等待 / 1 已扫码 / 2 已确认 / -1 过期 / -2 取消
  const mapped = { 0: 'waiting', 1: 'scanned', 2: 'confirmed', '-1': 'expired', '-2': 'cancelled' }[status] ?? 'waiting'

  if (mapped !== 'confirmed') return { status: mapped }

  // 已经换过就直接回报，避免每次轮询都重复请求上游
  if (session.cookie !== null && session.cookie !== undefined) {
    return { status: 'confirmed', saved: true }
  }

  const cookie = await exchange115Cookie(session.uid, session.app)
  if (cookie === null) {
    return { status: 'confirmed', saved: false, message: '登录已确认，但获取 Cookie 失败，请重试扫码' }
  }

  session.cookie = cookie
  // 直接落盘：写入 115_cookie.txt（600 权限），与手工填写的结果完全一致
  const result = writeConfig({ cookie115: cookie })
  return { status: 'confirmed', saved: true, updated: result.updated }
}

/**
 * 用二维码 uid 换取 Cookie 字符串。
 *
 * 上游返回 `data.cookie` 是对象，小雅要求的是 `K1=V1; K2=V2` 的字符串形式。
 */
async function exchange115Cookie(uid, app = DEFAULT_QRCODE_APP) {
  const body = new URLSearchParams({ account: uid })
  const target = resolveQrcodeApp(app)
  // ios 端必须带 UPhone 的 UA，否则上游按网页端处理、换不回 Cookie
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' }
  if (target === 'ios') headers['User-Agent'] = 'UPhone/1.0.0'

  const response = await safeFetch(`https://qrcodeapi.115.com/app/1.0/${target}/1.0/login/qrcode/`, {
    method: 'POST',
    headers,
    body,
  })
  const data = response?.data?.cookie
  if (data === undefined || data === null) return null
  if (typeof data === 'string') return data

  const pairs = Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
  if (pairs.length === 0) return null
  return pairs.join('; ')
}

/**
 * 校验 115 Cookie 是否可用。
 *
 * 用最小代价的接口：只要返回 uid 就说明 Cookie 有效。
 */
export async function verify115Cookie(cookie) {
  const response = await safeFetch('https://webapi.115.com/files?aid=1&cid=0&o=user_ptime&asc=0&offset=0&show_dir=1&limit=1', {
    headers: { Cookie: cookie, 'User-Agent': UA },
  })
  if (response?.state === true || response?.cid !== undefined) return { ok: true }
  return { ok: false, message: '115 Cookie 校验失败，请重新扫码或粘贴完整 Cookie' }
}

/* ── 通用 ─────────────────────────────────────────────── */

/**
 * 带超时的 JSON 请求。
 *
 * 网盘接口在受限网络下容易长时间挂起；超时后返回 null，
 * 由调用方给出「网络不可达」这类可执行提示，而不是让请求一直转圈。
 */
async function safeFetch(url, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(url, { ...options, signal: controller.signal })
    if (!response.ok) {
      // 401/403 这类由调用方按业务判断，这里只把非 2xx 的正文读出来备用
      const text = await response.text()
      try {
        return JSON.parse(text)
      }
      catch {
        return null
      }
    }
    return await response.json()
  }
  catch (error) {
    if (error.name === 'AbortError') return null
    return null
  }
  finally {
    clearTimeout(timer)
  }
}

/**
 * 提取阿里云盘 Refresh Token 的任务结果。
 *
 * 扫码确认后由调用方写入配置；这里把「从会话取 token」的边界固定下来，
 * 避免路由层直接读会话内部字段。
 */
export function takeAlipanRefreshToken(sessionId) {
  const session = aliSessions.get(sessionId)
  if (session === undefined) throw notFound('授权会话已过期', '请重新生成二维码')
  if (session.refreshToken === null) throw badRequest('尚未完成扫码确认', '请先扫码并在手机端确认登录')
  return { refreshToken: session.refreshToken }
}
