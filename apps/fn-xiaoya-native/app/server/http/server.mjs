/**
 * HTTP 层。
 *
 * 不引入 Web 框架：目标设备不许装 npm 依赖，Node 标准库足够覆盖这里的路由量。
 * 代价是要自己处理请求体读取、路由匹配与错误归一化，这些都在本文件内收口。
 */
import { createServer } from 'node:http'
import { AppError, normalizeError, notFound } from './respond.mjs'
import { resolveUser } from './auth.mjs'

/** 请求体上限：配置项都很小，超过 1MB 一定是异常请求。 */
const BODY_LIMIT = 1024 * 1024

/**
 * 创建路由表。
 *
 * 路由在注册时就把方法固定下来，避免「一个路径同时响应多种方法」导致的越权。
 */
export function createRouter() {
  /** @type {Array<{method: string, pattern: RegExp, keys: string[], handler: Function}>} */
  const routes = []

  const add = (method, path, handler) => {
    const keys = []
    // 把 /a/:id 编译成正则，并把参数名记录下来供取值
    const pattern = new RegExp(
      `^${path
        .split('/')
        .map((segment) => {
          if (segment.startsWith(':')) {
            keys.push(segment.slice(1))
            return '([^/]+)'
          }
          return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        })
        .join('/')}$`,
    )
    routes.push({ method, pattern, keys, handler })
  }

  return {
    get: (path, handler) => add('GET', path, handler),
    post: (path, handler) => add('POST', path, handler),
    put: (path, handler) => add('PUT', path, handler),
    delete: (path, handler) => add('DELETE', path, handler),
    match(method, pathname) {
      for (const route of routes) {
        if (route.method !== method) continue
        const match = route.pattern.exec(pathname)
        if (match === null) continue
        const params = {}
        route.keys.forEach((key, index) => {
          params[key] = decodeURIComponent(match[index + 1])
        })
        return { handler: route.handler, params }
      }
      return null
    },
  }
}

/** 读取并解析 JSON 请求体。 */
async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > BODY_LIMIT) {
      throw new AppError(413, '请求体过大', '请检查提交内容')
    }
    chunks.push(chunk)
  }
  if (size === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  }
  catch {
    throw new AppError(400, '请求体不是合法 JSON', '请刷新页面后重试')
  }
}

/** 写 JSON 响应。 */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    // 面板与网关同源，但开发环境跨端口，统一放开本地来源
    'Cache-Control': 'no-store',
  })
  res.end(payload)
}

/**
 * 启动 HTTP 服务。
 *
 * @param {{router: ReturnType<typeof createRouter>, staticHandler: Function, listen: object}} options
 */
export function createApp({ router, staticHandler }) {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const pathname = url.pathname

    // API 前置于静态资源：避免 /api 被 SPA fallback 抢走
    if (pathname.startsWith('/api/')) {
      try {
        const matched = router.match(req.method ?? 'GET', pathname)
        if (matched === null) throw notFound('接口不存在', '请检查请求路径')

        // 身份解析放在路由之后：静态资源不需要身份，未匹配的 API 也不该先被判 401
        const user = resolveUser(req)
        const query = Object.fromEntries(url.searchParams.entries())
        const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readJson(req)

        const result = await matched.handler({ req, user, params: matched.params, query, body })
        sendJson(res, 200, result ?? { code: 0, message: 'ok', data: null })
      }
      catch (error) {
        const normalized = normalizeError(error)
        sendJson(res, normalized.status, normalized.toBody())
      }
      return
    }

    // 其余请求交给静态资源处理器（含 SPA 回退）
    try {
      await staticHandler(req, res, pathname)
    }
    catch (error) {
      const normalized = normalizeError(error)
      sendJson(res, normalized.status, normalized.toBody())
    }
  })
}
