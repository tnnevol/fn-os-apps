/** Shared access to the fnOS SDK bundled into the plugin client. */

import { TrimApp, type TrimAppOptions } from '@trimjs/web-app'

export type FnosTrimApp = InstanceType<typeof TrimApp>

/**
 * Keep the fnOS SDK's own bridge diagnostics enabled. The SDK logs the
 * iframe/native connection and method lifecycle with the `[Trim App]` prefix;
 * picker-specific summaries are emitted by the caller with a more specific
 * `[dsh-fnos][fnos-sdk]` prefix.
 */
export function createTrimApp(options: TrimAppOptions = {}): FnosTrimApp {
  return new TrimApp({ debug: true, ...options })
}
