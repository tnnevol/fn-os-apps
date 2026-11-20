/**
 * 阿里云盘目录浏览。
 *
 * 用途：让用户可视化选择「转存目录」，把它对应的 folder id 写入
 * temp_transfer_folder_id.txt。之前这个值要手工粘贴 40 位十六进制串，
 * 既难获取又容易抄错。
 *
 * ## 为什么需要签名
 *
 * 新版阿里云盘接口（`api.alipan.com`）在 Refresh Token 之外还要求请求级
 * 签名，否则一律返回 AccessTokenInvalid。OpenList 的 `drivers/aliyundrive`
 * 实现里签名是强制的——这也是最初直接调 `adrive/v3/file/list` 失败的原因
 * （端点本身也不对：正确路径是 `v2/file/list`）。
 *
 * 签名细节见 aliyun-sign.mjs。
 *
 * ## 安全边界
 *
 * access_token 与签名私钥都只在服务端内存里持有，不落盘、不下发前端；
 * 前端只拿到「目录名 + file_id」。
 */
import { badRequest } from '../http/respond.mjs'
import { readSecret } from '../config/store.mjs'
import { ensureSession, signHeaders } from './aliyun-sign.mjs'

/** 换 access_token 的端点（与 OpenList 一致） */
const TOKEN_URL = 'https://auth.alipan.com/v2/account/token'

/** 目录列表端点（v2，需要签名） */
const LIST_URL = 'https://api.alipan.com/v2/file/list'

/** 新建目录端点 */
const CREATE_URL = 'https://api.alipan.com/adrive/v2/file/createWithFolders'

/** 用户信息端点，用于取 user_id 与 drive_id */
const USER_URL = 'https://api.alipan.com/v2/user/get'

/** 上游请求超时 */
const FETCH_TIMEOUT_MS = 15_000

/** access_token 缓存时长：有效期通常 2 小时，保守取 50 分钟。 */
const TOKEN_TTL_MS = 50 * 60 * 1000

/** 缓存键是 refresh_token：用户换账号后旧 token 自然失效。 */
let tokenCache = null

/** UA 与 canary 与 OpenList 保持一致，服务端会按客户端类型分流。 */
const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (compatible; fn-xiaoya-native)',
  'X-Canary': 'client=Android,app=adrive,version=v4.1.0',
}

/**
 * 用 Refresh Token 换 access_token 并补齐 userId / driveId。
 *
 * @returns {Promise<{token: string, userId: string, driveId: string}>} 会话信息
 */
async function accessToken() {
  const refreshToken = readSecret('refreshToken')
  if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
    throw badRequest(
      '尚未配置阿里云盘 Refresh Token',
      '请先在「账号配置 → 网盘授权」完成扫码或粘贴',
    )
  }

  if (tokenCache !== null && tokenCache.refreshToken === refreshToken && Date.now() - tokenCache.at < TOKEN_TTL_MS) {
    return tokenCache.session
  }

  let payload
  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: COMMON_HEADERS,
      body: JSON.stringify({ refresh_token: refreshToken, grant_type: 'refresh_token' }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    payload = await response.json()
  }
  catch (error) {
    throw badRequest(
      `无法连接阿里云盘：${error instanceof Error ? error.message : String(error)}`,
      '请检查 NAS 的网络连接',
    )
  }

  const token = payload?.access_token
  const userId = payload?.user_id
  if (typeof token !== 'string' || token === '' || typeof userId !== 'string' || userId === '') {
    throw badRequest(
      `刷新令牌失败：${payload?.message ?? payload?.code ?? '未知原因'}`,
      'Refresh Token 可能已失效，请重新授权',
    )
  }

  const driveId = typeof payload?.default_drive_id === 'string' ? payload.default_drive_id : ''
  const session = { token, userId, driveId }

  // 会话（上报公钥）是签名生效的前提，放在拿到 userId 之后
  await ensureSession(userId, refreshToken)

  // drive_id 缺失时补一次：少数响应不带 default_drive_id
  if (driveId === '') {
    session.driveId = await fetchDriveId(session)
  }

  tokenCache = { refreshToken, session, at: Date.now() }
  return session
}

/**
 * 补取默认 drive_id。
 *
 * @param {{token: string, userId: string}} session 会话
 * @returns {Promise<string>} drive id
 */
