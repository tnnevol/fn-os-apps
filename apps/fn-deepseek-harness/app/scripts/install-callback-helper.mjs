#!/usr/bin/env node

import { chmod, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return undefined
  }
}

async function readJsonStrict(path) {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function fileMode(path, fallback) {
  try {
    return (await stat(path)).mode & 0o777
  } catch {
    return fallback
  }
}

async function requiredFileMode(path) {
  return (await stat(path)).mode & 0o777
}

async function removeLegacyPnpmStoreConfig(configPath) {
  const source = await readFile(configPath, 'utf8')
  const lines = source.split(/\r?\n/)
  const filtered = lines.filter((line) => !/^\s*store-dir\s*=/.test(line))
  if (filtered.length === lines.length) return

  while (filtered.at(-1) === '') filtered.pop()
  const mode = await requiredFileMode(configPath)
  const temporaryPath = `${configPath}.tmp-${process.pid}`
  await writeFile(temporaryPath, `${filtered.join('\n')}\n`, { mode })
  await chmod(temporaryPath, mode)
  await rename(temporaryPath, configPath)
}

async function persistPnpmStoreDir(configPath, storeDir, storeFile) {
  if (!configPath || !storeDir || !storeFile) {
    throw new Error('persist-pnpm-store-dir requires config, store, and store-file paths')
  }

  await mkdir(dirname(storeFile), { recursive: true })
  const storeMode = await fileMode(storeFile, 0o600)
  const storeTemporaryPath = `${storeFile}.tmp-${process.pid}`
  await writeFile(storeTemporaryPath, `${storeDir}\n`, { mode: storeMode })
  await chmod(storeTemporaryPath, storeMode)
  await rename(storeTemporaryPath, storeFile)

  let source = ''
  try {
    source = await readFile(configPath, 'utf8')
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }

  const originalLines = source.split(/\r?\n/)
  const lines = originalLines.filter((line) => !/^\s*store-dir\s*=/.test(line))
  if (lines.length === originalLines.length) return

  while (lines.at(-1) === '') lines.pop()
  const configMode = await fileMode(configPath, 0o600)
  await mkdir(dirname(configPath), { recursive: true })
  const configTemporaryPath = `${configPath}.tmp-${process.pid}`
  await writeFile(configTemporaryPath, `${lines.join('\n')}\n`, { mode: configMode })
  await chmod(configTemporaryPath, configMode)
  await rename(configTemporaryPath, configPath)
}

async function packageField(path, field) {
  const packageJson = await readJson(path)
  const value = packageJson?.[field]
  if (typeof value === 'string') process.stdout.write(value)
}

async function profileDependencyVersion(path, packageName) {
  const manifest = await readJson(path)
  const dependencies = { ...(manifest?.dependencies || {}), ...(manifest?.devDependencies || {}) }
  const value = dependencies[packageName]
  if (typeof value === 'string') process.stdout.write(value)
}

async function profileStoreDir(path) {
  try {
    const text = await readFile(path, 'utf8')
    const value = text.match(/^storeDir:\s*(.+?)\s*$/m)?.[1]
    if (value) process.stdout.write(value.replace(/\/v\d+\/?$/, ''))
  } catch {
    // A missing or malformed pnpm metadata file means no reusable store.
  }
}

async function publishedPlugins(path) {
  const manifest = await readJsonStrict(path)
  for (const plugin of manifest.plugins || []) {
    if (typeof plugin?.name === 'string' && typeof plugin?.version === 'string') {
      console.log(`${plugin.name}\t${plugin.version}`)
    }
  }
}

async function bundledPluginVersion(path, packageName) {
  const manifest = await readJsonStrict(path)
  const plugin = (manifest.bundled || []).find((value) => value?.name === packageName)
  if (typeof plugin?.version === 'string') process.stdout.write(plugin.version)
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  switch (command) {
    case 'remove-legacy-pnpm-store-config':
      await removeLegacyPnpmStoreConfig(args[0])
      break
    case 'persist-pnpm-store-dir':
      await persistPnpmStoreDir(args[0], args[1], args[2])
      break
    case 'package-version':
      await packageField(args[0], 'version')
      break
    case 'profile-dependency-version':
      await profileDependencyVersion(args[0], args[1])
      break
    case 'profile-store-dir':
      await profileStoreDir(args[0])
      break
    case 'published-plugins':
      await publishedPlugins(args[0])
      break
    case 'bundled-plugin-version':
      await bundledPluginVersion(args[0], args[1])
      break
    default:
      throw new Error(`Unknown install callback helper command: ${command || '(missing)'}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
