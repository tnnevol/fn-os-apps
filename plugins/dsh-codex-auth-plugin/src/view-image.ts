/** Optional Codex image-reading tool, modeled on DSH's durable attachment seam. */

import { basename } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import type { ImageAttachmentRef, ImageMediaType } from '@deepseek-ai/dsh-attachment'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolDefinition, ToolExecution } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-fs'

/** Stable name of the optional image-recognition tool. */
export const VIEW_IMAGE_TOOL_NAME = 'view_image'

interface ViewImageValue {
  source: string
  image: {
    attachmentId: string
    mediaType: ImageMediaType
    bytes: number
    width: number
    height: number
    name?: string
  }
}

function imageRefOf(image: ViewImageValue['image']): ImageAttachmentRef {
  return {
    attachmentId: AttachmentId(image.attachmentId),
    mediaType: image.mediaType,
    bytes: image.bytes,
    width: image.width,
    height: image.height,
    ...image.name === undefined ? {} : { name: image.name },
  }
}

function contentOf(value: ViewImageValue): ContentBlock[] {
  return [
    {
      type: 'text',
      text: `<source>${value.source}</source>\n<image>${value.image.mediaType}, ${value.image.width}x${value.image.height} px, ${value.image.bytes} bytes</image>`,
    },
    { type: 'image', attachment: imageRefOf(value.image) },
  ]
}

function mediaTypeOf(data: Uint8Array): ImageMediaType | undefined {
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47
    && data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a) return 'image/png'
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return 'image/jpeg'
  if (data.length >= 6) {
    const signature = String.fromCharCode(...data.subarray(0, 6))
    if (signature === 'GIF87a' || signature === 'GIF89a') return 'image/gif'
  }
  if (data.length >= 12
    && String.fromCharCode(...data.subarray(0, 4)) === 'RIFF'
    && String.fromCharCode(...data.subarray(8, 12)) === 'WEBP') return 'image/webp'
  return undefined
}

async function assertImageCapable(ctx: Context, exec: ToolExecution, source: string): Promise<void> {
  const routed = exec.agent?.session.requestHeader()?.config
  const provider = routed?.provider ?? exec.agent?.options.provider
  const model = routed?.model ?? exec.agent?.options.model
  if (provider === undefined || model === undefined) {
    throw new Error(`cannot view ${JSON.stringify(source)}: the current model route is unavailable`)
  }
  const info = await ctx.llm.resolveModelInfo(provider, model, exec.signal)
  if (info.inputModalities === undefined || !info.inputModalities.includes('image')) {
    throw new Error(`cannot view ${JSON.stringify(source)}: model "${model}" does not declare image input`)
  }
}

/** Register a local-file image tool in the current DSH tool scope. */
export function viewImageTool(ctx: Context): ToolDefinition {
  return defineTool({
    name: VIEW_IMAGE_TOOL_NAME,
    description: 'View a local PNG, JPEG, WebP, or GIF image and return it to an image-capable model.',
    parameters: {
      source: {
        type: 'string',
        required: true,
        description: 'Absolute or workspace-relative local image path.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          source: { type: 'string', required: true },
          image: {
            type: 'object',
            required: true,
            additionalProperties: false,
            properties: {
              attachmentId: { type: 'string', required: true },
              mediaType: { type: 'string', required: true, enum: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] },
              bytes: { type: 'integer', required: true },
              width: { type: 'integer', required: true },
              height: { type: 'integer', required: true },
              name: { type: 'string' },
            },
          },
        },
      },
      render: (_args, value) => contentOf(value),
    },
    isConcurrencySafe: () => true,
    async execute(args, exec) {
      const source = args.source.trim()
      if (source.length === 0) throw new Error('view_image source must not be empty')
      await assertImageCapable(ctx, exec, source)

      const attachments = ctx.attachments
      const maxBytes = Math.min(attachments.imageLimits.maxImageBytes, attachments.imageLimits.maxMessageImageBytes)
      const cwd = exec.agent?.session.header.cwd
      const target = await ctx.fs.resolve(source, { ...cwd === undefined ? {} : { cwd }, signal: exec.signal })
      const info = await ctx.fs.stat(target, exec.signal)
      if (info === undefined) throw new Error(`image path does not exist: ${source}`)
      if (info.type !== 'file') throw new Error(`image path is not a regular file: ${source}`)
      const data = await ctx.fs.readBytes(target, exec.signal, maxBytes)
      ctx.emit('fs/observed', target, { kind: 'present', version: info.version }, exec)
      const mediaType = mediaTypeOf(data)
      if (mediaType === undefined) throw new Error('view_image supports PNG, JPEG, WebP, and GIF image bytes')
      if (!attachments.imageLimits.mediaTypes.includes(mediaType)) {
        throw new Error(`${mediaType} images are disabled by this deployment`)
      }

      const name = basename(target.displayPath)
      const image = { data, mediaType, ...(name.length === 0 ? {} : { name }) }
      await attachments.validateImage(image)
      const ref = await attachments.saveImage(image)
      const value: ViewImageValue = {
        source: target.displayPath,
        image: {
          attachmentId: ref.attachmentId,
          mediaType: ref.mediaType,
          bytes: ref.bytes,
          width: ref.width,
          height: ref.height,
          ...ref.name === undefined ? {} : { name: ref.name },
        },
      }
      if (exec.parent !== undefined) {
        exec.deferContext(createUserMessage({
          content: contentOf(value),
          source: { kind: 'plugin', plugin: '@tnnevol/dsh-codex-auth' },
        }))
      }
      return value
    },
    presentCall: args => ({
      card: 'generic',
      title: `View image ${args.source}`,
      kind: 'read',
      locations: [{ path: args.source }],
    }),
  })
}
