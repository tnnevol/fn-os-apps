import type { VersionBumpRelease } from 'bumpp'

export type VersionOptions = {
  release: VersionBumpRelease
  noCommit: boolean
  noTag: boolean
  confirm: boolean
}

const versionFlags = new Set(['--no-commit', '--no-tag', '--no-push', '--yes'])

export function normalizeArgs(args: string[]): string[] {
  return args.filter(arg => arg !== '--')
}

export function parseVersionOptions(args: string[]): VersionOptions {
  const values = args.filter(arg => !arg.startsWith('-'))
  const unknown = args.filter(arg => arg.startsWith('-') && !versionFlags.has(arg))
  if (unknown.length > 0) throw new Error(`Unknown version option: ${unknown.join(', ')}`)
  return {
    release: (values[0] ?? 'prompt') as VersionBumpRelease,
    noCommit: args.includes('--no-commit'),
    noTag: args.includes('--no-tag'),
    confirm: !args.includes('--yes'),
  }
}

export function optionValue(args: string[], option: string): string | undefined {
  const index = args.lastIndexOf(option)
  const value = index < 0 ? undefined : args[index + 1]
  return value?.startsWith('-') ? undefined : value
}
