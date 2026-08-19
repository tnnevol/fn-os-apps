#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const sourceDirectory = process.env.DSH_PLUGIN_SOURCE_DIRECTORY
const profileDirectory = process.env.DSH_PROFILE_DIRECTORY
const publishedManifestPath = process.env.DSH_PUBLISHED_PLUGIN_MANIFEST
const npmBin = process.env.NPM_BIN || 'npm'
const npmRegistry = process.env.NPM_REGISTRY || 'https://registry.npmjs.org/'
const installPublished = process.env.DSH_INSTALL_PUBLISHED === '1'
const localPluginNames = new Set(
  (process.env.DSH_LOCAL_PLUGIN_NAMES || '@tnnevol/dsh-fnos')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean),
)

function fail(message) {
  throw new Error(`[dsh-plugins] ${message}`)
}

function validatePackageName(name) {
  if (typeof name !== 'string' || name.length === 0 || name.split('/').some(part => part === '.' || part === '..')) {
    fail(`invalid DSH plugin name: ${name}`)
  }
}

function packageDirectory(baseDirectory, packageName) {
  validatePackageName(packageName)
  return join(baseDirectory, 'node_modules', ...packageName.split('/'))
}

async function readPackageManifest(packageDirectoryPath) {
  try {
    return JSON.parse(await readFile(join(packageDirectoryPath, 'package.json'), 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined
    throw error
  }
}

async function loadPublishedPlugins() {
  if (!publishedManifestPath) fail('published plugin manifest is not configured')
  let manifest
  try {
    manifest = JSON.parse(await readFile(publishedManifestPath, 'utf8'))
  } catch (error) {
    fail(`unable to read published plugin manifest: ${error.message}`)
  }

  if (!Array.isArray(manifest.plugins) || manifest.plugins.length === 0) {
    fail('published plugin manifest does not contain any plugins')
  }

  return manifest.plugins.map(plugin => {
    validatePackageName(plugin?.name)
    if (typeof plugin.version !== 'string' || plugin.version.length === 0) {
      fail(`published plugin ${plugin.name} has no version`)
    }
    return { name: plugin.name, version: plugin.version }
  })
}

async function installPublishedPlugins(publishedPlugins) {
  for (const plugin of publishedPlugins) {
    const targetDirectory = packageDirectory(profileDirectory, plugin.name)
    if (installPublished) {
      console.log(`Installing published ${plugin.name}@${plugin.version} from ${npmRegistry}...`)
      const result = spawnSync(npmBin, [
        'install',
        '--prefix', profileDirectory,
        '--no-save',
        '--package-lock=false',
        '--ignore-scripts',
        '--legacy-peer-deps',
        '--no-audit',
        '--fund=false',
        `--registry=${npmRegistry}`,
        `${plugin.name}@${plugin.version}`,
      ], { stdio: 'inherit' })
      if (result.error) throw result.error
      if (result.status !== 0) fail(`failed to install published ${plugin.name}@${plugin.version}`)
    }

    const installedManifest = await readPackageManifest(targetDirectory)
    if (installedManifest?.name !== plugin.name || installedManifest.version !== plugin.version) {
      fail(
        `published plugin ${plugin.name}@${plugin.version} is not installed in ${targetDirectory}`
        + (installPublished ? '' : '; run the application install or upgrade callback first'),
      )
    }
    if (typeof installedManifest.dsh?.bundle?.patch !== 'string') {
      fail(`published plugin ${plugin.name}@${plugin.version} does not declare dsh.bundle.patch`)
    }
  }
}

async function installLocalPlugins() {
  if (!sourceDirectory) fail('local plugin source directory is not configured')
  try {
    await readdir(sourceDirectory)
  } catch (error) {
    fail(`local plugin source directory is not available: ${sourceDirectory} (${error.message})`)
  }

  const entries = await readdir(sourceDirectory, { withFileTypes: true })
  const plugins = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const sourceDir = join(sourceDirectory, entry.name)
    const sourceManifest = await readPackageManifest(sourceDir)
    if (!sourceManifest) continue
    if (!localPluginNames.has(sourceManifest.name)) continue
    validatePackageName(sourceManifest.name)
    if (typeof sourceManifest.dsh?.bundle?.patch !== 'string') {
      fail(`local DSH plugin ${sourceManifest.name} does not declare dsh.bundle.patch`)
    }

    const targetDir = packageDirectory(profileDirectory, sourceManifest.name)
    await mkdir(dirname(targetDir), { recursive: true })
    await rm(targetDir, { recursive: true, force: true })
    await cp(sourceDir, targetDir, { recursive: true, force: true })
    // Read it back so a partially copied package fails before dsh starts.
    await readFile(join(targetDir, 'package.json'))
    plugins.push({ name: sourceManifest.name, version: sourceManifest.version })
    console.log(`Installed local ${sourceManifest.name} ${sourceManifest.version} into the web profile.`)
  }

  if (plugins.length === 0) fail(`no configured local DSH plugins found in ${sourceDirectory}`)
  return plugins
}

async function updateProfileBundles(profilePlugins) {
  const profileManifestPath = join(profileDirectory, 'package.json')
  const profileManifest = JSON.parse(await readFile(profileManifestPath, 'utf8'))
  const bundles = Array.isArray(profileManifest.dsh?.profile?.bundles)
    ? [...profileManifest.dsh.profile.bundles]
    : []
  for (const plugin of profilePlugins) {
    if (!bundles.includes(plugin.name)) bundles.push(plugin.name)
  }
  profileManifest.dsh = {
    ...(profileManifest.dsh ?? {}),
    profile: {
      ...(profileManifest.dsh?.profile ?? {}),
      bundles,
    },
  }
  await writeFile(profileManifestPath, `${JSON.stringify(profileManifest, null, 2)}\n`)
}

try {
  if (!sourceDirectory || !profileDirectory) {
    fail('local plugin source directory or web profile directory is not configured')
  }

  const publishedPlugins = await loadPublishedPlugins()
  await installPublishedPlugins(publishedPlugins)
  const localPlugins = await installLocalPlugins()
  await updateProfileBundles([...publishedPlugins, ...localPlugins])
  console.log(
    `${installPublished ? 'Installed' : 'Verified'} ${publishedPlugins.length} published and ${localPlugins.length} local DSH plugin(s).`,
  )
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
