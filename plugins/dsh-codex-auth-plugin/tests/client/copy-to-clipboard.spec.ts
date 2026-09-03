import { describe, expect, it, vi } from 'vitest'
import { copyTextToClipboard } from '../../src/client/services/copy-to-clipboard.ts'

describe('copyTextToClipboard', () => {
  it('uses the Clipboard API when available', async () => {
    const writeText = vi.fn(async () => undefined)
    await copyTextToClipboard('3J3V-UN5LK', { navigator: { clipboard: { writeText } } })
    expect(writeText).toHaveBeenCalledWith('3J3V-UN5LK')
  })

  it('falls back to execCommand for HTTP-style environments', async () => {
    const textarea = {
      value: '',
      style: {} as Record<string, string>,
      setAttribute: vi.fn(),
      focus: vi.fn(),
      select: vi.fn(),
    } as unknown as HTMLTextAreaElement
    const body = {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    } as unknown as HTMLElement
    const document = {
      createElement: vi.fn(() => textarea),
      body,
      execCommand: vi.fn(() => true),
    }

    await copyTextToClipboard('3J3V-UN5LK', { navigator: {}, document })

    expect(textarea.value).toBe('3J3V-UN5LK')
    expect(document.execCommand).toHaveBeenCalledWith('copy')
    expect(body.removeChild).toHaveBeenCalledWith(textarea)
  })

  it('reports a failed fallback copy', async () => {
    const document = {
      createElement: vi.fn(() => ({
        value: '',
        style: {},
        setAttribute: vi.fn(),
        focus: vi.fn(),
        select: vi.fn(),
      } as unknown as HTMLTextAreaElement)),
      body: { appendChild: vi.fn(), removeChild: vi.fn() } as unknown as HTMLElement,
      execCommand: vi.fn(() => false),
    }

    await expect(copyTextToClipboard('3J3V-UN5LK', { navigator: {}, document })).rejects.toThrow('Copy command was rejected')
  })
})
