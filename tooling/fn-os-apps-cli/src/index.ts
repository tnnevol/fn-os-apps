import { runBuild } from './commands/build.js'
import { runCheck } from './commands/check.js'
import { runReleaseNotes } from './commands/release-notes.js'
import { runStart } from './commands/start.js'
import { runVersion } from './commands/version.js'
import { normalizeArgs } from './core/args.js'
import { runTurbo } from './core/turbo.js'

type Command = (args: string[]) => Promise<void>

function showHelp(): void {
  console.log(`fnos-apps — fn-os-apps repository CLI

Commands:
  build             Select plugins, FPK applications, or documentation to build
  build:gateway     Build the fnOS gateway application bundle
  check             Select SDD, docs, packages, or plugins to validate
  release:notes     Generate and publish GitHub release notes
  start             Start plugin watch and/or the documentation dev server
  version           Version the project/FPK area or one DSH plugin

Examples:
  fnos-apps build
  fnos-apps build --fpk --app fn-deepseek-harness
  fnos-apps build --plugin fnos
  fnos-apps build --docs
  fnos-apps check --all
  fnos-apps check --sdd --plugins
  fnos-apps version project patch
`)
}

const commands: Record<string, Command> = {
  build: runBuild,
  'build:gateway': () => runTurbo('build:app', ['@tnnevol/fnos-gateway']),
  check: runCheck,
  help: async () => showHelp(),
  'release:notes': runReleaseNotes,
  start: runStart,
  version: runVersion,
}

const [name = 'build', ...rawArgs] = process.argv.slice(2)
const command = name === '--help' || name === '-h' ? commands.help : commands[name]

if (command === undefined) {
  console.error(`Unknown fnos-apps command: ${name}`)
  showHelp()
  process.exitCode = 1
} else {
  await command(normalizeArgs(rawArgs)).catch(error => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
