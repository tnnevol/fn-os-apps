import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { repositoryRoot } from './paths.js'

export type FpkApp = {
  /** 应用目录名，例如 fn-deepseek-harness。 */
  name: string
  /** 展示名称，优先读取 manifest 的 display_name。 */
  label: string
  /** manifest 版本号，用于校验与项目版本的一致性。 */
  version?: string
  /** 该应用是否需要先构建 fnOS Gateway。 */
  requiresGateway: boolean
}

export type GatewayPackage = {
  /** 完整 npm 包名，例如 @tnnevol/fnos-gateway。 */
  name: string
  /** 包目录名，例如 fnos-gateway。 */
  directory: string
  /** 网关产物输出的应用目录名（由 tsdown.app.config 的 outDir 推导）。 */
  targetApp?: string
}

type GatewayAppConfig = {
  outDir?: string
}

// 解析 tsdown 配置中的 outDir: resolve(__dirname, '../../apps/<app>/app')，
// 提取其中的应用目录名。
function appDirectoryFromOutDir(outDir: string): string | undefined {
  const normalized = outDir.replace(/\/+$/, '')
  const segments = normalized.split('/')
  if (segments[segments.length - 1] !== 'app') return undefined
  const appIndex = segments.indexOf('apps')
  if (appIndex < 0 || appIndex + 1 >= segments.length - 1) return undefined
  return segments[appIndex + 1]
}

// 动态发现「输出网关产物到 apps/ 目录」的 package（而非硬编码 fnos-gateway）。
// 判据：packages/<dir> 存在 tsdown.app.config.ts，且其 outDir 指向某个 apps/<app>/app。
function readGatewayPackage(): GatewayPackage | undefined {
  const packagesDirectory = join(repositoryRoot, 'packages')
  let entries
  try {
    entries = readdirSync(packagesDirectory, { withFileTypes: true })
  } catch {
    return undefined
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const configPath = join(packagesDirectory, entry.name, 'tsdown.app.config.ts')
    if (!existsSync(configPath)) continue
    let source: string
    try {
      source = readFileSync(configPath, 'utf8')
    } catch {
      continue
    }
    const match = source.match(/outDir:\s*resolve\(\s*__dirname,\s*['"]([^'"]+)['"]/)
    const outDir = match?.[1]
    if (outDir === undefined) continue
    const targetApp = appDirectoryFromOutDir(outDir)
    if (targetApp === undefined) continue

    const packagePath = join(packagesDirectory, entry.name, 'package.json')
    let manifest: { name?: unknown }
    try {
      manifest = JSON.parse(readFileSync(packagePath, 'utf8')) as { name?: unknown }
    } catch {
      continue
    }
    if (typeof manifest.name !== 'string') continue
    return { name: manifest.name, directory: entry.name, targetApp }
  }
  return undefined
}

const gatewayPackage = readGatewayPackage()

function readFpkApp(directoryName: string): FpkApp | undefined {
  const manifestPath = join(repositoryRoot, 'apps', directoryName, 'manifest')
  if (!existsSync(manifestPath)) return undefined
  let manifestText: string
  try {
    manifestText = readFileSync(manifestPath, 'utf8')
  } catch {
    return undefined
  }
  const version = manifestText.match(/^version\s*=\s*(.+)$/m)?.[1]?.trim()
  const displayName = manifestText
    .match(/^display_name\s*=\s*(.+)$/m)?.[1]
    ?.trim()
    ?.replace(/^["']|["']$/g, '')
  return {
    name: directoryName,
    label: displayName || directoryName,
    ...(version === undefined ? {} : { version }),
    requiresGateway: gatewayPackage?.targetApp === directoryName,
  }
}

export function readFpkApps(): FpkApp[] {
  let entries
  try {
    entries = readdirSync(join(repositoryRoot, 'apps'), { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => readFpkApp(entry.name))
    .filter((app): app is FpkApp => app !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function readGatewayName(): string | undefined {
  return gatewayPackage?.name
}
