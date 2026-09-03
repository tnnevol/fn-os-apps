import { describe, expect, it } from 'vitest'
import { createCodexAdapter } from '../../src/host/adapter.ts'
import { CodexCredentialStore } from '../../src/host/store.ts'

describe('dsh-codex-auth-plugin model adapter', () => {
  it('exposes the provider-native Codex model catalog to dsh', async () => {
    const adapter = createCodexAdapter(new CodexCredentialStore('/tmp/dsh-codex-auth-test.json'), () => undefined)
    const models = await adapter.listModels('openai-codex')

    expect(models.length).toBeGreaterThan(0)
    expect(models.some(model => model.id.toLowerCase().includes('codex'))).toBe(true)
  })
})
