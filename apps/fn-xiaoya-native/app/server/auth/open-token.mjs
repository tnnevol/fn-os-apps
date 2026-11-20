/**
 * 阿里云盘 Open Token 扫码获取。
 *
 * ## 为什么必须依赖第三方服务
 *
 * 换取 Open Token 需要 OAuth 的 client_id / client_secret，而这两个值属于
 * 阿里云盘开放平台的「应用凭证」，普通用户无法自助申请。小雅上游的做法是
 * 把它们交给 `auth.xiaoya.pro`（或 messense 的镜像服务）代持——
 * 上游代码里 client_id/client_secret 都是空字符串，由服务端补全。
 *
 * 所以本模块也走同一套服务，流程与上游 aliyunopentoken.py 一致：
 *   1. GET  /api/ali_open/qr            → 拿 sid
 *   2. 二维码内容 = https://www.aliyundrive.com/o/oauth/authorize?sid=…
 *   3. 轮询 openapi.alipan.com/oauth/qrcode/{sid}/status → 拿 authCode
 *   4. POST /api/ali_open/refresh       → 换出 refresh_token（即 Open Token）
 *
 * ## 安全边界
 *
 * 授权码只在服务端流转，不经过浏览器；用户的 Open Token 由后端直接写入
 * 配置文件，前端只看到掩码。同时把换取地址写进 opentoken_url.txt，
 * 保证小雅容器后续用同一个服务刷新 token，不会因为换个地址而失效。
 */
import { randomUUID } from 'node:crypto'
import { badRequest, notFound } from '../http/respond.mjs'
import { writeConfig } from '../config/store.mjs'

/** 默认换取服务；用户可在设置里改，但扫码时以这里的为准并同步写入配置 */
const DEFAULT_EXCHANGE = 'http://auth.xiaoya.pro/api/ali_open/refresh'

/** 二维码内容的基址 */
const QR_AUTHORIZE_BASE = 'https://www.aliyundrive.com/o/oauth/authorize'

/** 轮询状态的上游地址 */
const STATUS_URL = 'https://openapi.alipan.com/oauth/qrcode'

/** 会话存活时长：上游二维码通常 5 分钟有效，这里留些余量。 */
const SESSION_TTL_MS = 6 * 60 * 1000

/** 单次上游请求超时 */
const FETCH_TIMEOUT_MS = 12_000

/**
 * 进行中的扫码会话。
 *
 * 只存在内存：进程重启后用户重新扫码即可，不需要持久化凭据。
 */
const sessions = new Map()

/** 清理过期会话，避免长期运行后无限增长。 */
function pruneSessions() {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL_MS) sessions.delete(id)
  }
}

/**
 * 创建 Open Token 扫码会话。
 *
 * @returns {Promise<{sessionId: string, qrContent: string, expiresIn: number}>} 会话与二维码内容
 */
