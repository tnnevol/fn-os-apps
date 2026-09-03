import { describe, expect, it, vi } from 'vitest'
import { loadCodexModelCatalog } from '../src/client/model-catalog.ts'

const catalog = {
  groups: [{ id: 'openai-codex', name: 'OpenAI Codex', models: [] }],
  failures: [],
}

describe('Codex model catalog transport compatibility', () => {
  it('uses the alpha.4 Remote catalog when available', async () => {
    const modelCatalog = vi.fn(async () => ({ ok: true as const, value: catalog }))
    const connection = {} as never

    await expect(loadCodexModelCatalog(connection, { session: { modelCatalog } })).resolves.toBe(catalog)
    expect(modelCatalog).toHaveBeenCalledTimes(1)
  })

  it('falls back to the rc.2 connection API', async () => {
    const models = vi.fn(async () => ({ result: { ok: true as const, value: catalog } }))
    const connection = { api: { llm: { models } } } as never

    await expect(loadCodexModelCatalog(connection, {})).resolves.toBe(catalog)
    expect(models).toHaveBeenCalledWith({})
  })

  it('surfaces a modern catalog error instead of leaving the page in an invalid state', async () => {
    const connection = {} as never
    const remote = {
      session: {
        modelCatalog: async () => ({ ok: false as const, error: { message: 'catalog unavailable' } }),
      },
    }

    await expect(loadCodexModelCatalog(connection, remote)).rejects.toThrow('catalog unavailable')
  })
})
