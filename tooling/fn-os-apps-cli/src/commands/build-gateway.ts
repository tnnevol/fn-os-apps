import { program } from '../program.js'
import { runTurbo } from '../core/turbo.js'
import { readGatewayName } from '../config/workspace.js'

program
  .command('build:gateway')
  .description('Build the fnOS gateway application bundle')
  .action(async () => {
    const gatewayName = readGatewayName()
    if (gatewayName === undefined) throw new Error('Unable to resolve the fnOS Gateway package')
    await runTurbo('build:app', [gatewayName])
  })