export async function createOpenTokenQr() {
  pruneSessions()

  let payload
  try {
    const response = await fetch('http://auth.xiaoya.pro/api/ali_open/qr', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; fn-xiaoya-native)' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    payload = await response.json()
  }
  catch (error) {
    throw badRequest(
      `无法申请 Open Token 扫码：${error instanceof Error ? error.message : String(error)}`,
      '换取服务可能暂时不可用，请稍后重试；也可改用「手工填写」',
    )
  }

  const sid = typeof payload?.sid === 'string' ? payload.sid : ''
  if (sid === '') {
    throw badRequest('换取服务没有返回 sid', '请稍后重试或改用「手工填写」')
  }

  /**
   * 取官方二维码图片。
   *
   * 关键：服务返回的 `qrCodeUrl` 指向的是一张 430x430 的二维码**图片**，
   * 不是授权页 URL。之前的实现把它当成内容再编码成二维码，
   * 扫出来得到的是「图片地址」这个字符串，App 自然跳到错误页。
   *
   * 正确做法：直接把官方图片取回来给前端展示，扫的就是阿里云自己生成的码。
   */
  const qrCodeUrl = typeof payload?.qrCodeUrl === 'string' ? payload.qrCodeUrl : ''
  let qrImage = ''
  if (qrCodeUrl !== '') {
    try {
      const imageResponse = await fetch(qrCodeUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      if (imageResponse.ok) {
        const buffer = Buffer.from(await imageResponse.arrayBuffer())
        const type = imageResponse.headers.get('content-type') ?? 'image/jpeg'
        qrImage = `data:${type.split(';')[0]};base64,${buffer.toString('base64')}`
      }
    }
    catch {
      // 取图失败不阻断：回退到用 sid 拼授权链接，前端仍能编码出可用二维码
    }
  }

  const sessionId = randomUUID()
  sessions.set(sessionId, {
    sid,
    createdAt: Date.now(),
    /** 已完成时保存结果，供轮询取一次 */
    result: null,
  })

  return {
    sessionId,
    // 前端优先展示 qrImage；为空时回退用 qrContent 自行编码
    qrImage,
    qrContent: `${QR_AUTHORIZE_BASE}?sid=${sid}`,
    expiresIn: Math.floor(SESSION_TTL_MS / 1000),
  }
}

/**
 * 用 authCode 换取 Open Token。
 *
 * @param {string} authCode 上游返回的授权码
 * @returns {Promise<{openToken: string}>} 换到的 refresh_token
 */
async function exchangeOpenToken(authCode) {
  let payload
  try {
    const response = await fetch(DEFAULT_EXCHANGE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; fn-xiaoya-native)',
      },
      // client_id / client_secret 留空：由该服务补全，这是上游既定做法
      body: JSON.stringify({
        code: authCode,
        grant_type: 'authorization_code',
        client_id: '',
        client_secret: '',
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    payload = await response.json()
  }
  catch (error) {
    throw badRequest(
      `换取 Open Token 失败：${error instanceof Error ? error.message : String(error)}`,
      '请重新扫码；若持续失败可改用「手工填写」',
    )
  }

  const token = payload?.refresh_token
  if (typeof token !== 'string' || token.length === 0) {
    throw badRequest('换取服务没有返回 refresh_token', '请重新扫码或改用「手工填写」')
  }
  return { openToken: token }
}

/**
 * 轮询扫码状态。
 *
 * 扫码成功时直接把 Open Token 与换取地址写入配置：
 * 用户扫码后无需再做任何操作，容器下次启动即可读到。
 *
 * @param {string} sessionId 会话 id
 * @returns {Promise<{status: string, saved?: boolean}>} 状态：waiting / scanned / success / expired
 */
export async function pollOpenTokenQr(sessionId) {
  const session = sessions.get(sessionId)
  if (session === undefined) {
    throw notFound('扫码会话不存在或已过期', '请重新生成二维码')
  }
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(sessionId)
    return { status: 'expired' }
  }

  // 已完成：直接回报，避免重复换取
  if (session.result !== null) {
    return session.result
  }

  let payload
  try {
    const response = await fetch(`${STATUS_URL}/${session.sid}/status`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; fn-xiaoya-native)' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!response.ok) {
      return { status: 'waiting' }
    }
    payload = await response.json()
  }
  catch {
    // 网络抖动不算失败：继续等待下一次轮询
    return { status: 'waiting' }
  }

  const status = typeof payload?.status === 'string' ? payload.status : 'WaitLogin'

  /**
   * 状态判定要精确，不能「非 WaitLogin 即过期」。
   *
   * 阿里云实际会返回：WaitLogin（待扫）、QRCodeExpired（过期）、
   * LoginSuccess（已确认）。若把未知状态一律当过期，
   * 网络抖一下或出现「已扫码待确认」这类中间态就会误报过期，
   * 用户看到的就是「几十秒就失效」。
   *
   * 只有明确 QRCodeExpired 才算过期，其余未知状态继续等待。
   */
  if (status === 'QRCodeExpired') {
    sessions.delete(sessionId)
    return { status: 'expired' }
  }
  // 其余未识别状态（含「已扫码待确认」这类中间态）继续等待
  if (status !== 'LoginSuccess') return { status: 'waiting' }

  const authCode = payload?.authCode
  if (typeof authCode !== 'string' || authCode === '') {
    // 状态已是 LoginSuccess 但还没拿到 authCode：再等下一次轮询
    return { status: 'waiting' }
  }

  const { openToken } = await exchangeOpenToken(authCode)

  // 同时写入换取地址：容器刷新 token 时要用同一个服务，
  // 否则会出现「写入成功但容器刷新失败」的不一致。
  writeConfig({
    openToken,
    opentokenUrl: DEFAULT_EXCHANGE,
  })

  const result = { status: 'success', saved: true }
  session.result = result
  return result
}
