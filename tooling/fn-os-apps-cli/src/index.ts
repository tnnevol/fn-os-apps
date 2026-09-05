import { CommanderError } from 'commander'
import { normalizeArgs } from './core/args.js'
import { program } from './program.js'
import './commands/build.js'
import './commands/build-gateway.js'
import './commands/check.js'
import './commands/help.js'
import './commands/publish.js'
import './commands/release-notes.js'
import './commands/start.js'
import './commands/version.js'

const rawArgs = process.argv.slice(2)
const argv = normalizeArgs(rawArgs.length === 0 ? ['build'] : rawArgs)

try {
  await program.parseAsync([process.execPath, process.argv[1] ?? 'fn-apps-cli', ...argv])
} catch (error) {
  if (error instanceof CommanderError && ['commander.helpDisplayed', 'commander.version'].includes(error.code)) {
    process.exitCode = error.exitCode
  } else {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = error instanceof CommanderError ? error.exitCode : 1
  }
}
