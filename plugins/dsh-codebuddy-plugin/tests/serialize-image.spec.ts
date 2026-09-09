import { describe, expect, it } from 'vitest'
import { serializeRequestWithImages, hasRequestImages } from '../src/serialize-image.ts'
import type { GenerateOptions, Message } from '@deepseek-ai/dsh-llm'
import type { AttachmentStore, ImageAttachmentRef, RequestImageAttachment } from '@deepseek-ai/dsh-attachment'

const pngBytes = new Uint8Array([1, 2, 3, 4])

const imageRef: ImageAttachmentRef = {
  attachmentId: 'att-img-1' as never,
  mediaType: 'image/png',
  bytes: pngBytes.length,
  width: 32,
  height: 16,
}

const requestVersion: RequestImageAttachment = {
  variantId: 'v1' as never,
  attachment: imageRef,
  data: pngBytes,
  mediaType: 'image/png',
  bytes: pngBytes.length,
  width: 32,
  height: 16,
  depth: 'uchar',
  space: 'srgb',
  hasAlpha: false,
}

function makeStore(): AttachmentStore {
  return {
    readImageRequest: async () => requestVersion,
  } as unknown as AttachmentStore
}

const imageMessage: Message = {
  id: '1' as never,
  role: 'user',
  content: [
    { type: 'text', text: 'describe this' },
    { type: 'image', attachment: imageRef },
  ],
  source: { kind: 'user' } as never,
}

describe('CodeBuddy image request serialization', () => {
  it('serializes a durable image into an inline image_url data URI', async () => {
    const options = { provider: 'codebuddy', model: 'glm-5.3-flash', messages: [imageMessage] } as GenerateOptions
    const request = await serializeRequestWithImages(options, makeStore(), undefined)
    const content = request.messages[0]!.content
    expect(Array.isArray(content)).toBe(true)
    const parts = content as Array<{ type: string, image_url?: { url: string }, text?: string }>
    expect(parts.some(part => part.type === 'image_url')).toBe(true)
    const image = parts.find(part => part.type === 'image_url')!
    expect(image.image_url!.url).toBe(`data:image/png;base64,${Buffer.from(pngBytes).toString('base64')}`)
    // The original text and the image handle stay, so a text-only replay reads
    // consistently and the model knows an image is present.
    const texts = parts.filter(part => part.type === 'text').map(part => part.text).join('')
    expect(texts).toContain('describe this')
    expect(texts).toMatch(/[Ii]mage|[aA]ttachment/)
  })

  it('keeps text-only messages on the compact string wire form', async () => {
    const textMsg: Message = {
      id: '1' as never,
      role: 'user',
      content: [{ type: 'text', text: 'plain' }],
      source: { kind: 'user' } as never,
    }
    const options = { provider: 'codebuddy', model: 'm', messages: [textMsg] } as GenerateOptions
    const request = await serializeRequestWithImages(options, makeStore(), undefined)
    expect(request.messages[0]!.content).toBe('plain')
  })

  it('detects image-bearing history', () => {
    expect(hasRequestImages([imageMessage])).toBe(true)
    expect(hasRequestImages([{ ...imageMessage, content: [{ type: 'text', text: 'no image' }] }])).toBe(false)
  })
})
