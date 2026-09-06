import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('dsh-codex-auth-plugin host registration', () => {
  it('keeps the auth card and delegates the model page to pi-ai', async () => {
    const host = await readFile(new URL('../../src/index.ts', import.meta.url), 'utf8')
    const client = await readFile(new URL('../../src/client/index.tsx', import.meta.url), 'utf8')
    const paths = await readFile(new URL('../../src/contracts/auth-paths.ts', import.meta.url), 'utf8')
    const routes = await readFile(new URL('../../src/host/auth-routes.ts', import.meta.url), 'utf8')
    const patch = await readFile(new URL('../../cordis.patch.yml', import.meta.url), 'utf8')
    expect(host).not.toContain('ctx.llm.registerAdapter')
    expect(host).toContain('new CodexCredentialMirror(ctx.credentials, store)')
    expect(host).toContain('registerCodexAuthRoutes(ctx, store, mirror)')
    expect(paths).not.toContain('CODEX_AUTH_CODE_PATH')
    expect(paths).toContain('CODEX_AUTH_LOGIN_PATH')
    expect(paths).not.toContain('CODEX_AUTH_SETTINGS')
    expect(routes).toContain("Promise.resolve('device_code')")
    expect(routes).toContain("event.type !== 'device_code'")
    expect(routes).not.toContain('manual_code')
    expect(patch).toContain('id: llm-pi-ai')
    expect(patch).toContain('apiKeyEnv: OPENAI_CODEX_AUTH_TOKEN')
    expect(patch).toContain('id: gpt-5.4')
  })

  it('does not register the removed image capability module', async () => {
    const host = await readFile(new URL('../../src/index.ts', import.meta.url), 'utf8')
    const client = await readFile(new URL('../../src/client/index.tsx', import.meta.url), 'utf8')
    const routes = await readFile(new URL('../../src/host/auth-routes.ts', import.meta.url), 'utf8')
    const locales = await readFile(new URL('../../src/client/locales.ts', import.meta.url), 'utf8')
    expect(host).not.toContain('viewImageTool')
    expect(host).not.toContain('scheduleImageTool')
    expect(client).not.toContain('CodexCapabilities')
    expect(routes).not.toContain('CODEX_AUTH_SETTINGS_PATH')
    expect(routes).not.toContain('withDshVersion')
    expect(locales).not.toContain('enableImageUpload')
    expect(locales).not.toContain('enableImageRecognition')
  })
})
