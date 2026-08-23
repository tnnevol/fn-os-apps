import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('dsh-fnos package contract', () => {
  it('declares a bundle and an early web client with theme ordering', async () => {
    const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
      name: string
      version: string
      dsh: { bundle: { patch: string }, client: { platform: string, immediately: boolean, inject: string[] } }
      devDependencies: { '@trimjs/web-app': string, '@tnnevol/dsh-semi-ui': string }
    }
    expect(manifest.name).toBe('@tnnevol/dsh-fnos')
    expect(manifest.version).toBe('0.1.1-rc.2.0')
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(manifest.dsh.client.platform).toBe('web')
    expect(manifest.dsh.client.immediately).toBe(true)
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-theme')
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-settings')
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-settings-plugins')
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-workspace')
    expect(manifest.dsh.client.inject).not.toContain('@deepseek-ai/dsh-client-ui-directory-picker-browse')
    expect(manifest.devDependencies['@trimjs/web-app']).toBe('latest')
    expect(manifest.devDependencies['@tnnevol/dsh-semi-ui']).toBe('workspace:*')
  })

  it('only registers itself and does not patch the official directory picker', async () => {
    const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
    expect(patch).toContain('id: dsh-fnos')
    expect(patch).toContain("name: '@tnnevol/dsh-fnos'")
    expect(patch).not.toContain('directory-picker')
    expect(patch).not.toContain('@deepseek-ai/dsh-host-directory-picker-browse')
  })

  it('keeps the fnOS settings card after the built-in keyed cards', async () => {
    const source = await readFile(new URL('../src/client/index.ts', import.meta.url), 'utf8')
    expect(source).toMatch(/key:\s*'dsh-fnos-authorized-directories'[\s\S]{0,160}priority:\s*100/u)
  })

  it('keeps the cancel-authorization label stable while adding a directory', async () => {
    const source = await readFile(new URL('../src/client/AuthorizedDirectoriesCard.tsx', import.meta.url), 'utf8')
    expect(source).toContain("{t('delete')}")
    expect(source).not.toContain("{busy ? t('deleting') : t('delete')}")
  })

  it('adapts opening the DSH settings document to fnOS', async () => {
    const host = await readFile(new URL('../src/authorized-directories.ts', import.meta.url), 'utf8')
    const action = await readFile(new URL('../src/client/FnosSettingsDocumentAction.tsx', import.meta.url), 'utf8')
    const contract = await readFile(new URL('../src/settings-document-contract.ts', import.meta.url), 'utf8')
    const index = await readFile(new URL('../src/client/index.ts', import.meta.url), 'utf8')
    expect(host).toContain('ctx.settings.prepareDocument()')
    expect(host).toContain('FNOS_SETTINGS_DOCUMENT_PATH')
    expect(action).toContain('requestSettingsDocumentPath')
    expect(action).toContain('sdk.openFile(path)')
    expect(action).toContain('DshIconSetting as IconSetting')
    expect(action).toContain('<IconSetting />')
    expect(action).toContain("borderRadius: '32px'")
    expect(action).toContain("marginRight: '6px'")
    expect(index).toContain("id: 'open-document'")
    expect(index).toContain('priority: -1')
    expect(index).toContain('FnosSettingsDocumentAction')
    expect(contract).toContain("'/plugins/dsh-fnos/settings/document'")
  })

  it('replaces the fnOS Session log utility with a computer/NAS dropdown', async () => {
    const index = await readFile(new URL('../src/client/index.ts', import.meta.url), 'utf8')
    const action = await readFile(new URL('../src/client/FnosSessionLogHeaderAction.tsx', import.meta.url), 'utf8')
    const host = await readFile(new URL('../src/authorized-directories.ts', import.meta.url), 'utf8')
    const contract = await readFile(new URL('../src/session-log-export-contract.ts', import.meta.url), 'utf8')
    expect(index).toContain("id: 'session-log-download'")
    expect(index).toContain('FnosSessionLogHeaderAction')
    expect(action).toContain('DshDropdown')
    expect(action).toContain('DshTree')
    expect(action).not.toContain('treeCheckable')
    expect(host).toContain('ctx.get(\'apiProxy\')')
    expect(host).toContain('includeDescendants: true')
    expect(contract).toContain("'/plugins/dsh-fnos/session-log/export'")
  })

  it('keeps the original DSH workspace flow and augments it with a shortcut', async () => {
    const source = await readFile(new URL('../src/client/index.ts', import.meta.url), 'utf8')
    const shortcut = await readFile(new URL('../src/client/workspace-authorized-shortcut.ts', import.meta.url), 'utf8')
    expect(source).toContain('installWorkspaceAuthorizedShortcut')
    expect(source).not.toContain('directoryFlow')
    expect(shortcut).toContain('requestAuthorizedDirectories')
    expect(shortcut).toContain('DshDropdown as Dropdown')
    expect(shortcut).toContain('DshIconButton as IconButton')
    expect(shortcut).toContain('onClick: load')
    expect(shortcut).toContain('onClick: () => { fillAfterOpening')
    expect(shortcut).not.toContain('installSemiDshTheme')

    const client = await readFile(new URL('../src/client/index.ts', import.meta.url), 'utf8')
    expect(client).toContain("from '@tnnevol/dsh-semi-ui'")
    expect(client).toContain("installSemiDshTheme(), 'dsh-fnos: Semi DSH theme'")


    const semiTheme = await readFile(new URL('../../../packages/dsh-semi-ui/src/theme.ts', import.meta.url), 'utf8')
    expect(semiTheme).toContain('data-dsh-semi-theme')
    expect(semiTheme).toContain('--semi-color-bg-3: var(--dsw-alias-bg-layer-3)')
    expect(semiTheme).toContain('--semi-color-text-0: var(--dsw-alias-label-primary)')
    expect(semiTheme).toContain('.semi-dropdown-wrapper')
    expect(semiTheme).toContain('.semi-tooltip-wrapper')
    expect(semiTheme).toContain('background-color: var(--dsw-alias-bg-layer-3, #2a2a2a)')
    expect(semiTheme).toContain('color: var(--dsw-alias-label-primary, #fff)')
    expect(semiTheme).toContain('pointer-events: none')
    expect(semiTheme).toContain('overflow-x: auto')
     expect(semiTheme).toContain('semi-tree-option-list')
     expect(semiTheme).toContain('width: 100% !important')
    expect(semiTheme).toContain('semi-checkbox-unChecked:hover')
     expect(semiTheme).not.toContain('data-dsh-fnos-link')

     expect(semiTheme).not.toContain('data-dsh-fnos-input-references')
     expect(semiTheme).toContain('background: #111 !important')
    expect(semiTheme).toContain('color: #fff !important')
    expect(semiTheme).toContain('var(--dsw-shadow-lv3)')
  })

  it('keeps fnOS file and folder references in the native input draft', async () => {
    const actions = await readFile(new URL('../src/client/input-reference-actions.ts', import.meta.url), 'utf8')
    expect(actions).toContain("appearance: reference.kind === 'directory' ? 'folder' : 'file'")
    expect(actions).toContain('referenceLabel')
    expect(actions).toContain('restoreFnosInputCaret')
    expect(actions).toContain('draft += `@${label} `')
    expect(actions).toContain("slash/input-insert-reference")
    expect(actions).toContain("appearance: reference.kind === 'directory' ? 'folder' : 'file'")
    expect(actions).not.toContain('\\u00a0')
    const picker = await readFile(new URL('../src/client/FnosAuthorizedPathPicker.tsx', import.meta.url), 'utf8')
    expect(picker).toContain('const value = desiredPaths ?? EMPTY_TREE_VALUE')
    expect(picker).toContain('insertedTreePaths.current.clear()')
    expect(picker).toContain('return paths')
  })

  it('declares the DSH API version used by the client bridge', async () => {
    const compatibility = JSON.parse(await readFile(new URL('../compatibility.json', import.meta.url), 'utf8')) as {
      dshPluginApi: { version: string, packages: string[] }
    }
    expect(compatibility.dshPluginApi.version).toBe('0.1.1-rc.2')
    expect(compatibility.dshPluginApi.packages).toEqual([
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-session-log-export',
      '@deepseek-ai/dsh-client-ui-theme',
      '@deepseek-ai/dsh-client-ui-settings',
      '@deepseek-ai/dsh-client-locale',
      '@deepseek-ai/dsh-client-ui-conversation',
      '@deepseek-ai/dsh-client-ui-input-trigger',
      '@deepseek-ai/dsh-client-ui-primitives',
      '@deepseek-ai/dsh-client-ui-workspace',
      '@deepseek-ai/dsh-client-ui-settings-plugins',
      '@deepseek-ai/dsh-client-ui-slots',
      '@deepseek-ai/dsh-host-webserver',
      '@deepseek-ai/dsh-settings',
      '@deepseek-ai/schemastery',
    ])
  })
})
