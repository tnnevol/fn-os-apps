// 审计每个 Docker 应用的「镜像默认运行身份」与 compose 里的 user: 写法。
//
// 目的：compose 不写 user: 时，容器以镜像层 config.User 运行（未设置即 root）。
// 要判断某个应用是否会「以 root 写数据导致卸载残留」，必须拿到镜像的 config.User，
// 不能只看 compose。本脚本直接查 registry，不拉层；结果缓存到 tmp/。
//
// 用法：
//   node scripts/audit-image-user.mjs                 # 查全部（结果缓存到 tmp/image-user-cache.json）
//   AUDIT_NO_MIRROR=1 node scripts/audit-image-user.mjs --concurrency 1
//
// 输出分类：
//   A) 镜像默认 root 且 compose 未写 user:  → 容器以 root 写数据，卸载「删除所有数据」会残留（缺陷候选）
//   B) 镜像默认 root 且 compose 写了 user:  → 已按规约对齐包用户
//   C) 镜像自带非 root 且 compose 未写 user: → 容器以镜像内固定 uid 运行，与包用户属主不匹配（待验证）
//   D) 查询失败（Docker Hub 匿名限流 / 私有仓库 / 变量镜像）→ 隔一段时间重跑即可续查（有缓存）
import { execFile as execFileCb } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

const execFile = promisify(execFileCb)
const root = process.cwd()
const args = process.argv.slice(2)
const arg = (k, d) => {
  const i = args.indexOf(k)
  return i >= 0 ? args[i + 1] : d
}
const CONCURRENCY = Number(arg('--concurrency', '6'))
const OUT = arg('--out', 'tmp/image-user.json')
const CACHE = 'tmp/image-user-cache.json'

const cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {}

function parseImageRef(image) {
  // 去掉可能的 digest / 变量（后者应已在上游解析完毕）
  let ref = image.trim()
  const digestIndex = ref.indexOf('@')
  if (digestIndex > 0) ref = ref.slice(0, digestIndex)
  const slash = ref.indexOf('/')
  let registry = 'docker.io'
  let repoAndTag = ref
  // 没有斜杠时整个 ref 就是 repo:tag（`adminer:6.2.0-standalone` 里的点只是版本号，不是域名）
  if (slash > 0) {
    const first = ref.slice(0, slash)
    const colonInFirst = first.lastIndexOf(':')
    const looksLikeRegistry = first.includes('.')
      || first === 'localhost'
      || (colonInFirst > 0 && /^\d+$/.test(first.slice(colonInFirst + 1)))
    if (looksLikeRegistry) {
      registry = first
      repoAndTag = ref.slice(slash + 1)
    }
  }
  const colon = repoAndTag.lastIndexOf(':')
  let repo = repoAndTag
  let tag = 'latest'
  if (colon > repoAndTag.lastIndexOf('/')) {
    repo = repoAndTag.slice(0, colon)
    tag = repoAndTag.slice(colon + 1)
  }
  if (registry === 'docker.io' && !repo.includes('/')) repo = `library/${repo}`
  return { registry, repo, tag }
}

const REGISTRY_HOST = {
  'docker.io': 'registry-1.docker.io',
  'index.docker.io': 'registry-1.docker.io',
  'registry.hub.docker.com': 'registry-1.docker.io',
}

async function getToken(registry, repo) {
  const host = REGISTRY_HOST[registry] ?? registry
  const url = `https://${host}/v2/${repo}/manifests/`
  let res
  try {
    res = await fetch(`${url}latest`, { headers: { accept: 'application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json' } })
  } catch (error) {
    return { error: `registry 不可达: ${error.message}` }
  }
  if (res.status !== 401) return { token: null, host }
  const header = res.headers.get('www-authenticate') ?? ''
  const realm = /realm="([^"]+)"/.exec(header)?.[1]
  const service = /service="([^"]+)"/.exec(header)?.[1]
  if (!realm) return { error: '没有 WWW-Authenticate realm' }
  const params = new URLSearchParams()
  if (service) params.set('service', service)
  params.set('scope', `repository:${repo}:pull`)
  const tokenRes = await fetch(`${realm}?${params.toString()}`)
  if (!tokenRes.ok) return { error: `token 获取失败 ${tokenRes.status}` }
  const json = await tokenRes.json()
  return { token: json.token ?? json.access_token ?? null, host }
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function fetchJson(url, token, accept, attempt = 0) {
  const res = await fetch(url, { headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), accept } })
  if (res.status === 429 && attempt < 4) {
    const wait = 5000 * (attempt + 1)
    await sleep(wait)
    return await fetchJson(url, token, accept, attempt + 1)
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`)
  return await res.json()
}

async function inspectImage(image) {
  if (image.includes('${')) return { image, error: 'SKIP 变量镜像（未解析）' }
  const { registry, repo, tag } = parseImageRef(image)
  const { token, host, error } = await getToken(registry, repo)
  if (error) return { image, error }
  const bases = [`https://${host}/v2/${repo}`]
  // Docker Hub 匿名限流（429）时，用社区镜像源重试同一路径
  if (registry === 'docker.io' && process.env.AUDIT_NO_MIRROR !== '1') bases.push(`https://docker.fnnas.com/v2/${repo}`)
  const indexAccept = [
    'application/vnd.oci.image.index.v1+json',
    'application/vnd.docker.distribution.manifest.list.v2+json',
    'application/vnd.oci.image.manifest.v1+json',
    'application/vnd.docker.distribution.manifest.v2+json',
  ].join(', ')

  let manifest
  for (const candidate of bases) {
    try {
      manifest = await fetchJson(`${candidate}/manifests/${tag}`, token, indexAccept)
      bases.splice(0, bases.length, candidate)
      break
    } catch (error) {
      if (candidate === bases.at(-1)) throw error
    }
  }
  const base = bases[0]
  if (Array.isArray(manifest.manifests)) {
    const chosen
      = manifest.manifests.find(m => (m.platform?.architecture === 'amd64') && (m.platform?.os === 'linux'))
        ?? manifest.manifests.find(m => m.platform?.architecture === 'amd64')
        ?? manifest.manifests[0]
    if (!chosen) return { image, error: 'manifest 列表为空' }
    manifest = await fetchJson(`${base}/manifests/${chosen.digest}`, token, indexAccept)
  }
  const configDigest = manifest.config?.digest
  if (!configDigest) return { image, error: 'manifest 无 config.digest' }
  const config = await fetchJson(`${base}/blobs/${configDigest}`, token, 'application/json')
  return {
    image,
    user: config.config?.User ?? '',
    entrypoint: config.config?.Entrypoint ?? null,
    cmd: config.config?.Cmd ?? null,
  }
}

