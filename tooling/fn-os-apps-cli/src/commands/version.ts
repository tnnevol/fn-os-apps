import { intro, outro } from '@clack/prompts'
import { type OptionValues } from 'commander'
import { versionBump } from 'bumpp'
import { program } from '../program.js'
import { addBooleanArgs, addNegatedArgs } from '../core/command-args.js'
import { projectVersionFiles, repositoryRoot } from '../config/paths.js'
import { findPluginTarget } from '../config/targets.js'
import { parseVersionOptions } from '../core/args.js'
import { readPackageInfo } from '../core/package.js'
import { askPlugin, askReleaseArea, type ReleaseArea } from '../ui/prompts.js'

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
  const packagePath = target.path
  const current = await readPackageInfo(packagePath)
  const commitPrefix = `chore(plugin): release ${current.name} v`

  const result = await versionBump({
    cwd: repositoryRoot,
    files: [target.path],
    currentVersion: current.version,
    release: options.release,
    commit: options.noCommit ? false : `${commitPrefix}%s`,
    // Plugin version changes are tracked by the release commit only. Tags
    // are reserved for project/FPK releases.
    tag: false,
    push: false,
    ignoreScripts: true,
    confirm: options.confirm,
  })
  outro(`${current.name}: ${result.currentVersion} -> ${result.newVersion}`)
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

  const result = await versionBump({
    cwd: repositoryRoot,
    files: targets.map(target => target.path),
    currentVersion: first.version,
    release: options.release,
    commit: options.noCommit ? false : 'chore(plugin): release selected plugins v%s',
    // Plugin releases intentionally create no Git tags.
    tag: false,
    push: false,
    ignoreScripts: true,
    confirm: options.confirm,
  })

  outro(`${packages.map(pkg => pkg.name).join(', ')}: ${first.version} -> ${result.newVersion}`)
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
