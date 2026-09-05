import { describe, expect, it } from 'vitest'
import { serializeRequest } from '../src/serialize.ts'
import type { GenerateOptions, Message } from '@deepseek-ai/dsh-llm'

const textMessage: Message = {
  id: '1' as never,
  role: 'user',
  content: [{ type: 'text', text: 'hello' }],
  source: { kind: 'user' } as never,
}

describe('CodeBuddy request serialization', () => {
  it('serializes a user message and enables streaming with usage', () => {
    const options = { provider: 'codebuddy', model: 'x', messages: [textMessage] } as GenerateOptions
    const request = serializeRequest(options, false)
    expect(request.model).toBe('x')
    expect(request.stream).toBe(true)
    expect(request.stream_options).toEqual({ include_usage: true })
    expect(request.messages[0]).toEqual({ role: 'user', content: 'hello' })
  })

  it('omits absent options rather than sending null', () => {
    const options = { provider: 'codebuddy', model: 'x', messages: [textMessage] } as GenerateOptions
    const request = serializeRequest(options, false)
    expect('temperature' in request).toBe(false)
    expect('max_tokens' in request).toBe(false)
  })

  it('maps tools into function definitions', () => {
    const options = {
      provider: 'codebuddy',
      model: 'x',
      messages: [textMessage],
      tools: [{ name: 'echo', description: 'echo', parameters: { type: 'object' } }],
    } as GenerateOptions
    const request = serializeRequest(options, false)
    expect(request.tools?.[0]?.function?.name).toBe('echo')
  })

  // CodeBuddy's gateway rejects tool-call ids longer than 64 chars. History
  // replayed from another adapter (e.g. the pi-ai/codex `call_...|fc_...` ids)
  // must be emitted under a stable short alias, and the alias must stay paired
  // between the assistant tool_calls block and its role:'tool' result.
  const longId = 'call_QxCtiZxFEGZI0nihLdh2nsJF|fc_02c3e069e9aafb2e016a977da031c887d09fdc669cd979d669'
  const shortId = 'call_local_short_id'

  const toolCallMessages: Message[] = [
    textMessage,
    {
      id: 'a' as never,
      role: 'assistant',
      content: [
        { type: 'text', text: 'checking' },
        {
          type: 'tool-call',
          id: longId as never,
          name: 'search',
          arguments: '{}',
        },
      ],
      source: { kind: 'tool' } as never,
    },
    {
      id: 'b' as never,
      role: 'user',
      content: [
        {
          type: 'tool-result',
          toolCallId: longId as never,
          content: [{ type: 'text', text: 'found' }],
        },
      ],
      source: { kind: 'tool' } as never,
    },
  ]

  it('bounds over-long tool-call ids to a deterministic ≤64-char alias', () => {
    const options = {
      provider: 'codebuddy',
      model: 'x',
      messages: toolCallMessages,
    } as GenerateOptions
    const request = serializeRequest(options, false)
    const assistant = request.messages[1] as { tool_calls: Array<{ id: string }> }
    const tool = request.messages[2] as { tool_call_id: string }
    const bounded = assistant.tool_calls[0]!.id
    expect(bounded).toMatch(/^call_[0-9a-f]{16}$/)
    expect(bounded.length).toBeLessThanOrEqual(64)
    // The assistant id and its result stay paired on the wire.
    expect(tool.tool_call_id).toBe(bounded)
    // Stable: serializing again yields the same alias.
    const again = serializeRequest(options, false)
    expect((again.messages[1] as { tool_calls: Array<{ id: string }> }).tool_calls[0]!.id).toBe(bounded)
  })

  it('passes short tool-call ids through unchanged and paired', () => {
    const messages: Message[] = [
      textMessage,
      {
        id: 'a' as never,
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            id: shortId as never,
            name: 'search',
            arguments: '{}',
          },
        ],
        source: { kind: 'tool' } as never,
      },
      {
        id: 'b' as never,
        role: 'user',
        content: [
          {
            type: 'tool-result',
            toolCallId: shortId as never,
            content: [{ type: 'text', text: 'found' }],
          },
        ],
        source: { kind: 'tool' } as never,
      },
    ]
    const options = { provider: 'codebuddy', model: 'x', messages } as GenerateOptions
    const request = serializeRequest(options, false)
    const assistant = request.messages[1] as { tool_calls: Array<{ id: string }> }
    const tool = request.messages[2] as { tool_call_id: string }
    expect(assistant.tool_calls[0]!.id).toBe(shortId)
    expect(tool.tool_call_id).toBe(shortId)
  })
})
