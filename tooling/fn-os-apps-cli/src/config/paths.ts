import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const scriptsSourceDirectory = dirname(fileURLToPath(import.meta.url))

/**
 * CLI 自身包的标识，用于向上定位包目录。
 *
 * 同一个文件在两种布局下深度不同：打包后是 `lib/index.mjs`（包目录的下一层），
 * 直接在源码里跑是 `src/config/paths.ts`（包目录的下两层）。按固定层级 `..`
 * 拼接只在其中一种布局成立，因此改为向上查找包标识。
 */
const cliPackageName = '@tnnevol/fn-os-apps-cli'

function findUpward(
  startDirectory: string,
  predicate: (directory: string) => boolean,
): string | undefined {
  let directory = startDirectory
  for (;;) {
    if (predicate(directory)) return directory
    const parent = dirname(directory)
    if (parent === directory) return undefined
    directory = parent
  }
}

function hasPackageName(directory: string, name: string): boolean {
  const file = resolve(directory, 'package.json')
  if (!existsSync(file)) return false
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
    if (typeof parsed !== 'object' || parsed === null) return false
    return (parsed as { name?: unknown }).name === name
  } catch {
    return false
  }
}

/** CLI 包目录，`changelogithub` 等命令的 cwd。 */
export const scriptsPackageDirectory
  = findUpward(scriptsSourceDirectory, directory => hasPackageName(directory, cliPackageName))
    ?? resolve(scriptsSourceDirectory, '..')

/** 仓库根目录，按 workspace 标记文件向上定位。 */
export const repositoryRoot
  = findUpward(
    scriptsPackageDirectory,
    directory =>
      existsSync(resolve(directory, 'apps'))
      && existsSync(resolve(directory, 'pnpm-workspace.yaml')),
  ) ?? resolve(scriptsPackageDirectory, '..', '..')

/**
 * 版本升级需要同步的文件。
 *
 * `fnpack.json` 是 FnDepot 外部源索引，里面的 `download_url` 带 `v<项目版本>`
 * 的 release tag，必须跟着版本一起改；列入这里是为了让 bumpp 把它算进本次
 * release 提交，而不是留成工作区里的未提交改动。
 */
export const projectVersionFiles = [
  'package.json',
  'docs/package.json',
  'apps/**/manifest',
  'docs/development/manifest.md',
  'fnpack.json',
]
