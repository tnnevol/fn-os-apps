import { scriptsPackageDirectory } from '../config/paths.js'
import { runCommand } from '../core/process.js'

export async function runReleaseNotes(args: string[]): Promise<void> {
  const tag = process.env.GITHUB_REF_NAME ?? ''
  const prerelease = /-(?:alpha|beta|rc)/.test(tag) && !args.includes('--prerelease') ? ['--prerelease'] : []
  await runCommand('pnpm', ['exec', 'changelogithub', ...prerelease, ...args], scriptsPackageDirectory)
}
