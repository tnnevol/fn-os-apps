#!/usr/bin/env node

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const DSH_PROFILE_NAME = 'web'
const DSH_PACKAGE_PREFIX = '@deepseek-ai/dsh-'
const MANAGED_MARKER = '# Managed by fn-deepseek-harness: temporary compatibility quarantine.'
const EXACT_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u

// Older dsh-codex-connect releases published wildcard DSH peer dependencies
// and no compatibility.json, although they were built against DSH rc.6. Keep
// those installs safe on newer runtimes until the plugin publishes an explicit
// compatibility declaration. An explicit declaration always takes precedence.
const KNOWN_PLUGIN_DSH_VERSIONS = new Map([
  ['dsh-codex-connect', '0.1.0-rc.6'],
])

function isMissingFile(error) {
  return error?.code === 'ENOENT'
}

export function readJson(filename) {
  if (filename === undefined) return undefined
  try {
    return JSON.parse(readFileSync(filename, 'utf8'))
  } catch (error) {
    if (isMissingFile(error)) return undefined
    throw new Error(`failed to read JSON ${filename}: ${String(error)}`)
  }
}

function readText(filename) {
  if (filename === undefined) return undefined
  try {
    return readFileSync(filename, 'utf8')
  } catch (error) {
    if (isMissingFile(error)) return undefined
    throw new Error(`failed to read ${filename}: ${String(error)}`)
  }
}

function exactVersion(value) {
  return typeof value === 'string' && EXACT_VERSION_PATTERN.test(value.trim()) ? value.trim() : undefined
}

function packageDirectoryFromJson(filename) {
  return filename === undefined ? undefined : dirname(filename)
}

export function resolvePackageDirectory(profileDirectory, packageName, dshPackageDirectory) {
  const candidates = [
    join(profileDirectory, 'node_modules', packageName),
    join(dirname(profileDirectory), 'node_modules', packageName),
  ]
  if (dshPackageDirectory !== undefined) {
    candidates.push(join(dshPackageDirectory, 'node_modules', packageName))
  }
  return candidates.find(candidate => existsSync(join(candidate, 'package.json')))
}

function isFirstPartyBundle(packageName) {
  return packageName === '@deepseek-ai/dsh' || packageName.startsWith(DSH_PACKAGE_PREFIX)
}

function profileBundleNames(profileManifest) {
  const bundles = profileManifest?.dsh?.profile?.bundles
  return Array.isArray(bundles) ? bundles.filter(bundle => typeof bundle === 'string' && bundle.length > 0) : []
}

function declaredDshVersions(packageName, packageDirectory, packageManifest) {
  const versions = []
  const compatibility = readJson(join(packageDirectory, 'compatibility.json'))
  const compatibilityVersion = exactVersion(compatibility?.dshPluginApi?.version)
  if (compatibilityVersion !== undefined) versions.push(compatibilityVersion)

  const peers = packageManifest?.peerDependencies ?? {}
  for (const [packageName, version] of Object.entries(peers)) {
    if (packageName === '@deepseek-ai/dsh' || packageName.startsWith(DSH_PACKAGE_PREFIX)) {
      const peerVersion = exactVersion(version)
      if (peerVersion !== undefined) versions.push(peerVersion)
    }
  }

  // Some older third-party bundles only published wildcard peers. Use the
  // package-specific baseline only when no explicit DSH API version exists;
  // this lets a future compatibility.json opt the plugin back in.
  if (versions.length === 0) {
    const knownVersion = KNOWN_PLUGIN_DSH_VERSIONS.get(packageName)
    if (knownVersion !== undefined) versions.push(knownVersion)
  }
  return [...new Set(versions)]
}

/**
 * Extract loader ids inserted by a bundle patch without adding a YAML
 * dependency to the fnOS app. DSH bundle patches use a top-level `- insert:`
 * entry and an indented list of `- id:` entries. Target-only patches are not
 * treated as plugin-owned rows and are therefore left untouched.
 */
