import { createServer } from 'node:http'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { WebProcessController } from '../src/server/web-process.ts'

function isAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch { return false }
}

describe('DSH web process lifecycle', () => {
  it('does not expose a public dsh CLI wrapper', async () => {
    // fnOS offers no root-free identity switch for a normal caller, so a
    // wrapper cannot hold the fixed application identity it must guarantee.
    const installCallback = await readFile(new URL('../../../apps/fn-deepseek-harness/cmd/install_callback', import.meta.url), 'utf8')
    const resource = await readFile(new URL('../../../apps/fn-deepseek-harness/config/resource', import.meta.url), 'utf8')
    expect(installCallback).not.toContain('setup_cli_wrapper')
    expect(installCallback).not.toContain('CLI_WRAPPER=')
    expect(resource).not.toContain('/bin/dsh')
    expect(resource).not.toContain('usr-local-linker')
  })

  it('coalesces concurrent starts that share the gateway lock', async () => {
    const probe = createServer((_req, res) => { res.writeHead(200); res.end() })
    probe.listen(0, '127.0.0.1')
    await once(probe, 'listening')
    const address = probe.address()
    if (address === null || typeof address === 'string') throw new Error('probe did not bind to a TCP port')

    const directory = await mkdtemp(join(tmpdir(), 'fnos-web-process-'))
    const counter = join(directory, 'starts')
    const runtimeHome = join(directory, 'dsh-home')
    await writeFile(counter, '0')
    const script = [
      `const fs = require('node:fs')`,
      `const file = ${JSON.stringify(counter)}`,
      `const count = Number(fs.readFileSync(file, 'utf8') || '0') + 1`,
      `fs.writeFileSync(file, String(count))`,
      `if (process.env.DSH_HOME !== ${JSON.stringify(runtimeHome)}) process.exit(2)`,
      `setInterval(() => {}, 1000)`,
    ].join(';')
    const options = {
      command: process.execPath,
      args: ['-e', script, 'web'],
      env: { ...process.env, DSH_HOME: runtimeHome },
      cwd: directory,
      pidFile: join(directory, 'web.pid'),
      startingPidFile: join(directory, 'web.starting.pid'),
      lockFile: join(directory, 'web.lock'),
      healthUrl: `http://127.0.0.1:${address.port}/`,
      healthTimeoutMs: 1_000,
      terminationTimeoutMs: 50,
    } satisfies ConstructorParameters<typeof WebProcessController>[0]
    const first = new WebProcessController(options)
    const second = new WebProcessController(options)

    try {
      await expect(Promise.all([first.start(), second.start()])).resolves.toEqual([
        expect.objectContaining({ state: 'running' }),
        expect.objectContaining({ state: 'running' }),
      ])
      expect(await readFile(counter, 'utf8')).toBe('1')
    } finally {
      await first.stop()
      await second.stop()
      await rm(directory, { recursive: true, force: true })
      await new Promise<void>(resolve => probe.close(() => resolve()))
    }
  })

  it('recovers an exited DSH credentials writer before starting Web', async () => {
    const probe = createServer((_req, res) => { res.writeHead(200); res.end() })
    probe.listen(0, '127.0.0.1')
    await once(probe, 'listening')
    const address = probe.address()
    if (address === null || typeof address === 'string') throw new Error('probe did not bind to a TCP port')

    const directory = await mkdtemp(join(tmpdir(), 'fnos-web-process-'))
    const lockFile = join(directory, '.credentials.yaml.lock')
    const completed = spawnSync(process.execPath, ['-e', ''], { encoding: 'utf8' })
    if (completed.pid === undefined) throw new Error('failed to allocate a stale lock owner PID')
    await writeFile(lockFile, `${String(completed.pid)}\n`)
    const controller = new WebProcessController({
      command: process.execPath,
      args: ['-e', 'setInterval(() => {}, 1000)', 'web'],
      cwd: directory,
      pidFile: join(directory, 'web.pid'),
      startingPidFile: join(directory, 'web.starting.pid'),
      lockFile: join(directory, 'web.lock'),
      credentialsLockFile: lockFile,
      healthUrl: `http://127.0.0.1:${address.port}/`,
      healthTimeoutMs: 1_000,
      terminationTimeoutMs: 50,
    })

    try {
      await expect(controller.start()).resolves.toMatchObject({ state: 'running' })
      await expect(readFile(lockFile, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await controller.stop()
      await rm(directory, { recursive: true, force: true })
      await new Promise<void>(resolve => probe.close(() => resolve()))
    }
  })

  it('waits for a live DSH credentials writer instead of deleting its lock', async () => {
    const probe = createServer((_req, res) => { res.writeHead(200); res.end() })
    probe.listen(0, '127.0.0.1')
    await once(probe, 'listening')
    const address = probe.address()
    if (address === null || typeof address === 'string') throw new Error('probe did not bind to a TCP port')

    const directory = await mkdtemp(join(tmpdir(), 'fnos-web-process-'))
    const lockFile = join(directory, '.credentials.yaml.lock')
    await writeFile(lockFile, `${String(process.pid)}\n`)
    const release = setTimeout(() => { void rm(lockFile, { force: true }) }, 50)
    const controller = new WebProcessController({
      command: process.execPath,
      args: ['-e', 'setInterval(() => {}, 1000)', 'web'],
      cwd: directory,
      pidFile: join(directory, 'web.pid'),
      startingPidFile: join(directory, 'web.starting.pid'),
      lockFile: join(directory, 'web.lock'),
      credentialsLockFile: lockFile,
      credentialsLockWaitMs: 1_000,
      healthUrl: `http://127.0.0.1:${address.port}/`,
      healthTimeoutMs: 1_000,
      terminationTimeoutMs: 50,
    })

    try {
      await expect(controller.start()).resolves.toMatchObject({ state: 'running' })
    } finally {
      clearTimeout(release)
      await controller.stop()
      await rm(directory, { recursive: true, force: true })
      await new Promise<void>(resolve => probe.close(() => resolve()))
    }
  })

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
    const script = `console.log('dsh web: [http://127.0.0.1:${address.port}/?token=${token}](http://127.0.0.1:${address.port}/?token=${token})'); setInterval(() => {}, 1000)`
    const controller = new WebProcessController({
      command: process.execPath,
      args: ['-e', script, 'web'],
      cwd: directory,
      pidFile: join(directory, 'web.pid'),
      startingPidFile: join(directory, 'web.starting.pid'),
      lockFile: join(directory, 'web.lock'),
      launchTokenFile: join(directory, 'web.token'),
      healthUrl: `http://127.0.0.1:${address.port}/`,
      healthTimeoutMs: 1_000,
      terminationTimeoutMs: 50,
    })

    try {
      const startup = controller.start()
      await expect(controller.waitForLaunchToken()).resolves.toBe(token)
      await expect(startup).resolves.toMatchObject({ state: 'running' })
      expect(controller.getLaunchToken()).toBe(token)
      expect(await readFile(join(directory, 'web.token'), 'utf8')).toBe(token)

      const restored = new WebProcessController({
        command: process.execPath,
        args: ['-e', script, 'web'],
        cwd: directory,
        pidFile: join(directory, 'web.pid'),
        startingPidFile: join(directory, 'web.starting.pid'),
        lockFile: join(directory, 'web-restored.lock'),
        launchTokenFile: join(directory, 'web.token'),
        healthUrl: `http://127.0.0.1:${address.port}/`,
      })
      await expect(restored.start()).resolves.toMatchObject({ state: 'running' })
      expect(restored.getLaunchToken()).toBe(token)
    } finally {
      await controller.stop()
      await rm(directory, { recursive: true, force: true })
      await new Promise<void>(resolve => probe.close(() => resolve()))
    }
  })

  it('replaces the persisted token after an internal restart', async () => {
    const probe = createServer((req, res) => {
      if (new URL(req.url ?? '/', 'http://localhost').searchParams.has('token')) {
        res.writeHead(303, { location: '/' })
      } else {
        res.writeHead(401)
      }
      res.end()
    })
    probe.listen(0, '127.0.0.1')
    await once(probe, 'listening')
    const address = probe.address()
    if (address === null || typeof address === 'string') throw new Error('probe did not bind to a TCP port')

    const directory = await mkdtemp(join(tmpdir(), 'fnos-web-process-'))
    const counter = join(directory, 'counter')
    await writeFile(counter, '0')
    const script = [
      `const fs = require('node:fs')`,
      `const file = ${JSON.stringify(counter)}`,
      `const count = Number(fs.readFileSync(file, 'utf8') || '0') + 1`,
      `fs.writeFileSync(file, String(count))`,
      `console.log('dsh web: http://127.0.0.1:${address.port}/?token=restart-' + count)`,
      `setInterval(() => {}, 1000)`,
    ].join(';')
    const options = {
      command: process.execPath,
      args: ['-e', script, 'web'],
      cwd: directory,
      pidFile: join(directory, 'web.pid'),
      startingPidFile: join(directory, 'web.starting.pid'),
      lockFile: join(directory, 'web.lock'),
      launchTokenFile: join(directory, 'web.token'),
      healthUrl: `http://127.0.0.1:${address.port}/`,
      healthTimeoutMs: 1_000,
      terminationTimeoutMs: 50,
    } satisfies ConstructorParameters<typeof WebProcessController>[0]
    const controller = new WebProcessController(options)

    try {
      await expect(controller.start()).resolves.toMatchObject({ state: 'running' })
      await expect(controller.waitForLaunchToken()).resolves.toBe('restart-1')
      expect(await readFile(options.launchTokenFile, 'utf8')).toBe('restart-1')

      await expect(controller.restart()).resolves.toMatchObject({ state: 'running' })
      await expect(controller.waitForLaunchToken()).resolves.toBe('restart-2')
      expect(controller.getLaunchToken()).toBe('restart-2')
      expect(await readFile(options.launchTokenFile, 'utf8')).toBe('restart-2')
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
