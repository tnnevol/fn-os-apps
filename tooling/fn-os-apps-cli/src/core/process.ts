import { spawn } from 'node:child_process'

export type RunCommandOptions = {
  /** Replacement environment for the child; defaults to the inherited one. */
  env?: NodeJS.ProcessEnv
}

export function runCommand(command: string, args: string[], cwd: string, options: RunCommandOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      ...(options.env === undefined ? {} : { env: options.env }),
    })
    child.once('error', reject)
    child.once('exit', code => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`))
    })
  })
}
