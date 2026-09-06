import { dirname, join } from 'node:path'
import { type OptionValues } from 'commander'
import { program } from '../program.js'
import { repositoryRoot } from '../config/paths.js'
import { findPluginTarget, type PluginTarget } from '../config/targets.js'
import { optionValue } from '../core/args.js'
import { runCommand } from '../core/process.js'
import { addOptionalValueArg } from '../core/command-args.js'
import { askPublishPlugins } from '../ui/prompts.js'

function selectPublishTargets(plugin?: string): PluginTarget[] | Promise<PluginTarget[] | undefined> {
  if (plugin === undefined) return askPublishPlugins()
  const target = findPluginTarget(plugin)
  if (target === undefined) throw new Error(`Unknown plugin: ${plugin}`)
  return [target]
}

export async function runPublish(args: string[]): Promise<void> {
  const targets = await selectPublishTargets(optionValue(args, '--plugin'))
  if (targets === undefined) return

  // Publish in one npm-authenticated process at a time. Starting all
  // `pnpm publish` commands together makes npm launch one Web login flow per
  // package before the first credential has been persisted, which produces
  // several authorization prompts for the same registry account.
  for (const target of targets) {
    const packageDirectory = join(repositoryRoot, dirname(target.path))
    console.log(`\nPublishing npm package: ${target.label}`)
    await runCommand('pnpm', ['run', 'publish:rc'], packageDirectory)
  }
}

program
  .command('publish')
  .description('Publish selected DSH plugins to npm using the rc dist-tag')
  .option('--plugin [plugin]', 'publish one plugin, or prompt for plugins')
  .action(async (options: OptionValues) => {
    const args: string[] = []
    addOptionalValueArg(args, options, 'plugin')
    await runPublish(args)
  })
