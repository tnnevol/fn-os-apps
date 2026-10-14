/**
 * 从 1Panel 上游 logo 生成 fnOS 应用所需的整套图标。
 *
 * 上游仓库 `appstore/` 是本仓库的**同级只读参考**（不复制上游文件内容，
 * 上游 GPL-3.0 与本仓库 AGPL-3.0 不同）。脚本只读取其中的 `logo.png`，
 * 输出到本仓库，不写入上游任何文件。
 *
 * 输出 5 个文件（每个应用）：
 *   - `apps/fn-<app>/ICON.PNG`                     64×64
 *   - `apps/fn-<app>/ICON_256.PNG`                 256×256
 *   - `apps/fn-<app>/app/ui/images/icon_64.png`    64×64
 *   - `apps/fn-<app>/app/ui/images/icon_256.png`   256×256
 *   - `docs/public/icons/fn-<app>.png`             256×256（文档站 AppIcon 组件用）
 *
 * 用法（在仓库根目录执行，或 `pnpm run icons -- <参数>`）：
 *   node scripts/generate-icons.mjs it-tools adminer   # 指定应用（可多个）
 *   node scripts/generate-icons.mjs --all              # 扫描全部「上游有 logo 且本地已有应用目录」的项
 *   node scripts/generate-icons.mjs --all --dry-run    # 只报告将写入的文件
 *   node scripts/generate-icons.mjs --all --upstream /path/to/appstore/apps
 *
 * 覆盖保护（全局不变量）：只要目标应用的图标**已入库**（git 已跟踪，即已随版本
 * 发布过），任何模式下都必须显式加 `--force` 才允许覆盖；否则跳过该应用并提示。
 * 点名不等于有意覆盖已发布资产，因此点名模式同样受此约束。
 *
 * 缩放策略：每个目标尺寸都直接从源图单次重采样（不叠加多级插值），
 * 使用 Jimp 的 bicubic 插值。上游图标常见 180×180，放大到 256×256 属
 * 不可避免的插值放大；bicubic 是实测目视最清晰的可用选项。
 *
 * 依赖：`jimp`（纯 JS，无原生编译，无需在 pnpm-workspace.yaml 放行构建脚本）。
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { Jimp, ResizeStrategy } from 'jimp'

const ROOT = path.resolve(import.meta.dirname, '..')

/** 目标产物：由 size + 路径生成函数组成，全部为正方形。 */
const TARGETS = [
  { size: 64, file: app => path.join(ROOT, 'apps', app, 'ICON.PNG') },
  { size: 256, file: app => path.join(ROOT, 'apps', app, 'ICON_256.PNG') },
  { size: 64, file: app => path.join(ROOT, 'apps', app, 'app', 'ui', 'images', 'icon_64.png') },
  { size: 256, file: app => path.join(ROOT, 'apps', app, 'app', 'ui', 'images', 'icon_256.png') },
  { size: 256, file: app => path.join(ROOT, 'docs', 'public', 'icons', `${app}.png`) },
]

const HELP = `用法: node scripts/generate-icons.mjs <app...> [--all] [--dry-run] [--force] [--allow-non-square] [--upstream <dir>]

  <app...>            上游应用名（如 it-tools），可传多个；自动加 fn- 前缀映射到 apps/fn-<app>/
  --all               自动扫描上游目录中「有 logo.png 且本地已存在 apps/fn-<app>/」的应用
  --force             允许覆盖**已入库（已发布）**的图标
  --allow-non-square  允许上游图标为非正方形：以 max(宽,高) 为边长居中**补透明边**到正方形
                      （不裁剪、不拉伸）。默认拒绝非正方形输入。
  --dry-run           只列出将要写入的文件，不实际写入
  --upstream <dir>    指定上游应用根目录（默认 <仓库同级>/appstore/apps，
                      也可用环境变量 FNOS_UPSTREAM_APPS 指定）
  --help              显示本帮助

覆盖保护: 只要目标应用的图标已入库（git 已跟踪），任何模式下都必须加 --force
才允许覆盖，否则跳过该应用并提示。点名模式同样受此约束。`

/** 解析命令行参数；未知选项直接报错，避免静默忽略。 */
function parseArgs(argv) {
  const apps = []
  let upstream
  let all = false
  let dryRun = false
  let force = false
  let allowNonSquare = false
  let help = false

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === '--upstream') {
      // `--upstream` 必须紧跟一个目录值；缺失或又跟了选项都视为用法错误。
      const value = argv[index + 1]
      if (value === undefined || value.startsWith('--')) throw new Error('--upstream 需要一个目录参数')
      upstream = value
      index++
      continue
    }
    if (arg === '--all') { all = true; continue }
    if (arg === '--dry-run') { dryRun = true; continue }
    if (arg === '--force') { force = true; continue }
    if (arg === '--allow-non-square') { allowNonSquare = true; continue }
    if (arg === '--help') { help = true; continue }
    if (arg.startsWith('--')) throw new Error(`未知选项: ${arg}`)
    apps.push(arg)
  }

  return { all, dryRun, force, allowNonSquare, help, upstream, apps }
}

/** 上游应用根目录：默认取仓库同级的 appstore/apps，可被参数或环境变量覆盖。 */
function resolveUpstreamApps(cliValue) {
  const configured = cliValue ?? process.env.FNOS_UPSTREAM_APPS
  return configured === undefined || configured === ''
    ? path.resolve(ROOT, '..', 'appstore', 'apps')
    : path.resolve(configured)
}

/**
 * 自动发现：上游存在 `logo.png`，且本地已建立对应的 `apps/fn-<app>/` 目录。
 * 本地目录不存在时跳过——不替尚未落地的应用凭空建目录。
 *
 * 覆盖保护不在这里做，而是对全部模式统一生效，见 {@link isPublished}。
 */
