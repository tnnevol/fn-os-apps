import { describe, expect, it } from 'vitest'
import { rewriteCss } from '../src/middleware/content-rewrite.ts'

describe('gateway content rewriting', () => {
  it('prefixes root-relative CSS resources, including plugin images', () => {
    const css = `.pet { cursor: url('/dsh-pet-7340/pic/cursor-grab.png'), auto; background-image: url(/assets/pet.svg); }`

    expect(rewriteCss(Buffer.from(css), '/app/fn-deepseek-harness')).toBe(
      `.pet { cursor: url('/app/fn-deepseek-harness/dsh-pet-7340/pic/cursor-grab.png'), auto; background-image: url(/app/fn-deepseek-harness/assets/pet.svg); }`,
    )
  })

  it('does not rewrite external, data, or already-prefixed CSS resources', () => {
    const css = `.pet { background: url(https://example.com/pet.png), url(data:image/png;base64,abc), url('/app/fn-deepseek-harness/pet.png'); }`

    expect(rewriteCss(Buffer.from(css), '/app/fn-deepseek-harness')).toBe(css)
  })
})
