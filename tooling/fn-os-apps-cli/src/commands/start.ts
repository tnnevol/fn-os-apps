import { program } from '../program.js'
import { runTurboWatch } from '../core/turbo.js'
import { runDocsDev } from './docs.js'

export async function runStart(): Promise<void> {
  // The docs `dev` task is `interactive`, so Turbo's TUI can hand it the
  // keyboard (`i` to interact, `Ctrl+z` to return) and the VitePress shortcuts
  // (`h` for help, `r` to restart) keep working. Turbo refuses to run an
  // interactive task without a terminal UI, so a TTY decides how docs runs:
  //   - with a TTY there is a TUI worth keeping, so docs joins the watch;
  //   - without one (CI, a pipe, a background job) there is no TUI to lose, so
  //     docs is spawned directly instead of failing the whole command.
  const hasTui = process.stdin.isTTY === true && process.stdout.isTTY === true
  await (hasTui ? runTurboWatch(['dev'], ['./docs']) : runDocsDev())
}

program
  .command('start')
  .description('Start the documentation dev server')
  .option('--docs', 'start the documentation dev server (the only target)')
  .action(async () => {
    await runStart()
  })
