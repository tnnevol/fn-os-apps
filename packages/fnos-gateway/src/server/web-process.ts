import { open, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { spawn, type ChildProcess } from 'node:child_process'

export const WEB_CONTROL_STATUS_PATH = '/__fnos-gateway/control/web/status'
export const WEB_CONTROL_START_PATH = '/__fnos-gateway/control/web/start'
export const WEB_CONTROL_RESTART_PATH = '/__fnos-gateway/control/web/restart'
const DEFAULT_HEALTH_TIMEOUT_MS = 120_000

export interface WebProcessOptions {
  command: string
  env?: NodeJS.ProcessEnv
  args: string[]
  cwd: string
  pidFile: string
  startingPidFile: string
  lockFile: string
  launchTokenFile?: string
  healthUrl: string
  healthTimeoutMs?: number
  terminationTimeoutMs?: number
  /** DSH's provider-managed credential writer lock, recovered only when stale. */
  credentialsLockFile?: string
  credentialsLockWaitMs?: number
}

export interface WebProcessSnapshot { state: 'running' | 'starting' | 'stopped' | 'error', pid?: number, error?: string }

async function readPid(file: string): Promise<number | undefined> {
  try { const pid = Number.parseInt((await readFile(file, 'utf8')).trim(), 10); return Number.isInteger(pid) && pid > 1 ? pid : undefined } catch { return undefined }
}
function alive(pid: number): boolean { try { process.kill(pid, 0); return true } catch { return false } }

function delay(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)) }

async function waitForFileRemoval(file: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try { await readFile(file, 'utf8') } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true
    }
    await delay(100)
  }
  return false
}

/**
 * DSH records its writer PID in `<credentials>.lock` and deliberately leaves
 * orphan recovery to its operator. The fnOS gateway is that operator for its
 * own private DSH home: recover only a lock whose recorded PID is no longer
 * alive. A live writer is never interrupted or unlocked by a Web start.
 */
async function recoverCredentialsLock(lockFile: string, waitMs: number): Promise<void> {
  let owner: number | undefined
  try { owner = await readPid(lockFile) } catch {}
  if (owner === undefined) {
    try { await readFile(lockFile, 'utf8') } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    throw new Error(`DSH credentials writer lock has no valid PID: ${lockFile}`)
  }
  if (alive(owner)) {
    if (await waitForFileRemoval(lockFile, waitMs)) return
    throw new Error(`DSH credentials writer lock is still held by PID ${String(owner)}`)
  }

  // Rename claims this exact stale directory entry without touching a new
  // lock a concurrent writer might create at the original pathname.
  const quarantine = `${lockFile}.stale-${String(process.pid)}-${String(Date.now())}`
  try { await rename(lockFile, quarantine) } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
    throw error
  }
  await rm(quarantine, { force: true })
  console.warn(`[fnos-gateway] Recovered stale DSH credentials writer lock held by exited PID ${String(owner)}`)
}

export async function isDshWebProcess(pid: number, command: string, port?: number): Promise<boolean> {
  if (!alive(pid)) return false
  try {
    const cmdline = await readFile(`/proc/${pid}/cmdline`, 'utf8')
    const args = cmdline.split('\0')
    const commandCandidates = new Set([command])
    try { commandCandidates.add(await realpath(command)) } catch {}
    if (![...commandCandidates].some(candidate => cmdline.includes(candidate)) || !args.includes('web')) return false
    if (port === undefined) return true
    const portIndex = args.indexOf('--port')
    return portIndex >= 0 && args[portIndex + 1] === String(port)
  }
  catch {
    // A port-scoped orphan scan must fail closed when /proc cannot be read.
    return port === undefined
  }
}