function discoverApps(upstreamApps) {
  return fs
    .readdirSync(upstreamApps, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => fs.existsSync(path.join(upstreamApps, name, 'logo.png')))
    .filter(name => fs.existsSync(path.join(ROOT, 'apps', `fn-${name}`)))
    .sort()
}

/**
 * 判断图标是否**已入库**（git 已跟踪 = 已随版本发布过）。
 *
 * 用 git 跟踪状态而不是「文件是否存在」：fnpack 模板自带的占位图标在
 * `git add` 之前就存在，用存在性判断会把本批新建的应用一起误跳过。
 *
 * 该判定是覆盖保护的全局不变量：任何模式（`--all` 或点名）下，已入库的图标
 * 都必须显式 `--force` 才允许覆盖。点名只表示「限定处理范围」，不表示
 * 「有意覆盖已发布资产」。
 */
function isPublished(app) {
  const tracked = TARGETS.map(target => path.relative(ROOT, target.file(app)))
  try {
    const output = execFileSync('git', ['ls-files', '--', ...tracked], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return output.trim() !== ''
  }
  catch {
    // git 不可用（如脱离仓库运行）时按「未发布」处理，不阻断生成。
    return false
  }
}

/** 生成单个应用的 5 个图标文件。 */
async function generate(app, upstreamApps, dryRun, allowNonSquare) {
  const appname = `fn-${app}`
  const source = path.join(upstreamApps, app, 'logo.png')
  if (!fs.existsSync(source)) throw new Error(`找不到上游图标: ${path.relative(ROOT, source)}`)

  const image = await Jimp.read(source)
  const { width, height } = image.bitmap
  if (width !== height && !allowNonSquare) {
    throw new Error(`上游图标不是正方形: ${width}×${height}（如确认可补边处理，请显式加 --allow-non-square）`)
  }
  if (width < 64) console.warn(`  ⚠ 警告: 上游图标仅 ${width}×${height}，放大到 256 会明显失真`)

  // 非正方形：以 max(宽,高) 为边长居中补透明边到正方形。
  // 不裁剪（会切掉内容）、不拉伸（会变形）——只补边，视觉上无损。
  let base = image
  if (width !== height) {
    const side = Math.max(width, height)
    const canvas = new Jimp({ width: side, height: side, color: 0x00000000 })
    canvas.composite(image, Math.round((side - width) / 2), Math.round((side - height) / 2))
    base = canvas
    console.warn(`  ⚠ 上游图标 ${width}×${height} 非正方形，已居中补透明边为 ${side}×${side}`)
  }

  const written = []
  for (const target of TARGETS) {
    const file = target.file(appname)
    const relative = path.relative(ROOT, file)
    // 每个尺寸都从源图单次重采样，避免多级插值叠加造成的模糊。
    if (!dryRun) {
      const resized = base.clone().resize({ w: target.size, h: target.size, mode: ResizeStrategy.BICUBIC })
      fs.mkdirSync(path.dirname(file), { recursive: true })
      await resized.write(file)
    }
    written.push(`${relative} (${target.size}×${target.size})`)
  }
  return { appname, relativeSource: path.relative(ROOT, source), from: `${width}×${height}`, written }
}

async function main() {
  const { all, dryRun, force, allowNonSquare, help, upstream, apps } = parseArgs(process.argv.slice(2))
  if (help) {
    console.log(HELP)
    return
  }

  const upstreamApps = resolveUpstreamApps(upstream)
  if (!fs.existsSync(upstreamApps)) {
    throw new Error(`上游应用目录不存在: ${upstreamApps}\n用 --upstream <dir> 或 FNOS_UPSTREAM_APPS 指定 1Panel appstore 的 apps 目录`)
  }

  // 组装候选应用列表：`--all` 扫描发现，否则用点名传入的。
  let candidates = apps
  if (all) {
    candidates = discoverApps(upstreamApps)
    if (candidates.length === 0) throw new Error('未发现「上游有 logo.png 且本地已有 apps/fn-<app>/」的应用')
    console.log(`发现 ${candidates.length} 个应用: ${candidates.join(', ')}`)
  }
  if (candidates.length === 0) throw new Error('未指定应用；请给出应用名或使用 --all')

  // 覆盖保护是全局不变量，与 `--all` / 点名无关：只要图标已入库（已发布），
  // 就必须显式 --force 才允许覆盖。点名不等于有意覆盖已发布资产。
  const published = force ? [] : candidates.filter(app => isPublished(`fn-${app}`))
  const targets = candidates.filter(app => !published.includes(app))

  for (const app of published) {
    console.log(`跳过 fn-${app}: 图标已入库（已发布），如需覆盖请显式加 --force`)
  }
  if (published.length > 0)
    console.log(`共跳过 ${published.length} 个已发布应用: ${published.join(', ')}`)
  if (targets.length === 0)
    throw new Error('待处理应用的图标均已入库；如确需覆盖请加 --force')

  for (const app of targets) {
    const result = await generate(app, upstreamApps, dryRun, allowNonSquare)
    console.log(`\n${result.appname}  ←  ${result.relativeSource}  (${result.from})`)
    for (const line of result.written) console.log(`  ${dryRun ? '[dry-run] ' : ''}${line}`)
  }

  const summary = `完成: 写入 ${targets.length} 个应用，共 ${targets.length * TARGETS.length} 个文件${dryRun ? '（dry-run，未写入）' : ''}`
  console.log(`\n${summary}`)
  if (published.length > 0) console.log(`另有 ${published.length} 个应用因图标已入库被跳过（--force 可覆盖）`)
}

main().catch((error) => {
  console.error(`generate-icons 失败: ${error.message}`)
  process.exit(1)
})
