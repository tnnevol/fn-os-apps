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
  const explicitPlugin = area === 'plugin' ? areaArgs[0] : undefined
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

  const versionArgs = area === 'plugin' ? areaArgs.slice(1) : areaArgs
  const options = parseVersionOptions(versionArgs)

  if (targets !== undefined) {
    for (const target of targets) {
      await versionPlugin(target, versionArgs, options)
    }
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
  const tagPrefix = `plugin/${target.slug}-v`

  const result = await versionBump({
    cwd: repositoryRoot,
    files: [target.path],
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
  .description('Version the project/FPK area or one DSH plugin')
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
