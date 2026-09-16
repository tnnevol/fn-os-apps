import { spawnSync } from 'node:child_process'
import { constants, readFileSync } from 'node:fs'
import { access, chmod, copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { readJson } from './common.ts'

function logMessage(level: string, message: string): string {
  const timestamp = new Date().toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')
  return `[${timestamp}] [install-node-pty] [${level}] ${message}`
}

function failNodePty(message: string): never {
  throw new Error(logMessage('ERROR', message))
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) failNodePty(`${name} is required`)
  return value
}

function hasCompiler(): boolean {
  return spawnSync('g++', ['--version'], { stdio: 'ignore' }).status === 0
}

function readVersionList(path: string): string[] {
  try {
    return readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter(line => /\S/.test(line))
      .map(line => line.replace(/\s/g, ''))
  } catch {
    return []
  }
}

function validateVersions(versions: string[]): void {
  for (const version of versions) {
    if (!/^[A-Za-z0-9_.+-]+$/.test(version)) {
      failNodePty(`invalid packaged node-pty version: ${version}`)
    }
  }
}

async function findNodePtyPackages(root: string, result: string[] = []): Promise<string[]> {
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return result
  }

  for (const entry of entries) {
    const entryPath = join(root, entry.name)
    if (entry.isDirectory()) {
      await findNodePtyPackages(entryPath, result)
      continue
    }
    if (entry.isFile() && entry.name === 'package.json' && root.endsWith(join('node_modules', 'node-pty'))) {
      result.push(entryPath)
    }
  }
  return result
}

async function uniqueNodePtyPackages(roots: string[]): Promise<string[]> {
  const packages: string[] = []
  const seen = new Set<string>()
  for (const root of roots) {
    for (const packageJson of await findNodePtyPackages(root)) {
      if (seen.has(packageJson)) continue
      seen.add(packageJson)
      packages.push(packageJson)
    }
  }
  return packages
}

type PackageBackup = {
  backupPath: string
  packageJson: string
  mode: number
}

async function restorePackageMetadata(backups: PackageBackup[]): Promise<void> {
  for (const backup of backups) {
    await copyFile(backup.backupPath, backup.packageJson)
    await chmod(backup.packageJson, backup.mode)
  }
}

async function disableNodePtyInstallScripts(packageFiles: string[], backupDir: string): Promise<PackageBackup[]> {
  const backups: PackageBackup[] = []
  try {
    for (const [index, packageJson] of packageFiles.entries()) {
      const backupPath = join(backupDir, `${index}.json`)
      const mode = (await stat(packageJson)).mode & 0o777
      await copyFile(packageJson, backupPath)
      await chmod(backupPath, mode)
      backups.push({ backupPath, packageJson, mode })

      const manifest = JSON.parse(await readFile(packageJson, 'utf8')) as Record<string, unknown>
      const scripts = manifest.scripts !== null && typeof manifest.scripts === 'object'
        ? manifest.scripts as Record<string, unknown>
        : {}
      manifest.scripts = { ...scripts, install: 'node -e "process.exit(0)"' }
      await writeFile(packageJson, `${JSON.stringify(manifest, null, 2)}\n`)
    }
  } catch (error) {
    try {
      await restorePackageMetadata(backups)
    } catch {
      // Preserve the original failure; the caller reports the operation phase.
    }
    throw error
  }
  return backups
}

async function runDshDependencyScripts(
  packageFiles: string[],
  backupDir: string,
  npmBin: string,
  compilerAvailable: boolean,
): Promise<void> {
  let backups: PackageBackup[] = []
  if (compilerAvailable) {
    console.log(logMessage('INFO', 'g++ detected; running node-pty lifecycle scripts without the native compilation patch.'))
  } else {
    backups = await disableNodePtyInstallScripts(packageFiles, backupDir)
    console.log(logMessage('INFO', `Temporarily disabling lifecycle scripts for ${packageFiles.length} node-pty package(s); other DSH dependency scripts remain enabled.`))
    console.log(logMessage('INFO', 'Running DSH dependency lifecycle scripts with node-pty native compilation disabled.'))
  }

  const startedAt = Date.now()
  console.log(logMessage('INFO', 'START: npm rebuild --global --foreground-scripts'))
  const result = spawnSync(npmBin, ['rebuild', '--global', '--ignore-scripts=false', '--foreground-scripts'], {
    stdio: 'inherit',
  })
  const elapsed = Math.floor((Date.now() - startedAt) / 1000)
  if (result.error) console.error(result.error.message)
  const status = result.status ?? 1
  if (status === 0) {
    console.log(logMessage('INFO', `DONE: npm rebuild --global --foreground-scripts (${elapsed}s)`))
  } else {
    console.error(logMessage('ERROR', `FAILED: npm rebuild --global --foreground-scripts (exit=${status}, elapsed=${elapsed}s)`))
  }

  if (!compilerAvailable) {
    try {
      await restorePackageMetadata(backups)
    } catch {
      await rm(backupDir, { recursive: true, force: true })
      failNodePty('Unable to restore node-pty package metadata')
    }
  }
  await rm(backupDir, { recursive: true, force: true })
  if (status !== 0) failNodePty('Failed to run DSH dependency lifecycle scripts')
  console.log(logMessage('INFO', 'DSH dependency lifecycle scripts completed.'))
}

async function copyDirectoryContents(source: string, target: string): Promise<void> {
  await mkdir(target, { recursive: true })
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const sourcePath = join(source, entry.name)
    const targetPath = join(target, entry.name)
    if (entry.isDirectory()) {
      await copyDirectoryContents(sourcePath, targetPath)
    } else {
      await copyFile(sourcePath, targetPath)
      await chmod(targetPath, (await stat(sourcePath)).mode & 0o777)
    }
  }
}

