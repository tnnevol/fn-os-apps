import { checkComposeUserMapping } from '../apps/compose-user.js'
import { readFpkApps } from '../config/workspace.js'

export async function runCheckApps(): Promise<void> {
  const errors = checkComposeUserMapping()
  if (errors.length > 0) {
    console.error(`Compose user check failed with ${errors.length} error(s):`)
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
    return
  }

  console.log(`Compose user check passed: ${readFpkApps().length} app(s) checked`)
}