export function insertedEntryIds(patch) {
  const ids = []
  let insertIndent
  for (const line of patch.split(/\r?\n/u)) {
    const indentation = /^\s*/u.exec(line)?.[0].length ?? 0
    const insert = /^(\s*)-\s+insert:\s*(?:#.*)?$/u.exec(line)
    if (insert !== null) {
      insertIndent = insert[1].length
      continue
    }

    if (insertIndent !== undefined && line.trim() !== '' && !line.trim().startsWith('#') && indentation <= insertIndent) {
      insertIndent = undefined
    }
    if (insertIndent === undefined) continue

    const match = /^\s*-\s+id:\s*(?:"([A-Za-z0-9][A-Za-z0-9._-]*)"|'([A-Za-z0-9][A-Za-z0-9._-]*)'|([A-Za-z0-9][A-Za-z0-9._-]*))\s*(?:#.*)?$/u.exec(line)
    if (match !== null) {
      const id = match[1] ?? match[2] ?? match[3]
      if (!ids.includes(id)) ids.push(id)
    }
  }
  return ids
}

function pluginCompatibility(packageName, packageDirectory, packageManifest, runtimeVersion) {
  const declaredVersions = declaredDshVersions(packageName, packageDirectory, packageManifest)
  if (runtimeVersion === undefined || declaredVersions.length === 0) return undefined
  const incompatibleVersions = declaredVersions.filter(version => version !== runtimeVersion)
  if (incompatibleVersions.length === 0) return undefined

  const patchReference = packageManifest?.dsh?.bundle?.patch
  if (typeof patchReference !== 'string' || patchReference.length === 0) {
    return { incompatibleVersions, entryIds: [], reason: 'bundle patch is not declared' }
  }
  const patchFile = join(packageDirectory, patchReference)
  const patch = readText(patchFile)
  if (patch === undefined) {
    return { incompatibleVersions, entryIds: [], reason: `bundle patch is missing at ${patchFile}` }
  }
  return { incompatibleVersions, entryIds: insertedEntryIds(patch), reason: undefined }
}

function runtimeVersion(dshPackageFile, dshVersionFile) {
  const packageManifest = readJson(dshPackageFile)
  const packageVersion = exactVersion(packageManifest?.version)
  if (packageVersion !== undefined) return packageVersion
  const fileVersion = exactVersion(readText(dshVersionFile)?.trim())
  return fileVersion
}

function patchContent(plugins) {
  const entryIds = [...new Set(plugins.flatMap(plugin => plugin.entryIds))].sort()
  return `${MANAGED_MARKER}\n# The package, profile dependency, plugin settings, and OAuth data are retained.\n${entryIds.map(id => `- id: ${id}\n  disabled: true`).join('\n')}\n`
}

function writeManagedPatch(filename, content) {
  const existing = readText(filename)
  if (existing !== undefined && !existing.includes(MANAGED_MARKER)) {
    throw new Error(`refusing to overwrite non-managed compatibility patch ${filename}`)
  }
  mkdirSync(dirname(filename), { recursive: true })
  const temporary = `${filename}.tmp-${process.pid}`
  writeFileSync(temporary, content, 'utf8')
  renameSync(temporary, filename)
}

function removeManagedPatch(filename) {
  const existing = readText(filename)
  if (existing === undefined) return false
  if (!existing.includes(MANAGED_MARKER)) {
    console.warn(`[dsh compatibility] keeping non-managed patch ${filename}`)
    return false
  }
  unlinkSync(filename)
  return true
}

export function prepareCompatibility({
  profileDirectory,
  dshPackageFile,
  dshVersionFile,
  dshPackageDirectory,
  patchFile,
}) {
  const profileManifest = readJson(join(profileDirectory, 'package.json'))
  if (profileManifest === undefined) {
    return { action: 'deferred', reason: `profile ${DSH_PROFILE_NAME} has not been initialized` }
  }

  const currentVersion = runtimeVersion(dshPackageFile, dshVersionFile)
  if (currentVersion === undefined) {
    return { action: 'deferred', reason: 'installed DSH version is unavailable' }
  }

  const incompatiblePlugins = []
  const unresolvedPlugins = []
  for (const packageName of profileBundleNames(profileManifest)) {
    if (isFirstPartyBundle(packageName)) continue
    const packageDirectory = resolvePackageDirectory(profileDirectory, packageName, dshPackageDirectory)
    const packageManifest = readJson(packageDirectory === undefined ? undefined : join(packageDirectory, 'package.json'))
    if (packageDirectory === undefined || packageManifest === undefined) continue

    const compatibility = pluginCompatibility(packageName, packageDirectory, packageManifest, currentVersion)
    if (compatibility === undefined) continue
    const plugin = {
      packageName,
      packageVersion: packageManifest.version ?? 'unknown',
      currentVersion,
      incompatibleVersions: compatibility.incompatibleVersions,
      entryIds: compatibility.entryIds,
      reason: compatibility.reason,
    }
    if (plugin.entryIds.length === 0) unresolvedPlugins.push(plugin)
    else incompatiblePlugins.push(plugin)
  }

  if (unresolvedPlugins.length > 0) {
    for (const plugin of unresolvedPlugins) {
      console.warn(
        `[dsh compatibility] ${plugin.packageName}@${plugin.packageVersion} declares DSH ${plugin.incompatibleVersions.join(', ')} `
        + `but the app runs ${plugin.currentVersion}; its bundle entry ids could not be determined (${plugin.reason ?? 'empty bundle patch'}).`,
      )
    }
  }

  if (incompatiblePlugins.length > 0) {
    const content = patchContent(incompatiblePlugins)
    writeManagedPatch(patchFile, content)
    return { action: 'quarantined', patchFile, plugins: incompatiblePlugins, unresolvedPlugins }
  }

  if (unresolvedPlugins.length > 0) {
    return { action: 'unresolved', patchFile, unresolvedPlugins }
  }

  const restored = removeManagedPatch(patchFile)
  return { action: restored ? 'restored' : 'none', unresolvedPlugins }
}

function displayQuarantine(result) {
  for (const plugin of result.plugins) {
    console.log(
      `[dsh compatibility] temporarily disabled ${plugin.packageName}@${plugin.packageVersion} `
      + `(supports DSH ${plugin.incompatibleVersions.join(', ')}, running ${plugin.currentVersion}) `
      + `to keep the web profile available.`,
    )
  }
  console.log(`[dsh compatibility] plugin packages and user data were kept; update the plugin and restart the app to restore it.`)
  console.log(`[dsh compatibility] managed patch: ${result.patchFile}`)
}

function main() {
  const dshHome = process.env.DSH_HOME
  const appHome = process.env.DSH_COMPAT_APP_HOME
  if (dshHome === undefined || appHome === undefined) {
    throw new Error('DSH_HOME and DSH_COMPAT_APP_HOME are required')
  }
  const dshPackageDirectory = process.env.DSH_COMPAT_DSH_PACKAGE_DIRECTORY
    ?? join(dshHome, '.npm-global', 'lib', 'node_modules', '@deepseek-ai', 'dsh')
  const patchFile = process.env.DSH_COMPAT_PATCH_FILE
    ?? join(appHome, '.fn-deepseek-harness', 'compatibility', `${DSH_PROFILE_NAME}-incompatible-plugins.patch.yml`)
  const result = prepareCompatibility({
    profileDirectory: process.env.DSH_COMPAT_PROFILE_DIRECTORY ?? join(dshHome, 'profiles', DSH_PROFILE_NAME),
    dshPackageFile: process.env.DSH_COMPAT_DSH_PACKAGE_FILE ?? join(dshPackageDirectory, 'package.json'),
    dshVersionFile: process.env.DSH_COMPAT_DSH_VERSION_FILE,
    dshPackageDirectory,
    patchFile: resolve(patchFile),
  })
  if (result.action === 'quarantined') displayQuarantine(result)
  if (result.action === 'restored') console.log('[dsh compatibility] all previously quarantined plugins are compatible again; removed the managed patch.')
  if (result.action === 'deferred') console.log(`[dsh compatibility] ${result.reason}; compatibility check will run again before the next start.`)
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isMain) {
  try {
    main()
  } catch (error) {
    console.error(`[dsh compatibility] ${String(error)}`)
    process.exitCode = 1
  }
}
