import { open, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { spawn, type ChildProcess } from 'node:child_process'

export const WEB_CONTROL_STATUS_PATH = '/__fnos-gateway/control/web/status'
export const WEB_CONTROL_START_PATH = '/__fnos-gateway/control/web/start'
export const WEB_CONTROL_RESTART_PATH = '/__fnos-gateway/control/web/restart'

export interface WebProcessOptions {
  command: string
  args: string[]
  cwd: string
  pidFile: string
  startingPidFile: string
  lockFile: string
  healthUrl: string
  healthTimeoutMs?: number
  terminationTimeoutMs?: number
}

export interface WebProcessSnapshot { state: 'running' | 'starting' | 'stopped' | 'error', pid?: number, error?: string }

async function readPid(file: string): Promise<number | undefined> {
  try { const pid = Number.parseInt((await readFile(file, 'utf8')).trim(), 10); return Number.isInteger(pid) && pid > 1 ? pid : undefined } catch { return undefined }
}
function alive(pid: number): boolean { try { process.kill(pid, 0); return true } catch { return false } }

function delay(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)) }

export async function isDshWebProcess(pid: number, command: string): Promise<boolean> {
  if (!alive(pid)) return false
  try { const cmdline = await readFile(`/proc/${pid}/cmdline`, 'utf8'); return cmdline.includes(command) && cmdline.split('\0').includes('web') }
  catch { return true }
}

async function waitForChildExit(child: ChildProcess, timeoutMs: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return
  await new Promise<void>(resolve => {
    const onExit = (): void => finish()
    const finish = (): void => {
      clearTimeout(timer)
      child.removeListener('exit', onExit)
      resolve()
    }
    const timer = setTimeout(finish, timeoutMs)
    child.once('exit', onExit)
  })
}

async function terminatePid(pid: number, command: string, timeoutMs = 10_000): Promise<void> {
  if (!await isDshWebProcess(pid, command)) return
  // A detached child owns a process group named after its PID. Sending to
  // the group works on both Linux (the NAS) and macOS (the development host).
  // Fall back to the PID for old processes that were not detached.
  try { process.kill(-pid, 'SIGTERM') } catch { try { process.kill(pid, 'SIGTERM') } catch {} }
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline && await isDshWebProcess(pid, command)) await delay(250)
  if (await isDshWebProcess(pid, command)) {
    try { process.kill(-pid, 'SIGKILL') } catch { try { process.kill(pid, 'SIGKILL') } catch {} }
  }
}

async function terminateChild(child: ChildProcess, command: string, timeoutMs = 10_000): Promise<void> {
  if (child.pid !== undefined) await terminatePid(child.pid, command, timeoutMs)
  else { try { child.kill('SIGTERM') } catch {} }
  // Reap the child-process handle as well as terminating the OS process. This
  // prevents a failed health check from leaving a detached child around.
  await waitForChildExit(child, 1_000)
}

export class WebProcessController {
  private starting: Promise<WebProcessSnapshot> | undefined
  private restarting: Promise<WebProcessSnapshot> | undefined
  private child: ChildProcess | undefined
  private lastError: string | undefined
  private stopping = false
  constructor(readonly options: WebProcessOptions) {}

  async snapshot(): Promise<WebProcessSnapshot> {
    if (this.starting !== undefined) return { state: 'starting' }
    const pid = await readPid(this.options.pidFile)
    if (pid !== undefined && await isDshWebProcess(pid, this.options.command)) return { state: 'running', pid }
    return this.lastError === undefined ? { state: 'stopped' } : { state: 'error', error: this.lastError }
  }

  async start(): Promise<WebProcessSnapshot> {
    if (this.stopping) return { state: 'error', error: 'DSH Web stop is in progress' }
    if (this.starting !== undefined) return await this.starting
    const current = await this.snapshot()
    if (current.state === 'running') return current
    this.starting = this.startLocked().finally(() => { this.starting = undefined })
    return await this.starting
  }

  async restart(): Promise<WebProcessSnapshot> {
    if (this.restarting !== undefined) return await this.restarting
    const operation = (async (): Promise<WebProcessSnapshot> => {
      await this.stop()
      return await this.start()
    })()
    this.restarting = operation.finally(() => { this.restarting = undefined })
    return await this.restarting
  }

  private async startLocked(retry = true): Promise<WebProcessSnapshot> {
    let lock: Awaited<ReturnType<typeof open>> | undefined
    try { lock = await open(this.options.lockFile, 'wx', 0o600) }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      const candidate = await readPid(this.options.startingPidFile)
      if (candidate !== undefined && await isDshWebProcess(candidate, this.options.command)) return { state: 'starting', pid: candidate }
      if (!retry) return { state: 'error', error: 'stale DSH Web start lock' }
      await rm(this.options.lockFile, { force: true })
      return await this.startLocked(false)
    }
    let child: ChildProcess | undefined
    try {
      await rm(this.options.startingPidFile, { force: true })
      // Keep DSH Web in its own process group so shutdown also terminates
      // children started by the CLI instead of leaving a port-owning process
      // behind after the fnOS app has been stopped.
      const spawned = spawn(this.options.command, this.options.args, { cwd: this.options.cwd, env: process.env, stdio: 'inherit', detached: true })
      child = spawned
      this.child = spawned
      if (spawned.pid === undefined) throw new Error('DSH Web did not return a PID')
      await writeFile(this.options.startingPidFile, String(spawned.pid), { mode: 0o600 })
      spawned.once('exit', () => {
        if (this.child === spawned) this.child = undefined
        void readPid(this.options.pidFile).then(current => current === spawned.pid ? rm(this.options.pidFile, { force: true }) : undefined)
      })
      const deadline = Date.now() + (this.options.healthTimeoutMs ?? 30_000)
      while (Date.now() < deadline) {
        if (this.stopping) throw new Error('DSH Web start cancelled')
        if (spawned.exitCode !== null) throw new Error(`DSH Web exited with code ${String(spawned.exitCode)}`)
        try { const response = await fetch(this.options.healthUrl, { signal: AbortSignal.timeout(1_000) }); if (response.ok) { await rename(this.options.startingPidFile, this.options.pidFile); this.lastError = undefined; return { state: 'running', pid: spawned.pid } } } catch {}
        await delay(500)
      }
      throw new Error('DSH Web health check timed out')
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      if (child !== undefined && this.child === child) {
        await terminateChild(child, this.options.command, this.options.terminationTimeoutMs)
        this.child = undefined
      }
      await rm(this.options.startingPidFile, { force: true })
      return { state: 'error', error: this.lastError }
    } finally {
      await lock.close()
      await rm(this.options.lockFile, { force: true })
    }
  }

  async stop(): Promise<void> {
    this.stopping = true
    try {
      const starting = this.starting
      if (starting !== undefined) await starting.catch(() => undefined)
      const child = this.child
      if (child !== undefined) {
        await terminateChild(child, this.options.command, this.options.terminationTimeoutMs)
        this.child = undefined
      } else {
        const pid = await readPid(this.options.pidFile) ?? await readPid(this.options.startingPidFile)
        if (pid !== undefined) await terminatePid(pid, this.options.command, this.options.terminationTimeoutMs)
      }
      await Promise.all([rm(this.options.pidFile, { force: true }), rm(this.options.startingPidFile, { force: true }), rm(this.options.lockFile, { force: true })])
    } finally {
      this.stopping = false
    }
  }
}
