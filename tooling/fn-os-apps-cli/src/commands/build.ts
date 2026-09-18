import { join } from 'node:path'
import { type OptionValues } from 'commander'
import { program } from '../program.js'
import { repositoryRoot } from '../config/paths.js'
import { readFpkApps, type FpkApp } from '../config/workspace.js'
import { runDocsBuild } from './docs.js'
import { addBooleanArgs } from '../core/command-args.js'
import { runCommand } from '../core/process.js'
import { askBuildSelection, askFpkApps } from '../ui/prompts.js'

async function buildFpkApps(apps: FpkApp[]): Promise<void> {
  for (const app of apps) {
    console.log(`\nBuilding FPK: ${app.name}`)
    await runCommand('fnpack', ['build'], join(repositoryRoot, 'apps', app.name))
  }
}

async function selectFpkApps(app?: string): Promise<FpkApp[] | undefined> {
  const apps = readFpkApps()
  if (app !== undefined) {
    const selected = apps.find(candidate => candidate.name === app)
    if (selected === undefined) throw new Error(`Unknown FPK application: ${app}`)
    return [selected]
  }
  return askFpkApps(apps)
}

export async function runBuild(args: string[]): Promise<void> {
  const app = args.includes('--app') ? args[args.indexOf('--app') + 1] : undefined
  if (args.includes('--fpk')) {
    const apps = await selectFpkApps(app)
    if (apps !== undefined) await buildFpkApps(apps)
    return
  }
  if (args.includes('--docs')) {
    await runDocsBuild()
    return
  }

  const selection = await askBuildSelection()
  if (selection === undefined) return

  const fpkApps = selection.includes('fpk') ? await selectFpkApps() : undefined
  const tasks: Promise<void>[] = []
  if (fpkApps !== undefined) tasks.push(buildFpkApps(fpkApps))
  if (selection.includes('docs')) tasks.push(runDocsBuild())
  await Promise.all(tasks)
}

program
  .command('build')
  .description('Select FPK applications or documentation to build')
  .option('--fpk', 'build FPK applications')
  .option('--app <app>', 'select one FPK application')
  .option('--docs', 'build documentation')
  .action(async (options: OptionValues) => {
    const args: string[] = []
    addBooleanArgs(args, options, ['fpk', 'docs'])
    if (options.app !== undefined) args.push('--app', options.app)
    await runBuild(args)
  })