async function findDshWebProcesses(command: string, port: number): Promise<number[]> {
  let entries: string[]
  try { entries = await readdir('/proc') } catch { return [] }
  const pids: number[] = []
  for (const entry of entries) {
    if (!/^\d+$/u.test(entry)) continue
    const pid = Number.parseInt(entry, 10)
    if (pid > 1 && await isDshWebProcess(pid, command, port)) pids.push(pid)
  }
  return pids
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

async function signalChildProcessGroup(child: ChildProcess, signal: NodeJS.Signals): Promise<void> {
  if (child.pid === undefined) {
    try { child.kill(signal) } catch {}
    return
  }
  // This child was created by this controller, so its detached process group
  // can be terminated without a second command-line identity check.
  try { process.kill(-child.pid, signal) } catch {
    try { process.kill(child.pid, signal) } catch { try { child.kill(signal) } catch {} }
  }
}

async function terminateChild(child: ChildProcess, timeoutMs = 10_000): Promise<void> {
  await signalChildProcessGroup(child, 'SIGTERM')
  // Reap the child-process handle as well as terminating the OS process. This
  // prevents a failed health check from leaving a detached child around.
  await waitForChildExit(child, Math.min(timeoutMs, 1_000))
  if (child.exitCode === null && child.signalCode === null) {
    await signalChildProcessGroup(child, 'SIGKILL')
    await waitForChildExit(child, 1_000)
  }
}

export class WebProcessController {
  private starting: Promise<WebProcessSnapshot> | undefined
  private restarting: Promise<WebProcessSnapshot> | undefined
  private child: ChildProcess | undefined
  private lastError: string | undefined
  private launchToken: string | undefined
  private launchGeneration = 0
  private tokenWriteSequence = 0
  private launchTokenPersistence: Promise<void> | undefined
  private outputBuffer = ''
  private stopping = false
  constructor(readonly options: WebProcessOptions) {}

  /** Return the current DSH process token captured from its startup URL. */
  getLaunchToken(): string | undefined {
    return this.launchToken
  }

  /** Wait for the startup URL token when the iframe races DSH Web startup. */
  async waitForLaunchToken(timeoutMs = 15_000): Promise<string | undefined> {
    if (this.launchToken !== undefined) return this.launchToken
    if (this.starting === undefined) return undefined
    const deadline = Date.now() + timeoutMs
    while (this.launchToken === undefined && this.starting !== undefined && Date.now() < deadline) {
      await delay(Math.min(100, Math.max(1, deadline - Date.now())))
    }
    return this.launchToken
  }

  async snapshot(): Promise<WebProcessSnapshot> {
    await this.restoreLaunchToken()
    if (this.starting !== undefined) return { state: 'starting' }
    return await this.currentSnapshot()
  }

  private async currentSnapshot(): Promise<WebProcessSnapshot> {
    const pid = await readPid(this.options.pidFile)
    if (pid !== undefined && await isDshWebProcess(pid, this.options.command)) return { state: 'running', pid }
    return this.lastError === undefined ? { state: 'stopped' } : { state: 'error', error: this.lastError }
  }

  async start(): Promise<WebProcessSnapshot> {
    if (this.stopping) return { state: 'error', error: 'DSH Web stop is in progress' }
    if (this.starting !== undefined) return await this.starting
    this.starting = (async () => {
      const current = await this.currentSnapshot()
      if (current.state === 'running') {
        await this.restoreLaunchToken()
        return current
      }
      return await this.startLocked()
    })().finally(() => { this.starting = undefined })
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
      const lockOwner = await readPid(this.options.lockFile)
      if (lockOwner !== undefined && alive(lockOwner)) {
        const released = await waitForFileRemoval(this.options.lockFile, (this.options.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS) + 5_000)
        if (!released) return { state: 'error', error: 'another DSH Web start is still in progress' }
        const current = await this.currentSnapshot()
        if (current.state === 'running') return current
        if (!retry) return { state: 'error', error: 'DSH Web start failed in another gateway' }
        return await this.startLocked(false)
      }
      const candidate = await readPid(this.options.startingPidFile)
      if (candidate !== undefined && alive(candidate)) return { state: 'starting', pid: candidate }
      if (!retry) return { state: 'error', error: 'stale DSH Web start lock' }
      await rm(this.options.lockFile, { force: true })
      return await this.startLocked(false)
    }
    let child: ChildProcess | undefined
    try {
      await lock.writeFile(String(process.pid))
      await rm(this.options.startingPidFile, { force: true })
      if (this.options.credentialsLockFile !== undefined) {
        await recoverCredentialsLock(this.options.credentialsLockFile, this.options.credentialsLockWaitMs ?? 35_000)
      }
      // The fnOS app can be restarted after its gateway has been killed or
      // its pid files have been removed. In that case an orphaned DSH Web
      // process may still own the configured port. Reconcile only processes
      // matching this executable, `web`, and this controller's port.
      const port = new URL(this.options.healthUrl).port
      const configuredPort = port === '' ? (new URL(this.options.healthUrl).protocol === 'https:' ? 443 : 80) : Number.parseInt(port, 10)
      for (const pid of await findDshWebProcesses(this.options.command, configuredPort)) {
        await terminatePid(pid, this.options.command, this.options.terminationTimeoutMs)
      }
      // Keep DSH Web in its own process group so shutdown also terminates
      // children started by the CLI instead of leaving a port-owning process
      // behind after the fnOS app has been stopped.
      // Finish any token write from the previous generation before removing
      // the file. Otherwise an old async rename could recreate a stale token
      // after the fresh generation has started.
      await this.launchTokenPersistence
      const generation = ++this.launchGeneration
      this.launchToken = undefined
      this.launchTokenPersistence = undefined
      this.outputBuffer = ''
      await rm(this.options.launchTokenFile ?? '', { force: true }).catch(() => undefined)
      const spawned = spawn(this.options.command, this.options.args, { cwd: this.options.cwd, env: this.options.env ?? process.env, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
      child = spawned
      this.child = spawned
      if (spawned.pid === undefined) throw new Error('DSH Web did not return a PID')
      spawned.stdout?.setEncoding('utf8')
      spawned.stdout?.on('data', chunk => this.forwardOutput('stdout', chunk, generation))
      spawned.stderr?.setEncoding('utf8')
      spawned.stderr?.on('data', chunk => this.forwardOutput('stderr', chunk, generation))
      await writeFile(this.options.startingPidFile, String(spawned.pid), { mode: 0o600 })
      spawned.once('exit', () => {
        if (this.child === spawned) this.child = undefined
        void readPid(this.options.pidFile)
          .then(current => current === spawned.pid ? rm(this.options.pidFile, { force: true }) : undefined)
          .catch(() => {
            // Child-exit cleanup is best effort; never turn a stale pid-file
            // failure into an unhandled rejection in the gateway process.
          })
      })
      const deadline = Date.now() + (this.options.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS)
      while (Date.now() < deadline) {
        if (this.stopping) throw new Error('DSH Web start cancelled')
        if (spawned.exitCode !== null) throw new Error(`DSH Web exited with code ${String(spawned.exitCode)}`)
        try {
          const response = await fetch(this.healthCheckUrl(), { redirect: 'manual', signal: AbortSignal.timeout(1_000) })
          if (response.ok || (response.status >= 300 && response.status < 400)) {
            await this.launchTokenPersistence
            await rename(this.options.startingPidFile, this.options.pidFile)
            this.lastError = undefined
            return { state: 'running', pid: spawned.pid }
          }
        } catch {}
        await delay(500)
      }
      throw new Error('DSH Web health check timed out')
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error)
      if (child !== undefined && this.child === child) {
        await terminateChild(child, this.options.terminationTimeoutMs)
        this.child = undefined
      }
      await rm(this.options.startingPidFile, { force: true })
      this.launchToken = undefined
      this.launchGeneration++
      await this.launchTokenPersistence
      this.launchTokenPersistence = undefined
      await rm(this.options.launchTokenFile ?? '', { force: true }).catch(() => undefined)
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
        await terminateChild(child, this.options.terminationTimeoutMs)
        this.child = undefined
      } else {
        const pid = await readPid(this.options.pidFile) ?? await readPid(this.options.startingPidFile)
        if (pid !== undefined) await terminatePid(pid, this.options.command, this.options.terminationTimeoutMs)
      }
      await Promise.all([rm(this.options.pidFile, { force: true }), rm(this.options.startingPidFile, { force: true }), rm(this.options.lockFile, { force: true })])
      this.launchToken = undefined
      this.launchGeneration++
      await this.launchTokenPersistence
      this.launchTokenPersistence = undefined
      this.outputBuffer = ''
      await rm(this.options.launchTokenFile ?? '', { force: true }).catch(() => undefined)
    } finally {
      this.stopping = false
    }
  }

  private healthCheckUrl(): string {
    if (this.launchToken === undefined) return this.options.healthUrl
    const url = new URL(this.options.healthUrl)
    url.searchParams.set('token', this.launchToken)
    return url.href
  }

  private async restoreLaunchToken(): Promise<void> {
    if (this.launchToken !== undefined || this.options.launchTokenFile === undefined) return
    try {
      const token = (await readFile(this.options.launchTokenFile, 'utf8')).trim()
      if (token !== '') this.launchToken = token
    } catch {}
  }

  private persistLaunchToken(token: string, generation: number): void {
    const tokenFile = this.options.launchTokenFile
    if (tokenFile === undefined) return
    const temporaryFile = `${tokenFile}.tmp-${process.pid}-${++this.tokenWriteSequence}`
    // Serialize writes so a delayed rename for an older startup line cannot
    // overwrite the token emitted by a newer line.
    const persistence = (this.launchTokenPersistence ?? Promise.resolve()).then(async () => {
      if (generation !== this.launchGeneration) return
      try {
        // Write and rename in the same directory so readers see either the
        // previous complete token or the new complete token, never a partial
        // value. The in-memory token changes only after the atomic replace.
        await writeFile(temporaryFile, token, { mode: 0o600 })
        await rename(temporaryFile, tokenFile)
        if (generation === this.launchGeneration) this.launchToken = token
      } catch {
        await rm(temporaryFile, { force: true }).catch(() => undefined)
      }
    })
    this.launchTokenPersistence = persistence
    void persistence
  }

  private forwardOutput(channel: 'stdout' | 'stderr', chunk: string, generation: number): void {
    process[channel].write(chunk)
    this.outputBuffer = (this.outputBuffer + chunk).slice(-8_192)
    for (const line of this.outputBuffer.split(/\r?\n/u)) {
      if (!/^dsh web:\s+/u.test(line.trim())) continue
      const candidates = line.match(/https?:\/\/[^\s)\]]+/gu) ?? []
      for (const candidate of candidates) {
        try {
          const token = new URL(candidate).searchParams.get('token')
          if (token !== null && token !== '') {
            this.persistLaunchToken(token, generation)
            break
          }
        } catch {}
      }
    }
  }
}
