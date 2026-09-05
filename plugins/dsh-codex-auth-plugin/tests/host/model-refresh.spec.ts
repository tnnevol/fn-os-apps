import { describe, expect, it, vi } from 'vitest'
import {
  normalizeCodexCatalog,
  normalizeCodexModel,
  normalizeReasoningEfforts,
  refreshCodexModelCatalog,
} from '../../src/host/model-refresh.ts'
import type { CodexCredentialStore } from '../../src/host/store.ts'

const astraRow = {
  slug: 'gpt-6-astra',
  display_name: 'GPT-6-Astra',
  visibility: 'list',
  input_modalities: ['text', 'image'],
  context_window: 272000,
  max_context_window: 872000,
  supported_reasoning_levels: [
    { effort: 'low', description: 'Fast responses with lighter reasoning' },
    { effort: 'medium' },
    { effort: 'high' },
    { effort: 'xhigh' },
    { effort: 'max' },
    { effort: 'ultra', description: 'Maximum reasoning with automatic task delegation' },
  ],
  default_reasoning_level: 'low',
}

describe('Codex model catalog refresh normalization', () => {
  it('maps an account model to a profile entry with selectable reasoning efforts', () => {
    const entry = normalizeCodexModel(astraRow)

    expect(entry).toEqual({
      id: 'gpt-6-astra',
      name: 'GPT-6-Astra',
      contextWindow: 272000,
      maxTokens: 128000,
      input: ['text', 'image'],
      reasoningEfforts: { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' },
    })
  })

  it('drops reasoning levels outside llm-pi-ai vocabulary instead of writing them', () => {
    expect(normalizeReasoningEfforts(astraRow)).not.toHaveProperty('ultra')
    expect(normalizeReasoningEfforts(astraRow)).toHaveProperty('max')
  })

  it('marks a model with no selectable levels as non-reasoning', () => {
    expect(normalizeReasoningEfforts({ slug: 'x', supported_reasoning_levels: [{ effort: 'ultra' }] })).toBe(false)
    expect(normalizeReasoningEfforts({ slug: 'x' })).toBe(false)
  })

  it('skips internal machinery rows and hidden service rows', () => {
    const { models, skipped } = normalizeCodexCatalog({
      models: [
        astraRow,
        { slug: 'codex-auto-review', visibility: 'hide', display_name: 'Codex Auto Review' },
        { slug: 'gpt-reserve', visibility: 'hide', display_name: 'GPT-Reserve' },
      ],
    })

    expect(models.map(model => model.id)).toEqual(['gpt-6-astra'])
    expect(skipped).toEqual(['codex-auto-review', 'gpt-reserve'])
  })

  it('keeps rows that carry no context window out of the written list', () => {
    const { models } = normalizeCodexCatalog({ models: [{ slug: 'gpt-5.4-mini', visibility: 'list' }] })
    expect(models).toEqual([])
  })

  it('defaults missing display name and modalities safely', () => {
    const entry = normalizeCodexModel({
      slug: 'gpt-5.5',
      visibility: 'list',
      context_window: 272000,
      supported_reasoning_levels: [{ effort: 'low' }, { effort: 'high' }],
    })

    expect(entry?.name).toBe('gpt-5.5')
    expect(entry?.input).toEqual(['text'])
    expect(entry?.reasoningEfforts).toEqual({ low: 'low', high: 'high' })
  })
})

describe('refreshCodexModelCatalog', () => {
  const oauthCredential = {
    type: 'oauth',
    access: 'test-access-token',
    refresh: 'test-refresh-token',
    expires: Date.now() + 3_600_000,
    accountId: 'acct-1',
  }
  const signedInStore = {
    read: vi.fn(async () => oauthCredential),
  } as unknown as CodexCredentialStore

  it('normalizes the fetched account catalog into a refresh result', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ models: [astraRow] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))

    const result = await refreshCodexModelCatalog(signedInStore, fetchImpl as never)
    expect(result.models).toHaveLength(1)
    expect(result.models[0]?.id).toBe('gpt-6-astra')
    expect(result.skipped).toEqual([])
  })

  it('surfaces a non-OK upstream response as a plain Error', async () => {
    const fetchImpl = vi.fn(async () => new Response('upstream down', { status: 502 }))
    await expect(refreshCodexModelCatalog(signedInStore, fetchImpl as never)).rejects.toThrow(/status 502/)
  })

  it('rejects an empty selectable catalog', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ models: [{ slug: 'codex-auto-review', visibility: 'hide' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    await expect(refreshCodexModelCatalog(signedInStore, fetchImpl as never)).rejects.toThrow(/no selectable models/)
  })

  it('rejects a payload that is not a models array', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ nope: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    await expect(refreshCodexModelCatalog(signedInStore, fetchImpl as never)).rejects.toThrow(/models array/)
  })
})
