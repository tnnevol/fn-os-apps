import { checkComposeUserMapping } from '../apps/compose-user.js'
import { readFpkApps } from '../config/workspace.js'

export async function runCheckApps(): Promise<void> {
  const { errors, warnings } = checkComposeUserMapping()
  const total = readFpkApps().length

  for (const warning of warnings) console.warn(`[warn] ${warning}`)

  if (errors.length > 0) {
    console.error(`Compose user check failed with ${errors.length} error(s):`)
    for (const error of errors) console.error(`- ${error}`)
    process.exitCode = 1
    return
  }

  if (warnings.length > 0) {
    console.log(
      `Compose user check passed: ${total} app(s) checked,`
      + ` ${warnings.length} warning(s)（未写 user: 且无 PUID/PGID 或例外，需逐个真机确认）`,
    )
    return
  }

  console.log(`Compose user check passed: ${total} app(s) checked`)
}
