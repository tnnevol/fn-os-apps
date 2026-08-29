import { createServer, type Server } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { once } from 'node:events'
import { createConnection } from 'node:net'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { createGateway } from '../src/server.ts'

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
})
