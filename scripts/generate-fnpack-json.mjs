/**
 * 生成 FnDepot V2 外部源索引 fnpack.json。
 *
 * 数据全部来自 apps/<appname>/manifest 与上游 appstore 的分类标签，
 * 不引入人工维护的副本——每次新增应用后重跑即可。
 *
 * 用法：
 *   node scripts/generate-fnpack-json.mjs                # 生成
 *   node scripts/generate-fnpack-json.mjs --check        # 只校验不写盘
 *   node scripts/generate-fnpack-json.mjs --app fn-memos # 只处理单个应用
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const APPS_DIR = path.join(ROOT, 'apps')
const OUT = path.join(ROOT, 'fnpack.json')

/**
 * Release 下载基址与 tag。
 *
 * RELEASE_TAG 取仓库根 package.json 的版本并加 v 前缀——因为 build-common-fn.yml
 * 产出的资产名是 `<appname>-<RELEASE_TAG>.fpk`，而 RELEASE_TAG 就是 git tag（含 v）。
 * `pnpm run version` 递增版本后必须重跑本脚本，否则 URL 会指向旧 tag。
 */
const PROJECT_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8')).version
const RELEASE_TAG = `v${PROJECT_VERSION}`
const RELEASE_BASE = 'https://github.com/tnnevol/fn-os-apps'

const SOURCE_INFO = {
  name: '飞牛 fnOS 应用 Monorepo',
  author: 'tnnevol',
  homepage: 'https://github.com/tnnevol/fn-os-apps',
  description: '由 tnnevol 维护的 fnOS 第三方应用源，收录自 1Panel 应用商店的转换成果。',
}

/** FnDepot V2 只接受这九个固定分类。 */
const CATEGORIES = [
  '影音娱乐',
  '系统工具',
  '编程开发',
  'AI赋能',
  '生活服务',
  '智能智控',
  '教育学习',
  '游戏地带',
  '硬件驱动',
]

/**
 * 上游 1Panel 的 tags → FnDepot 固定分类。
 *
 * 词表来自全量扫描上游各应用 data.yml 的 additionalProperties.tags 字段，
 * 实际出现 16 个取值，全部在此映射；未列出的值一律落到「系统工具」。
 */
const TAG_TO_CATEGORY = {
  Media: '影音娱乐',
  Game: '游戏地带',
  AI: 'AI赋能',
  Database: '编程开发',
  DevTool: '编程开发',
  DevOps: '编程开发',
  Middleware: '编程开发',
  Runtime: '编程开发',
  Email: '系统工具',
  Security: '系统工具',
  Server: '系统工具',
  Storage: '系统工具',
  Tool: '系统工具',
  Website: '生活服务',
  CRM: '生活服务',
  BI: '生活服务',
}

/** 应用名 → 分类的手工覆盖：上游 tags 缺失或明显不准时使用。 */
const CATEGORY_OVERRIDES = {
  'fn-mysql_v8': ['编程开发'],
  'fn-zentao': ['编程开发'],
  'fn-moviepilot': ['影音娱乐'],
  'fn-new-api': ['AI赋能'],
  'fn-xiaoya-only': ['影音娱乐'],
  'fn-reader': ['教育学习'],
  'fn-halo': ['编程开发'],
  'fn-bitwarden': ['系统工具'],
  'fn-quark-auto-save': ['生活服务'],
}

const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const onlyIdx = args.indexOf('--app')
const only = onlyIdx === -1 ? null : args[onlyIdx + 1]

