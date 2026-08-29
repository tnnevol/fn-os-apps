import { open, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { spawn, type ChildProcess } from 'node:child_process'

export const WEB_CONTROL_STATUS_PATH = '/__fnos-gateway/control/web/status'
export const WEB_CONTROL_START_PATH = '/__fnos-gateway/control/web/start'

export interface WebProcessOptions {
  command: string
  args: string[]
  cwd: string
  pidFile: string
  startingPidFile: string
  lockFile: string
  healthUrl: string
  healthTimeoutMs?: number
}

export interface WebProcessSnapshot { state: 'running' | 'starting' | 'stopped' | 'error', pid?: number, error?: string }

async function readPid(file: string): Promise<number | undefined> {
  try { const pid = Number.parseInt((await readFile(file, 'utf8')).trim(), 10); return Number.isInteger(pid) && pid > 1 ? pid : undefined } catch { return undefined }
}
function alive(pid: number): boolean { try { process.kill(pid, 0); return true } catch { return false } }

export async function isDshWebProcess(pid: number, command: string): Promise<boolean> {
  if (!alive(pid)) return false
  try { const cmdline = await readFile(`/proc/${pid}/cmdline`, 'utf8'); return cmdline.includes(command) && cmdline.split('\0').includes('web') }
  catch { return true }
}

export class WebProcessController {
  private starting: Promise<WebProcessSnapshot> | undefined
  private child: ChildProcess | undefined
  private lastError: string | undefined
  constructor(readonly options: WebProcessOptions) {}

  async snapshot(): Promise<WebProcessSnapshot> {
    if (this.starting !== undefined) return { state: 'starting' }
    const pid = await readPid(this.options.pidFile)
    if (pid !== undefined && await isDshWebProcess(pid, this.options.command)) return { state: 'running', pid }
    return this.lastError === undefined ? { state: 'stopped' } : { state: 'error', error: this.lastError }
  }

  async start(): Promise<WebProcessSnapshot> {
    if (this.starting !== undefined) return await this.starting
    const current = await this.snapshot()
    if (current.state === 'running') return current
    this.starting = this.startLocked().finally(() => { this.starting = undefined })
    return await this.starting
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
    try {
      await rm(this.options.startingPidFile, { force: true })
      const child = spawn(this.options.command, this.options.args, { cwd: this.options.cwd, env: process.env, stdio: 'inherit' })
      this.child = child
      if (child.pid === undefined) throw new Error('DSH Web did not return a PID')
      await writeFile(this.options.startingPidFile, String(child.pid), { mode: 0o600 })
      const deadline = Date.now() + (this.options.healthTimeoutMs ?? 30_000)
      while (Date.now() < deadline) {
        if (child.exitCode !== null) throw new Error(`DSH Web exited with code ${String(child.exitCode)}`)
        try { const response = await fetch(this.options.healthUrl); if (response.ok) { await rename(this.options.startingPidFile, this.options.pidFile); this.lastError = undefined; child.once('exit', () => { void readPid(this.options.pidFile).then(current => current === child.pid ? rm(this.options.pidFile, { force: true }) : undefined) }); return { state: 'running', pid: child.pid } } } catch {}
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      throw new Error('DSH Web health check timed out')
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      if (this.child?.pid !== undefined && await isDshWebProcess(this.child.pid, this.options.command)) this.child.kill('SIGTERM')
      await rm(this.options.startingPidFile, { force: true })
      return { state: 'error', error: this.lastError }
    } finally {
      await lock.close()
      await rm(this.options.lockFile, { force: true })
    }
  }

  async stop(): Promise<void> {
    const pid = await readPid(this.options.pidFile) ?? await readPid(this.options.startingPidFile)
    if (pid !== undefined && await isDshWebProcess(pid, this.options.command)) {
      try { process.kill(pid, 'SIGTERM') } catch {}
      const deadline = Date.now() + 10_000
      while (alive(pid) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 250))
      if (alive(pid) && await isDshWebProcess(pid, this.options.command)) {
        try { process.kill(pid, 'SIGKILL') } catch {}
      }
    }
    await Promise.all([rm(this.options.pidFile, { force: true }), rm(this.options.startingPidFile, { force: true }), rm(this.options.lockFile, { force: true })])
  }
}
