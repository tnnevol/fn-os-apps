import { type OptionValues } from 'commander'
import { program } from '../program.js'
import { scriptsPackageDirectory } from '../config/paths.js'
import { runCommand } from '../core/process.js'

export async function runReleaseNotes(args: string[]): Promise<void> {
  const tag = process.env.GITHUB_REF_NAME ?? ''
  const prerelease = /-(?:alpha|beta|rc)/.test(tag) && !args.includes('--prerelease') ? ['--prerelease'] : []
  await runCommand('pnpm', ['exec', 'changelogithub', ...prerelease, ...args], scriptsPackageDirectory)
}

program
  .command('release:notes [args...]')
  .description('Generate and publish GitHub release notes')
  .option('--prerelease', 'mark the release as a prerelease')
  .action(async (args: string[], options: OptionValues) => {
    if (options.prerelease) args.push('--prerelease')
    await runReleaseNotes(args)
  })
