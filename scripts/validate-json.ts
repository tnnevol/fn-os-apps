import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : execFileSync('git', ['ls-files'], { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter((file) => /(^|\/)wizard\/[^/]+$|\.(json|jsonc)$|(^|\/)app\/ui\/config$/.test(file))

let failed = false

for (const file of files) {
  try {
    JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (error) {
    failed = true
    const message = error instanceof Error ? error.message : String(error)
    console.error(`${path.relative(process.cwd(), file)}: invalid JSON (${message})`)
  }
}

process.exitCode = failed ? 1 : 0
