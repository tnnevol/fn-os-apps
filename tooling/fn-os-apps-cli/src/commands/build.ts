import { cp, mkdir, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
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
import { askBuildSelection, askBundleDshPlugins, askFpkApps, askPlugins } from '../ui/prompts.js'

const DSH_PUBLISHED_PLUGIN_MANIFEST = 'app/published-dsh-plugins.json'
const DSH_BUNDLED_PLUGIN_DIRECTORY = 'app/bundled-dsh-plugins'

type PublishedDshPluginManifest = {
  plugins?: Array<{ name?: unknown }>
}

function dshPublishedPluginManifestPath(app: FpkApp): string {
  return join(repositoryRoot, 'apps', app.name, DSH_PUBLISHED_PLUGIN_MANIFEST)
}

function hasDshPluginManifest(app: FpkApp): boolean {
  return existsSync(dshPublishedPluginManifestPath(app))
}

async function readPublishedDshPluginNames(app: FpkApp): Promise<string[]> {
  const manifestPath = dshPublishedPluginManifestPath(app)
  if (!existsSync(manifestPath)) return []

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as PublishedDshPluginManifest
  if (!Array.isArray(manifest.plugins) || manifest.plugins.length === 0) {
    throw new Error(`Published DSH plugin manifest is empty: ${manifestPath}`)
  }

  return manifest.plugins.map((plugin, index) => {
    if (typeof plugin?.name !== 'string' || plugin.name.length === 0) {
      throw new Error(`Invalid DSH plugin at ${manifestPath} (index ${index})`)
    }
    return plugin.name
  })
}

function validatePackageFile(relativePath: string): void {
  if (relativePath.startsWith('/') || relativePath.split('/').includes('..')) {
    throw new Error(`Invalid plugin package file path: ${relativePath}`)
  }
}

async function copyPluginPackage(sourceDirectory: string, targetDirectory: string): Promise<void> {
  const packageManifest = JSON.parse(await readFile(join(sourceDirectory, 'package.json'), 'utf8')) as {
    files?: unknown
  }
  const files = new Set(['package.json'])
  if (Array.isArray(packageManifest.files)) {
    for (const file of packageManifest.files) {
      if (typeof file !== 'string' || file.length === 0) continue
      validatePackageFile(file)
      files.add(file)
    }
  }

  for (const file of files) {
    await mkdir(dirname(join(targetDirectory, file)), { recursive: true })
    await cp(join(sourceDirectory, file), join(targetDirectory, file), { recursive: true })
  }
}

async function prepareDshPluginBundle(app: FpkApp, include: boolean): Promise<void> {
  const manifestPath = dshPublishedPluginManifestPath(app)
  const targetDirectory = join(repositoryRoot, 'apps', app.name, DSH_BUNDLED_PLUGIN_DIRECTORY)
  await rm(targetDirectory, { recursive: true, force: true })
  if (!existsSync(manifestPath) || !include) return

  const pluginNames = await readPublishedDshPluginNames(app)
  const pluginTargets = pluginNames.map(name => {
    const target = findPluginTarget(name)
    if (target === undefined) {
      throw new Error(`Unable to find local source for published DSH plugin ${name}`)
    }
    return target
  })

  await runTurbo('build', pluginTargets.map(target => target.filter))
  await mkdir(targetDirectory, { recursive: true })
  for (const target of pluginTargets) {
    const sourceDirectory = dirname(join(repositoryRoot, target.path))
    const pluginDirectory = join(targetDirectory, ...target.name.split('/'))
    await copyPluginPackage(sourceDirectory, pluginDirectory)
  }
}

function requestedDshPluginBundle(args: string[]): boolean | undefined {
  const include = args.includes('--bundle-dsh-plugins')
  const skip = args.includes('--skip-bundle-dsh-plugins')
  if (include && skip) throw new Error('Cannot combine --bundle-dsh-plugins and --skip-bundle-dsh-plugins')
  if (include) return true
  if (skip) return false
  return undefined
}

async function selectDshPluginBundle(apps: FpkApp[], args: string[]): Promise<boolean | undefined> {
  if (!apps.some(hasDshPluginManifest)) return false
  const requested = requestedDshPluginBundle(args)
  return requested ?? askBundleDshPlugins()
}

function listFpkApps(): FpkApp[] {
  return readFpkApps()
}

async function buildFpkApps(apps: FpkApp[], options: { bundleDshPlugins?: boolean } = {}): Promise<void> {
  if (apps.some(app => app.requiresGateway)) {
    const gatewayName = readGatewayName()
    if (gatewayName === undefined) throw new Error('Unable to resolve the fnOS Gateway package')
    await runTurbo('build:app', [gatewayName])
  }
  for (const app of apps) {
    await prepareDshPluginBundle(app, options.bundleDshPlugins === true)
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
    if (apps !== undefined) {
      const bundleDshPlugins = await selectDshPluginBundle(apps, args)
      if (bundleDshPlugins !== undefined) await buildFpkApps(apps, { bundleDshPlugins })
    }
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
  const bundleDshPlugins = fpkApps === undefined ? false : await selectDshPluginBundle(fpkApps, args)
  if (fpkApps !== undefined && bundleDshPlugins === undefined) return

  const tasks: Promise<void>[] = []
  if (pluginFilters !== undefined) tasks.push(runTurbo('build', pluginFilters))
  if (fpkApps !== undefined && bundleDshPlugins !== undefined) {
    tasks.push(buildFpkApps(fpkApps, { bundleDshPlugins }))
  }
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
  .option('--bundle-dsh-plugins', 'include published DSH plugins in the FPK')
  .option('--skip-bundle-dsh-plugins', 'do not include published DSH plugins in the FPK')
  .option('--docs', 'build documentation')
  .action(async (options: OptionValues) => {
    const args: string[] = []
    addOptionalValueArg(args, options, 'plugin')
    addBooleanArgs(args, options, ['fpk', 'docs'])
    if (options.bundleDshPlugins) args.push('--bundle-dsh-plugins')
    if (options.skipBundleDshPlugins) args.push('--skip-bundle-dsh-plugins')
    if (options.app !== undefined) args.push('--app', options.app)
    await runBuild(args)
  })
