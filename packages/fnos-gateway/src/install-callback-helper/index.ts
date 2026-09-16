#!/usr/bin/env node

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
import { prepareNodePty } from './node-pty.ts'

function requiredArgument(args: string[], index: number, name: string): string {
  const value = args[index]
  if (!value) throw new Error(`${name} is required`)
  return value
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const [command, ...commandArgs] = args
  switch (command) {
    case 'remove-legacy-pnpm-store-config':
      await removeLegacyPnpmStoreConfig(requiredArgument(commandArgs, 0, 'config path'))
      break
    case 'persist-pnpm-store-dir':
      await persistPnpmStoreDir(
        requiredArgument(commandArgs, 0, 'config path'),
        requiredArgument(commandArgs, 1, 'store path'),
        requiredArgument(commandArgs, 2, 'store-file path'),
      )
      break
    case 'package-version':
      await packageField(requiredArgument(commandArgs, 0, 'package path'), 'version')
      break
    case 'profile-dependency-version':
      await profileDependencyVersion(
        requiredArgument(commandArgs, 0, 'profile manifest path'),
        requiredArgument(commandArgs, 1, 'package name'),
      )
      break
    case 'profile-store-dir':
      await profileStoreDir(requiredArgument(commandArgs, 0, 'pnpm metadata path'))
      break
    case 'published-plugins':
      await publishedPlugins(requiredArgument(commandArgs, 0, 'plugin manifest path'))
      break
    case 'bundled-plugin-version':
      await bundledPluginVersion(
        requiredArgument(commandArgs, 0, 'plugin manifest path'),
        requiredArgument(commandArgs, 1, 'package name'),
      )
      break
    case 'prepare-node-pty':
      await prepareNodePty()
      break
    case 'patch-attachment-local':
      await patchDshAttachmentLocal()
      break
    default:
      throw new Error(`Unknown install callback helper command: ${command || '(missing)'}`)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
