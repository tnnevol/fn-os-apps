import { createServer } from 'node:http'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { WebProcessController } from '../src/server/web-process.ts'

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch { return false }
}

describe('DSH web process lifecycle', () => {
  it('captures the launch token and accepts the tokenized startup response as healthy', async () => {
    const token = 'launch-token'
    const probe = createServer((req, res) => {
      if (req.url !== `/?token=${token}`) {
        res.writeHead(401)
        res.end()
        return
      }
      res.writeHead(303, { location: '/' })
      res.end()
    })
    probe.listen(0, '127.0.0.1')
    await once(probe, 'listening')
    const address = probe.address()
    if (address === null || typeof address === 'string') throw new Error('probe did not bind to a TCP port')

    const directory = await mkdtemp(join(tmpdir(), 'fnos-web-process-'))
    const script = `console.log('dsh web: http://127.0.0.1:${address.port}/?token=${token}'); setInterval(() => {}, 1000)`
    const controller = new WebProcessController({
      command: process.execPath,
      args: ['-e', script, 'web'],
      cwd: directory,
      pidFile: join(directory, 'web.pid'),
      startingPidFile: join(directory, 'web.starting.pid'),
      lockFile: join(directory, 'web.lock'),
      healthUrl: `http://127.0.0.1:${address.port}/`,
      healthTimeoutMs: 1_000,
      terminationTimeoutMs: 50,
    })

    try {
      await expect(controller.start()).resolves.toMatchObject({ state: 'running' })
      expect(controller.getLaunchToken()).toBe(token)
    } finally {
      await controller.stop()
      await rm(directory, { recursive: true, force: true })
      await new Promise<void>(resolve => probe.close(() => resolve()))
    }
  })

  it('force-cleans a child that ignores graceful termination after startup failure', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fnos-web-process-'))
    const marker = join(directory, 'child.pid')
    const script = `require('node:fs').writeFileSync(${JSON.stringify(marker)}, String(process.pid)); process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)`
    const controller = new WebProcessController({
      command: process.execPath,
      args: ['-e', script, 'web'],
      cwd: directory,
      pidFile: join(directory, 'web.pid'),
      startingPidFile: join(directory, 'web.starting.pid'),
      lockFile: join(directory, 'web.lock'),
      healthUrl: 'http://127.0.0.1:1/',
      healthTimeoutMs: 30,
      terminationTimeoutMs: 50,
    })

    try {
      await expect(controller.start()).resolves.toMatchObject({ state: 'error' })
      const pid = Number.parseInt(await readFile(marker, 'utf8'), 10)
      await vi.waitFor(() => { expect(isAlive(pid)).toBe(false) })
    } finally {
      await controller.stop()
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('force-cleans descendants in the DSH Web process group', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'fnos-web-process-'))
    const marker = join(directory, 'children.pid')
    const script = [
      `const { spawn } = require('node:child_process')`,
      `const fs = require('node:fs')`,
      `const child = spawn(process.execPath, ['-e', ${JSON.stringify("process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)")}], { stdio: 'ignore' })`,
      `fs.writeFileSync(${JSON.stringify(marker)}, JSON.stringify([process.pid, child.pid]))`,
      `process.on('SIGTERM', () => {})`,
      `setInterval(() => {}, 1000)`,
    ].join(';')
    const controller = new WebProcessController({
      command: process.execPath,
      args: ['-e', script, 'web'],
      cwd: directory,
      pidFile: join(directory, 'web.pid'),
      startingPidFile: join(directory, 'web.starting.pid'),
      lockFile: join(directory, 'web.lock'),
      healthUrl: 'http://127.0.0.1:1/',
      healthTimeoutMs: 30,
      terminationTimeoutMs: 50,
    })

    try {
      await expect(controller.start()).resolves.toMatchObject({ state: 'error' })
      const [pid, childPid] = JSON.parse(await readFile(marker, 'utf8')) as [number, number]
      await vi.waitFor(() => {
        expect(isAlive(pid)).toBe(false)
        expect(isAlive(childPid)).toBe(false)
      })
    } finally {
      await controller.stop()
      await rm(directory, { recursive: true, force: true })
    }
  })
})
