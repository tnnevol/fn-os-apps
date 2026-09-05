import { join } from 'node:path'
import { repositoryRoot } from '../config/paths.js'
import { runCommand } from '../core/process.js'

const docsRoot = join(repositoryRoot, 'docs')

export function runDocsBuild(): Promise<void> {
  return runCommand('pnpm', ['exec', 'vitepress', 'build'], docsRoot)
}
