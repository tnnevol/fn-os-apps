import { describe, expect, it } from 'vitest'
import {
  createFnosInputReference,
  decodeFnosReference,
  fileUrlForPath,
  fnosReferenceDisplayText,
  fnosReferencePromptText,
  normalizeFnosPath,
  uniqueFnosInputReferences,
} from '../src/client/input-references.ts'

describe('fnOS DSH input references', () => {
  it('normalizes paths and serializes spaces without leaking raw path syntax', () => {
    expect(normalizeFnosPath(' /vol4/My Folder/// ')).toBe('/vol4/My Folder')
    expect(fileUrlForPath('/vol4/My Folder/report #1.md')).toBe('file:///vol4/My%20Folder/report%20%231.md')
    expect(fileUrlForPath('/')).toBe('file:///')
  })

  it('round-trips the kind and internal path through the reference id', () => {
    const reference = createFnosInputReference('directory', '/vol4/My Folder', '存储空间4/My Folder')
    expect(reference).toMatchObject({
      kind: 'directory',
      path: '/vol4/My Folder',
      semanticPath: '存储空间4/My Folder',
      clipboardText: 'file:///vol4/My%20Folder',
    })
    expect(decodeFnosReference(reference!.ref)).toEqual({ kind: 'directory', path: '/vol4/My Folder' })
  })

  it('deduplicates the same selected path while retaining first-seen order', () => {
    const first = createFnosInputReference('file', '/vol4/a', 'A')
    const second = createFnosInputReference('file', '/vol4/a/', 'A again')
    const third = createFnosInputReference('directory', '/vol4/b', 'B')
    expect(uniqueFnosInputReferences([first, second, undefined, third])).toEqual([first, third])
  })

  it('projects structured references as official echo tokens', () => {
    const file = createFnosInputReference('file', '/vol1/1000/Downloads/trim-cli-skillv2.zip', 'codex-auth-plugin/analysis-codex-readonly-model-input.md')!
    const folder = createFnosInputReference('directory', '/vol1/1000/Downloads', 'codex-auth-plugin')!
    expect(fnosReferenceDisplayText(file)).toBe('@codex-auth-plugin/analysis-codex-readonly-model-input.md')
    expect(fnosReferenceDisplayText(folder)).toBe('@codex-auth-plugin/')
    expect(fnosReferencePromptText(file.ref)).toBe('@/vol1/1000/Downloads/trim-cli-skillv2.zip')
    expect(fnosReferencePromptText(folder.ref)).toBe('@/vol1/1000/Downloads/')
  })

  it('keeps the clipboard path projection as a file URL', () => {
    const folder = createFnosInputReference('directory', '/vol6/1000/Documents', '/vol6/1000/Documents')!
    expect(folder.clipboardText).toBe('file:///vol6/1000/Documents')
    expect(decodeFnosReference(folder.ref)).toEqual({ kind: 'directory', path: '/vol6/1000/Documents' })
  })
})
