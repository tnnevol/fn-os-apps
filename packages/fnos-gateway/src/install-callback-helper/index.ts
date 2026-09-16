#!/usr/bin/env node

import { Command, CommanderError } from 'commander'
import {
  bundledPluginVersion,
  packageField,
  persistPnpmStoreDir,
  profileDependencyVersion,
  profileStoreDir,
  publishedPlugins,
  removeLegacyPnpmStoreConfig,
} from './common.ts'
import { patchDshAttachmentLocal } from './attachment-patch.ts'
import { createLogger, InstallHelperError } from './logger.ts'
import { prepareNodePty } from './node-pty.ts'

const logger = createLogger('install-callback-helper')

export function createProgram(): Command {
  const program = new Command()
    .name('install-callback-helper')
    .description('Run DeepSeek Harness install callback helper operations')
    .exitOverride()
    .configureOutput({
      writeErr: message => logger.error(message.trimEnd()),
    })

  program
    .command('remove-legacy-pnpm-store-config')
    .description('Remove the legacy pnpm store-dir entry from an npm config file')
    .argument('<config-path>')
    .action(removeLegacyPnpmStoreConfig)

  program
    .command('persist-pnpm-store-dir')
    .description('Persist the pnpm store path and remove the legacy npm config entry')
    .argument('<config-path>')
    .argument('<store-path>')
    .argument('<store-file>')
    .action(persistPnpmStoreDir)

  program
    .command('package-version')
    .description('Read a package.json version')
    .argument('<package-path>')
    .action(path => packageField(path, 'version'))

  program
    .command('profile-dependency-version')
    .description('Read a dependency version from a profile package manifest')
    .argument('<manifest-path>')
    .argument('<package-name>')
    .action(profileDependencyVersion)

  program
    .command('profile-store-dir')
    .description('Read the pnpm store directory from profile metadata')
    .argument('<metadata-path>')
    .action(profileStoreDir)

  program
    .command('published-plugins')
    .description('Print published plugins as tab-separated name and version rows')
    .argument('<manifest-path>')
    .action(publishedPlugins)

  program
    .command('bundled-plugin-version')
    .description('Read a bundled plugin version from the plugin manifest')
    .argument('<manifest-path>')
    .argument('<package-name>')
    .action(bundledPluginVersion)

  program
    .command('prepare-node-pty')
    .description('Prepare node-pty lifecycle scripts and native files')
    .action(prepareNodePty)

  program
    .command('patch-attachment-local')
    .description('Apply the fnOS attachment-local persistence patch')
    .action(patchDshAttachmentLocal)

  return program
}

export async function main(argv: string[] = process.argv): Promise<void> {
  await createProgram().parseAsync(argv)
}

main().catch((error: unknown) => {
  if (error instanceof CommanderError) {
    process.exitCode = error.exitCode
    return
  }
  if (error instanceof InstallHelperError) {
    createLogger(error.scope).error(error.message)
    process.exitCode = 1
    return
  }
  logger.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
