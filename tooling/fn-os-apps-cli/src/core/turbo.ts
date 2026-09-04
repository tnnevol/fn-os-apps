import { repositoryRoot } from '../config/paths.js'
import { runCommand } from './process.js'

function turboArgs(mode: 'run' | 'watch', task: string, filters: string[]): string[] {
  return ['exec', 'turbo', mode, task, ...filters.map(filter => `--filter=${filter}`)]
}

export async function runTurbo(task: string, filters: string[]): Promise<void> {
  await runCommand('pnpm', turboArgs('run', task, filters), repositoryRoot)
}

export async function runTurboWatch(task: string, filters: string[]): Promise<void> {
  await runCommand('pnpm', turboArgs('watch', task, filters), repositoryRoot)
}