async function fetchDriveId(session) {
  try {
    const headers = { ...COMMON_HEADERS, Authorization: `Bearer ${session.token}`, ...(await signHeaders(session.userId)) }
    const response = await fetch(USER_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    const payload = await response.json()
    return typeof payload?.default_drive_id === 'string' ? payload.default_drive_id : ''
  }
  catch {
    return ''
  }
}

/**
 * 列出某个目录下的子目录。
 *
 * 只返回目录：目标是选「转存目录」，混着文件会让列表很长且无法选取。
 *
 * @param {string} parentId 父目录 id；根目录用 'root'
 * @returns {Promise<{items: Array<{id: string, name: string}>}>} 子目录列表
 */
export async function listFolders(parentId = 'root') {
  const session = await accessToken()
  if (session.driveId === '') {
    throw badRequest('无法确定默认网盘', '请重新授权阿里云盘')
  }

  // 一次最多 200 条，足够覆盖普通用户的目录数量
  const body = JSON.stringify({
    drive_id: session.driveId,
    parent_file_id: parentId,
    limit: 200,
    fields: '*',
    order_by: 'name',
    order_direction: 'ASC',
    url_expire_sec: 14400,
  })

  let payload
  try {
    const headers = {
      ...COMMON_HEADERS,
      Authorization: `Bearer ${session.token}`,
      ...(await signHeaders(session.userId)),
    }
    const response = await fetch(LIST_URL, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    payload = await response.json()
  }
  catch (error) {
    throw badRequest(
      `无法读取目录：${error instanceof Error ? error.message : String(error)}`,
      '请检查网络或稍后重试',
    )
  }

  // 接口报错时给出可读原因，而不是返回空列表让用户以为目录是空的
  if (payload?.code !== undefined) {
    throw badRequest(
      `读取目录失败：${payload.message ?? payload.code}`,
      '请确认 Refresh Token 有效，或重新授权',
    )
  }

  const items = Array.isArray(payload?.items) ? payload.items : []
  return {
    items: items
      .filter(item => item?.type === 'folder' && typeof item?.file_id === 'string')
      .map(item => ({
        id: item.file_id,
        name: typeof item.name === 'string' ? item.name : item.file_id,
      })),
  }
}

/**
 * 在指定目录下新建文件夹。
 *
 * 场景：小雅用的账号往往是个空盘，根目录下没有任何文件夹，
 * 用户无法选中「转存目录」。允许直接建一个省去跳到网页端。
 *
 * @param {string} parentId 父目录 id（根用 'root'）
 * @param {string} name 文件夹名
 * @returns {Promise<{id: string, name: string}>} 新建目录的 id 与名称
 */
export async function createFolder(parentId, name) {
  const folderName = typeof name === 'string' ? name.trim() : ''
  if (folderName === '') {
    throw badRequest('文件夹名称不能为空', '请输入名称后重试')
  }
  if (folderName.includes('/') || folderName === '.' || folderName === '..') {
    throw badRequest('文件夹名称不合法', '名称不能包含斜杠')
  }

  const session = await accessToken()
  if (session.driveId === '') {
    throw badRequest('无法确定默认网盘', '请重新授权阿里云盘')
  }

  let payload
  try {
    const response = await fetch(CREATE_URL, {
      method: 'POST',
      headers: {
        ...COMMON_HEADERS,
        Authorization: `Bearer ${session.token}`,
        ...(await signHeaders(session.userId)),
      },
      body: JSON.stringify({
        drive_id: session.driveId,
        parent_file_id: parentId,
        name: folderName,
        type: 'folder',
        // 同名时直接返回错误，避免建出「名称(1)」这类目录
        check_name_mode: 'refuse',
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    payload = await response.json()
  }
  catch (error) {
    throw badRequest(
      `新建文件夹失败：${error instanceof Error ? error.message : String(error)}`,
      '请检查网络后重试',
    )
  }

  if (typeof payload?.file_id !== 'string') {
    throw badRequest(
      `新建文件夹失败：${payload?.message ?? payload?.code ?? '未知原因'}`,
      '同名文件夹可能已存在，请换个名称',
    )
  }

  return { id: payload.file_id, name: folderName }
}

/** 清空缓存，用户改完 Refresh Token 后调用。 */
export function resetTokenCache() {
  tokenCache = null
}
