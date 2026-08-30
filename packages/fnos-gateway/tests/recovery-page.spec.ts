import { describe, expect, it } from 'vitest'
import { recoveryPage } from '../src/recovery-page.ts'

describe('DSH Web recovery page', () => {
  it('offers a Web-side restart action when DSH Web is unavailable', () => {
    const html = recoveryPage('/app/fn-deepseek-harness', 'upstream unavailable')

    expect(html).toContain('Web 端重启。')
    expect(html).toContain('id="restart"')
    expect(html).toContain('>重启</button>')
    expect(html).toContain('正在重启…')
    expect(html).toContain('/app/fn-deepseek-harness/__fnos-gateway/control/web/restart')
  })
})
