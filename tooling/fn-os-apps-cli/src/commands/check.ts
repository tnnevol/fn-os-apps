import { type OptionValues } from 'commander'
import { program } from '../program.js'
import { addBooleanArgs } from '../core/command-args.js'
import { runCheckSdd } from './check-sdd.js'
import { runDocsBuild } from './docs.js'
import { askCheckSelection, type CheckSelection } from '../ui/prompts.js'

const flags = new Set(['--all', '--sdd', '--docs'])

function selectionsFromArgs(args: string[]): CheckSelection[] {
  const unknown = args.filter(arg => !flags.has(arg))
  if (unknown.length > 0) throw new Error(`Unknown check option: ${unknown.join(', ')}`)
  if (args.includes('--all')) return ['sdd', 'docs']
  return [
    ...(args.includes('--sdd') ? ['sdd' as const] : []),
    ...(args.includes('--docs') ? ['docs' as const] : []),
  ]
}

export async function runCheck(args: string[]): Promise<void> {
  let selection = selectionsFromArgs(args)
  if (selection.length === 0) {
    const prompted = await askCheckSelection()
    if (prompted === undefined) return
    selection = prompted
  }

  const tasks: Promise<void>[] = []
  if (selection.includes('sdd')) tasks.push(runCheckSdd())
  if (selection.includes('docs')) tasks.push(runDocsBuild())
  await Promise.all(tasks)
}

program
  .command('check')
  .description('Select SDD or docs to validate')
  .option('--all', 'run every check')
  .option('--sdd', 'check SDD documents')
  .option('--docs', 'build project documentation')
  .action(async (options: OptionValues) => {
    const args: string[] = []
    addBooleanArgs(args, options, ['all', 'sdd', 'docs'])
    await runCheck(args)
  })
