/**
 * Fixed CodeBuddy service facts.
 *
 * These are protocol constants rather than user configuration: the endpoint is
 * where the OAuth handshake and the model catalog both live, and the version
 * strings are what the service expects a plugin client to identify itself as.
 *
 * @module dsh-codebuddy/constants
 */

/** The provider route this plugin registers on `ctx.llm`. */
export const CODEBUDDY_PROVIDER = 'codebuddy'

/** Display name shown in model selectors and settings surfaces. */
export const CODEBUDDY_DISPLAY_NAME = 'CodeBuddy'

/** CodeBuddy service root; both the auth handshake and `/v3/config` live here. */
export const CODEBUDDY_ENDPOINT = 'https://copilot.tencent.com'

/**
 * OpenAI-compatible chat base. Only the chat wire route is compatible; the
 * model catalog at `/v3/config` is not, which is why this plugin owns its own
 * catalog reader instead of using an OpenAI `GET /models` listing.
 */
export const CODEBUDDY_CHAT_BASE = `${CODEBUDDY_ENDPOINT}/v2`

/** IDE version reported when reading the config/model catalog. */
export const CODEBUDDY_IDE_VERSION = '4.9.8'

/** CLI version reported on chat requests. */
export const CODEBUDDY_CLI_VERSION = '2.96.0'

/**
 * Client version stamped on the browser-login page URL as `version`.
 *
 * The auth-state service returns a login URL that already carries
 * `platform` and the server-issued `state`; the CodeBuddy client then appends
 * its own product version (`openAuthUrl` in the codebuddy-code CLI does
 * `searchParams.set('version', pluginVersion)`). The value is fixed per
 * release, never random — this mirrors the current CodeBuddy CLI release
 * (2.145.0) the plugin presents itself as on this channel.
 */
export const CODEBUDDY_LOGIN_VERSION = '2.145.0'

/**
 * Context capacity assumed for a model the catalog does not describe at all.
 *
 * This is a convention, not a CodeBuddy-provided figure: the service discloses
 * `maxAllowedSize` per model and offers no global default to fall back on.
 * Listed models are therefore never sized from this — an entry that withholds
 * its capacity is dropped from the listing instead. It applies only to an id
 * named explicitly that the catalog does not list, where something must be
 * assumed to resolve the route at all.
 */
export const DEFAULT_CONTEXT_WINDOW = 128_000

/** Output cap assumed for an unlisted model; a convention, as above. */
export const DEFAULT_MAX_TOKENS = 8_192

/** Default maximum provider idle time while one stream read is outstanding. */
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000

/** How long the browser login flow waits for the user to finish, in ms. */
export const LOGIN_TIMEOUT_MS = 10 * 60 * 1000

/** Poll interval while waiting for the browser login to complete, in ms. */
export const LOGIN_POLL_INTERVAL_MS = 1_000

/** Service code meaning "the browser login has not completed yet". */
export const AUTH_PENDING_CODE = 11217
