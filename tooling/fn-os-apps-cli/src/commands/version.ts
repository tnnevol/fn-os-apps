import { type OptionValues } from 'commander'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { versionBump } from 'bumpp'
import { program } from '../program.js'
import { addBooleanArgs, addNegatedArgs } from '../core/command-args.js'
import { projectVersionFiles, repositoryRoot } from '../config/paths.js'
import { parseVersionOptions } from '../core/args.js'
import { readPackageInfo } from '../core/package.js'

/**
 * 项目版本需要同步的文本文件。
 *
 * `bumpp` 只按 `version = x.y.z` 这种字面量改文件，因此这里列出文档里
 * 确实带该写法的文件；应用 manifest 由 {@link projectVersionFiles} 的
 * glob 交给 bumpp 处理。
 */
const projectVersionTextFiles = [
  'docs/development/manifest.md',
]

/** Workspace 包需要跟随根版本，但它们不在 {@link projectVersionFiles} 的 glob 里。 */
const projectVersionPackageFiles = [
  'docs/package.json',
]

type JsonObject = Record<string, unknown>

async function readJson(relativePath: string): Promise<JsonObject> {
  const value: unknown = JSON.parse(await readFile(join(repositoryRoot, relativePath), 'utf8'))
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${relativePath} must contain a JSON object`)
  }
  return value as JsonObject
}

async function updatePackageVersion(relativePath: string, version: string): Promise<void> {
  const value = await readJson(relativePath)
  value.version = version
  await writeFile(join(repositoryRoot, relativePath), `${JSON.stringify(value, null, 2)}\n`)
}

async function alignProjectVersionTextFiles(version: string): Promise<void> {
  for (const relativePath of projectVersionTextFiles) {
    const absolutePath = join(repositoryRoot, relativePath)
    const content = await readFile(absolutePath, 'utf8')
    const updated = content.replace(/^(\s*version\s*=\s*)\S+$/gm, `$1${version}`)
    if (updated !== content) await writeFile(absolutePath, updated)
  }
}

async function alignProjectVersionPackageFiles(version: string): Promise<void> {
  for (const relativePath of projectVersionPackageFiles) {
    const packageInfo = await readJson(relativePath)
    if (packageInfo.version !== version) await updatePackageVersion(relativePath, version)
  }
}

async function versionProject(options: ReturnType<typeof parseVersionOptions>): Promise<void> {
  const current = await readPackageInfo('package.json')

  // 先把手写的版本文本与 workspace 包对齐到当前版本，再交给 bumpp 统一递增：
  // bumpp 会跳过版本号与根不一致的文本文件，不对齐就会漏改。
  await alignProjectVersionPackageFiles(current.version)
  await alignProjectVersionTextFiles(current.version)

  const result = await versionBump({
    cwd: repositoryRoot,
    files: projectVersionFiles,
    currentVersion: current.version,
    release: options.release,
    commit: options.noCommit ? false : 'chore: release v%s',
    tag: options.noTag ? false : 'v%s',
    push: false,
    ignoreScripts: true,
    confirm: options.confirm,
    // bumpp 的顺序是「改版本 → execute → commit → tag」，索引必须放在这里重生成，
    // 才能和其他版本文件一起进同一个 release 提交。放在 versionBump 之后会变成
    // 提交之外的游离改动，Tag 也会漏掉它。
    execute: async () => {
      await regenerateFnDepotIndex()
    },
  })
  console.log(`${current.name}: ${result.currentVersion} -> ${result.newVersion}`)
}

/**
 * 重生成 FnDepot 源索引，使它带上本次版本的 release tag。
 *
 * 索引里的 `download_url` 带 `v<项目版本>` 的 release tag，版本递增后旧 URL
 * 会指向上一版的资产包——不同步就会让客户端装到过期的 FPK。
 *
 * 失败时直接抛出：这里已经是 release 提交的组装阶段，索引没更新就提交等于
 * 发布一个指向旧包的源，宁可中止本次 version 让调用方重试。
 */
async function regenerateFnDepotIndex(): Promise<void> {
  const script = join(repositoryRoot, 'scripts', 'generate-fnpack-json.mjs')
  if (!existsSync(script)) return
  await new Promise<void>((resolve, reject) => {
    execFile(process.execPath, [script], { cwd: repositoryRoot }, (error) => {
      if (error === null) resolve()
      else reject(error)
    })
  })
  console.log('已同步 fnpack.json（download_url 指向新的 release tag）')
}

export async function runVersion(args: string[]): Promise<void> {
  await versionProject(parseVersionOptions(args))
}

program
  .command('version [release]')
  .description('Version the project/FPK area')
  .option('--no-commit', 'only update version files')
  .option('--no-tag', 'do not create a version tag')
  .option('--no-push', 'do not push tags')
  .option('--yes', 'skip the version confirmation')
  .action(async (release: string | undefined, options: OptionValues) => {
    const args: string[] = []
    if (release !== undefined && !release.startsWith('-')) args.push(release)
    addNegatedArgs(args, options, [
      ['commit', '--no-commit'],
      ['tag', '--no-tag'],
      ['push', '--no-push'],
    ])
    addBooleanArgs(args, options, ['yes'])
    await runVersion(args)
  })
