import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const scriptsSourceDirectory = dirname(fileURLToPath(import.meta.url))
export const scriptsPackageDirectory = resolve(scriptsSourceDirectory, '..')
export const repositoryRoot = resolve(scriptsPackageDirectory, '..', '..')

/** Local DSH home: the repository keeps its own profiles, credentials and sessions under `.dsh`. */
export const dshHomeDirectory = resolve(repositoryRoot, '.dsh')

export const projectVersionFiles = [
  'package.json',
  'docs/package.json',
  'packages/**/package.json',
  'apps/**/manifest',
  'docs/development/manifest.md',
  'README.md',
]
