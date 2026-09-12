import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { repositoryRoot } from '../config/paths.js'
import { runCommand } from './process.js'

function turboArgs(mode: 'run' | 'watch', task: string, filters: string[]): string[] {
  return ['exec', 'turbo', mode, task, ...filters.map(filter => `--filter=${filter}`)]
}

export async function runTurbo(task: string, filters: string[]): Promise<void> {
  const turboBinary = join(repositoryRoot, 'node_modules', '.bin', 'turbo')
  if (existsSync(turboBinary)) {
    await runCommand(turboBinary, ['run', task, ...filters.map(filter => `--filter=${filter}`)], repositoryRoot)
    return
  }
  await runCommand('pnpm', turboArgs('run', task, filters), repositoryRoot)
}

export async function runTurboWatch(task: string, filters: string[]): Promise<void> {
  const turboBinary = join(repositoryRoot, 'node_modules', '.bin', 'turbo')
  if (existsSync(turboBinary)) {
    await runCommand(turboBinary, ['watch', task, ...filters.map(filter => `--filter=${filter}`)], repositoryRoot)
    return
  }
  await runCommand('pnpm', turboArgs('watch', task, filters), repositoryRoot)
}
