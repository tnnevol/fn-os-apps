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
    expect(manifest.version).toBe('0.1.0-rc.7')
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(manifest.dsh.client.platform).toBe('web')
    expect(manifest.dsh.client.immediately).toBe(true)
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-theme')
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-settings-plugins')
    expect(manifest.dsh.client.inject).toContain('@deepseek-ai/dsh-client-ui-workspace')
    expect(manifest.dsh.client.inject).not.toContain('@deepseek-ai/dsh-client-ui-directory-picker-browse')
    expect(manifest.devDependencies['@trimjs/web-app']).toBe('latest')
  })

  it('inserts the plugin using the package name resolved by client-modules', async () => {
    const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
    expect(patch).toContain('id: dsh-fnos')
    expect(patch).toContain("name: '@tnnevol/dsh-fnos'")
    expect(patch).toContain('id: directory-picker')
    expect(patch).toContain('disabled: true')
    expect(patch).not.toContain('dsh-client-ui-directory-picker-browse')
    expect(patch).toContain("name: '@tnnevol/dsh-fnos'")
  })

  it('declares the DSH API version used by the client bridge', async () => {
    const compatibility = JSON.parse(await readFile(new URL('../compatibility.json', import.meta.url), 'utf8')) as {
      dshPluginApi: { version: string, packages: string[] }
    }
    expect(compatibility.dshPluginApi.version).toBe('0.1.0-rc.8')
    expect(compatibility.dshPluginApi.packages).toEqual([
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-ui-theme',
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
