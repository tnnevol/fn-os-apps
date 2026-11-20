/**
 * 小雅 Alist 反向代理。
 *
 * 为什么需要它：统一网关只按 `gatewayPrefix` 注册一个前缀、一个 Socket，
 * 应用内部的其它服务（这里是 5678 的小雅面板）没有独立入口。
 * 若让用户自己去拼 `http://NAS地址:5678`，既拿不到网关的登录态，
 * 也没法在公网场景下工作。
 *
 * 因此把 alist 挂在应用的网关前缀下（`/app/fn-xiaoya-native/alist/`），
 * 由本进程转发到宿主机的 5678。这样用户在面板里点「打开」即可，
 * 走的是与面板同一个已鉴权入口。
 *
 * 边界与取舍：
 * - 只代理到固定的本机端口，不接受调用方指定上游，避免变成开放代理；
 * - 透传 Cookie / Range / Accept，保证登录态与大文件拖动可用；
 * - 不代理 WebSocket：小雅面板本身用不到，加上会显著增加转发复杂度。
 */
import { request as httpRequest } from 'node:http'

/** 代理前缀：对外路径以它开头，转发时剥掉。 */
export const ALIST_PROXY_PREFIX = '/alist'

/** 上游固定为容器映射的 5678，可用环境变量覆盖以便调试。 */
function upstreamBase() {
  return process.env.XIAOYA_ALIST_UPSTREAM ?? 'http://127.0.0.1:5678'
}

/** 不该透传给上游的逐跳头。 */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
])

/**
 * 判断当前请求是否由本代理处理。
 *
 * @param {string} pathname 已剥掉网关前缀的路径
 * @returns {boolean} 是否属于代理范围
 */
export function isAlistProxyPath(pathname) {
  return pathname === ALIST_PROXY_PREFIX || pathname.startsWith(`${ALIST_PROXY_PREFIX}/`)
}

/**
 * 转发请求到小雅上游。
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} pathname 已剥掉网关前缀的完整路径（含 /alist 前缀）
 * @param {string} search 原始查询串（含 ?）
 */
export function proxyToAlist(req, res, pathname, search) {
  // 剥掉代理前缀，剩下的就是小雅自己的路径
  const inner = pathname.slice(ALIST_PROXY_PREFIX.length) || '/'
  const target = new URL(`${upstreamBase()}${inner}${search}`)

  const headers = {}
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue
    if (HOP_BY_HOP.has(key)) continue
    headers[key] = value
  }
  // 上游以为自己在被直接访问；Host 用小雅的，部分重定向逻辑依赖它
  headers.host = target.host

  const upstream = httpRequest(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      path: `${target.pathname}${target.search}`,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      const outHeaders = {}
      for (const [key, value] of Object.entries(upstreamRes.headers)) {
        if (value === undefined) continue
        if (HOP_BY_HOP.has(key)) continue
        outHeaders[key] = value
      }
      // 小雅返回的重定向若指向它自己的根路径，要改写回代理前缀下，
      // 否则浏览器会跳到 /login 这种应用根路径，落在面板的 SPA 上而不是小雅
      const location = outHeaders.location
      if (typeof location === 'string' && location.startsWith('/')) {
        if (!location.startsWith(`${ALIST_PROXY_PREFIX}/`) && location !== ALIST_PROXY_PREFIX) {
          outHeaders.location = `${ALIST_PROXY_PREFIX}${location}`
        }
      }

      res.writeHead(upstreamRes.statusCode ?? 502, outHeaders)
      upstreamRes.pipe(res)
    },
  )

  upstream.on('error', () => {
    // 容器没起来是最常见的失败原因：给一段能直接看懂的话，
    // 而不是让浏览器显示空白页
    if (res.headersSent) {
      res.end()
      return
    }
    res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`<!doctype html><meta charset="utf-8">
<div style="font-family:system-ui;padding:40px;line-height:1.7;color:#e5e7eb;background:#17181c;height:100vh">
  <h2 style="margin:0 0 12px">小雅服务未运行</h2>
  <p style="margin:0 0 8px">无法连接到 ${upstreamBase()}。容器可能尚未启动。</p>
  <p style="margin:0"><a href="../service/alist" style="color:#409eff">返回面板启动小雅服务</a></p>
</div>`)
  })

  // GET/HEAD 没有请求体；其余方法直接管道转发（表单、上传都用得到）
  if (req.method === 'GET' || req.method === 'HEAD') {
    upstream.end()
    return
  }
  req.pipe(upstream)
}
