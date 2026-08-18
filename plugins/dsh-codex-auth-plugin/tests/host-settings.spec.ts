import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('dsh-codex-auth-plugin settings-card namespace', () => {
  it('keeps the auth card namespace and delegates the model page to pi-ai', async () => {
    const host = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8')
    const client = await readFile(new URL('../src/client/index.tsx', import.meta.url), 'utf8')
    const paths = await readFile(new URL('../src/auth-paths.ts', import.meta.url), 'utf8')
    const routes = await readFile(new URL('../src/auth-routes.ts', import.meta.url), 'utf8')
    const patch = await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8')
    expect(host).toContain('ctx.settings.register(CODEX_AUTH_SETTINGS_NS, CodexAuthSettingsSchema)')
    expect(host).not.toContain('ctx.llm.registerAdapter')
    expect(host).toContain('new CodexCredentialMirror(ctx.credentials, store)')
    expect(host).toContain('registerCodexAuthRoutes(ctx, store, mirror)')
    expect(client).toContain('key: CODEX_AUTH_SETTINGS_NAMESPACE')
    expect(paths).not.toContain('CODEX_AUTH_CODE_PATH')
    expect(paths).toContain('CODEX_AUTH_LOGIN_PATH')
    expect(paths).toContain("CODEX_AUTH_SETTINGS_NAMESPACE = 'dsh-codex-auth'")
    expect(routes).toContain("Promise.resolve('device_code')")
    expect(routes).toContain("event.type !== 'device_code'")
    expect(routes).not.toContain('manual_code')
    expect(patch).toContain('id: llm-pi-ai')
    expect(patch).toContain('apiKeyEnv: OPENAI_CODEX_AUTH_TOKEN')
    expect(patch).toContain('id: gpt-5.4')
  })

  it('exposes a live image-recognition capability without changing the model adapter', async () => {
    const host = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8')
    const settings = await readFile(new URL('../src/settings.ts', import.meta.url), 'utf8')
    const tool = await readFile(new URL('../src/view-image.ts', import.meta.url), 'utf8')
    expect(settings).toContain('enableImageTool')
    expect(settings).toContain('enableImageUpload')
    expect(host).toContain("['tools', 'fs', 'attachments', 'llm']")
    expect(host).toContain('viewImageTool')
    expect(host).toContain('settings.watch(scheduleImageTool)')
    expect(tool).toContain('await attachments.validateImage(image)')
    expect(tool).toContain('await attachments.saveImage(image)')
  })
})
