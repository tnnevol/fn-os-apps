/** Shared access to the fnOS SDK bundled into the plugin client. */

import { TrimApp, type TrimAppOptions } from '@trimjs/web-app'
import { isEmbeddedFnosFrame, shouldForceWebCarrier } from './sdk-carrier.ts'

export type FnosTrimApp = InstanceType<typeof TrimApp>

/**
 * fnOS may add FNAppVer/... to the User-Agent of an ordinary browser iframe.
 * @trimjs/web-app interprets that marker as a Flutter/mobile host and skips
 * its web Postmate bridge. Only normalize it while constructing the SDK in a
 * real iframe; standalone browser debugging keeps the original User-Agent.
 */
function withWebCarrierUserAgent<T>(run: () => T): T {
  if (!isEmbeddedFnosFrame() || typeof navigator === 'undefined') return run()
  const original = navigator.userAgent
  if (!shouldForceWebCarrier(original, true)) return run()

  const webUserAgent = original.replace(/\s+FNAppVer\/[^\s)]+/giu, '')
  try {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: webUserAgent,
    })
  } catch (error: unknown) {
    console.debug('[dsh-fnos] unable to normalize fnOS iframe User-Agent for web SDK', error)
    return run()
  }

  try {
    return run()
  } finally {
    try {
      Object.defineProperty(navigator, 'userAgent', {
        configurable: true,
        value: original,
      })
    } catch (error: unknown) {
      console.debug('[dsh-fnos] unable to restore iframe User-Agent after SDK creation', error)
    }
  }
}

/**
 * Keep the fnOS SDK's own bridge diagnostics enabled. The SDK logs the
 * iframe/native connection and method lifecycle with the `[Trim App]` prefix;
 * picker-specific summaries are emitted by the caller with a more specific
 * `[dsh-fnos][fnos-sdk]` prefix.
 */
export function createTrimApp(options: TrimAppOptions = {}): FnosTrimApp {
  return withWebCarrierUserAgent(() => new TrimApp({ debug: true, ...options }))
}
