/**
 * 静态资源服务。
 *
 * 面板是 Vite 构建出的 SPA：带哈希的静态文件可以长缓存，`index.html` 必须不缓存，
 * 其余路径回退到 `index.html` 交给前端路由处理。
 *
 * 路径处理是本文件的风险点：任何 `..` 或编码绕过都可能读到应用目录之外，
 * 因此解析后必须确认最终路径仍落在 `webRoot` 内。
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { webRoot } from '../paths.mjs'

/** 扩展名到 Content-Type 的映射。 */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

/** 判断路径是否仍在根目录内。 */
function insideRoot(root, target) {
  const rootPath = resolve(root)
  const targetPath = resolve(target)
  return targetPath === rootPath || targetPath.startsWith(`${rootPath}/`)
}

/** 把请求路径映射到磁盘文件。 */
function resolveFile(pathname) {
  // 先解码再 normalize：`%2e%2e%2f` 这类编码只有在解码后才能被 normalize 折叠掉
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  }
  catch {
    return null
  }
  const relative = normalize(decoded).replace(/^(\.\.[/\\])+/, '')
  const candidate = join(webRoot, relative)
  if (!insideRoot(webRoot, candidate)) return null
  return candidate
}

/** 发送文件。 */
function sendFile(res, filePath, { immutable }) {
  const ext = extname(filePath).toLowerCase()
  const size = statSync(filePath).size
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Content-Length': size,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  createReadStream(filePath).pipe(res)
}

/**
 * 静态资源处理器。
 *
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} pathname
 */
export async function serveStatic(req, res, pathname) {
  // 构建产物不存在时给出明确提示，而不是空响应：开发阶段最常见就是这个原因
  if (!existsSync(join(webRoot, 'index.html'))) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('前端资源尚未构建。请在应用目录执行 web 构建，或使用开发服务器。')
    return
  }

  const direct = resolveFile(pathname)
  if (direct !== null && existsSync(direct) && statSync(direct).isFile()) {
    // 带哈希的 assets 文件名内容稳定，可以长缓存
    const immutable = pathname.startsWith('/assets/')
    sendFile(res, direct, { immutable })
    return
  }

  // 构建产物缺失的 assets 请求必须返回 404，不能回退到 index.html。
  // 回退会返回 text/html，浏览器按 module script 解析时直接报
  // 「Expected a JavaScript-or-Wasm module script but ... MIME type text/html」，
  // 而且因为是 200，前端也没法通过状态码判断资源已失效。
  // 真实场景：应用升级后旧页面仍在跑，用旧哈希请求新版本已删除的 chunk。
  if (pathname.startsWith('/assets/')) {
    res.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    })
    res.end('资源不存在：应用可能已更新，请刷新页面。')
    return
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Method Not Allowed')
    return
  }

  // SPA 回退：未知路径交给前端路由
  sendFile(res, join(webRoot, 'index.html'), { immutable: false })
}
