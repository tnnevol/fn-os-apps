import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { repositoryRoot } from '../config/paths.js'

export type PackageInfo = {
  name: string
  version: string
}

export async function readPackageInfo(relativePath: string): Promise<PackageInfo> {
  const file = await readFile(join(repositoryRoot, relativePath), 'utf8')
  const value: unknown = JSON.parse(file)
  if (
    typeof value !== 'object' ||
    value === null ||
    !('name' in value) ||
    !('version' in value) ||
    typeof value.name !== 'string' ||
    typeof value.version !== 'string'
  ) {
    throw new Error(`${relativePath} must contain a package name and version`)
  }
  return { name: value.name, version: value.version }
}
