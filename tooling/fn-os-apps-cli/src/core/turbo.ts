import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { dshHomeDirectory, repositoryRoot } from '../config/paths.js'
import { runCommand } from './process.js'

/**
 * Task name of the repository-root row that runs the local DSH Web inside
 * Turbo, so it shares one TUI with the plugin and docs dev tasks.
 *
 * A root task (`//#`) is the right home: DSH Web belongs to no workspace
 * package, so it cannot be an ordinary package task, and starting it as a
 * second foreground process outside Turbo would cost the terminal UI.
 */
export const DEV_WEB_TASK = '//#dev:web'

function turboBinary(): string | undefined {
  const binary = join(repositoryRoot, 'node_modules', '.bin', 'turbo')
  return existsSync(binary) ? binary : undefined
}

function turboArgs(mode: 'run' | 'watch', tasks: string[], filters: string[]): string[] {
  return ['exec', 'turbo', mode, ...tasks, ...filters.map(filter => `--filter=${filter}`)]
}

function turboCommand(mode: 'run' | 'watch', tasks: string[], filters: string[]): [string, string[]] {
  const binary = turboBinary()
  if (binary !== undefined) return [binary, [mode, ...tasks, ...filters.map(filter => `--filter=${filter}`)]]
  return ['pnpm', turboArgs(mode, tasks, filters)]
}

/**
 * Resolve the repository-local DSH CLI so setup steps always run the exact
 * version this checkout pins instead of whatever install happens to be first
 * on the caller's `PATH`.
 */
export function resolveDshBinary(): string {
  const localBinary = join(repositoryRoot, 'node_modules', '.bin', 'dsh')
  if (!existsSync(localBinary)) {
    throw new Error('DSH CLI is missing; run `pnpm install` at the repository root first')
  }
  return localBinary
}

/**
 * Environment for a dev run that boots this checkout's own DSH.
 *
 * `DSH_HOME` is pinned to `<repo>/.dsh`; `turbo.json` declares it under
 * `passThroughEnv` so Turbo's strict env mode lets the task see it. The
 * caller's session identity is dropped so the local instance is a clean
 * process instead of a nested view of the session that launched it. `HOME`
 * stays untouched: tool caches keep working while every profile, credential
 * and session belongs to this checkout.
 */
export function devEnvironment(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, DSH_HOME: dshHomeDirectory }
  delete env.DSH_SESSION_ID
  delete env.DSH_SHELL
  delete env.DSH_WEB_URL
  return env
}

/** Run the repository-local DSH CLI directly, for setup that precedes boot. */
export function runRepoDsh(args: string[]): Promise<void> {
  return runCommand(resolveDshBinary(), args, repositoryRoot, { env: devEnvironment() })
}

export async function runTurbo(tasks: string[], filters: string[]): Promise<void> {
  const [command, args] = turboCommand('run', tasks, filters)
  await runCommand(command, args, repositoryRoot)
}

export type TurboWatchOptions = {
  /** Environment for the Turbo process; declared vars reach the tasks. */
  env?: NodeJS.ProcessEnv
}

export async function runTurboWatch(tasks: string[], filters: string[], options: TurboWatchOptions = {}): Promise<void> {
  const [command, args] = turboCommand('watch', tasks, filters)
  await runCommand(command, args, repositoryRoot, options.env === undefined ? {} : { env: options.env })
}