/** 解析 INI 风格的 manifest。 */
function parseManifest(file) {
  const out = {}
  for (const raw of fs.readFileSync(file, 'utf-8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
  }
  return out
}

/**
 * 读取上游 data.yml 的 tags 与 name，用于补分类。
 *
 * 只解析 additionalProperties 段内 `- xxx` 列表形式的 tags——
 * 上游用的是 YAML 块序列而非行内数组，用行内正则会漏掉全部取值。
 */
function upstreamMeta(appname) {
  const key = appname.replace(/^fn-/, '')
  const candidates = [key, key.replace(/_/g, '-')]
  for (const c of candidates) {
    const file = path.join(ROOT, '..', 'appstore', 'apps', c, 'data.yml')
    if (!fs.existsSync(file)) continue
    const tags = parseUpstreamTags(fs.readFileSync(file, 'utf-8'))
    return { tags }
  }
  return { tags: [] }
}

/** 从 data.yml 中提取 additionalProperties.tags（YAML 块序列）。 */
function parseUpstreamTags(text) {
  const lines = text.split('\n')
  let inAp = false
  let inTags = false
  const tags = []
  for (const line of lines) {
    if (line.startsWith('additionalProperties:')) {
      inAp = true
      continue
    }
    if (inAp && line && !/^\s/.test(line)) break
    if (!inAp) continue
    if (/^\s{4}tags:\s*$/.test(line)) {
      inTags = true
      continue
    }
    if (inTags) {
      const item = line.match(/^\s{8}-\s*(.+?)\s*$/)
      if (!item) {
        inTags = false
        continue
      }
      tags.push(item[1].replace(/^['"]|['"]$/g, ''))
    }
  }
  return tags
}

function pickCategories(appname) {
  const override = CATEGORY_OVERRIDES[appname]
  if (override) return override.slice(0, 2)
  const { tags } = upstreamMeta(appname)
  const mapped = []
  for (const t of tags) {
    const c = TAG_TO_CATEGORY[t]
    if (c && !mapped.includes(c)) mapped.push(c)
  }
  return mapped.length > 0 ? mapped.slice(0, 2) : ['系统工具']
}

function isDocker(appname) {
  return fs.existsSync(path.join(APPS_DIR, appname, 'app', 'docker'))
}

function pickServicePort(appname, manifest) {
  const declared = manifest.service_port
  if (declared) return declared
  const cfg = path.join(APPS_DIR, appname, 'app', 'ui', 'config')
  if (!fs.existsSync(cfg)) return ''
  try {
    const ui = JSON.parse(fs.readFileSync(cfg, 'utf-8'))
    const first = Object.values(ui['.url'] ?? {})[0]
    if (first && typeof first.port === 'string') return first.port
  } catch {
    /* 配置异常时留空，由构建期校验兜底 */
  }
  return ''
}

const appDirs = fs
  .readdirSync(APPS_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .filter(n => only === null || n === only)
  .sort()

const apps = {}
const problems = []

for (const appname of appDirs) {
  const manifestFile = path.join(APPS_DIR, appname, 'manifest')
  if (!fs.existsSync(manifestFile)) {
    problems.push(`${appname}: 缺少 manifest`)
    continue
  }
  const manifest = parseManifest(manifestFile)

  if (manifest.appname !== appname) {
    problems.push(`${appname}: manifest.appname=${manifest.appname} 与目录名不一致`)
  }
  if (!manifest.version) {
    problems.push(`${appname}: manifest 缺少 version`)
  }
  if (!manifest.display_name) {
    problems.push(`${appname}: manifest 缺少 display_name`)
  }
  if (!manifest.desc) {
    problems.push(`${appname}: manifest 缺少 desc`)
  }

  const platform = manifest.platform === 'arm' ? ['arm'] : ['x86']
  const iconRel = `./${appname}/ICON.PNG`
  const iconAbs = path.join(APPS_DIR, appname, 'ICON.PNG')
  if (!fs.existsSync(iconAbs)) problems.push(`${appname}: 缺少 ICON.PNG`)

  const app = {
    display_name: manifest.display_name ?? '',
    desc: manifest.desc ?? '',
    platform,
    categories: pickCategories(appname),
    icon_url: iconRel,
    readme_url: `./${appname}/README.md`,
    bug_report_url: 'https://github.com/tnnevol/fn-os-apps/issues',
    maintainer: manifest.maintainer ?? 'tnnevol',
    run_as: 'package',
    install_type: '',
    is_docker: isDocker(appname),
    service_port: pickServicePort(appname, manifest),
    releases: {},
  }
  if (manifest.maintainer_url) app.maintainer_url = manifest.maintainer_url
  if (manifest.distributor) app.distributor = manifest.distributor
  if (manifest.distributor_url) app.distributor_url = manifest.distributor_url

  const version = manifest.version ?? '0.0.0'
  const release = { packages: {} }
  if (manifest.os_min_version) release.os_min_version = manifest.os_min_version
  release.packages[platform[0]] = {
    // Release 资产名由 build-common-fn.yml 产出：`<appname>-<RELEASE_TAG>.fpk`，
    // RELEASE_TAG 是 `v<项目版本>`（含 v 前缀）。
    // 用 /releases/latest/download/ 而非写死具体 tag，发版后客户端自动取到最新包。
    download_url: `${RELEASE_BASE}/releases/latest/download/${appname}-${RELEASE_TAG}.fpk`,
  }
  app.releases[version] = release
  apps[appname] = app
}

const doc = {
  schema_version: '2',
  source_info: SOURCE_INFO,
  apps,
}

const json = `${JSON.stringify(doc, null, 2)}\n`

if (problems.length > 0) {
  console.error('生成前检查发现问题：')
  for (const p of problems) console.error(`  - ${p}`)
  process.exitCode = 1
}

if (checkOnly) {
  console.log(`检查模式：${Object.keys(apps).length} 个应用，发现 ${problems.length} 个问题`)
} else {
  fs.writeFileSync(OUT, json)
  console.log(`已写入 ${path.relative(ROOT, OUT)}：${Object.keys(apps).length} 个应用`)
}

// 生成后自检：分类必须落在固定集合内
for (const [name, app] of Object.entries(apps)) {
  for (const c of app.categories) {
    if (!CATEGORIES.includes(c)) {
      console.error(`分类非法：${name} → ${c}`)
      process.exitCode = 1
    }
  }
  if (app.categories.length > 2) {
    console.error(`分类超过两个：${name}`)
    process.exitCode = 1
  }
}