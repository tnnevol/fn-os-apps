import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const scriptsSourceDirectory = dirname(fileURLToPath(import.meta.url))
export const scriptsPackageDirectory = resolve(scriptsSourceDirectory, '..')
export const repositoryRoot = resolve(scriptsPackageDirectory, '..', '..')

export const projectVersionFiles = [
  'package.json',
  'docs/package.json',
  'packages/**/package.json',
  'apps/**/manifest',
  'docs/development/manifest.md',
  'README.md',
]
