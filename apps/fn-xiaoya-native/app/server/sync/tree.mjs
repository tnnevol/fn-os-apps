/**
 * 元数据目录树代理。
 *
 * 用户在面板里勾选要同步的目录，需要一个可展开的目录树。
 * 目录结构只在镜像站上，浏览器直连会遇到两个问题：
 * - 跨域被拦（镜像不返回 CORS 头）；
 * - 镜像域名在用户网络里可能不可达，而 NAS 可达。
 *
 * 因此由后端代理：先选出最快的镜像，再抓取指定目录的列表页解析成树。
 * 只做「读目录」这一件事，不接受任意 URL，避免变成开放代理。
 */
import { serverError } from '../http/respond.mjs'
import { resolveMirror } from './mirror.mjs'

/** 单次抓取超时。 */
const FETCH_TIMEOUT_MS = 12_000

/** 同时展开的层级上限，防止恶意/异常页面导致递归过深。 */
const MAX_DEPTH = 3

/** 每层最多返回的条目数。 */
const MAX_ENTRIES = 200

/**
 * 校验路径。
 *
 * 只允许形如 `电影` 或 `电影/动作片` 的相对路径：
 * 收敛掉 `..`、绝对路径与协议，确保拼出来的 URL 不会指向镜站之外。
 */
function sanitizePath(raw) {
  if (typeof raw !== 'string') return ''
  return raw
    .split('/')
    .filter(seg => seg !== '' && seg !== '.' && seg !== '..')
    .slice(0, MAX_DEPTH)
    .join('/')
}

/** 把目录名拼成 nginx 目录页的 URL。 */
function buildUrl(base, path) {
  const encoded = path
    .split('/')
    .filter(Boolean)
    .map(seg => encodeURIComponent(seg))
    .join('/')
  return `${base.replace(/\/+$/, '')}/${encoded}${encoded === '' ? '' : '/'}`
}

/**
 * 解析 nginx 自动索引页。
 *
 * 小雅镜像用的是 nginx autoindex，形如：
 *   <a href="%E7%94%B5%E5%BD%B1/">电影/</a>  07-Jan-2026 18:23  -
 * 只取目录（href 以 / 结尾），文件不在这里用；实体与 URL 编码都要还原。
 */
function parseAutoindex(html) {
  const entries = []
  // href 里可能有 URL 编码，也有未编码的中文；链接文本作为兜底名称
  const linkPattern = /<a\s+href="([^"]+)"[^>]*>([^<]*)<\/a>/gi
  let match = linkPattern.exec(html)
  while (match !== null) {
    const href = match[1]
    const text = match[2]
    if (href.startsWith('../') || href.startsWith('?') || href.startsWith('/') || !href.endsWith('/')) {
      match = linkPattern.exec(html)
      continue
    }
    let name
    try {
      name = decodeURIComponent(href.replace(/\/+$/, ''))
    }
    catch {
      name = href.replace(/\/+$/, '')
    }
    if (name !== '' && name !== '..' && name !== '.') {
      entries.push({ name, isDir: true })
    }
    match = linkPattern.exec(html)
  }
  // 同页可能重复出现（标题/面包屑），去重保序
  const seen = new Set()
  return entries.filter((item) => {
    if (seen.has(item.name)) return false
    seen.add(item.name)
    return true
  }).slice(0, MAX_ENTRIES)
}

/**
 * 抓取并解析一个目录。
 *
 * @param {string} path 相对路径，空字符串表示根
 * @param {number} depth 展开层数：1 只列当前层，>1 递归展开子目录
 */
export async function fetchTree(path, depth = 1) {
  const clean = sanitizePath(path)
  const base = await resolveMirror()
  const target = buildUrl(base, clean)

  // 只允许请求镜像站本身：base 由 mirror.mjs 决定，不接受外部传入
  let response
  try {
    response = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; fn-xiaoya-native)' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'follow',
    })
  }
  catch (error) {
    throw serverError(
      `抓取目录失败：${error instanceof Error ? error.message : String(error)}`,
      '请稍后重试，或在设置里重新测速挑选镜像',
    )
  }

  if (!response.ok) {
    throw serverError(
      `镜像返回 ${response.status}`,
      '该镜像可能暂时不可用，请重新测速后再试',
    )
  }

  const html = await response.text()
  const entries = parseAutoindex(html)

  // 需要展开时递归抓子目录；并发执行，避免大目录串行等待
  const wantChildren = Math.min(Math.max(depth, 1), MAX_DEPTH) > 1
  const nodes = await Promise.all(
    entries.map(async (entry) => {
      if (!wantChildren) return { name: entry.name, path: joinPath(clean, entry.name), isDir: true }
      try {
        const child = await fetchTree(joinPath(clean, entry.name), depth - 1)
        return { name: entry.name, path: joinPath(clean, entry.name), isDir: true, children: child.entries }
      }
      catch {
        // 单个子目录抓不到不影响整体：标记为空，用户可再展开重试
        return { name: entry.name, path: joinPath(clean, entry.name), isDir: true, children: [] }
      }
    }),
  )

  return { base, path: clean, entries: nodes }
}

/** 拼相对路径。 */
function joinPath(parent, name) {
  return parent === '' ? name : `${parent}/${name}`
}
