import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { repositoryRoot } from './paths.js'

export type FpkApp = {
  /** 应用目录名，例如 fn-memos。 */
  name: string
  /** 展示名称，优先读取 manifest 的 display_name。 */
  label: string
  /** manifest 版本号，用于校验与项目版本的一致性。 */
  version?: string
}

function readFpkApp(directoryName: string): FpkApp | undefined {
  const manifestPath = join(repositoryRoot, 'apps', directoryName, 'manifest')
  if (!existsSync(manifestPath)) return undefined
  let manifestText: string
  try {
    manifestText = readFileSync(manifestPath, 'utf8')
  } catch {
    return undefined
  }
  const version = manifestText.match(/^version\s*=\s*(.+)$/m)?.[1]?.trim()
  const displayName = manifestText
    .match(/^display_name\s*=\s*(.+)$/m)?.[1]
    ?.trim()
    ?.replace(/^["']|["']$/g, '')
  return {
    name: directoryName,
    label: displayName || directoryName,
    ...(version === undefined ? {} : { version }),
  }
}

export function readFpkApps(): FpkApp[] {
  let entries
  try {
    entries = readdirSync(join(repositoryRoot, 'apps'), { withFileTypes: true })
  } catch {
    return []
  }
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => readFpkApp(entry.name))
    .filter((app): app is FpkApp => app !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name))
}
