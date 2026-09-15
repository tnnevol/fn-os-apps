import { type OptionValues } from 'commander'
import { program } from '../program.js'
import { addBooleanArgs, addOptionalValueArg } from '../core/command-args.js'
import { optionValue } from '../core/args.js'
import { ensureLocalProfilePlugins } from '../core/local-profile.js'
import { DEV_WEB_TASK, devEnvironment, runTurboWatch } from '../core/turbo.js'
import { runDocsDev } from './docs.js'
import { findPluginTarget } from '../config/targets.js'
import { askPlugins, askStartSelection, type StartSelection } from '../ui/prompts.js'

export async function runStart(args: string[]): Promise<void> {
  const explicitDocs = args.includes('--docs')
  const explicitPlugins = args.includes('--plugin')
  const explicitWeb = args.includes('--web')
  let selection: StartSelection[]

  if (explicitDocs || explicitPlugins || explicitWeb) {
    selection = [
      ...(explicitPlugins ? ['plugins' as const] : []),
      ...(explicitDocs ? ['docs' as const] : []),
      ...(explicitWeb ? ['web' as const] : []),
    ]
  } else {
    const prompted = await askStartSelection()
    if (prompted === undefined) return
    selection = prompted
  }

  if (selection.length === 0) return

  const wantsDocs = selection.includes('docs')
  const wantsWeb = selection.includes('web')
  const pluginFilters = selection.includes('plugins') ? await pluginFiltersFromArgs(args) : []

  // The docs `dev` task is `interactive`, so Turbo's TUI can hand it the
  // keyboard (`i` to interact, `Ctrl+z` to return) and the VitePress shortcuts
  // (`h` for help, `r` to restart) keep working. Turbo refuses to run an
  // interactive task without a terminal UI, so a TTY decides where docs runs:
  //   - with a TTY there is a TUI worth keeping, so docs joins the watch;
  //   - without one (CI, a pipe, a background job) there is no TUI to lose, so
  //     docs is spawned directly instead of failing the whole command.
  const hasTui = process.stdin.isTTY === true && process.stdout.isTTY === true

  // `start` schedules every target into ONE `turbo watch`, so the plugin, docs
  // and DSH Web rows share the same TUI. Two `persistent` tasks may run
  // together under a single watch, which is why DSH Web is a Turbo task rather
  // than a second foreground process: a process started outside Turbo would
  // take the terminal away from the TUI.
  //
  // Docs stays a filter on the bare `dev` task rather than an explicit
  // `pkg#task` name: naming a task explicitly re-adds that package to the
  // scope, and the bare `dev` then matches it a second time, which would start
  // VitePress twice.
  const watchFilters = [
    ...(wantsDocs && hasTui ? ['./docs'] : []),
    ...pluginFilters,
  ]
  const turboTasks = [
    ...(wantsWeb ? [DEV_WEB_TASK] : []),
    ...(watchFilters.length > 0 ? ['dev'] : []),
  ]

  if (wantsWeb) {
    // The local profile is git-ignored state, so link this repository's plugins
    // into it before booting; otherwise a fresh clone would start a DSH Web
    // with none of the plugins under development loaded. Profile linking needs
    // the plugin build outputs, so it runs once, up front, outside the watch.
    await ensureLocalProfilePlugins()
  }

  const tasks: Promise<void>[] = []
  if (turboTasks.length > 0) tasks.push(runTurboWatch(turboTasks, watchFilters, { env: devEnvironment() }))
  if (wantsDocs && !hasTui) tasks.push(runDocsDev())
  await Promise.all(tasks)
}

async function pluginFiltersFromArgs(args: string[]): Promise<string[]> {
  const plugin = optionValue(args, '--plugin')
  const target = plugin === undefined ? undefined : findPluginTarget(plugin)
  if (plugin !== undefined && target === undefined) throw new Error(`Unknown plugin: ${plugin}`)
  if (target !== undefined) return [target.filter]
  const selected = await askPlugins()
  if (selected === undefined) throw new Error('Start cancelled while selecting plugins')
  return selected
}

program
  .command('start')
  .description('Start plugin watch, the documentation dev server, and/or DSH Web')
  .option('--plugin [plugin]', 'watch one plugin, or prompt for plugins')
  .option('--docs', 'start the documentation dev server')
  .option('--web', 'start DSH Web with this repository as DSH_HOME')
  .action(async (options: OptionValues) => {
    const args: string[] = []
    addOptionalValueArg(args, options, 'plugin')
    addBooleanArgs(args, options, ['docs', 'web'])
    await runStart(args)
  })
