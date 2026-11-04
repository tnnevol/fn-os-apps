import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { repositoryRoot } from './paths.js'

export type FpkApp = {
  /** 应用目录名，例如 fn-memos。 */
  name: string
  /** 展示名称，优先读取 manifest 的 display_name，占位符按 i18n 语言文件还原。 */
  label: string
  /** manifest 版本号，用于校验与项目版本的一致性。 */
  version?: string
}

const placeholderPattern = /^\$\{([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\}$/

/**
 * i18n 语言文件的取值顺序。
 *
 * 命令行是中文界面，优先取中文译文；`en-US` 是打包工具强制要求的基准语言，放在
 * 中文之后兜底。两者都不存在时按文件名排序取第一个可用语言。
 */
const localePriority = ['zh-CN', 'en-US', 'en']

function stripQuotes(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '')
}

/** 把 INI 语言文件解析成 `section.key` → 文本的映射。 */
function parseLocaleFile(filePath: string): Map<string, string> {
  const values = new Map<string, string>()
  let text: string
  try {
    text = readFileSync(filePath, 'utf8')
  } catch {
    return values
  }
  let section: string | undefined
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#') || trimmed.startsWith(';')) continue
    const header = /^\[(.+)\]$/.exec(trimmed)
    if (header !== null) {
      section = header[1]
      continue
    }
    const separator = trimmed.indexOf('=')
    if (section === undefined || separator <= 0) continue
    const key = trimmed.slice(0, separator).trim()
    const value = stripQuotes(trimmed.slice(separator + 1))
    values.set(`${section}.${key}`, value)
  }
  return values
}

/** 按优先级合并 i18n 目录下所有语言文件，先出现的语言优先。 */
function readLocaleValues(i18nDirectory: string): Map<string, string> {
  const values = new Map<string, string>()
  let fileNames: string[]
  try {
    fileNames = readdirSync(i18nDirectory, { withFileTypes: true })
      .filter(entry => entry.isFile())
      .map(entry => entry.name)
  } catch {
    return values
  }
  const ordered = [
    ...localePriority.filter(name => fileNames.includes(name)),
    ...fileNames.filter(name => !localePriority.includes(name)).sort(),
  ]
  for (const name of ordered) {
    for (const [key, value] of parseLocaleFile(join(i18nDirectory, name))) {
      if (!values.has(key)) values.set(key, value)
    }
  }
  return values
}

/**
 * 还原 manifest 里被国际化成 `${section.key}` 的文本。
 *
 * 面板文案改成占位符后 manifest 不再直接包含可展示的名称，构建选择项如果照抄
 * 就会回显 `${common.displayName}`。这里按 i18n 语言文件把占位符还原成实际文本；
 * 还原不出来的返回 `undefined`，由调用方回退到应用目录名。
 */
export function resolveManifestText(
  rawValue: string | undefined,
  i18nDirectory: string,
): string | undefined {
  if (rawValue === undefined) return undefined
  const value = stripQuotes(rawValue)
  if (value === '') return undefined
  const placeholder = placeholderPattern.exec(value)
  if (placeholder === null) return value
  const [, section, key] = placeholder
  if (section === undefined || key === undefined) return undefined
  return readLocaleValues(i18nDirectory).get(`${section}.${key}`)
}

function readFpkApp(directoryName: string): FpkApp | undefined {
  const appDirectory = join(repositoryRoot, 'apps', directoryName)
  const manifestPath = join(appDirectory, 'manifest')
  if (!existsSync(manifestPath)) return undefined
  let manifestText: string
  try {
    manifestText = readFileSync(manifestPath, 'utf8')
  } catch {
    return undefined
  }
  const version = manifestText.match(/^version\s*=\s*(.+)$/m)?.[1]?.trim()
  const displayName = resolveManifestText(
    manifestText.match(/^display_name\s*=\s*(.+)$/m)?.[1],
    join(appDirectory, 'i18n'),
  )
  return {
    name: directoryName,
    label: displayName ?? directoryName,
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
