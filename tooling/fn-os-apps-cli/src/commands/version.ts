import { confirm, intro, isCancel, outro, select } from '@clack/prompts'
import { type OptionValues } from 'commander'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { versionBump } from 'bumpp'
import { program } from '../program.js'
import { addBooleanArgs, addNegatedArgs } from '../core/command-args.js'
import { projectVersionFiles, repositoryRoot } from '../config/paths.js'
import { findPluginTarget } from '../config/targets.js'
import { parseVersionOptions } from '../core/args.js'
import { readPackageInfo } from '../core/package.js'
import { askPlugin, askReleaseArea, type ReleaseArea } from '../ui/prompts.js'

const publishedDshPluginsPath = 'apps/fn-deepseek-harness/app/published-dsh-plugins.json'

type JsonObject = Record<string, unknown>

type ParsedVersion = {
  major: number
  minor: number
  patch: number
  prerelease?: string[]
}

function parsePluginVersion(version: string): ParsedVersion {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(version)
  if (match === null) throw new Error(`Invalid plugin version: ${version}`)
  const [, major, minor, patch, prerelease] = match
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    ...(prerelease === undefined ? {} : { prerelease: prerelease.split('.') }),
  }
}

function formatPluginVersion(version: ParsedVersion): string {
  const base = `${version.major}.${version.minor}.${version.patch}`
  return version.prerelease === undefined
    ? base
    : `${base}-${version.prerelease.join('.')}`
}

function prereleaseVersion(major: number, minor: number, patch: number): string {
  return formatPluginVersion({
    major,
    minor,
    patch,
    prerelease: ['beta', '1'],
  })
}

function bumpPluginVersion(currentVersion: string, release: string): string {
  if (/^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(release)) {
    parsePluginVersion(release)
    return release.replace(/^v/, '')
  }

  const current = parsePluginVersion(currentVersion)
  switch (release) {
    case 'patch':
      return formatPluginVersion({
        major: current.major,
        minor: current.minor,
        patch: current.patch + (current.prerelease === undefined ? 1 : 0),
      })
    case 'minor':
      return formatPluginVersion({ major: current.major, minor: current.minor + 1, patch: 0 })
    case 'major':
      return formatPluginVersion({ major: current.major + 1, minor: 0, patch: 0 })
    case 'prepatch':
      return prereleaseVersion(current.major, current.minor, current.patch + 1)
    case 'preminor':
      return prereleaseVersion(current.major, current.minor + 1, 0)
    case 'premajor':
      return prereleaseVersion(current.major + 1, 0, 0)
    case 'prerelease':
      return current.prerelease === undefined
        ? prereleaseVersion(current.major, current.minor, current.patch)
        : formatPluginVersion({
            ...current,
            prerelease: current.prerelease.at(-1) !== undefined && /^\d+$/.test(current.prerelease.at(-1)!)
              ? [...current.prerelease.slice(0, -1), String(Number(current.prerelease.at(-1)) + 1)]
              : [...current.prerelease, '1'],
          })
    case 'next':
      return current.prerelease === undefined
        ? bumpPluginVersion(currentVersion, 'patch')
        : bumpPluginVersion(currentVersion, 'prerelease')
    default:
      throw new Error(`Unsupported plugin release: ${release}`)
  }
}

async function choosePluginRelease(currentVersion: string, pluginNames: string[]): Promise<string | undefined> {
  const result = await select({
    message: `选择 ${pluginNames.join('、')} 的发布版本（当前 ${currentVersion}）`,
    options: [
      { value: 'patch', label: 'patch', hint: '修复版本' },
      { value: 'minor', label: 'minor', hint: '功能版本' },
      { value: 'major', label: 'major', hint: '破坏性版本' },
      { value: 'prerelease', label: 'prerelease', hint: '下一个预发布版本' },
    ],
  })
  return isCancel(result) ? undefined : result
}

