#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const profileDirectory = process.env.DSH_PROFILE_DIRECTORY
const publishedManifestPath = process.env.DSH_PUBLISHED_PLUGIN_MANIFEST
const npmBin = process.env.NPM_BIN || 'npm'
const npmRegistry = process.env.NPM_REGISTRY || 'https://registry.npmjs.org/'
const installPublished = process.env.DSH_INSTALL_PUBLISHED === '1'

// These are the shipped web profile layers. The three built-in settings cards
// (terminal, agent loop, and web search) are registered by this official
// bundle pair, not by the published third-party plugin manifest. Keep the
// baseline in old profiles so upgrading DSH does not leave a stale profile
// without the built-in settings providers.
const OFFICIAL_WEB_PROFILE_BUNDLES = [
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
]

function fail(message) {
  throw new Error(`[dsh-plugins] ${message}`)
}

function validatePackageName(name) {
  if (typeof name !== 'string' || name.length === 0 || name.split('/').some(part => part === '.' || part === '..')) {
    fail(`invalid DSH plugin name: ${name}`)
  }
}

function validateDistTag(tag) {
  if (typeof tag !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(tag)) {
    fail(`invalid DSH plugin dist-tag: ${tag}`)
  }
}

function pluginRequirement(plugin) {
  return plugin.version ? `${plugin.name}@${plugin.version}` : `${plugin.name}@${plugin.distTag}`
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
    const hasVersion = typeof plugin.version === 'string' && plugin.version.length > 0
    const hasDistTag = typeof plugin.distTag === 'string' && plugin.distTag.length > 0
    if (hasVersion === hasDistTag) {
      fail(`published plugin ${plugin.name} must specify exactly one of version or distTag`)
    }
    if (hasDistTag) validateDistTag(plugin.distTag)
    return hasVersion
      ? { name: plugin.name, version: plugin.version }
      : { name: plugin.name, distTag: plugin.distTag }
  })
}

function resolvePublishedVersion(plugin) {
  const requirement = pluginRequirement(plugin)
  if (plugin.version) return plugin.version

  const result = spawnSync(npmBin, [
    'view',
    requirement,
    'version',
    `--registry=${npmRegistry}`,
  ], { encoding: 'utf8' })
  if (result.error) throw result.error

  const version = String(result.stdout ?? '').trim()
  if (result.status !== 0 || !version) {
    const detail = String(result.stderr ?? '').trim()
    fail(`unable to resolve ${requirement} from ${npmRegistry}${detail ? `: ${detail}` : ''}`)
  }
  return version
}

async function installPublishedPlugins(publishedPlugins) {
  for (const plugin of publishedPlugins) {
    const targetDirectory = packageDirectory(profileDirectory, plugin.name)
    let resolvedVersion = plugin.version
    if (installPublished) {
      resolvedVersion = resolvePublishedVersion(plugin)
      console.log(
        `Installing published ${plugin.name}@${resolvedVersion}`
        + (plugin.distTag ? ` (dist-tag ${plugin.distTag})` : '')
        + ` from ${npmRegistry}...`,
      )
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
        `${plugin.name}@${resolvedVersion}`,
      ], { stdio: 'inherit' })
      if (result.error) throw result.error
      if (result.status !== 0) fail(`failed to install published ${plugin.name}@${resolvedVersion}`)
    }

    const installedManifest = await readPackageManifest(targetDirectory)
    const expectedVersion = plugin.version ?? (installPublished ? resolvedVersion : undefined)
    const hasExpectedPackage = installedManifest?.name === plugin.name
      && (expectedVersion
        ? installedManifest.version === expectedVersion
        : typeof installedManifest.version === 'string')
    if (!hasExpectedPackage) {
      fail(
        `published plugin ${pluginRequirement(plugin)} is not installed in ${targetDirectory}`
        + (installPublished ? '' : '; run the application install or upgrade callback first'),
      )
    }
    if (typeof installedManifest.dsh?.bundle?.patch !== 'string') {
      fail(`published plugin ${pluginRequirement(plugin)} does not declare dsh.bundle.patch`)
    }
  }
}

async function updateProfileBundles(publishedPlugins) {
  const profileManifestPath = join(profileDirectory, 'package.json')
  const profileManifest = JSON.parse(await readFile(profileManifestPath, 'utf8'))
  const existingBundles = Array.isArray(profileManifest.dsh?.profile?.bundles)
    ? [...profileManifest.dsh.profile.bundles]
    : []
  const hadOfficialBaseline = OFFICIAL_WEB_PROFILE_BUNDLES.every(
    (bundle, index) => existingBundles[index] === bundle,
  )
  const bundles = []

  // Heal profiles created by older FPK/DSH versions. Do not replace the
  // user's bundle list: normalize the official baseline first, then retain
  // every existing string bundle in its original order.
  for (const bundle of [...OFFICIAL_WEB_PROFILE_BUNDLES, ...existingBundles]) {
    if (typeof bundle !== 'string' || bundles.includes(bundle)) continue
    bundles.push(bundle)
  }

  for (const plugin of publishedPlugins) {
    if (!bundles.includes(plugin.name)) bundles.push(plugin.name)
  }

  if (!hadOfficialBaseline) {
    console.log('Repaired the dsh web profile with the official base and web-app bundles.')
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
  if (!profileDirectory) fail('web profile directory is not configured')

  const publishedPlugins = await loadPublishedPlugins()
  await installPublishedPlugins(publishedPlugins)
  await updateProfileBundles(publishedPlugins)
  console.log(`${installPublished ? 'Installed' : 'Verified'} ${publishedPlugins.length} published DSH plugin(s).`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
