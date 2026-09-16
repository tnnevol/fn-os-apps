import { mkdir, readFile, rename, rm } from 'node:fs/promises'
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
import { askBuildSelection, askBundleDshNative, askBundleDshPlugins, askFpkApps, askPlugins } from '../ui/prompts.js'

const DSH_APP_NAME = 'fn-deepseek-harness'
const DSH_PUBLISHED_PLUGIN_MANIFEST = 'app/published-dsh-plugins.json'
const DSH_BUNDLED_PLUGIN_DIRECTORY = 'app/bundled-dsh-plugins'
const DSH_VERSION = '0.1.5-rc.2'
const PNPM_VERSION = '11.7.0'
const DSHMARKET_VERSION = '1.46.1'
const DSH_NATIVE_CONFIG = '.github/config/dsh-native-0.1.5-rc.2.env'
const DSH_NATIVE_PREP_SCRIPT = '.github/scripts/prepare-dsh-native.sh'
const DSH_NATIVE_BUNDLE_DIRECTORY = 'app/native/node-pty'
const DSH_NATIVE_VERSION_FILES = ['app/dsh-version', 'app/node-pty-versions'] as const

type PublishedDshPluginManifest = {
  plugins?: Array<{ name?: unknown, version?: unknown }>
  bundled?: Array<{ name?: unknown, version?: unknown }>
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

async function readDshPluginManifest(app: FpkApp): Promise<PublishedDshPluginManifest> {
  const manifestPath = dshPublishedPluginManifestPath(app)
  if (!existsSync(manifestPath)) return {}
  return JSON.parse(await readFile(manifestPath, 'utf8')) as PublishedDshPluginManifest
}

async function packPluginPackage(sourceDirectory: string, targetDirectory: string, expected: { name: string, version: string }): Promise<void> {
  const packageManifest = JSON.parse(await readFile(join(sourceDirectory, 'package.json'), 'utf8')) as {
    name?: unknown
    version?: unknown
    dependencies?: Record<string, string>
  }
  if (packageManifest.name !== expected.name || packageManifest.version !== expected.version) {
    throw new Error(`Plugin package metadata mismatch for ${expected.name}@${expected.version}`)
  }
  for (const [name, version] of Object.entries(packageManifest.dependencies ?? {})) {
    if (version.startsWith('workspace:') || version.startsWith('link:')) {
      throw new Error(`Bundled plugin ${expected.name} has an unpackable runtime dependency: ${name}@${version}`)
    }
  }
  await mkdir(dirname(targetDirectory), { recursive: true })
  await runCommand('pnpm', ['pack', '--pack-destination', dirname(targetDirectory)], sourceDirectory)
  const packedName = expected.name.replace(/^@/u, '').replaceAll('/', '-')
  const generated = join(dirname(targetDirectory), `${packedName}-${expected.version}.tgz`)
  await rename(generated, targetDirectory)
}

async function validateDshReleaseInputs(app: FpkApp): Promise<void> {
  if (app.name !== 'fn-deepseek-harness') return
  const manifestPath = dshPublishedPluginManifestPath(app)
  const manifest = await readDshPluginManifest(app)
  if (!Array.isArray(manifest.plugins) || manifest.plugins.length === 0) {
    throw new Error(`Published DSH plugin manifest is empty: ${manifestPath}`)
  }
  for (const [index, plugin] of manifest.plugins.entries()) {
    if (typeof plugin?.name !== 'string' || typeof plugin.version !== 'string' ||
        plugin.version.length === 0 || !/^[0-9A-Za-z][0-9A-Za-z.+-]*$/u.test(plugin.version)) {
      throw new Error(`Published DSH plugin must use an exact version at ${manifestPath} (index ${index})`)
    }
  }
  // Codex must stay bundled: the registry only carries builds whose DSH
  // baseline predates 0.1.5-rc.2, and installing one of those breaks Web
  // startup on the missing `settingsNamespace` export. Keep the removal
  // guard inverted so a manifest edit cannot silently drop it again.
  const codex = manifest.plugins.find(plugin => typeof plugin?.name === 'string' && plugin.name.includes('codex'))
  if (codex === undefined) {
    throw new Error(`The published DSH plugin manifest must bundle the Codex plugin: ${manifestPath}`)
  }
  const codeBuddy = manifest.plugins.find(plugin => plugin?.name === '@tnnevol/dsh-codebuddy')
  if (codeBuddy === undefined) {
    throw new Error(`The published DSH plugin manifest must bundle CodeBuddy: ${manifestPath}`)
  }
  const dshmarket = manifest.bundled?.find(plugin => plugin?.name === 'dshmarket')
  if (dshmarket?.version !== DSHMARKET_VERSION) {
    throw new Error(`The published DSH plugin manifest must pin dshmarket@${DSHMARKET_VERSION}`)
  }
  const callback = await readFile(join(repositoryRoot, 'apps', app.name, 'cmd/install_callback'), 'utf8')
  if (!callback.includes(`DSH_VERSION="${DSH_VERSION}"`) || !callback.includes(`PNPM_VERSION="${PNPM_VERSION}"`)) {
    throw new Error(`install_callback is not aligned with DSH ${DSH_VERSION} and pnpm ${PNPM_VERSION}`)
  }
  const shellVariable = (name: string) => '$' + '{' + name + '}'
  const main = await readFile(join(repositoryRoot, 'apps', app.name, 'cmd/main'), 'utf8')
  if (!main.includes(`DSH_REAL_BIN="${shellVariable('DSH_HOME')}/.npm-global/bin/dsh"`) ||
      !main.includes(`DSH_BIN="${shellVariable('DSH_REAL_BIN')}"`) ||
      main.includes('DSH_WRAPPER=') || main.includes('DSH_PROCESS_BIN=')) {
    throw new Error('cmd/main must pass the real DSH CLI to the gateway; it must not use a CLI wrapper')
  }
  if (main.includes('dsh_running()') || main.includes(`is_runtime_process "${shellVariable('pid')}" dsh`)) {
    throw new Error('cmd/main must not manage DSH Web processes; the gateway owns the Web lifecycle')
  }
  // fnOS exposes no root-free way for a normal caller to become the application
  // user: `runuser` refuses non-root, `su` demands a password, and the SDD
  // forbids setuid/ungoverned sudo. A public `dsh` entry point therefore cannot
  // keep the fixed application identity it promises, so the app ships none.
  if (callback.includes('CLI_WRAPPER=') || callback.includes('setup_cli_wrapper')) {
    throw new Error('install_callback must not create the dsh CLI wrapper; the app does not expose a public dsh command')
  }
  const nativeConfig = await readFile(join(repositoryRoot, DSH_NATIVE_CONFIG), 'utf8')
  if (!nativeConfig.includes(`DSH_VERSION="${DSH_VERSION}"`)) {
    throw new Error(`Native build config is not aligned with DSH ${DSH_VERSION}`)
  }
  const resource = await readFile(join(repositoryRoot, 'apps', app.name, 'config/resource'), 'utf8')
  if (resource.includes('/bin/dsh') || resource.includes('usr-local-linker')) {
    throw new Error('config/resource must not register a dsh CLI wrapper')
  }
}

async function prepareDshPluginBundle(app: FpkApp, include: boolean): Promise<void> {
  const manifestPath = dshPublishedPluginManifestPath(app)
  const targetDirectory = join(repositoryRoot, 'apps', app.name, DSH_BUNDLED_PLUGIN_DIRECTORY)
  await rm(targetDirectory, { recursive: true, force: true })
  if (!existsSync(manifestPath) || !include) return

  const manifest = await readDshPluginManifest(app)
  const pluginNames = await readPublishedDshPluginNames(app)
  const pluginVersions = new Map((manifest.plugins ?? []).flatMap(plugin =>
    typeof plugin.name === 'string' && typeof plugin.version === 'string' ? [[plugin.name, plugin.version] as const] : []))
  const pluginTargets = pluginNames.flatMap(name => {
    const target = findPluginTarget(name)
    if (target === undefined) {
      console.log(`Skipping third-party DSH plugin ${name}; it remains a separate install.`)
      return []
    }
    return [target]
  })

  if (pluginTargets.length > 0) await runTurbo(['build'], pluginTargets.map(target => target.filter))
  await mkdir(targetDirectory, { recursive: true })
  for (const target of pluginTargets) {
    const sourceDirectory = dirname(join(repositoryRoot, target.path))
    const pluginArchive = join(targetDirectory, ...target.name.split('/')) + '.tgz'
    const version = pluginVersions.get(target.name)
    if (version === undefined) throw new Error(`Missing exact version for published DSH plugin ${target.name}`)
    await packPluginPackage(sourceDirectory, pluginArchive, { name: target.name, version })
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

function requestedDshNativeBundle(args: string[]): boolean | undefined {
  const include = args.includes('--bundle-dsh-native')
  const skip = args.includes('--skip-bundle-dsh-native')
  if (include && skip) throw new Error('Cannot combine --bundle-dsh-native and --skip-bundle-dsh-native')
  if (include) return true
  if (skip) return false
  return undefined
}

async function selectDshNativeBundle(apps: FpkApp[], args: string[]): Promise<boolean | undefined> {
  if (!apps.some(app => app.name === DSH_APP_NAME)) return false
  const requested = requestedDshNativeBundle(args)
  return requested ?? askBundleDshNative()
}

async function prepareDshNativeBundle(app: FpkApp, include: boolean): Promise<void> {
  if (app.name !== DSH_APP_NAME) return

  const appDirectory = join(repositoryRoot, 'apps', app.name)
  const nativeDirectory = join(appDirectory, DSH_NATIVE_BUNDLE_DIRECTORY)
  const versionFiles = DSH_NATIVE_VERSION_FILES.map(file => join(appDirectory, file))
  if (!include) {
    await rm(nativeDirectory, { recursive: true, force: true })
    await Promise.all(versionFiles.map(file => rm(file, { force: true })))
    console.log('Skipping node-pty native files; the NAS must provide g++ during installation.')
    return
  }

  if (process.platform !== 'linux') {
    throw new Error('node-pty native files must be prepared on a Linux build runner; select No on this platform or use the CI workflow')
  }
  const nativePrepScript = join(repositoryRoot, DSH_NATIVE_PREP_SCRIPT)
  if (!existsSync(nativePrepScript)) {
    throw new Error(`node-pty native preparation script is unavailable: ${nativePrepScript}`)
  }
  console.log('Preparing node-pty native files for the FPK.')
  await runCommand('bash', [nativePrepScript], appDirectory, {
    env: {
      ...process.env,
      APP_DIR: appDirectory,
      NATIVE_CONFIG_FILE: join(repositoryRoot, DSH_NATIVE_CONFIG),
    },
  })

  const missing = [
    ...(existsSync(nativeDirectory) ? [] : [nativeDirectory]),
    ...versionFiles.filter(file => !existsSync(file)),
  ]
  if (missing.length > 0) {
    throw new Error(`node-pty native preparation completed without required files: ${missing.join(', ')}`)
  }
  console.log('Including prepared node-pty native files in the FPK.')
}

function listFpkApps(): FpkApp[] {
  return readFpkApps()
}

async function buildFpkApps(apps: FpkApp[], options: { bundleDshNative?: boolean, bundleDshPlugins?: boolean } = {}): Promise<void> {
  if (apps.some(app => app.requiresGateway)) {
    const gatewayName = readGatewayName()
    if (gatewayName === undefined) throw new Error('Unable to resolve the fnOS Gateway package')
    await runTurbo(['build:app'], [gatewayName])
  }
  for (const app of apps) {
    await validateDshReleaseInputs(app)
    await prepareDshNativeBundle(app, options.bundleDshNative === true)
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
      const bundleDshNative = await selectDshNativeBundle(apps, args)
      const bundleDshPlugins = await selectDshPluginBundle(apps, args)
      if (bundleDshNative !== undefined && bundleDshPlugins !== undefined) {
        await buildFpkApps(apps, { bundleDshNative, bundleDshPlugins })
      }
    }
    return
  }
  if (args.includes('--plugin')) {
    const filters = await selectPluginFilters(plugin)
    if (filters !== undefined) await runTurbo(['build'], filters)
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
  const bundleDshNative = fpkApps === undefined ? false : await selectDshNativeBundle(fpkApps, args)
  const bundleDshPlugins = fpkApps === undefined ? false : await selectDshPluginBundle(fpkApps, args)
  if (fpkApps !== undefined && (bundleDshNative === undefined || bundleDshPlugins === undefined)) return

  const tasks: Promise<void>[] = []
  if (pluginFilters !== undefined) tasks.push(runTurbo(['build'], pluginFilters))
  if (fpkApps !== undefined && bundleDshNative !== undefined && bundleDshPlugins !== undefined) {
    tasks.push(buildFpkApps(fpkApps, { bundleDshNative, bundleDshPlugins }))
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
  .option('--bundle-dsh-native', 'include prepared node-pty native files in the FPK')
  .option('--skip-bundle-dsh-native', 'do not include node-pty native files in the FPK')
  .option('--docs', 'build documentation')
  .action(async (options: OptionValues) => {
    const args: string[] = []
    addOptionalValueArg(args, options, 'plugin')
    addBooleanArgs(args, options, ['fpk', 'docs'])
    if (options.bundleDshPlugins) args.push('--bundle-dsh-plugins')
    if (options.skipBundleDshPlugins) args.push('--skip-bundle-dsh-plugins')
    if (options.bundleDshNative) args.push('--bundle-dsh-native')
    if (options.skipBundleDshNative) args.push('--skip-bundle-dsh-native')
    if (options.app !== undefined) args.push('--app', options.app)
    await runBuild(args)
  })
