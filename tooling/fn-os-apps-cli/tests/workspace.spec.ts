/* eslint-disable no-template-curly-in-string -- 被测值就是 `${section.key}` 形式的占位符字面量 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readFpkApps, resolveManifestText } from '../src/config/workspace.js'

const temporaryDirectories: string[] = []

function createI18nDirectory(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'fn-apps-workspace-'))
  temporaryDirectories.push(root)
  const i18nDirectory = join(root, 'i18n')
  mkdirSync(i18nDirectory)
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(i18nDirectory, name), content)
  }
  return i18nDirectory
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('resolveManifestText', () => {
  it('resolves a placeholder from the Chinese locale first', () => {
    const i18nDirectory = createI18nDirectory({
      'zh-CN': '[common]\ndisplayName="笔记"\n',
      'en-US': '[common]\ndisplayName="Notes"\n',
    })

    expect(resolveManifestText('${common.displayName}', i18nDirectory)).toBe('笔记')
  })

  it('falls back to another locale when the preferred one lacks the key', () => {
    const i18nDirectory = createI18nDirectory({
      'zh-CN': '[common]\ndesc="说明"\n',
      'en-US': '[common]\ndisplayName="Notes"\n',
    })

    expect(resolveManifestText('${common.displayName}', i18nDirectory)).toBe('Notes')
  })

  it('returns plain text and strips the surrounding quotes', () => {
    const i18nDirectory = createI18nDirectory({})

    expect(resolveManifestText('"Memos"', i18nDirectory)).toBe('Memos')
    expect(resolveManifestText('  Emby Server  ', i18nDirectory)).toBe('Emby Server')
  })

  it('returns undefined when the placeholder cannot be resolved', () => {
    const i18nDirectory = createI18nDirectory({})

    expect(resolveManifestText('${common.displayName}', i18nDirectory)).toBeUndefined()
    expect(resolveManifestText('   ', i18nDirectory)).toBeUndefined()
    expect(resolveManifestText(undefined, i18nDirectory)).toBeUndefined()
  })
})

describe('readFpkApps', () => {
  it('renders localized display names instead of raw placeholders', () => {
    const memos = readFpkApps().find(app => app.name === 'fn-memos')

    expect(memos).toBeDefined()
    expect(memos?.label).toBe('Memos')
  })
})
