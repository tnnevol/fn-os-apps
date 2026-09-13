import { createServer, request as httpRequest, type Server } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { once } from 'node:events'
import { createConnection } from 'node:net'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { createGateway } from '../src/server/gateway-server.ts'

const GATEWAY_PREFIX = '/app/fn-deepseek-harness'

async function listen(server: Server): Promise<number> {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('upstream did not bind to a TCP port')
  return address.port
}

describe('gateway server', () => {
  const resources: Array<() => Promise<void>> = []

  afterEach(async () => {
    while (resources.length > 0) await resources.pop()?.()
  })

  it('bootstraps the launch token once and then stops injecting it for cookie-bearing requests', async () => {
    const upstreamPaths: string[] = []
    const upstream = createServer((req, res) => {
      upstreamPaths.push(req.url ?? '')
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end('<!doctype html>')
    })
    const upstreamPort = await listen(upstream)
    resources.push(async () => new Promise<void>(resolve => upstream.close(() => resolve())))

    const directory = await mkdtemp(join(tmpdir(), 'fnos-gateway-'))
    const gatewaySocket = join(directory, 'gateway.sock')
    const webProcess = {
      getLaunchToken: () => 'launch-token',
      snapshot: async () => ({ state: 'running' as const, pid: process.pid }),
      start: async () => ({ state: 'running' as const, pid: process.pid }),
      restart: async () => ({ state: 'running' as const, pid: process.pid }),
      stop: async () => undefined,
    }
    const gateway = createGateway({
      socketPath: gatewaySocket,
      gatewayPrefix: GATEWAY_PREFIX,
      upstreamHost: '127.0.0.1',
      upstreamPort,
      webProcess: webProcess as never,
    })
    await once(gateway.server, 'listening')
    resources.push(async () => gateway.close())
    resources.push(async () => rm(directory, { recursive: true, force: true }))

    const get = (headers: Record<string, string> = {}) => new Promise<{ statusCode: number | undefined, location: string | undefined }>((resolve, reject) => {
      const request = httpRequest({ socketPath: gatewaySocket, path: `${GATEWAY_PREFIX}/`, method: 'GET', headers }, res => {
        res.resume()
        res.on('end', () => resolve({ statusCode: res.statusCode, location: res.headers.location }))
        res.on('error', reject)
      })
      request.on('error', reject)
      request.end()
    })

    // The first visit has no DSH browser-session cookie, so the gateway seeds
    // one by asking DSH for the tokenized index.
    await expect(get()).resolves.toEqual({ statusCode: 200, location: undefined })
    expect(upstreamPaths[0]).toBe('/?token=launch-token')

    // DSH answers *any* tokenized index request with a 303 to the clean URL,
    // even when the request already carries a valid cookie. Re-injecting the
    // token here is what produced the "too many redirects" loop.
    await expect(get({ cookie: 'dsh-auth-test=valid' })).resolves.toEqual({ statusCode: 200, location: undefined })
    expect(upstreamPaths[1]).toBe('/')
  })

  it('waits for a startup token before forwarding the first Web root request', async () => {
    let releaseToken: (token: string) => void = () => undefined
    const tokenReady = new Promise<string>(resolve => { releaseToken = resolve })
    const directory = await mkdtemp(join(tmpdir(), 'fnos-gateway-'))
    const gatewaySocket = join(directory, 'gateway.sock')
    const webProcess = {
      getLaunchToken: () => undefined,
      waitForLaunchToken: () => tokenReady,
      snapshot: async () => ({ state: 'starting' as const }),
      start: async () => ({ state: 'running' as const, pid: process.pid }),
      restart: async () => ({ state: 'running' as const, pid: process.pid }),
      stop: async () => undefined,
    }
    const gateway = createGateway({
      socketPath: gatewaySocket,
      gatewayPrefix: GATEWAY_PREFIX,
      upstreamHost: '127.0.0.1',
      upstreamPort: 1,
      webProcess: webProcess as never,
    })
    await once(gateway.server, 'listening')
    resources.push(async () => gateway.close())
    resources.push(async () => rm(directory, { recursive: true, force: true }))

    const responsePromise = new Promise<{ statusCode: number | undefined, location: string | undefined }>((resolve, reject) => {
      const request = httpRequest({ socketPath: gatewaySocket, path: `${GATEWAY_PREFIX}/`, method: 'GET' }, res => {
        res.resume()
        res.on('end', () => resolve({ statusCode: res.statusCode, location: res.headers.location }))
        res.on('error', reject)
      })
      request.on('error', reject)
      request.end()
    })
    await new Promise(resolve => setTimeout(resolve, 10))
    releaseToken('delayed-launch-token')

    await expect(responsePromise).resolves.toEqual({ statusCode: 502, location: undefined })
  })

  it('replaces an invalid browser cookie with the current launch token upstream', async () => {
    const upstream = createServer((req, res) => {
      const requestUrl = new URL(req.url ?? '/', 'http://upstream.invalid')
      if (requestUrl.pathname === '/' && !requestUrl.searchParams.has('token')) {
        res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('dsh web authentication required')
        return
      }
      res.writeHead(200)
      res.end()
    })
    const upstreamPort = await listen(upstream)
    resources.push(async () => new Promise<void>(resolve => upstream.close(() => resolve())))

    const directory = await mkdtemp(join(tmpdir(), 'fnos-gateway-'))
    const gatewaySocket = join(directory, 'gateway.sock')
    const webProcess = {
      getLaunchToken: () => 'current-launch-token',
      snapshot: async () => ({ state: 'running' as const, pid: process.pid }),
      start: async () => ({ state: 'running' as const, pid: process.pid }),
      restart: async () => ({ state: 'running' as const, pid: process.pid }),
      stop: async () => undefined,
    }
    const gateway = createGateway({
      socketPath: gatewaySocket,
      gatewayPrefix: GATEWAY_PREFIX,
      upstreamHost: '127.0.0.1',
      upstreamPort,
      webProcess: webProcess as never,
    })
    await once(gateway.server, 'listening')
    resources.push(async () => gateway.close())
    resources.push(async () => rm(directory, { recursive: true, force: true }))

    const response = await new Promise<{ statusCode: number | undefined, location: string | undefined }>((resolve, reject) => {
      const request = httpRequest({
        socketPath: gatewaySocket,
        path: `${GATEWAY_PREFIX}/`,
        method: 'GET',
        headers: { cookie: 'dsh-auth-stale=invalid' },
      }, res => {
        res.resume()
        res.on('end', () => resolve({ statusCode: res.statusCode, location: res.headers.location }))
        res.on('error', reject)
      })
      request.on('error', reject)
      request.end()
    })

    expect(response).toEqual({ statusCode: 200, location: undefined })
  })

  it('does not loop when the upstream answers a tokenized index with 303 to the clean URL', async () => {
    const seen: string[] = []
    // Mirrors DSH's authorizeIndex: a tokenized index for `/` always mints a
    // cookie and redirects to `/`, even when the request already had a valid
    // cookie. A proxy that keeps re-adding the token therefore never settles.
    const upstream = createServer((req, res) => {
      const requestUrl = new URL(req.url ?? '/', 'http://upstream.invalid')
      seen.push(req.url ?? '')
      const session = String(req.headers.cookie ?? '').includes('dsh-auth-upstream=')
      if (requestUrl.pathname === '/' && requestUrl.searchParams.has('token')) {
        res.writeHead(303, {
          'cache-control': 'no-store',
          location: '/',
          'set-cookie': 'dsh-auth-upstream=v1.fresh; Path=/; HttpOnly; SameSite=Strict',
        })
        res.end()
        return
      }
      if (requestUrl.pathname === '/' && !session) {
        res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('dsh web authentication required')
        return
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end('<!doctype html>')
    })
    const upstreamPort = await listen(upstream)
    resources.push(async () => new Promise<void>(resolve => upstream.close(() => resolve())))

    const directory = await mkdtemp(join(tmpdir(), 'fnos-gateway-'))
    const gatewaySocket = join(directory, 'gateway.sock')
    const gateway = createGateway({
      socketPath: gatewaySocket,
      gatewayPrefix: GATEWAY_PREFIX,
      upstreamHost: '127.0.0.1',
      upstreamPort,
      webProcess: {
        getLaunchToken: () => 'launch-token',
        snapshot: async () => ({ state: 'running' as const, pid: process.pid }),
        start: async () => ({ state: 'running' as const, pid: process.pid }),
        restart: async () => ({ state: 'running' as const, pid: process.pid }),
        stop: async () => undefined,
      } as never,
    })
    await once(gateway.server, 'listening')
    resources.push(async () => gateway.close())
    resources.push(async () => rm(directory, { recursive: true, force: true }))

    // Follow redirects the way a browser does, bounded so a regression shows
    // up as an assertion failure rather than an infinite loop.
    let cookie = ''
    let statusCode: number | undefined
    let hops = 0
    for (; hops < 5; hops += 1) {
      const response = await new Promise<{ statusCode: number | undefined, location: string | undefined, setCookie: string | undefined }>((resolve, reject) => {
        const request = httpRequest({
          socketPath: gatewaySocket,
          path: `${GATEWAY_PREFIX}/`,
          method: 'GET',
          headers: cookie === '' ? {} : { cookie },
        }, res => {
          res.resume()
          res.on('end', () => resolve({
            statusCode: res.statusCode,
            location: res.headers.location,
            setCookie: res.headers['set-cookie']?.[0],
          }))
          res.on('error', reject)
        })
        request.on('error', reject)
        request.end()
      })
      statusCode = response.statusCode
      if (response.setCookie !== undefined) cookie = response.setCookie.split(';', 1)[0] ?? ''
      if (statusCode !== 303) break
    }

    expect(statusCode).toBe(200)
    expect(hops).toBeLessThan(5)
    // Only the very first, cookie-less hop may carry the token.
    expect(seen.filter(path => path.includes('token=launch-token'))).toHaveLength(1)
    expect(seen.at(-1)).toBe('/')
  })

  it('rewrites and proxies the first websocket upgrade', async () => {
    let upstreamPath: string | undefined
    let upstreamHeaders: Record<string, string | string[] | undefined> | undefined
    const upstream = createServer()
    upstream.on('upgrade', (req, socket) => {
      upstreamPath = req.url
      upstreamHeaders = req.headers
      socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n')
      socket.end()
    })
    const upstreamPort = await listen(upstream)
    resources.push(async () => new Promise<void>(resolve => upstream.close(() => resolve())))

    const directory = await mkdtemp(join(tmpdir(), 'fnos-gateway-'))
    const gatewaySocket = join(directory, 'gateway.sock')
    const gateway = createGateway({
      socketPath: gatewaySocket,
      gatewayPrefix: GATEWAY_PREFIX,
      upstreamHost: '127.0.0.1',
      upstreamPort,
    })
    await once(gateway.server, 'listening')
    resources.push(async () => gateway.close())
    resources.push(async () => rm(directory, { recursive: true, force: true }))

    const client = createConnection(gatewaySocket)
    resources.push(async () => new Promise<void>(resolve => {
      if (client.destroyed) { resolve(); return }
      client.once('close', () => resolve())
      client.destroy()
    }))
    await once(client, 'connect')
    client.write([
      `GET ${GATEWAY_PREFIX}/api/events.mux HTTP/1.1`,
      'Host: 192.168.119.6:5666',
      'Connection: Upgrade',
      'Upgrade: websocket',
      'Origin: http://192.168.119.6:5666',
      'Sec-Fetch-Site: cross-site',
      'Sec-WebSocket-Version: 13',
      'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
      '',
      '',
    ].join('\r\n'))
    const [response] = await once(client, 'data') as [Buffer]

    expect(response.toString('utf8')).toContain('HTTP/1.1 101 Switching Protocols')
    expect(upstreamPath).toBe('/api/events.mux')
    expect(upstreamHeaders?.host).toBe(`127.0.0.1:${upstreamPort}`)
    expect(upstreamHeaders?.origin).toBe(`http://127.0.0.1:${upstreamPort}`)
    expect(upstreamHeaders?.['sec-fetch-site']).toBe('cross-site')
  })

  it('does not rewrite an image URL response as HTML', async () => {
    const body = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
    const upstream = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'image/png', 'content-length': String(body.length) })
      res.end(body)
    })
    const upstreamPort = await listen(upstream)
    resources.push(async () => new Promise<void>(resolve => upstream.close(() => resolve())))

    const directory = await mkdtemp(join(tmpdir(), 'fnos-gateway-'))
    const gatewaySocket = join(directory, 'gateway.sock')
    const gateway = createGateway({
      socketPath: gatewaySocket,
      gatewayPrefix: GATEWAY_PREFIX,
      upstreamHost: '127.0.0.1',
      upstreamPort,
    })
    await once(gateway.server, 'listening')
    resources.push(async () => gateway.close())
    resources.push(async () => rm(directory, { recursive: true, force: true }))

    const response = await new Promise<{ statusCode: number | undefined, headers: Record<string, string | string[] | undefined>, body: Buffer }>((resolve, reject) => {
      const request = httpRequest({
        socketPath: gatewaySocket,
        path: `${GATEWAY_PREFIX}/dsh-pet-7340/pic/cursor-grab.png`,
        method: 'GET',
      }, res => {
        const chunks: Buffer[] = []
        res.on('data', chunk => chunks.push(Buffer.from(chunk)))
        res.on('end', () => resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks),
        }))
        res.on('error', reject)
      })
      request.on('error', reject)
      request.end()
    })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-type']).toBe('image/png')
    expect(response.body).toEqual(body)
  })

  it('returns JSON errors when web control operations reject', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fnos-gateway-'))
    const gatewaySocket = join(directory, 'gateway.sock')
    const gateway = createGateway({
      socketPath: gatewaySocket,
      gatewayPrefix: GATEWAY_PREFIX,
      upstreamHost: '127.0.0.1',
      upstreamPort: 1,
      webProcess: {
        snapshot: async () => { throw new Error('boom') },
        start: async () => { throw new Error('boom') },
        restart: async () => { throw new Error('boom') },
        stop: async () => undefined,
      } as never,
    })
    await once(gateway.server, 'listening')
    resources.push(async () => gateway.close())
    resources.push(async () => rm(directory, { recursive: true, force: true }))
    const request = (path: string, method: string) => new Promise<{ statusCode: number | undefined, body: string }>((resolve, reject) => {
      const req = httpRequest({ socketPath: gatewaySocket, path, method, headers: { 'x-requested-with': 'fetch', 'x-trim-isadmin': 'true' } }, res => {
        const chunks: Buffer[] = []
        res.on('data', chunk => chunks.push(Buffer.from(chunk)))
        res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks).toString() }))
        res.on('error', reject)
      })
      req.on('error', reject)
      req.end()
    })
    await expect(request('/__fnos-gateway/control/web/status', 'GET')).resolves.toEqual({ statusCode: 503, body: '{"error":"web-control-failed"}' })
    await expect(request('/__fnos-gateway/control/web/start', 'POST')).resolves.toEqual({ statusCode: 503, body: '{"error":"web-control-failed"}' })
  })

  it('returns one HTML recovery response when the upstream connection fails', async () => {
    const upstream = createServer((_req, res) => {
      res.socket?.destroy()
    })
    const upstreamPort = await listen(upstream)
    resources.push(async () => new Promise<void>(resolve => upstream.close(() => resolve())))

    const directory = await mkdtemp(join(tmpdir(), 'fnos-gateway-'))
    const gatewaySocket = join(directory, 'gateway.sock')
    const webProcess = {
      snapshot: async () => ({ state: 'stopped' as const }),
      start: async () => ({ state: 'running' as const, pid: process.pid }),
      restart: async () => ({ state: 'running' as const, pid: process.pid }),
      stop: async () => undefined,
    }
    const gateway = createGateway({
      socketPath: gatewaySocket,
      gatewayPrefix: GATEWAY_PREFIX,
      upstreamHost: '127.0.0.1',
      upstreamPort,
      webProcess: webProcess as never,
    })
    await once(gateway.server, 'listening')
    resources.push(async () => gateway.close())
    resources.push(async () => rm(directory, { recursive: true, force: true }))

    const response = await new Promise<{ statusCode: number | undefined, headers: Record<string, string | string[] | undefined>, body: string }>((resolve, reject) => {
      const request = httpRequest({
        socketPath: gatewaySocket,
        path: `${GATEWAY_PREFIX}/`,
        method: 'GET',
        headers: { accept: 'text/html' },
      }, res => {
        const chunks: Buffer[] = []
        res.on('data', chunk => chunks.push(Buffer.from(chunk)))
        res.on('end', () => resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        }))
        res.on('error', reject)
      })
      request.on('error', reject)
      request.end()
    })

    expect(response.statusCode).toBe(503)
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8')
    expect(response.body).toContain('DSH Web 未运行')
  })
})
