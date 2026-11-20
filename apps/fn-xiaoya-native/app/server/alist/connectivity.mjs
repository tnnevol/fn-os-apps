/**
 * 小雅连通性与访问地址推导。
 *
 * 面板需要知道「小雅现在能不能访问、该用哪个地址访问」，才能给出可执行的提示。
 * 上游 all_in_one.sh 的做法是 `test_xiaoya_status`：拿 README.md 去试几个候选地址，
 * 看响应里有没有 `x-oss-` / `x-115-request-id` 这类网盘回源头。
 *
 * 这里做同样的事，只是候选地址改为按本机网卡打分后得到的列表。
 */
import { readConfig } from '../config/store.mjs'
import { readDockerAddress, readSign } from '../config/sign.mjs'
import { localAddress } from '../system/net.mjs'

/** 探测超时：小雅刚启动时可能很慢，但超过这个时间用户也不会再等。 */
const PROBE_TIMEOUT_MS = 4000

/** 小雅面板使用的容器内端口。 */
const ALIST_PORT = 5678

/** 用一个必然存在的小文件做探针，避免拉整个目录。 */
const PROBE_PATH = '/d/README.md'

/** 带超时的 fetch，返回 null 表示失败。 */
async function tryFetch(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'fn-xiaoya-native' },
    })
    const text = await response.text()
    return { ok: true, status: response.status, text: text.slice(0, 512) }
  }
  catch {
    return null
  }
  finally {
    clearTimeout(timer)
  }
}

/**
 * 判断响应是否真的来自小雅（而不是 502 错误页或登录页）。
 *
 * 只看状态码不够：小雅未就绪时 nginx 会返回 502，强制登录开启时会返回登录页，
 * 两者的状态码都可能是 200/302，必须看内容特征。
 */
function looksLikeXiaoya(result) {
  if (result === null) return false
  return /x-oss-|x-115-request-id|aliyundrive|115\.com/i.test(result.text)
}

/**
 * 列出候选访问地址，按可信度排序。
 *
 * 顺序有意为之：先本机回环（容器一定在监听），再用户配置的对外地址，
 * 最后是网卡推导出的局域网地址。
 */
function candidateAddresses() {
  const list = [`http://127.0.0.1:${ALIST_PORT}`]

  const configured = readDockerAddress()
  if (configured !== null && configured !== '') list.push(configured)

  const lan = localAddress()
  if (lan !== null && lan !== '') list.push(`http://${lan}:${ALIST_PORT}`)

  // 去重，保留首次出现的顺序
  return [...new Set(list)]
}

/**
 * 探测小雅是否可达。
 *
 * @returns {Promise<{reachable: boolean, baseUrl: string|null, signEnabled: boolean,
 *   forceLogin: boolean, reason: string, checks: Array<object>}>}
 */
export async function probeConnectivity() {
  const sign = readSign()
  const config = readConfig()
  const base = {
    signEnabled: sign.enabled === true,
    forceLogin: config.switches?.forceLogin === true,
  }

  const checks = []
  for (const baseUrl of candidateAddresses()) {
    const url = `${baseUrl}${PROBE_PATH}${sign.query ?? ''}`
    const result = await tryFetch(url)
    const reachable = looksLikeXiaoya(result)
    checks.push({
      baseUrl,
      reachable,
      status: result?.status ?? null,
      reason: reachable
        ? 'ok'
        : (result === null ? '无法连接' : '返回内容不是小雅（可能是错误页或登录页）'),
    })
    if (reachable) {
      return { reachable: true, baseUrl, ...base, reason: 'ok', checks }
    }
  }

  return {
    reachable: false,
    baseUrl: null,
    ...base,
    reason: '无法连接',
    checks,
  }
}

/**
 * 生成元数据包下载地址。
 *
 * 上游用 `get_sign` 拼 `?sign=md5(guestpass)`：强制登录开启后，
 * 不带签名会被重定向到登录页，下载到的就是一张提示图（这正是
 * 之前 config.mp4 只有 94KB 的原因）。
 *
 * @param {string} name 包文件名，如 config.mp4
 * @param {string} [baseUrl] 访问小雅的基地址
 * @returns {string} 完整下载地址
 */
export function metadataDownloadUrl(name, baseUrl) {
  const sign = readSign()
  const origin = baseUrl ?? readDockerAddress() ?? `http://127.0.0.1:${ALIST_PORT}`
  // 目录名是中文，必须编码；小雅侧按解码后的路径匹配
  const encoded = encodeURIComponent(name)
  return `${origin}/d/${encodeURIComponent('元数据')}/${encoded}${sign.query ?? ''}`
}
