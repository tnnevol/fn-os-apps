import { join } from 'node:path'
import { type OptionValues } from 'commander'
import { program } from '../program.js'
import { repositoryRoot } from '../config/paths.js'
import { findPluginTarget } from '../config/targets.js'
import { readFpkApps, readGatewayName, type FpkApp } from '../config/workspace.js'
import { runDocsBuild } from './docs.js'
import { optionValue } from '../core/args.js'
import { addBooleanArgs, addOptionalValueArg } from '../core/command-args.js'
import { runCommand } from '../core/process.js'
import { runTurbo } from '../core/turbo.js'
import { askBuildSelection, askFpkApps, askPlugins } from '../ui/prompts.js'

function listFpkApps(): FpkApp[] {
  return readFpkApps()
}

async function buildFpkApps(apps: FpkApp[]): Promise<void> {
  if (apps.some(app => app.requiresGateway)) {
    const gatewayName = readGatewayName()
    if (gatewayName === undefined) throw new Error('Unable to resolve the fnOS Gateway package')
    await runTurbo('build:app', [gatewayName])
  }
  for (const app of apps) {
    console.log(`\nBuilding FPK: ${app.name}`)
    await runCommand('fnpack', ['build'], join(repositoryRoot, 'apps', app.name))
  }
}

async function selectPluginFilters(filter?: string): Promise<string[] | undefined> {
  if (filter !== undefined) {
    const target = findPluginTarget(filter)
    if (target === undefined) throw new Error(`Unknown plugin: ${filter}`)
    return [target.filter]
  }
  return askPlugins()
}

async function selectFpkApps(app?: string): Promise<FpkApp[] | undefined> {
  const apps = listFpkApps()
  if (app !== undefined) {
    const selected = apps.find(candidate => candidate.name === app)
    if (selected === undefined) throw new Error(`Unknown FPK application: ${app}`)
    return [selected]
  }
  return askFpkApps(apps)
}

export async function runBuild(args: string[]): Promise<void> {
  const app = optionValue(args, '--app')
  const plugin = optionValue(args, '--plugin')
  if (args.includes('--fpk')) {
    const apps = await selectFpkApps(app)
    if (apps !== undefined) await buildFpkApps(apps)
    return
  }
  if (args.includes('--plugin')) {
    const filters = await selectPluginFilters(plugin)
    if (filters !== undefined) await runTurbo('build', filters)
    return
  }
  if (args.includes('--docs')) {
    await runDocsBuild()
    return
  }

  const selection = await askBuildSelection()
  if (selection === undefined) return

  const pluginFilters = selection.includes('plugins') ? await selectPluginFilters() : undefined
  const fpkApps = selection.includes('fpk') ? await selectFpkApps() : undefined

  const tasks: Promise<void>[] = []
  if (pluginFilters !== undefined) tasks.push(runTurbo('build', pluginFilters))
  if (fpkApps !== undefined) tasks.push(buildFpkApps(fpkApps))
  if (selection.includes('docs')) tasks.push(runDocsBuild())
  await Promise.all(tasks)
}

export { listFpkApps, buildFpkApps, type FpkApp }

program
  .command('build')
  .description('Select plugins, FPK applications, or documentation to build')
  .option('--plugin [plugin]', 'build one plugin, or prompt for plugins')
  .option('--fpk', 'build FPK applications')
  .option('--app <app>', 'select one FPK application')
  .option('--docs', 'build documentation')
  .action(async (options: OptionValues) => {
    const args: string[] = []
    addOptionalValueArg(args, options, 'plugin')
    addBooleanArgs(args, options, ['fpk', 'docs'])
    if (options.app !== undefined) args.push('--app', options.app)
    await runBuild(args)
  })
