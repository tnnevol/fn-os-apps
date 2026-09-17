import { chmod, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export type JsonObject = Record<string, unknown>

type PluginManifestEntry = {
  name?: unknown
  version?: unknown
}

function asJsonObject(value: unknown): JsonObject | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : undefined
}

export async function readJson(path: string): Promise<JsonObject | undefined> {
  try {
    return asJsonObject(JSON.parse(await readFile(path, 'utf8')))
  } catch {
    return undefined
  }
}

export async function readJsonStrict(path: string): Promise<JsonObject> {
  const value = asJsonObject(JSON.parse(await readFile(path, 'utf8')))
  if (value === undefined) throw new Error(`Expected a JSON object at ${path}`)
  return value
}

async function fileMode(path: string, fallback: number): Promise<number> {
  try {
    return (await stat(path)).mode & 0o777
  } catch {
    return fallback
  }
}

async function requiredFileMode(path: string): Promise<number> {
  return (await stat(path)).mode & 0o777
}

export async function removeLegacyPnpmStoreConfig(configPath: string): Promise<void> {
  const source = await readFile(configPath, 'utf8')
  const lines = source.split(/\r?\n/)
  const filtered = lines.filter(line => !/^\s*store-dir\s*=/.test(line))
  if (filtered.length === lines.length) return

  while (filtered.at(-1) === '') filtered.pop()
  const mode = await requiredFileMode(configPath)
  const temporaryPath = `${configPath}.tmp-${process.pid}`
  await writeFile(temporaryPath, `${filtered.join('\n')}\n`, { mode })
  await chmod(temporaryPath, mode)
  await rename(temporaryPath, configPath)
}

export async function persistPnpmStoreDir(
  configPath: string,
  storeDir: string,
  storeFile: string,
): Promise<void> {
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
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }

  const originalLines = source.split(/\r?\n/)
  const lines = originalLines.filter(line => !/^\s*store-dir\s*=/.test(line))
  if (lines.length === originalLines.length) return

  while (lines.at(-1) === '') lines.pop()
  const configMode = await fileMode(configPath, 0o600)
  await mkdir(dirname(configPath), { recursive: true })
  const configTemporaryPath = `${configPath}.tmp-${process.pid}`
  await writeFile(configTemporaryPath, `${lines.join('\n')}\n`, { mode: configMode })
  await chmod(configTemporaryPath, configMode)
  await rename(configTemporaryPath, configPath)
}

export async function packageField(path: string, field: string): Promise<void> {
  const packageJson = await readJson(path)
  const value = packageJson?.[field]
  if (typeof value === 'string') process.stdout.write(value)
}

export async function profileDependencyVersion(path: string, packageName: string): Promise<void> {
  const manifest = await readJson(path)
  const dependencies = {
    ...(manifest?.dependencies !== null && typeof manifest?.dependencies === 'object'
      ? manifest.dependencies as JsonObject
      : {}),
    ...(manifest?.devDependencies !== null && typeof manifest?.devDependencies === 'object'
      ? manifest.devDependencies as JsonObject
      : {}),
  }
  const value = dependencies[packageName]
  if (typeof value === 'string') process.stdout.write(value)
}

export async function profileStoreDir(path: string): Promise<void> {
  try {
    const text = await readFile(path, 'utf8')
    let value: unknown
    try {
      value = (JSON.parse(text) as { storeDir?: unknown }).storeDir
    } catch {
      value = text.match(/^storeDir:\s*(.+?)\s*$/m)?.[1]
    }
    if (typeof value === 'string' && value.length > 0) {
      process.stdout.write(value.replace(/\/v\d+\/?$/, ''))
    }
  } catch {
    // A missing or malformed pnpm metadata file means no reusable store.
  }
}

export async function publishedPlugins(path: string): Promise<void> {
  const manifest = await readJsonStrict(path)
  const plugins = Array.isArray(manifest.plugins) ? manifest.plugins as PluginManifestEntry[] : []
  for (const plugin of plugins) {
    if (typeof plugin.name === 'string' && typeof plugin.version === 'string') {
      process.stdout.write(`${plugin.name}\t${plugin.version}\n`)
    }
  }
}

export async function bundledPluginVersion(path: string, packageName: string): Promise<void> {
  const manifest = await readJsonStrict(path)
  const bundled = Array.isArray(manifest.bundled) ? manifest.bundled as PluginManifestEntry[] : []
  const plugin = bundled.find(value => value.name === packageName)
  if (typeof plugin?.version === 'string') process.stdout.write(plugin.version)
}
