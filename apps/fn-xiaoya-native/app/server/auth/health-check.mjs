/**
 * 网盘凭据有效性检测。
 *
 * 对应上游脚本的 `check_aliyunpan_refreshtoken` / `check_aliyunpan_opentoken` /
 * `check_115_cookie` / `check_quark_cookie` / `check_uc_cookie`：
 * 面板要能直接告诉用户「这个 Cookie 还有效吗」，而不是等小雅运行失败才发现。
 *
 * ## 为什么不轮询
 *
 * 这些检测都要打到网盘官方接口，频繁请求会被限流甚至风控；
 * 而且凭据的有效期通常以天/月计，没有必要持续盯着。
 * 因此只在进入授权页时查一次，由前端主动触发。
 *
 * ## 结果只读
 *
 * 除了阿里云盘会在刷新时回写新 token（与上游一致，避免 token 轮换后失效），
 * 其余检测不修改任何配置。
 */
import { readSecret } from '../config/store.mjs'

/** 上游 UA：部分接口对默认 UA 会直接拒绝 */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

/** 夸克专用 UA：与上游 QUARK_UA 一致，普通 UA 会被识别为非客户端 */
const QUARK_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) quark-cloud-drive/2.5.20 Chrome/100.0.4896.160 Electron/18.3.5.4-bilibili-1.13 Safari/537.36 Channel/pckk_other_ch'

/** 单个检测的超时；进入页面时并发跑，过长会拖慢首屏 */
const TIMEOUT_MS = 12_000

/**
 * 检测结果。
 *
 * status 三态，避免把「网络不通」误报成「凭据失效」——
 * 前者用户不用改配置，后者必须重新授权。
 */
const OK = 'valid'
const BAD = 'invalid'
const UNKNOWN = 'unknown'

/** 取某个密钥的明文；未配置返回空串。 */
function secret(key) {
  const value = readSecret(key)
  return typeof value === 'string' ? value : ''
}

/**
 * 阿里云盘 Refresh Token。
 *
 * 与上游一致：换 token 成功即有效，并回写新值。
 * 回写很重要——阿里云的 refresh_token 会轮换，不回写会导致下次失效。
 *
 * @returns {Promise<{status: string, message: string, extra?: object}>} 检测结果
 */
async function checkRefreshToken() {
  const token = secret('refreshToken')
  if (token === '') {
    return { status: UNKNOWN, message: '未配置' }
  }

  try {
    const response = await fetch('https://auth.aliyundrive.com/v2/account/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': UA,
        Referer: 'https://www.aliyundrive.com/',
      },
      body: JSON.stringify({ refresh_token: token, grant_type: 'refresh_token' }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const payload = await response.json()

    const next = payload?.refresh_token
    if (typeof next === 'string' && next !== '') {
      // 与上游一致：把轮换后的 token 写回，否则下次就不再有效
      try {
        if (next !== token) {
          const { writeConfig } = await import('../config/store.mjs')
          writeConfig({ refreshToken: next })
        }
      }
      catch {
        // 回写失败不影响「有效性」判断
      }
      return {
        status: OK,
        message: '有效',
        extra: {
          nickname: payload?.nick_name ?? null,
          vip: typeof payload?.vip_status === 'string' ? payload.vip_status : null,
        },
      }
    }

    return { status: BAD, message: payload?.message ?? '令牌已失效，请重新授权' }
  }
  catch (error) {
    // 网络问题不算失效
    return { status: UNKNOWN, message: `无法连接阿里云盘：${error instanceof Error ? error.message : String(error)}` }
  }
}

/**
 * 阿里云盘 Open Token。
 *
 * 经 `opentoken_url.txt` 指定的服务换取。与 Refresh Token 不同，
 * 这里没有轮换回写的必要（服务每次都返回可用的 refresh_token）。
 *
 * @returns {Promise<{status: string, message: string}>} 检测结果
 */
async function checkOpenToken() {
  const token = secret('openToken')
  if (token === '') {
    return { status: UNKNOWN, message: '未配置' }
  }

  const endpoint = secret('opentokenUrl') || 'http://auth.xiaoya.pro/api/ali_open/refresh'
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ refresh_token: token, grant_type: 'refresh_token' }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const payload = await response.json().catch(() => null)
    const next = payload?.refresh_token
    if (typeof next === 'string' && next !== '') {
      return { status: OK, message: '有效' }
    }
    return { status: BAD, message: payload?.message ?? '令牌已失效，请重新扫码' }
  }
  catch (error) {
    return { status: UNKNOWN, message: `无法连接换取服务：${error instanceof Error ? error.message : String(error)}` }
  }
}

/**
 * 115 Cookie。
 *
 * 请求 `my.115.com/?ct=ajax&ac=nav`，响应里带 user_id 即有效；
 * 顺带取 vip 状态，让用户知道是普通还是会员。
 *
 * @returns {Promise<{status: string, message: string, extra?: object}>} 检测结果
 */