async function installBundledNodePty(packageFiles: string[], versions: string[], nativeBundle: string): Promise<void> {
  let packageCount = 0
  const foundVersions = new Set<string>()
  for (const packageJson of packageFiles) {
    const manifest = await readJson(packageJson)
    const candidateVersion = manifest?.version
    if (typeof candidateVersion !== 'string' || candidateVersion === '') continue
    if (!versions.includes(candidateVersion)) {
      failNodePty(`Installed node-pty ${candidateVersion} is not present in the FPK dependency set`)
    }

    const bundleDir = join(nativeBundle, candidateVersion)
    try {
      await stat(join(bundleDir, 'pty.node'))
    } catch {
      failNodePty(`The FPK does not contain node-pty ${candidateVersion} native files`)
    }

    await copyDirectoryContents(bundleDir, join(dirname(packageJson), 'build', 'Release'))
    try {
      const helperPath = join(dirname(packageJson), 'build', 'Release', 'spawn-helper')
      await chmod(helperPath, (await stat(helperPath)).mode | 0o111)
    } catch {
      // The helper is optional on some node-pty builds.
    }
    packageCount += 1
    foundVersions.add(candidateVersion)
  }

  if (packageCount === 0) failNodePty('Unable to locate any node-pty package in the installed dsh dependency tree')
  for (const expectedVersion of versions) {
    if (!foundVersions.has(expectedVersion)) {
      failNodePty(`Installed dsh dependency tree is missing node-pty ${expectedVersion}`)
    }
  }
  console.log(logMessage('INFO', `Installed bundled node-pty versions: ${[...foundVersions].join(',')}.`))
}

export async function prepareNodePty(): Promise<void> {
  const nodeBin = process.env.NODE_BIN || '/var/apps/nodejs_v24/target/bin'
  const npmBin = process.env.NPM_BIN || join(nodeBin, 'npm')
  const packageManager = process.env.PACKAGE_MANAGER || 'npm'
  const packageManagerBin = process.env.PACKAGE_MANAGER_BIN || npmBin
  const dshHome = requiredEnv('DSH_HOME')
  const dshVersion = requiredEnv('DSH_VERSION')
  const dshVersionFile = requiredEnv('DSH_VERSION_FILE')
  const nativeBundle = requiredEnv('DSH_NATIVE_BUNDLE')
  const versionsFile = requiredEnv('NODE_PTY_VERSIONS_FILE')
  const packageDir = requiredEnv('DSH_PACKAGE_DIR')
  const npmGlobalRoot = requiredEnv('NPM_GLOBAL_ROOT')

  if (packageManager !== 'npm') failNodePty(`Unsupported package manager: ${packageManager}`)
  try {
    await access(packageManagerBin, constants.X_OK)
  } catch {
    failNodePty(`Package manager is not executable: ${packageManagerBin}`)
  }

  const versions = readVersionList(versionsFile)
  validateVersions(versions)
  const nativeBundleExists = await (async () => {
    try {
      return (await stat(nativeBundle)).isDirectory()
    } catch {
      return false
    }
  })()
  const hasBundledNodePty = versions.length > 0 && nativeBundleExists
  if (versions.length > 0 || nativeBundleExists) {
    if (!hasBundledNodePty) failNodePty('The FPK node-pty native bundle is incomplete')
  }

  const runDependencyScripts = process.env.DSH_RUN_DEPENDENCY_SCRIPTS === '1'
  const packageFiles = runDependencyScripts || hasBundledNodePty
    ? await uniqueNodePtyPackages([packageDir, npmGlobalRoot])
    : []
  if ((runDependencyScripts || hasBundledNodePty) && packageFiles.length === 0) {
    failNodePty(runDependencyScripts
      ? 'Unable to locate any node-pty package before running dependency scripts'
      : 'Unable to locate any node-pty package in the installed dsh dependency tree')
  }

  if (hasBundledNodePty) {
    try {
      const packagedVersion = (await readFile(dshVersionFile, 'utf8')).replace(/\s/g, '')
      if (packagedVersion !== dshVersion) {
        failNodePty(`The FPK native files target DSH ${packagedVersion || 'unknown'}, expected ${dshVersion}`)
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('[')) throw error
      failNodePty(`The FPK DSH version file is not available: ${dshVersionFile}`)
    }
    console.log(logMessage('INFO', `Preparing node-pty native files for DSH ${dshVersion}.`))
  }

  const compilerAvailable = hasCompiler()
  if (!hasBundledNodePty && !compilerAvailable) {
    failNodePty('The FPK has no bundled node-pty native files and g++ is not available on this NAS')
  }

  const backupDir = await mkdtemp(join(dshHome, '.node-pty-scripts.'))
  try {
    if (runDependencyScripts) await runDshDependencyScripts(packageFiles, backupDir, npmBin, compilerAvailable)
    else await rm(backupDir, { recursive: true, force: true })

    if (hasBundledNodePty) {
      if (!compilerAvailable || runDependencyScripts) {
        await installBundledNodePty(packageFiles, versions, nativeBundle)
      } else {
        console.log(logMessage('INFO', 'g++ detected; using the node-pty native build from the NAS environment.'))
      }
    } else {
      console.log(logMessage('INFO', 'Using the node-pty native build from the NAS environment.'))
    }
  } finally {
    await rm(backupDir, { recursive: true, force: true })
  }
  console.log(logMessage('INFO', 'node-pty preparation completed.'))
}
