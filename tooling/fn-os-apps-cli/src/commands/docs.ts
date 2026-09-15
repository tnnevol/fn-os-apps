import { join } from 'node:path'
import { repositoryRoot } from '../config/paths.js'
import { runCommand } from '../core/process.js'

const docsRoot = join(repositoryRoot, 'docs')

export function runDocsBuild(): Promise<void> {
  return runCommand('pnpm', ['exec', 'vitepress', 'build'], docsRoot)
}

/**
 * Start the VitePress dev server outside Turbo.
 *
 * The docs `dev` task is `interactive` so Turbo's TUI can hand it the keyboard
 * (`i` to interact, `Ctrl+z` to return), which is what keeps the server's own
 * shortcuts — `h` for help, `r` to restart — usable. Turbo refuses to run an
 * interactive task without a terminal UI, so when `start` has no TTY there is
 * no TUI to preserve and the server is spawned directly instead of failing the
 * whole command with "Cannot run interactive task without Terminal UI".
 */
export function runDocsDev(): Promise<void> {
  return runCommand('pnpm', ['exec', 'vitepress', 'dev'], docsRoot)
}