async function check115() {
  const cookie = secret('cookie115')
  if (cookie === '') {
    return { status: UNKNOWN, message: '未配置' }
  }

  try {
    const response = await fetch('https://my.115.com/?ct=ajax&ac=nav', {
      headers: {
        Cookie: cookie,
        'User-Agent': UA,
        Referer: 'https://115.com/',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const text = await response.text()

    if (!text.includes('user_id')) {
      return { status: BAD, message: 'Cookie 已失效，请重新扫码或粘贴' }
    }

    // vip 字段：0 普通，其它为会员等级
    const vipMatch = /"vip":\s*"?(\d+)"?/.exec(text)
    const vip = vipMatch === null ? null : Number(vipMatch[1])
    return {
      status: OK,
      message: vip === null ? '有效' : (vip === 0 ? '有效（普通用户）' : '有效（VIP 用户）'),
      extra: { vip },
    }
  }
  catch (error) {
    return { status: UNKNOWN, message: `无法连接 115：${error instanceof Error ? error.message : String(error)}` }
  }
}

/**
 * 夸克 Cookie。
 *
 * 上游按配置接口的 HTTP 状态判断：401 失效、200 有效。
 * 这里同样看状态码，再尝试取会员类型作为附加信息。
 *
 * @returns {Promise<{status: string, message: string, extra?: object}>} 检测结果
 */
async function checkQuark() {
  const cookie = secret('cookieQuark')
  if (cookie === '') {
    return { status: UNKNOWN, message: '未配置' }
  }

  const headers = {
    Cookie: cookie,
    'User-Agent': QUARK_UA,
    Referer: 'https://pan.quark.cn',
  }

  try {
    const response = await fetch('https://drive-pc.quark.cn/1/clouddrive/config?pr=ucpro&fr=pc&uc_param_str=', {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (response.status === 401) {
      return { status: BAD, message: 'Cookie 已失效，请重新粘贴' }
    }
    if (!response.ok) {
      return { status: UNKNOWN, message: `夸克返回 ${response.status}` }
    }

    // 会员类型只是附加信息，取不到不影响有效性判断
    let member = null
    try {
      const memberRes = await fetch(
        'https://drive-pc.quark.cn/1/clouddrive/member?pr=ucpro&fr=pc&uc_param_str=&fetch_subscribe=true&_ch=home&fetch_identity=true',
        { headers, signal: AbortSignal.timeout(TIMEOUT_MS) },
      )
      const memberJson = await memberRes.json()
      member = memberJson?.data?.member_type ?? null
    }
    catch {
      // 忽略：会员信息不是必需
    }

    const label = member === null
      ? '有效'
      : (member === 'NORMAL' ? '有效（普通用户）' : `有效（${member}）`)
    return { status: OK, message: label, extra: { memberType: member } }
  }
  catch (error) {
    return { status: UNKNOWN, message: `无法连接夸克：${error instanceof Error ? error.message : String(error)}` }
  }
}

/**
 * UC Cookie。
 *
 * UC 与夸克同源（同为 ucpro 体系），但接口域名不同，单独检测。
 *
 * @returns {Promise<{status: string, message: string}>} 检测结果
 */
async function checkUc() {
  const cookie = secret('cookieUc')
  if (cookie === '') {
    return { status: UNKNOWN, message: '未配置' }
  }

  try {
    // UC 的接口域名与夸克不同：drive-pc.uc.cn 不可用，实测 pc-api.uc.cn 才会返回 401/200
    const response = await fetch('https://pc-api.uc.cn/1/clouddrive/config?pr=ucpro&fr=pc&uc_param_str=', {
      headers: {
        Cookie: cookie,
        'User-Agent': UA,
        Referer: 'https://drive.uc.cn',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (response.status === 401) {
      return { status: BAD, message: 'Cookie 已失效，请重新粘贴' }
    }
    if (!response.ok) {
      return { status: UNKNOWN, message: `UC 返回 ${response.status}` }
    }
    return { status: OK, message: '有效' }
  }
  catch (error) {
    return { status: UNKNOWN, message: `无法连接 UC：${error instanceof Error ? error.message : String(error)}` }
  }
}

/**
 * 一次性检测全部网盘凭据。
 *
 * 并发执行：串行 5 个检测最坏要等一分多钟，用户只会以为页面卡死。
 *
 * @returns {Promise<Record<string, {status: string, message: string, extra?: object}>>} 各网盘的检测结果
 */
export async function checkAllCredentials() {
  const [refreshToken, openToken, pan115, quark, uc] = await Promise.all([
    checkRefreshToken(),
    checkOpenToken(),
    check115(),
    checkQuark(),
    checkUc(),
  ])

  return { refreshToken, openToken, pan115, quark, uc }
}