function readComposeImages() {
  const items = []
  for (const app of fs.readdirSync(path.join(root, 'apps')).sort()) {
    const compose = path.join(root, 'apps', app, 'app/docker/docker-compose.yaml')
    if (!fs.existsSync(compose)) continue
    const text = fs.readFileSync(compose, 'utf8')
    const image = /^\s*image:\s*(\S+)\s*$/m.exec(text)?.[1]
    const user = /^\s*user:\s*(.+?)\s*$/m.exec(text)?.[1] ?? null
    const marker = text.split(/\r?\n/).some(line => /^#\s*USER-EXCEPTION:/.test(line.trim()))
    items.push({ app, image, composeUser: user, exceptionMarker: marker })
  }
  return items
}

async function mapLimit(items, limit, fn) {
  const results = []
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await fn(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

const apps = readComposeImages()
const uniqueImages = [...new Set(apps.map(a => a.image).filter(Boolean))]
const todo = uniqueImages.filter(img => !(img in cache))
console.log(`应用 ${apps.length} 个，唯一镜像 ${uniqueImages.length} 个，待查 ${todo.length} 个`)

let done = 0
await mapLimit(todo, CONCURRENCY, async (image) => {
  try {
    cache[image] = await inspectImage(image)
  } catch (error) {
    cache[image] = { image, error: String(error.message ?? error) }
  }
  done++
  if (done % 10 === 0 || done === todo.length) {
    fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2))
    console.log(`  进度 ${done}/${todo.length}`)
  }
})
fs.writeFileSync(CACHE, JSON.stringify(cache, null, 2))

const rows = apps.map(a => ({ ...a, ...(cache[a.image] ?? {}) }))
fs.writeFileSync(OUT, JSON.stringify(rows, null, 2))

const summarize = (predicate) => rows.filter(predicate)
const summary = { rootNoUser: [], rootWithUser: [], nonRootNoUser: [], err: [] }
for (const row of rows) {
  if (row.error) { summary.err.push(row); continue }
  const imageUser = String(row.user ?? '').trim()
  const isRootImage = imageUser === '' || imageUser === 'root' || imageUser === '0' || imageUser === '0:0'
  if (isRootImage && !row.composeUser) summary.rootNoUser.push(row)
  else if (isRootImage && row.composeUser) summary.rootWithUser.push(row)
  else if (!isRootImage && !row.composeUser) summary.nonRootNoUser.push(row)
}
console.log(`\nA) 镜像默认 root 且 compose 未写 user: ${summary.rootNoUser.length} 个（缺陷候选）`)
console.log(`B) 镜像默认 root 且 compose 写了 user: ${summary.rootWithUser.length} 个`)
console.log(`C) 镜像自带非 root 且 compose 未写 user: ${summary.nonRootNoUser.length} 个（属主风险待验证）`)
console.log(`D) 查询失败 ${summary.err.length} 个`)
for (const [label, list] of Object.entries({ A: summary.rootNoUser, C: summary.nonRootNoUser, D: summary.err })) {
  if (list.length === 0) continue
  console.log(`\n===== ${label} =====`)
  for (const row of list) {
    const who = row.error ? `ERR ${row.error}` : `USER=${row.user || '(空=root)'}`
    console.log(`${row.app.padEnd(26)} ${who.padEnd(42)} ${row.image}`)
  }
}
