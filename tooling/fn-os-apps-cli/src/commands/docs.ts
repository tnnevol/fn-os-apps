import { repositoryRoot } from '../config/paths.js'
import { runCommand } from '../core/process.js'

export function runDocsBuild(): Promise<void> {
  return runCommand('pnpm', ['exec', 'vitepress', 'build', 'docs'], repositoryRoot)
}

export function runDocsDev(): Promise<void> {
  return runCommand('pnpm', ['exec', 'vitepress', 'dev', 'docs'], repositoryRoot)
}
