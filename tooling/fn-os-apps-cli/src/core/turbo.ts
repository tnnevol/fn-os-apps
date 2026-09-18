import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { repositoryRoot } from '../config/paths.js'
import { runCommand } from './process.js'

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
 * Run one `turbo watch` for the given tasks.
 *
 * Only `start` uses this: the docs `dev` task is `interactive`, so it needs
 * Turbo's TUI to receive the keyboard.
 */
export async function runTurboWatch(tasks: string[], filters: string[]): Promise<void> {
  const [command, args] = turboCommand('watch', tasks, filters)
  await runCommand(command, args, repositoryRoot)
}
