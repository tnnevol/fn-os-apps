import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('dsh-fnos package contract', () => {
  it('declares a bundle and an early web client with theme ordering', async () => {
    const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
      name: string
      version: string
      dsh: { bundle: { patch: string }, client: { platform: string, immediately: boolean, inject: string[] } }
      devDependencies: { '@trimjs/web-app': string }
    }
    expect(manifest.name).toBe('@tnnevol/dsh-fnos')
    expect(manifest.version).toBe('0.1.0-rc.8.0')
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(manifest.dsh.client.platform).toBe('web')
    expect(manifest.dsh.client.immediately).toBe(true)
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-theme')
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-settings')
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-settings-plugins')
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-workspace')
    expect(manifest.dsh.client.inject).not.toContain('@deepseek-ai/dsh-client-ui-directory-picker-browse')
    expect(manifest.devDependencies['@trimjs/web-app']).toBe('latest')
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

  it('keeps the original DSH workspace flow and augments it with a shortcut', async () => {
    const source = await readFile(new URL('../src/client/index.ts', import.meta.url), 'utf8')
    const shortcut = await readFile(new URL('../src/client/workspace-authorized-shortcut.ts', import.meta.url), 'utf8')
    expect(source).toContain('installWorkspaceAuthorizedShortcut')
    expect(source).not.toContain('directoryFlow')
    expect(shortcut).toContain('requestAuthorizedDirectories')
    expect(shortcut).toContain("import Dropdown from '@douyinfe/semi-ui/lib/es/dropdown/index.js'")
    expect(shortcut).toContain("import IconButton from '@douyinfe/semi-ui/lib/es/iconButton/index.js'")
    expect(shortcut).toContain('onClick: load')
    expect(shortcut).toContain('onClick: () => { fillAfterOpening')
    expect(shortcut).toContain("import { installSemiDshTheme } from './semi-theme.ts'")

    const semiTheme = await readFile(new URL('../src/client/semi-theme.ts', import.meta.url), 'utf8')
    expect(semiTheme).toContain('data-dsh-fnos-semi-theme')
    expect(semiTheme).toContain('--semi-color-bg-3: var(--dsw-alias-bg-layer-3)')
    expect(semiTheme).toContain('--semi-color-text-0: var(--dsw-alias-label-primary)')
    expect(semiTheme).toContain('.semi-dropdown-wrapper')
    expect(semiTheme).toContain('var(--dsw-shadow-lv3)')
  })

  it('declares the DSH API version used by the client bridge', async () => {
    const compatibility = JSON.parse(await readFile(new URL('../compatibility.json', import.meta.url), 'utf8')) as {
      dshPluginApi: { version: string, packages: string[] }
    }
    expect(compatibility.dshPluginApi.version).toBe('0.1.0-rc.8')
    expect(compatibility.dshPluginApi.packages).toEqual([
      '@deepseek-ai/dsh-client-runtime',
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
