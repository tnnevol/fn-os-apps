import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { repositoryRoot } from './paths.js'

export type PluginTarget = {
  /** 稳定别名，用于 --plugin 参数与多选值。 */
  value: string
  /** 展示名称，优先使用包内的 displayName。 */
  label: string
  /** 完整 npm 包名，例如 @tnnevol/dsh-codex-auth。 */
  name: string
  /** Turbo filter，包含依赖图。 */
  filter: string
  /** 相对仓库根目录的 package.json 路径。 */
  path: string
  /** 包名最后一段，用于 plugin/<slug>-v 标签。 */
  slug: string
}

type PluginManifest = {
  name?: unknown
  displayName?: unknown
}

// 仅保留历史 CLI 简称，避免破坏既有 `--plugin codex` / `--plugin showcase` 用法。
// 插件列表本身完全由 plugins/ 目录动态发现，新增插件无需在此登记。
const LEGACY_ALIASES: Record<string, string> = {
  '@tnnevol/dsh-codex-auth': 'codex',
  '@tnnevol/dsh-semi-ui-showcase': 'showcase',
}

const pluginsDirectory = join(repositoryRoot, 'plugins')

function deriveAlias(slug: string): string {
  return slug.replace(/^dsh-/, '')
}

function readPluginTarget(directoryName: string): PluginTarget | undefined {
  const packagePath = join(pluginsDirectory, directoryName, 'package.json')
  let manifest: PluginManifest
  try {
    manifest = JSON.parse(readFileSync(packagePath, 'utf8')) as PluginManifest
  } catch {
    return undefined
  }
  if (typeof manifest.name !== 'string' || manifest.name.length === 0) return undefined

  const slug = manifest.name.split('/').pop() ?? manifest.name
  const alias = deriveAlias(slug)
  return {
    value: LEGACY_ALIASES[manifest.name] ?? alias,
    label: typeof manifest.displayName === 'string' && manifest.displayName.length > 0
      ? manifest.displayName
      : alias,
    name: manifest.name,
    filter: `${manifest.name}...`,
    path: `plugins/${directoryName}/package.json`,
    slug,
  }
}

function readPluginTargets(): PluginTarget[] {
  let entries
  try {
    entries = readdirSync(pluginsDirectory, { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => readPluginTarget(entry.name))
    .filter((target): target is PluginTarget => target !== undefined)
}

export const pluginTargets: PluginTarget[] = readPluginTargets()

export function findPluginTarget(alias: string | undefined): PluginTarget | undefined {
  if (alias === undefined) return undefined
  return pluginTargets.find(target =>
    target.value === alias || target.slug === alias || target.name === alias,
  )
}
