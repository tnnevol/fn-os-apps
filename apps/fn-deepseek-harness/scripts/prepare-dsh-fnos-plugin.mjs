#!/usr/bin/env node

import { cp, mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryDirectory = resolve(scriptDirectory, '../../..')
const sourceDirectory = resolve(repositoryDirectory, 'plugins/dsh-fnos-plugin')
const targetDirectory = resolve(scriptDirectory, '../app/plugins/dsh-fnos')
const packageFiles = ['package.json', 'compatibility.json', 'cordis.patch.yml', 'README.md']

const sourceManifest = JSON.parse(await readFile(resolve(sourceDirectory, 'package.json'), 'utf8'))
if (sourceManifest.name !== '@tnnevol/dsh-fnos') {
  throw new Error(`Unexpected fnOS plugin package name: ${String(sourceManifest.name)}`)
}

await rm(targetDirectory, { recursive: true, force: true })
await mkdir(targetDirectory, { recursive: true })
for (const filename of packageFiles) {
  await cp(resolve(sourceDirectory, filename), resolve(targetDirectory, filename))
}
await cp(resolve(sourceDirectory, 'lib'), resolve(targetDirectory, 'lib'), { recursive: true })

for (const filename of ['lib/index.js', 'lib/client.js']) {
  await readFile(resolve(targetDirectory, filename))
}

console.log(`Staged @tnnevol/dsh-fnos ${sourceManifest.version} in ${targetDirectory}`)
