import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { repositoryRoot } from '../config/paths.js'
import { findPluginTarget } from '../config/targets.js'
import { runDocsBuild } from './docs.js'
import { optionValue } from '../core/args.js'
import { runCommand } from '../core/process.js'
import { runTurbo } from '../core/turbo.js'
import { askBuildSelection, askFpkApps, askPlugins } from '../ui/prompts.js'

async function listFpkApps(): Promise<string[]> {
  const appsDirectory = join(repositoryRoot, 'apps')
  const entries = await readdir(appsDirectory, { withFileTypes: true })
  const apps: string[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    try {
      await readFile(join(appsDirectory, entry.name, 'manifest'), 'utf8')
      apps.push(entry.name)
    } catch {
      // A directory without a manifest is not an FPK application.
    }
  }
  return apps.sort()
}

async function buildFpkApps(apps: string[]): Promise<void> {
  if (apps.includes('fn-deepseek-harness')) {
    await runTurbo('build:app', ['@tnnevol/fnos-gateway'])
  }
  for (const app of apps) {
    console.log(`\nBuilding FPK: ${app}`)
    await runCommand('fnpack', ['build'], join(repositoryRoot, 'apps', app))
  }
}

async function buildSelectedPlugins(filter?: string): Promise<void> {
  if (filter !== undefined) {
    const target = findPluginTarget(filter)
    if (target === undefined) throw new Error(`Unknown plugin: ${filter}`)
    await runTurbo('build', [target.filter])
    return
  }
  const selected = await askPlugins()
  if (selected !== undefined) await runTurbo('build', selected)
}

async function buildSelectedFpk(app?: string): Promise<void> {
  const apps = await listFpkApps()
  if (app !== undefined) {
    if (!apps.includes(app)) throw new Error(`Unknown FPK application: ${app}`)
    await buildFpkApps([app])
    return
  }
  const selected = await askFpkApps(apps)
  if (selected !== undefined) await buildFpkApps(selected)
}

export async function runBuild(args: string[]): Promise<void> {
  const app = optionValue(args, '--app')
  const plugin = optionValue(args, '--plugin')
  if (args.includes('--fpk')) {
    await buildSelectedFpk(app)
    return
  }
  if (args.includes('--plugin')) {
    await buildSelectedPlugins(plugin)
    return
  }
  if (args.includes('--docs')) {
    await runDocsBuild()
    return
  }

  const selection = await askBuildSelection()
  if (selection === undefined) return
  if (selection.includes('plugins')) await buildSelectedPlugins()
  if (selection.includes('fpk')) await buildSelectedFpk()
  if (selection.includes('docs')) await runDocsBuild()
}

export { listFpkApps, buildFpkApps }