async function readJson(relativePath: string): Promise<JsonObject> {
  const value: unknown = JSON.parse(await readFile(join(repositoryRoot, relativePath), 'utf8'))
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${relativePath} must contain a JSON object`)
  }
  return value as JsonObject
}

async function updatePackageVersion(relativePath: string, version: string): Promise<void> {
  const value = await readJson(relativePath)
  value.version = version
  await writeFile(join(repositoryRoot, relativePath), `${JSON.stringify(value, null, 2)}\n`)
}

async function syncPublishedPluginVersion(pluginName: string, version: string): Promise<boolean> {
  if (!existsSync(join(repositoryRoot, publishedDshPluginsPath))) return false

  const manifest = await readJson(publishedDshPluginsPath)
  const plugins = manifest.plugins
  if (!Array.isArray(plugins)) throw new Error(`${publishedDshPluginsPath} must contain a plugins array`)

  let changed = false
  for (const plugin of plugins) {
    if (typeof plugin !== 'object' || plugin === null || Array.isArray(plugin)) continue
    const entry = plugin as JsonObject
    if (entry.name !== pluginName || typeof entry.version !== 'string' || entry.version === version) continue
    entry.version = version
    changed = true
  }

  if (changed) {
    await writeFile(join(repositoryRoot, publishedDshPluginsPath), `${JSON.stringify(manifest, null, 2)}\n`)
  }
  return changed
}

function runGit(args: string[]): void {
  const result = spawnSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) {
    const details = typeof result.stderr === 'string' ? result.stderr.trim() : ''
    throw new Error(`git ${args.join(' ')} failed${details === '' ? '' : `: ${details}`}`)
  }
}

async function confirmPluginRelease(pluginNames: string[], currentVersion: string, newVersion: string): Promise<boolean> {
  const result = await confirm({
    message: `将 ${pluginNames.join('、')} 从 ${currentVersion} 更新到 ${newVersion}，继续吗？`,
    initialValue: true,
  })
  return isCancel(result) ? false : result
}

async function writePluginRelease(
  targets: NonNullable<ReturnType<typeof findPluginTarget>>[],
  packages: Awaited<ReturnType<typeof readPackageInfo>>[],
  newVersion: string,
  noCommit: boolean,
): Promise<number> {
  const changedPaths = targets.map(target => target.path)
  let syncedCount = 0
  for (const [index, target] of targets.entries()) {
    await updatePackageVersion(target.path, newVersion)
    const pkg = packages[index]
    if (pkg !== undefined && await syncPublishedPluginVersion(pkg.name, newVersion)) syncedCount += 1
  }

  if (syncedCount > 0) changedPaths.push(publishedDshPluginsPath)
  if (!noCommit) {
    runGit(['add', '--', ...changedPaths])
    const subject = targets.length === 1
      ? `chore(plugin): release ${packages[0]?.name ?? 'plugin'} v${newVersion}`
      : `chore(plugin): release selected plugins v${newVersion}`
    runGit(['commit', '-m', subject])
  }
  return syncedCount
}

export async function runVersion(args: string[]): Promise<void> {
  intro('fn-os-apps 版本维护')
  const explicitArea = args[0] === 'project' || args[0] === 'plugin' ? args[0] as ReleaseArea : undefined
  const area = explicitArea ?? await askReleaseArea()
  if (area === undefined) return

  const areaArgs = explicitArea === undefined ? args : args.slice(1)
  // Commander options are appended to args by the command adapter. Ignore
  // those flags while locating a plugin, otherwise an interactive multi-
  // select with --yes/--no-* is mistaken for an unknown plugin.
  const pluginArgIndex = area === 'plugin' ? areaArgs.findIndex(arg => !arg.startsWith('-')) : -1
  const explicitPlugin = pluginArgIndex < 0 ? undefined : areaArgs[pluginArgIndex]
  const explicitTarget = explicitPlugin === undefined ? undefined : findPluginTarget(explicitPlugin)
  const targets = area === 'plugin'
    ? explicitPlugin === undefined ? await askPlugin() : explicitTarget === undefined ? undefined : [explicitTarget]
    : undefined
  if (area === 'plugin') {
    if (targets === undefined) {
      throw new Error(`Unknown plugin: ${explicitPlugin ?? '(none)'}`)
    }
    if (targets.length === 0) return
  }

  const versionArgs = area === 'plugin'
    ? pluginArgIndex < 0 ? areaArgs : areaArgs.slice(pluginArgIndex + 1)
    : areaArgs
  const options = parseVersionOptions(versionArgs)

  if (targets !== undefined) {
    if (targets.length === 1) await versionPlugin(targets[0]!, versionArgs, options)
    else await versionPlugins(targets, options)
  } else {
    await versionProject(versionArgs, options)
  }
}

async function versionPlugin(
  target: NonNullable<ReturnType<typeof findPluginTarget>>,
  versionArgs: string[],
  options: ReturnType<typeof parseVersionOptions>,
): Promise<void> {
  const current = await readPackageInfo(target.path)
  const release = options.release === 'prompt'
    ? await choosePluginRelease(current.version, [current.name])
    : String(options.release)
  if (release === undefined) return
  const newVersion = bumpPluginVersion(current.version, release)
  if (options.confirm && !await confirmPluginRelease([current.name], current.version, newVersion)) return

  const syncedCount = await writePluginRelease([target], [current], newVersion, options.noCommit)
  const syncMessage = syncedCount > 0 ? '，已同步 published-dsh-plugins.json' : ''
  outro(`${current.name}: ${current.version} -> ${newVersion}${syncMessage}`)
}

async function versionPlugins(
  targets: NonNullable<ReturnType<typeof findPluginTarget>>[],
  options: ReturnType<typeof parseVersionOptions>,
): Promise<void> {
  const packages = await Promise.all(targets.map(target => readPackageInfo(target.path)))
  const first = packages[0]
  if (first === undefined) throw new Error('No plugins selected')

  const mismatched = packages.filter(pkg => pkg.version !== first.version)
  if (mismatched.length > 0) {
    const versions = [...new Set(packages.map(pkg => `${pkg.name}@${pkg.version}`))].join(', ')
    throw new Error(`Selected plugins must use the same current version for a combined release: ${versions}`)
  }

  const release = options.release === 'prompt'
    ? await choosePluginRelease(first.version, packages.map(pkg => pkg.name))
    : String(options.release)
  if (release === undefined) return
  const newVersion = bumpPluginVersion(first.version, release)
  if (options.confirm && !await confirmPluginRelease(packages.map(pkg => pkg.name), first.version, newVersion)) return

  const syncedCount = await writePluginRelease(targets, packages, newVersion, options.noCommit)
  const syncMessage = syncedCount > 0 ? '，已同步 published-dsh-plugins.json' : ''
  outro(`${packages.map(pkg => pkg.name).join(', ')}: ${first.version} -> ${newVersion}${syncMessage}`)
}

async function versionProject(
  versionArgs: string[],
  options: ReturnType<typeof parseVersionOptions>,
): Promise<void> {
  const current = await readPackageInfo('package.json')
  const commitPrefix = 'chore: release v'
  const tagPrefix = 'v'

  const result = await versionBump({
    cwd: repositoryRoot,
    files: projectVersionFiles,
    currentVersion: current.version,
    release: options.release,
    commit: options.noCommit ? false : `${commitPrefix}%s`,
    tag: options.noTag ? false : `${tagPrefix}%s`,
    push: false,
    ignoreScripts: true,
    confirm: options.confirm,
  })
  outro(`${current.name}: ${result.currentVersion} -> ${result.newVersion}`)
}

program
  .command('version [args...]')
  .description('Version the project/FPK area or selected DSH plugins')
  .option('--no-commit', 'only update version files')
  .option('--no-tag', 'do not create a version tag')
  .option('--no-push', 'do not push tags')
  .option('--yes', 'skip the version confirmation')
  .action(async (args: string[], options: OptionValues) => {
    addNegatedArgs(args, options, [
      ['commit', '--no-commit'],
      ['tag', '--no-tag'],
      ['push', '--no-push'],
    ])
    addBooleanArgs(args, options, ['yes'])
    await runVersion(args)
  })
