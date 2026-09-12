import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { serializeRequest } from '../src/host/serialize.ts'
import { serializeRequestWithImages } from '../src/host/serialize-image.ts'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'
import type { WireRequest } from '../src/host/types.ts'

/**
 * 多模态能力端到端契约测试。
 *
 * 报告 §2 指出：之前只有序列化单测，没有任何测试验证「CodeBuddy 模型 supportsImages
 * → 适配器 inputModalities → 序列化输出含 image_url」这条完整链路。
 *
 * 不接 DSH、不发真实 HTTP（vitest 起不了 Semi/cordis）。但**关键事实**——「支持
 * 图片的模型，图片就以 data URI 形式进入请求体」是序列化层能锁定的。
 */
const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '..', 'src')
const ADAPTER_SRC = readFileSync(join(SRC, 'host/adapter.ts'), 'utf8')
const AUTH_SRC = readFileSync(join(SRC, 'host/auth-service.ts'), 'utf8')

const PNG8 = Uint8Array.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])

function requestWithImage(): GenerateOptions {
  return {
    model: 'auto',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: '看这张图' },
        // ref 需要带 mediaType：序列化器在 extension() 里用它
        { type: 'image', attachment: { attachmentId: 'att-1', mediaType: 'image/png' } },
      ],
    }],
  } as unknown as GenerateOptions
}

function findImageParts(body: WireRequest): Array<{ type: string; image_url?: { url: string } }> {
  const parts: Array<{ type: string; image_url?: { url: string } }> = []
  for (const m of body.messages) {
    const arr = Array.isArray(m.content) ? m.content : []
    for (const p of arr) if (typeof p === 'object' && p !== null && 'type' in p) {
      parts.push(p as { type: string; image_url?: { url: string } })
    }
  }
  return parts
}

describe('序列化契约', () => {
  it('supportsImages=true：图片以 data:image/...;base64,... 的 image_url 进入请求体', async () => {
    // 真实 RequestImageAttachment：{ mediaType, data: Uint8Array | string }，
    // serialize-image 用 `Buffer.from(version.data).toString('base64')` 编码。
    const attachments = {
      readImageRequest: () => Promise.resolve({ mediaType: 'image/png', data: PNG8 }),
    } as never
    // resolveImageAccess 用于文本占位（我们这里有图，不走占位分支；返回 readonlyPath 即可）
    const resolveAccess = () => ({ readonlyPath: '/run/dsh/att-1.png' } as never)
    const body = await serializeRequestWithImages(
      requestWithImage(), attachments, resolveAccess as never,
    )
    // 至少有 1 个 image_url（序列化器还可能附加 text handles 描述图，不影响核心契约）
    const imageUrlParts = findImageParts(body).filter(p => p.type === 'image_url')
    expect(imageUrlParts).toHaveLength(1)
    expect(imageUrlParts[0]!.image_url!.url).toMatch(/^data:image\/png;base64,/)
  })

  it('supportsImages=false：序列化器主动拒绝（不让图片进入请求体）', () => {
    expect(() => serializeRequest(requestWithImage(), false))
      .toThrow(/does not accept image content/)
  })

  it('无图消息：直接走无图路径，不读 attachments', () => {
    const plain = {
      model: 'm',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
    } as unknown as GenerateOptions
    const body = serializeRequest(plain, true)
    expect(findImageParts(body)).toHaveLength(0)
  })
})

describe('能力声明：listModels / resolveModel / 职责边界', () => {
  it('listModels：supportsImages=true → inputModalities 含 image', () => {
    // 整段函数体只测它，不被相邻代码干扰
    const i = ADAPTER_SRC.indexOf('function modelInfo')
    const body = ADAPTER_SRC.slice(i, ADAPTER_SRC.indexOf('\n}', i) + 2)
    // 形态: `inputModalities: model.supportsImages === true ? ['text', 'image'] : ['text']`
    expect(body).toMatch(/model\.supportsImages\s*===\s*true\s*\?\s*\[\s*['"]text['"],\s*['"]image['"]\s*\]\s*:\s*\[\s*['"]text['"]\s*\]/)
  })

  it('resolveModel：未在目录中或 supportsImages 缺失 → text-only（保守）', () => {
    // 「把未声明当支持」会把图片静默丢给纯文本模型。所以保守是必要的。
    // 双向断言：含 ['text']，且**不含** 'image' —— 单边断言会被「全声明为 image」逃过。
    const i = ADAPTER_SRC.indexOf('override async resolveModel')
    const body = ADAPTER_SRC.slice(i, i + 2000)
    expect(body).toMatch(/inputModalities:\s*\[\s*['"]text['"]\s*\]/)
    // 取出这块里所有 inputModalities 声明，确认都只含 text
    const declarations = body.match(/inputModalities:\s*\[[^\]]+\]/g) ?? []
    for (const d of declarations) {
      expect(d).not.toMatch(/image/)
    }
  })

  it('插件没有注册 read_image / ocr 工具（DSH 自带，不重复）', () => {
    expect(AUTH_SRC).not.toMatch(/name:\s*['"]read_image['"]/)
    expect(AUTH_SRC).not.toMatch(/name:\s*['"]ocr['"]/i)
  })

  it('请求路径唯一：先判 hasRequestImages，再选择无图或 image_url 路径', () => {
    // 旧写法：先 serializeRequest()，再决定是否重新生成（507 调一次，513/526
    // 可能再用一次）。新写法：先 wantsImage，再选单条路径。锁住「不再有重复序列化」。
    const i = ADAPTER_SRC.indexOf('const wantsImage = hasRequestImages')
    const body = ADAPTER_SRC.slice(i, i + 1500)
    // 旧形态：先 serializeRequest()，再 wantsImage
    expect(body).not.toMatch(/const body = serializeRequest\(/)
    // 新形态：wantsImage 在前，序列化在后
    expect(body.indexOf('hasRequestImages')).toBeLessThan(body.indexOf('serializeRequestWithImages'))
  })
})
