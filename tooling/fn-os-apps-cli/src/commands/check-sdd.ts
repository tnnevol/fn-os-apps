import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { repositoryRoot } from '../config/paths.js'
import { checkSddDocs } from '../sdd/checker.js'

export async function runCheckSdd(): Promise<void> {
  const errors = checkSddDocs(repositoryRoot)
  if (errors.length > 0) {
    console.error(`SDD docs check failed with ${errors.length} error(s):`)
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
    return
  }

  const [requirements, plans] = await Promise.all([
    readdir(join(repositoryRoot, 'docs/requirements')),
    readdir(join(repositoryRoot, 'docs/plans')),
  ])
  const countDocuments = (files: string[]): number => files.filter(file => file.endsWith('.md') && file !== 'index.md').length
  console.log(`SDD docs check passed: ${countDocuments(requirements)} requirement document(s), ${countDocuments(plans)} plan document(s)`)
}
