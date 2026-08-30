import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { once } from 'node:events'
import { createConnection, type Socket } from 'node:net'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { createGateway } from '../src/server.ts'
import { PATH_ALLOWLIST_EVENTS_PATH, PathAllowlistStore } from '../src/path-allowlist.ts'

const GATEWAY_PREFIX = '/app/fn-deepseek-harness'

function waitForData(socket: Socket, ...expected: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    const onData = (chunk: Buffer): void => {
      body += chunk.toString('utf8')
      if (!expected.every(value => body.includes(value))) {
        return
      }
      cleanup()
      resolve(body)
    }
    const onError = (error: Error): void => {
      cleanup()
      reject(error)
    }
    const cleanup = (): void => {
      socket.off('data', onData)
      socket.off('error', onError)
    }
    socket.on('data', onData)
    socket.once('error', onError)
  })
}

describe('path allowlist event stream', () => {
  const cleanup: Array<() => Promise<void>> = []

  afterEach(async () => {
    while (cleanup.length > 0) await cleanup.pop()?.()
  })

  it('keeps the SSE connection alive while the allowlist is unchanged', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fnos-gateway-events-'))
    cleanup.push(async () => rm(directory, { recursive: true, force: true }))
    const filePath = join(directory, 'path-allowlist.json')
    await writeFile(filePath, JSON.stringify({ version: 1, paths: ['/plugin-api'] }))

    const gateway = createGateway({
      socketPath: join(directory, 'gateway.sock'),
      gatewayPrefix: GATEWAY_PREFIX,
      upstreamHost: '127.0.0.1',
      upstreamPort: 1,
      pathAllowlist: new PathAllowlistStore(filePath),
      sseKeepaliveInterval: 10,
    })
    await once(gateway.server, 'listening')
    cleanup.push(async () => gateway.close())

    const client = createConnection(join(directory, 'gateway.sock'))
    cleanup.push(async () => {
      if (!client.destroyed) client.destroy()
    })
    await once(client, 'connect')
    const data = waitForData(client, 'HTTP/1.1 200', 'event: paths', ': fnos-gateway path allowlist keep-alive')
    client.write([
      `GET ${GATEWAY_PREFIX}${PATH_ALLOWLIST_EVENTS_PATH} HTTP/1.1`,
      'Host: fnos-gateway.test',
      'Connection: keep-alive',
      '',
      '',
    ].join('\r\n'))

    const rawResponse = await data
    expect(rawResponse).toContain('content-type: text/event-stream')
  })
})
