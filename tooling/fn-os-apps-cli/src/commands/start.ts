import { optionValue } from '../core/args.js'
import { runTurboWatch } from '../core/turbo.js'
import { findPluginTarget } from '../config/targets.js'
import { askPlugins, askStartSelection, type StartSelection } from '../ui/prompts.js'
import { runDocsDev } from './docs.js'

export async function runStart(args: string[]): Promise<void> {
  const explicitDocs = args.includes('--docs')
  const explicitPlugins = args.includes('--plugin')
  let selection: StartSelection[]

  if (explicitDocs || explicitPlugins) {
    selection = [
      ...(explicitPlugins ? ['plugins' as const] : []),
      ...(explicitDocs ? ['docs' as const] : []),
    ]
  } else {
    const prompted = await askStartSelection()
    if (prompted === undefined) return
    selection = prompted
  }

  const tasks: Promise<void>[] = []
  if (selection.includes('docs')) tasks.push(runDocsDev())
  if (selection.includes('plugins')) {
    const plugin = optionValue(args, '--plugin')
    const target = plugin === undefined ? undefined : findPluginTarget(plugin)
    if (plugin !== undefined && target === undefined) throw new Error(`Unknown plugin: ${plugin}`)
    const filters = target === undefined ? await askPlugins() : [target.filter]
    if (filters !== undefined) tasks.push(runTurboWatch('dev', filters))
  }
  await Promise.all(tasks)
}
