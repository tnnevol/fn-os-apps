import { program } from '../program.js'
import { runTurbo } from '../core/turbo.js'

program
  .command('build:gateway')
  .description('Build the fnOS gateway application bundle')
  .action(async () => runTurbo('build:app', ['@tnnevol/fnos-gateway']))
