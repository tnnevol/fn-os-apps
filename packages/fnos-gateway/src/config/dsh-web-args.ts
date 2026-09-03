/** Options used to start the DSH web profile behind the fnOS gateway. */
export interface DshWebArgsOptions {
  /** Address exposed by the upstream DSH web server. */
  host: string
  /** Port exposed by the upstream DSH web server. */
  port: number
  /** Browser authorities trusted by DSH, forwarded one at a time. */
  trustedHosts: readonly string[]
}

/** Build the DSH web command without opening a browser from the fnOS service. */
export function buildDshWebArgs({ host, port, trustedHosts }: DshWebArgsOptions): string[] {
  const args = ['web', '--no-open', '--host', host, '--port', String(port)]
  for (const trustedHost of trustedHosts) args.push('--trusted-host', trustedHost)
  return args
}
