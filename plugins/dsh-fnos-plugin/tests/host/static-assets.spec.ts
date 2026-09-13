import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { registerStaticAssetRoute } from '../../src/host/static-assets.ts'
import { FNOS_STATIC_PREFIX } from '../../src/contracts/static-assets-contract.ts'

/**
 * 插件静态资源路由。
 *
 * 直接驱动真实 handler（而不是只断言源码字符串），守三条契约：
 *
 * 1. 已知资源返回插件包内的字节与正确的 content-type；
 * 2. **只有**显式列举的资源名可以被读取——这靠「白名单目录里放一个未列举的
 *    文件，仍必须 404」来钉住，因为只测路径穿越会让 `/` 检查或 ENOENT 顶替
 *    白名单成为实际判据，白名单被删掉测试也不报警；
 * 3. 资源缺失时 404，不回退读取 fnOS 宿主目录。
 *
 * 夹具用临时目录：生产环境资源由构建拷到 `lib/assets/`，内容同 `src/assets/`。
 */

interface CapturedRoute {
  kind: string
  path: string
  handler: (req: { method?: string, url?: string }, res: FakeResponse) => void | Promise<void>
}

interface FakeResponse {
  statusCode?: number
  headers?: Record<string, string> | undefined
  body?: unknown
  ended: boolean
  writeHead: (status: number, headers?: Record<string, string>) => void
  end: (value?: unknown) => void
}

function fakeResponse(): FakeResponse {
  const res: FakeResponse = {
    ended: false,
    writeHead(status, headers) { res.statusCode = status; res.headers = headers },
    end(value) { res.body = value; res.ended = true },
  }
  return res
}

const sourceDir = dirname(fileURLToPath(import.meta.url))
const realAsset = join(sourceDir, '..', '..', 'src', 'assets', 'file-manager.png')

/** 白名单外、但确实存在于资源目录中的文件：用来证明白名单真的在拦。 */
const UNLISTED = 'unlisted-but-present.png'
let fixtureDir: string
let route: CapturedRoute

beforeAll(async () => {
  fixtureDir = await mkdtemp(join(tmpdir(), 'dsh-fnos-assets-'))
  await copyFile(realAsset, join(fixtureDir, 'file-manager.png'))
  await writeFile(join(fixtureDir, UNLISTED), 'this must never be served')

  let captured: CapturedRoute | undefined
  const ctx = {
    effect: (factory: () => unknown) => { factory() },
    webServer: { register: (value: CapturedRoute) => { captured = value; return () => undefined } },
  }
  registerStaticAssetRoute(ctx as never, { assetsDirectory: fixtureDir })
  if (captured === undefined) throw new Error('static asset route was not registered')
  route = captured
})

afterAll(async () => {
  await rm(fixtureDir, { recursive: true, force: true })
})

async function invoke(method: string, url: string): Promise<FakeResponse> {
  const res = fakeResponse()
  await route.handler({ method, url }, res)
  return res
}

describe('fnOS 插件静态资源路由', () => {
  it('注册在前缀路由上，且前缀与客户端引用一致', () => {
    expect(route.kind).toBe('prefix')
    expect(route.path).toBe(FNOS_STATIC_PREFIX)
    expect(route.path).toBe('/fnos-plugins/static/dsh-fnos')
  })

  it('返回插件包内资源的真实字节与 content-type', async () => {
    const res = await invoke('GET', `${FNOS_STATIC_PREFIX}/file-manager.png`)
    expect(res.statusCode).toBe(200)
    expect(res.headers?.['content-type']).toBe('image/png')

    const expected = await readFile(join(fixtureDir, 'file-manager.png'))
    expect(Buffer.isBuffer(res.body)).toBe(true)
    expect((res.body as Buffer).equals(expected)).toBe(true)
  })

  it('目录里存在但未列举的资源仍然 404（白名单是判据）', async () => {
    const res = await invoke('GET', `${FNOS_STATIC_PREFIX}/${UNLISTED}`)
    expect(res.statusCode).toBe(404)
    // 文件确实存在于资源目录中，所以 404 只能来自白名单。
    await expect(readFile(join(fixtureDir, UNLISTED), 'utf8')).resolves.toContain('never be served')
  })

  it('HEAD 只回响应头，不带 body', async () => {
    const res = await invoke('HEAD', `${FNOS_STATIC_PREFIX}/file-manager.png`)
    expect(res.statusCode).toBe(200)
    expect(res.headers?.['content-type']).toBe('image/png')
    expect(res.body).toBeUndefined()
  })

  it('带子路径的名字一律拒绝（不留路径穿越余地）', async () => {
    for (const url of [
      `${FNOS_STATIC_PREFIX}/../../package.json`,
      `${FNOS_STATIC_PREFIX}/nested/file-manager.png`,
      `${FNOS_STATIC_PREFIX}/..%2f..%2fpackage.json`,
      `${FNOS_STATIC_PREFIX}/`,
    ]) {
      const res = await invoke('GET', url)
      expect(res.statusCode, url).toBe(404)
    }
  })

  it('非 GET/HEAD 返回 405', async () => {
    const res = await invoke('POST', `${FNOS_STATIC_PREFIX}/file-manager.png`)
    expect(res.statusCode).toBe(405)
  })

  it('查询串不影响资源匹配', async () => {
    const res = await invoke('GET', `${FNOS_STATIC_PREFIX}/file-manager.png?v=2`)
    expect(res.statusCode).toBe(200)
  })
})
