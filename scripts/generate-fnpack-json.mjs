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

/**
 * 图标与 README 的静态资源基址。
 *
 * FnDepot 客户端直接取这两个 URL 展示，必须是可公网访问的完整地址：
 * 相对路径（如 `./fn-xxx/ICON.PNG`）在客户端上下文里无从解析，且应用实际位于
 * 仓库的 `apps/<appname>/` 下，写 `./<appname>/...` 本身就是错的。
 * 固定指向 main 分支——图标与 README 属于文档性资源，跟随主分支即可；
 * FPK 包本身仍用 `releases/latest/download` 保证取到最新发布。
 */
const RAW_BASE = 'https://raw.githubusercontent.com/tnnevol/fn-os-apps/main'

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
  // PostgreSQL 与 fn-mysql_v8 同类，上游 postgresql 没有可映射的 tags，按数据库归类
  'fn-postgres': ['编程开发'],
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
 * 面板文案国际化后，manifest 的 display_name / desc 可能是 `${section.key}` 占位符。
 *
 * FnDepot 客户端直接展示这两个字段，不能把占位符原样透出，因此按 i18n/ 语言文件
 * 还原成实际文本。取值顺序与 fn-apps-cli 的 workspace 解析保持一致（中文优先，
 * en-US 兜底），两处逻辑需要同步维护。
 */
const LOCALE_PRIORITY = ['zh-CN', 'en-US', 'en']
const MANIFEST_PLACEHOLDER = /^\$\{([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\}$/

/** 把 INI 语言文件解析成 `section.key` → 文本。 */
function parseLocaleFile(file) {
  const values = new Map()
  let section
  for (const raw of fs.readFileSync(file, 'utf-8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith(';')) continue
    const header = /^\[(.+)\]$/.exec(line)
    if (header) {
      section = header[1]
      continue
    }
    const eq = line.indexOf('=')
    if (section === undefined || eq <= 0) continue
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    values.set(`${section}.${line.slice(0, eq).trim()}`, value)
  }
  return values
}

/** 按优先级合并 i18n/ 下所有语言文件，先出现的语言优先。 */
function readLocaleValues(appname) {
  const dir = path.join(APPS_DIR, appname, 'i18n')
  const values = new Map()
  if (!fs.existsSync(dir)) return values
  const names = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
  const ordered = [
    ...LOCALE_PRIORITY.filter(name => names.includes(name)),
    ...names.filter(name => !LOCALE_PRIORITY.includes(name)).sort(),
  ]
  for (const name of ordered) {
    for (const [key, value] of parseLocaleFile(path.join(dir, name))) {
      if (!values.has(key)) values.set(key, value)
    }
  }
  return values
}

/** 占位符还原成实际文本；不是占位符时返回原值，还原不出来时标记 unresolved。 */
function resolveLocalizedText(appname, rawValue) {
  if (!rawValue) return { value: rawValue ?? '', unresolved: false }
  const value = rawValue.trim().replace(/^["']|["']$/g, '')
  const match = MANIFEST_PLACEHOLDER.exec(value)
  if (!match) return { value, unresolved: false }
  const resolved = readLocaleValues(appname).get(`${match[1]}.${match[2]}`)
  if (resolved === undefined) return { value, unresolved: true }
  return { value: resolved, unresolved: false }
}


/**
 * 上游 appstore 的候选检出位置。
 *
 * 文档约定的是工作区旁的同级目录（`../appstore`），但实际检出位置因人而异：
 * 有人放在仓库内的 `appstore/`，也有人按 `tmp/` 约定克隆。
 * 逐个尝试，避免「找不到上游 → 分类静默全部回退成系统工具」这种难发现的偏差。
 */
const UPSTREAM_APPSTORE_ROOTS = [
  path.join(ROOT, '..', 'appstore'),
  path.join(ROOT, 'appstore'),
  path.join(ROOT, 'tmp', '1panel-appstore'),
]

let upstreamRootWarned = false

/** 返回第一个存在且带 apps/ 的上游根目录，找不到返回 null。 */
function resolveUpstreamRoot() {
  for (const root of UPSTREAM_APPSTORE_ROOTS) {
    if (fs.existsSync(path.join(root, 'apps'))) return root
  }
  if (!upstreamRootWarned) {
    upstreamRootWarned = true
    console.warn(
      `警告：未找到上游 appstore 检出（已尝试：${UPSTREAM_APPSTORE_ROOTS.join('、')}）。\n` +
        '     所有应用的分类将回退为「系统工具」，请先检出 1Panel-dev/appstore 再重新生成。',
    )
  }
  return null
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
  const upstreamRoot = resolveUpstreamRoot()
  if (!upstreamRoot) return { tags: [] }
  for (const c of candidates) {
    const file = path.join(upstreamRoot, 'apps', c, 'data.yml')
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
  const displayName = resolveLocalizedText(appname, manifest.display_name)
  const description = resolveLocalizedText(appname, manifest.desc)

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
  if (displayName.unresolved) {
    problems.push(`${appname}: display_name 的占位符在 i18n/ 里找不到对应语言文本`)
  }
  if (description.unresolved) {
    problems.push(`${appname}: desc 的占位符在 i18n/ 里找不到对应语言文本`)
  }

  const platform = manifest.platform === 'arm' ? ['arm'] : ['x86']
  const iconAbs = path.join(APPS_DIR, appname, 'ICON.PNG')
  if (!fs.existsSync(iconAbs)) problems.push(`${appname}: 缺少 ICON.PNG`)
  const readmeAbs = path.join(APPS_DIR, appname, 'README.md')
  // README 只有少数应用提供；缺失时不写该字段，避免客户端展示一个必然 404 的链接。
  const hasReadme = fs.existsSync(readmeAbs)

  const app = {
    display_name: displayName.value,
    desc: description.value,
    platform,
    categories: pickCategories(appname),
    icon_url: `${RAW_BASE}/apps/${appname}/ICON.PNG`,
    ...(hasReadme ? { readme_url: `${RAW_BASE}/apps/${appname}/README.md` } : {}),
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