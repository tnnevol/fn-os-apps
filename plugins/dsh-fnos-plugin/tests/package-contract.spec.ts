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
    expect(manifest.version).toBe('0.1.1-rc.2')
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(manifest.dsh.client.platform).toBe('web')
    expect(manifest.dsh.client.immediately).toBe(true)
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-theme')
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-settings')
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-settings-plugins')
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-workspace')
    expect(manifest.dsh.client.inject).not.toContain('@deepseek-ai/dsh-client-ui-directory-picker-browse')
    expect(manifest.devDependencies['@trimjs/web-app']).toBe('catalog:')
    expect(manifest.devDependencies['@tnnevol/dsh-semi-ui']).toBe('workspace:*')
  })

  it('does not block fnOS routes on the optional ApiProxy service', async () => {
    const source = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8')
    expect(source).toMatch(/export const inject = \['webServer', 'settings'\]/u)
    expect(source).not.toMatch(/export const inject = \['webServer', 'settings', 'apiProxy'\]/u)
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
    expect(source).toContain("ctx.slots.inject('sidebar.footer.action'")
    expect(source).toContain("id: 'dsh-fnos-web-restart'")
    expect(source).toContain('installFnosBrowserRefreshShortcut')
    const restart = await readFile(new URL('../src/client/FnosWebRestartAction.tsx', import.meta.url), 'utf8')
    expect(restart).toContain('DshButtonGroup')
    expect(restart).toContain('DshIconRefresh2')
    expect(restart).toContain('DshIconSync')
    expect(restart).toContain('spin={busy}')
    expect(restart).toContain('window.location.reload()')
    expect(restart).toContain("aria-label={refreshLabel}")
    expect(restart).toContain('/__fnos-gateway/control/web/restart')
    expect(restart).toContain('isEmbeddedFnosFrame')
    expect(restart).toContain('dsh-fnos-web-refresh')
    const refreshShortcut = await readFile(new URL('../src/client/browser-refresh-shortcut.ts', import.meta.url), 'utf8')
    expect(refreshShortcut).toContain("event.key === 'F5'")
    expect(refreshShortcut).toContain("event.key.toLowerCase() === 'r'")
    expect(refreshShortcut).toContain('event.preventDefault()')
    expect(refreshShortcut).toContain('window.location.reload()')
  })

  it('keeps the cancel-authorization label stable while adding a directory', async () => {
    const source = await readFile(new URL('../src/client/AuthorizedDirectoriesCard.tsx', import.meta.url), 'utf8')
    expect(source).toContain("{t('delete')}")
    expect(source).not.toContain("{busy ? t('deleting') : t('delete')}")
  })

  it('adapts opening the DSH settings document to fnOS', async () => {
    const host = await readFile(new URL('../src/authorized-directories.ts', import.meta.url), 'utf8')
    const action = await readFile(new URL('../src/client/FnosSettingsDocumentAction.tsx', import.meta.url), 'utf8')
    const style = await readFile(new URL('../src/client/style.scss', import.meta.url), 'utf8')
    const contract = await readFile(new URL('../src/settings-document-contract.ts', import.meta.url), 'utf8')
    const index = await readFile(new URL('../src/client/index.ts', import.meta.url), 'utf8')
    expect(host).toContain('ctx.settings.prepareDocument()')
    expect(host).toContain('FNOS_SETTINGS_DOCUMENT_PATH')
    expect(action).toContain('requestSettingsDocumentPath')
    expect(action).toContain('sdk.openFile(path)')
    expect(action).toContain('DshIconSetting as IconSetting')
    expect(action).toContain('<IconSetting />')
    expect(style).toContain('.dsh-fnos-settings-document-button')
    expect(style).toContain('margin-right: 6px')
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
    const style = await readFile(new URL('../src/client/style.scss', import.meta.url), 'utf8')
    const theme = await readFile(new URL('../../../packages/dsh-semi-ui/src/theme.scss', import.meta.url), 'utf8')
    expect(index).toContain("id: 'session-log-download'")
    expect(index).toContain('FnosSessionLogHeaderAction')
    expect(action).toContain('DshDropdown')
    expect(action).toContain('DshIconChangelog as IconChangelog')
    expect(action).toContain('<IconChangelog />')
    expect(style).toContain('.dsh-fnos-session-log-button')
    expect(style).toContain('margin-right: 6px')
    expect(action).toContain("type: 'primary'")
    expect(action).toContain('nasExportEnabled')
    expect(theme).toContain('.semi-button.semi-button-solid:not(.semi-button-disabled)')
    expect(theme).toContain(':not([data-ds-dark-theme]) .semi-button.semi-button-solid:not(.semi-button-disabled)')
    expect(theme).toContain('body[data-dsh-semi-theme][data-ds-dark-theme] .semi-button.semi-button-solid:not(.semi-button-disabled)')
    expect(action).toContain('DshTree')
    expect(action).toContain('useSessionLogDownload')
    expect(action).toContain('sessionLogDialogPreparingTitle')
    expect(action).toContain('dismissDownload(sessionId)')
    expect(action).not.toContain('treeCheckable')
    expect(host).toContain('ctx.get(\'apiProxy\')')
    expect(host).toContain('includeDescendants: true')
    expect(contract).toContain("'/plugins/dsh-fnos/session-log/export'")
  })

  it('keeps the original DSH workspace flow and augments it with a shortcut', async () => {
    const source = await readFile(new URL('../src/client/index.ts', import.meta.url), 'utf8')
    const shortcut = await readFile(new URL('../src/client/workspace-authorized-shortcut.ts', import.meta.url), 'utf8')
    const picker = await readFile(new URL('../src/client/FnosAuthorizedPathPicker.tsx', import.meta.url), 'utf8')
    const restart = await readFile(new URL('../src/client/FnosWebRestartAction.tsx', import.meta.url), 'utf8')
    const clientStyle = await readFile(new URL('../src/client/style.scss', import.meta.url), 'utf8')
    expect(source).toContain('installWorkspaceAuthorizedShortcut')
    expect(source).not.toContain('directoryFlow')
    expect(shortcut).toContain('requestAuthorizedDirectories')
    expect(shortcut).toContain('DshDropdown as Dropdown')
    expect(shortcut).toContain('DshIconButton as IconButton')
    expect(shortcut).toContain('onClick: load')
    expect(shortcut).toContain('onClick: () => { fillAfterOpening')
    expect(shortcut).not.toContain('new KeyboardEvent')
    expect(shortcut).not.toContain('installSemiDshTheme')

    const client = await readFile(new URL('../src/client/index.ts', import.meta.url), 'utf8')
    expect(client).toContain("from '@tnnevol/dsh-semi-ui'")
    expect(client).toContain("installSemiDshTheme(), 'dsh-fnos: Semi DSH theme'")


    const themeRuntime = await readFile(new URL('../../../packages/dsh-semi-ui/src/theme.ts', import.meta.url), 'utf8')
    const semiTheme = await readFile(new URL('../../../packages/dsh-semi-ui/src/theme.scss', import.meta.url), 'utf8')
    expect(semiTheme).toContain('data-dsh-semi-theme')
    expect(themeRuntime).toContain("const SEMI_THEME_MODE_ATTRIBUTE = 'theme-mode'")
    expect(themeRuntime).toContain('data-ds-dark-theme')
    expect(themeRuntime).toContain("setAttribute(SEMI_THEME_MODE_ATTRIBUTE, document.body.hasAttribute(DSH_DARK_THEME_ATTRIBUTE) ? 'dark' : 'light')")
    expect(themeRuntime).toContain('MutationObserver')
    expect(semiTheme).toContain('--semi-color-bg-3: var(--dsw-alias-bg-layer-3)')
    expect(semiTheme).toContain('--semi-color-text-0: var(--dsw-alias-label-primary)')
    expect(semiTheme).toContain('.semi-dropdown-wrapper')
    expect(semiTheme).toContain('.semi-tooltip-wrapper')
    expect(semiTheme).toContain('background-color: var(--dsw-alias-tooltip-bg)')
    expect(semiTheme).toContain('color: var(--dsw-static-neutral-bluish-00)')
    expect(semiTheme).toContain('pointer-events: none')
    expect(clientStyle).toContain('.dsh-fnos-authorized-path-picker {')
    expect(clientStyle).toContain('.semi-tree-option-list {')
    expect(clientStyle).toContain('overflow-x: auto')
    expect(clientStyle).toContain('width: 100% !important')
    expect(semiTheme).toContain('semi-checkbox-unChecked:hover')
    expect(semiTheme).toContain('.semi-checkbox:not(.semi-checkbox-checked):not(.semi-checkbox-indeterminate):hover')
    expect(semiTheme).toContain('.semi-tree-option-disabled .semi-tree-option-label')
    expect(semiTheme).not.toContain('data-dsh-fnos-link')

    expect(semiTheme).not.toContain('data-dsh-fnos-input-references')
    expect(picker).toContain('borderless')
    expect(picker).toContain('checkRelation="related"')
    expect(picker).not.toContain('new KeyboardEvent')
    expect(semiTheme).toContain('.dsh-fnos-input-picker-trigger')
    expect(semiTheme).toContain('border: none;')
    expect(semiTheme).toContain('background: var(--dsw-static-neutral-bluish-00);')
    expect(semiTheme).toContain('border-color: var(--dsw-static-neutral-bluish-1000);')
    expect(semiTheme).toContain('color: var(--dsw-static-neutral-bluish-1000);')
    expect(semiTheme).toContain('background: var(--dsw-static-neutral-bluish-1000);')
    expect(semiTheme).toContain('border-color: var(--dsw-static-neutral-bluish-00);')
    expect(semiTheme).toContain('color: var(--dsw-static-neutral-bluish-00);')
    expect(semiTheme).toContain(':not([data-ds-dark-theme]) .semi-button.semi-button-primary.semi-button-solid:not(.semi-button-disabled)')
    expect(semiTheme).toContain('background-color: var(--dsw-static-neutral-bluish-1000);')
    expect(semiTheme).toContain('color: var(--dsw-static-neutral-bluish-00);')
    expect(semiTheme).toContain('body[data-dsh-semi-theme][data-ds-dark-theme] .semi-button.semi-button-primary.semi-button-solid:not(.semi-button-disabled)')
    expect(semiTheme).toContain('.semi-button.dsh-fnos-web-refresh:not(.semi-button-borderless):not(.semi-button-disabled)')
    expect(semiTheme).not.toContain('height: 42px')
    expect(semiTheme).not.toContain('font-size: 14px')
    expect(restart).toContain('size="small"')
    expect(semiTheme).toContain('background: transparent;')
    expect(semiTheme).toContain('var(--dsw-alias-interactive-bg-hover);')
    expect(semiTheme).toContain('--semi-border-radius-full: 9999px;')
    expect(semiTheme).toContain('font-weight: 400;')
    expect(restart).toContain('className="dsh-fnos-web-actions"')
    expect(restart).toContain('dsh-fnos-web-actions--collapsed')
    expect(restart).toContain('theme="borderless"')
    expect(semiTheme).not.toContain('!important')
    expect(semiTheme).toContain('var(--dsw-shadow-lv3)')
    expect(semiTheme).toContain('.dsh-fnos-web-actions--collapsed')
    expect(semiTheme).toContain('justify-content: center;')
  })

  it('keeps fnOS file and folder references in the native input draft', async () => {
    const actions = await readFile(new URL('../src/client/input-reference-actions.ts', import.meta.url), 'utf8')
    expect(actions).toContain("appearance: reference.kind === 'directory' ? 'folder' : 'file'")
    expect(actions).toContain('referenceLabel')
    expect(actions).toContain('restoreFnosInputCaret')
    expect(actions).toContain('fnosReferenceDraftText')
    expect(actions).toContain("return `\\uFFFC${label}`")
    expect(actions).toContain("slash/input-insert-reference")
    expect(actions).toContain("appearance: reference.kind === 'directory' ? 'folder' : 'file'")
    expect(actions).not.toContain('\\u00a0')
    const picker = await readFile(new URL('../src/client/FnosAuthorizedPathPicker.tsx', import.meta.url), 'utf8')
    expect(picker).toContain('const value = desiredPaths ?? EMPTY_TREE_VALUE')
    const pickerStyle = await readFile(new URL('../src/client/style.scss', import.meta.url), 'utf8')
    expect(pickerStyle).toContain('max-width: min(560px, calc(100vw - 32px))')
    expect(pickerStyle).toContain('overflow-x: auto')
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
      '@deepseek-ai/dsh-client-ui-sidebar',
      '@deepseek-ai/dsh-client-ui-slots',
      '@deepseek-ai/dsh-host-webserver',
      '@deepseek-ai/dsh-settings',
      '@deepseek-ai/schemastery',
    ])
  })
})
