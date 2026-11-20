/**
 * 飞牛开放 API 客户端（后端侧）。
 *
 * 后端 API 只能通过 Unix Socket 调用，不能从浏览器直连：
 *   POST /api/v1/trimapp   @ /var/run/trim_open_gateway_apiscope.socket
 *   Authorization: Bearer <TRIM_API_TOKEN>
 *
 * TRIM_API_TOKEN 由飞牛在启动 cmd/main 时注入，且可能在重装/重新注册后变化，
 * 因此每次调用都从当前进程环境变量现读，绝不缓存到文件或配置里。
 *
 * 设计要点：所有能力都「可降级」。开发机没有飞牛环境时，
 * 这些调用会失败，但面板其余功能必须照常工作——所以统一返回
 * { ok: false, reason } 而不是抛异常，由调用方决定如何提示。
 */
import { request } from 'node:http'

/** 飞牛开放 API 的 Unix Socket 路径。 */
const API_SOCKET = '/var/run/trim_open_gateway_apiscope.socket'

/** 应用名，与 manifest 的 appname 一致。 */
const APP_NAME = process.env.TRIM_APPNAME ?? 'fn-xiaoya-native'

/** 请求序号，仅用于日志关联。 */
let seq = 0

/**
 * 是否具备调用飞牛后端 API 的条件。
 *
 * 开发环境没有 socket 也没有 token，提前判断可以让调用方给出
 * 「开发环境不支持」这种准确提示，而不是抛一个 ECONNREFUSED。
 */
export function hasTrimApi() {
  const token = process.env.TRIM_API_TOKEN
  return typeof token === 'string' && token !== ''
}

/**
 * 调用一个飞牛后端能力。
 *
 * @param {string} req 能力标识，例如 trim.file.getSharedAccessibleFolders
 * @param {object} data 该能力的参数
 * @returns {Promise<{ok: boolean, data?: any, code?: number, msg?: string, reason?: string}>} 成功时 ok 为真并带 data；失败时带可展示的 reason
 */
export function callTrimApi(req, data = {}) {
  const token = process.env.TRIM_API_TOKEN
  if (typeof token !== 'string' || token === '') {
    return Promise.resolve({
      ok: false,
      reason: '当前环境没有飞牛 API 令牌（开发环境或未通过应用中心启动）',
    })
  }

  const body = JSON.stringify({
    reqId: String(++seq),
    req,
    appName: APP_NAME,
    data,
  })

  return new Promise((resolve) => {
    const client = request(
      {
        socketPath: API_SOCKET,
        path: '/api/v1/trimapp',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Authorization: `Bearer ${token}`,
        },
        timeout: 15_000,
      },
      (res) => {
        let raw = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => { raw += chunk })
        res.on('end', () => {
          let parsed
          try {
            parsed = JSON.parse(raw)
          }
          catch {
            resolve({ ok: false, reason: `飞牛 API 返回了非 JSON 响应（HTTP ${res.statusCode}）` })
            return
          }
          if (parsed?.code === 0) {
            resolve({ ok: true, data: parsed.data })
          }
          else {
            resolve({
              ok: false,
              code: parsed?.code,
              msg: parsed?.msg ?? '',
              // 把飞牛的原始消息带上，便于用户/维护者定位（例如「仅管理员可进行此操作」）
              reason: parsed?.msg || `飞牛 API 返回错误码 ${parsed?.code}`,
            })
          }
        })
      },
    )

    client.on('timeout', () => {
      client.destroy()
      resolve({ ok: false, reason: '调用飞牛 API 超时' })
    })
    client.on('error', (error) => {
      // socket 不存在 = 不在飞牛环境；权限不足 = 应用用户未获授权
      if (error.code === 'ENOENT') {
        resolve({ ok: false, reason: '未检测到飞牛开放 API（当前可能不是飞牛环境）' })
        return
      }
      if (error.code === 'EACCES') {
        resolve({ ok: false, reason: '应用用户无权访问飞牛开放 API' })
        return
      }
      resolve({ ok: false, reason: `调用飞牛 API 失败：${error.message}` })
    })

    client.end(body)
  })
}

/**
 * 查询当前应用已获授权的目录列表。
 *
 * 这是「元数据目录」的权威来源：用户在飞牛里授权了哪些目录，
 * 面板就只允许从这些目录里选，不能凭前端传一个路径就当已授权。
 */
export async function getSharedFolders() {
  const result = await callTrimApi('trim.file.getSharedAccessibleFolders', {})
  if (!result.ok) return { ok: false, paths: [], reason: result.reason }
  const paths = Array.isArray(result.data?.paths) ? result.data.paths.filter(p => typeof p === 'string') : []
  return { ok: true, paths }
}

/**
 * 检查指定用户对若干路径的权限。
 *
 * 授权只让「应用用户」能访问目录；是否展示/写入还要看当前使用用户的 ACL。
 * 返回 Map<path, {readable, writable, deletable}>，查询失败的路径不出现。
 */
export async function checkUserAcl(uid, paths) {
  const list = Array.isArray(paths) ? paths.filter(p => typeof p === 'string' && p !== '') : []
  if (list.length === 0) return { ok: true, acl: new Map() }

  const numericUid = Number(uid)
  if (!Number.isInteger(numericUid)) {
    return { ok: false, acl: new Map(), reason: '缺少有效的用户 UID' }
  }

  const result = await callTrimApi('trim.file.checkUserACL', { uid: numericUid, path: list })
  if (!result.ok) return { ok: false, acl: new Map(), reason: result.reason }

  const acl = new Map()
  for (const item of Array.isArray(result.data) ? result.data : []) {
    if (typeof item?.path !== 'string') continue
    acl.set(item.path, {
      readable: item.readable === true,
      writable: item.writable === true,
      deletable: item.deletable === true,
    })
  }
  return { ok: true, acl }
}

/**
 * 把用户选择的路径校验为「已授权目录的子路径」。
 *
 * 这是安全边界：即使前端被篡改，也只能操作管理员已经授权给应用的目录。
 * 用 realpath 折叠 `..` 与符号链接后再比较前缀，避免路径穿越。
 *
 * @param {string} target 待校验的绝对路径
 * @param {string[]} allowedRoots 已授权目录
 */
export function isWithinAllowed(target, allowedRoots) {
  if (typeof target !== 'string' || target === '') return false
  const normalized = normalizePath(target)
  return allowedRoots.some((root) => {
    const r = normalizePath(root)
    return normalized === r || normalized.startsWith(`${r}/`)
  })
}

/** 折叠重复分隔符与 `..`，不访问文件系统（授权目录不一定本地可见）。 */
function normalizePath(input) {
  const parts = []
  for (const segment of input.split('/')) {
    if (segment === '' || segment === '.') continue
    if (segment === '..') parts.pop()
    else parts.push(segment)
  }
  return `/${parts.join('/')}`
}
