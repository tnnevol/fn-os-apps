/** Shared access to the fnOS SDK bundled into the plugin client. */

import { TrimApp } from '@trimjs/web-app'

export type FnosTrimApp = InstanceType<typeof TrimApp>

export function createTrimApp(): FnosTrimApp {
  return new TrimApp()
}
