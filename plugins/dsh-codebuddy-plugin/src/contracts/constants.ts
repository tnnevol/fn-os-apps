/**
 * Fixed CodeBuddy service facts.
 *
 * These are protocol constants rather than user configuration: the endpoint is
 * where the OAuth handshake and the model catalog both live, and the version
 * strings are what the service expects a plugin client to identify itself as.
 *
 * @module dsh-codebuddy/constants
 */

/**
 * 该插件在 `ctx.llm` 上注册的 provider 路由。
 *
 * —— 以下到 RPC 频道这一段都是 **host 与 client 共用的契约**，
 * 不要把它们挪进 `host/`：client 侧同样引用它们，而两端各写一份常量
 * 曾经导致过真实的失联风险（`CODEBUDDY_AUTH_CHANNEL` 一度在 host 与
 * client 各定义一份，靠注释「mirror of the host constant」维持同步——
 * 改一处就会静默对不上）。
 */
export const CODEBUDDY_PROVIDER = 'codebuddy'

/**
 * 客户端调用认证服务所用的 RPC 频道。
 *
 * 定义在 contracts 而非 `host/auth-service.ts`：它是**两端协商的字符串**，
 * 不是宿主的实现细节。原先两处各写一份 `/codebuddy`，只靠注释提示同步。
 */
export const CODEBUDDY_AUTH_CHANNEL = '/codebuddy'

/** Display name shown in model selectors and settings surfaces. */
export const CODEBUDDY_DISPLAY_NAME = 'CodeBuddy'

/**
 * Network environments the official client distinguishes, mirroring
 * `CODEBUDDY_INTERNET_ENVIRONMENT` and the `product.<env>.json` files the
 * official CLI ships. The endpoint decides where the OAuth handshake, the
 * model catalog, metering, and the OpenAI-compatible chat route live; the
 * authority part doubles as the default `X-Domain` header value.
 */
export const CODEBUDDY_ENVIRONMENTS = ['external', 'internal', 'ioa', 'cloudhosted', 'selfhosted'] as const

/** One network environment id. */
export type CodeBuddyEnvironment = (typeof CODEBUDDY_ENVIRONMENTS)[number]

/** Default service root for the external environment (`product.json`). */
export const CODEBUDDY_ENDPOINT_EXTERNAL = 'https://www.codebuddy.ai'

/** Default service root for the internal and ioa environments
 *  (`product.internal.json` / `product.ioa.json` — both point here). */
export const CODEBUDDY_ENDPOINT_INTERNAL = 'https://copilot.tencent.com'

/**
 * Default endpoints keyed by environment. `cloudhosted`/`selfhosted` are
 * deliberately absent: the official CLI ships no default for them and
 * requires the enterprise's own service address, so an account on those
 * environments must carry an explicit endpoint.
 */
export const CODEBUDDY_ENVIRONMENT_ENDPOINTS: Readonly<
  Record<Exclude<CodeBuddyEnvironment, 'cloudhosted' | 'selfhosted'>, string>
> = {
  external: CODEBUDDY_ENDPOINT_EXTERNAL,
  internal: CODEBUDDY_ENDPOINT_INTERNAL,
  ioa: CODEBUDDY_ENDPOINT_INTERNAL,
}

/**
 * 环境字典：id → 展示名。选择器、面板与日志统一从这里取文案，id 与
 * CODEBUDDY_INTERNET_ENVIRONMENT 的取值一一对应。
 */
export const CODEBUDDY_ENVIRONMENT_LABELS: Readonly<Record<CodeBuddyEnvironment, string>> = {
  external: '海外版',
  internal: '中国版',
  ioa: 'iOA 企业版',
  cloudhosted: '专享版',
  selfhosted: '私有化部署',
}

/**
 * IOA-only header defaults the official client applies
 * (`IOAUtils.applyIOADefaultHeaders`): the auth domain defaults to the SSO
 * host rather than the endpoint authority, and a personal (enterprise-less)
 * session carries the product's default enterprise id.
 */
export const CODEBUDDY_IOA_DOMAIN = 'tencent.sso.copilot.tencent.com'
export const CODEBUDDY_IOA_DEFAULT_ENTERPRISE_ID = 'etahzsqej0n4'

/**
 * Legacy hard-coded endpoint. Accounts stored before environments existed
 * were all signed in against the China service, so a migrated legacy entry
 * and any document without explicit environment facts resolve here.
 */
export const CODEBUDDY_ENDPOINT = 'https://copilot.tencent.com'

/** The default environment; the official CLI treats absent as external. */
export const CODEBUDDY_DEFAULT_ENVIRONMENT: CodeBuddyEnvironment = 'internal'

/**
 * The auth path prefix the official client inserts between `/v2` and the
 * auth routes (`authentication.attributes.prefixPath`).
 */
export const CODEBUDDY_PLUGIN_PREFIX = '/plugin'

/**
 * OpenAI-compatible chat base. Only the chat wire route is compatible; the
 * model catalog at `/v3/config` is not, which is why this plugin owns its own
 * catalog reader instead of using an OpenAI `GET /models` listing.
 */
export const CODEBUDDY_CHAT_BASE = `${CODEBUDDY_ENDPOINT}/v2`

/** IDE version reported when reading the config/model catalog. */
export const CODEBUDDY_IDE_VERSION = '4.9.8'

/**
 * CLI version reported on chat requests.
 *
 * 对齐 `@tencent-ai/codebuddy-code` 的正式发布版本。官方 CLI 发的是**自己的
 * package.json version**（源码里 `getCurrentPackageJson()` 取值），服务端用这组头
 * （`X-IDE-Type: CLI` / `X-IDE-Version` / `User-Agent`）把请求归因到具体客户端版本，
 * 因此这里必须跟着产品发布走，不能随机化也不能长期滞后。
 *
 * 更新方式：查 npm 的 `dist-tags.latest`（`npm view @tencent-ai/codebuddy-code
 * dist-tags`），只取正式版，不要用 dev/next 预发布号。
 *
 * 注意与 {@link CODEBUDDY_IDE_VERSION} 的区别：那是 **CodeBuddyIDE**（VS Code 扩展）
 * 的版本，属另一条产品线，不随本包变化。
 */
export const CODEBUDDY_CLI_VERSION = '2.148.0'

/**
 * 登录/请求时声明的客户端身份。
 *
 * 服务端用 `platform` 参数（`/plugin/auth/state?platform=<id>`）区分客户端类型，
 * 并把该值原样回填进 `authUrl`；不同客户端的登录页与用量平面都可能不同：
 *
 * - `cli`：CodeBuddy CLI（`platform=CLI`），走 `CODEBUDDY_ENVIRONMENT_ENDPOINTS`
 *   定义的服务地址。
 * - `workbuddy`：WorkBuddy 客户端（`platform=workbuddy`），登录与计费都在
 *   `www.workbuddy.cn`。
 *
 * 两者的**版本号都是产品发布版本、固定不变**（不是随机值也不是每次会话新生成）：
 * 服务端以此把请求归因到具体客户端版本，随机化会让归因失真。
 */
export type CodeBuddyClientId = 'cli' | 'workbuddy'

/** 客户端字典：id → `platform` 查询参数取值（服务端原样回填 authUrl）。 */
export const CODEBUDDY_CLIENT_PLATFORMS: Readonly<Record<CodeBuddyClientId, string>> = {
  cli: 'CLI',
  workbuddy: 'workbuddy',
}

/** 客户端字典：id → 固定版本号。 */
export const CODEBUDDY_CLIENT_VERSIONS: Readonly<Record<CodeBuddyClientId, string>> = {
  cli: CODEBUDDY_CLI_VERSION,
  workbuddy: '5.5.4',
}

/** 客户端字典：id → 登录页/计费所在的服务地址。 */
export const CODEBUDDY_CLIENT_ENDPOINTS: Readonly<Record<CodeBuddyClientId, string>> = {
  cli: CODEBUDDY_ENDPOINT_INTERNAL,
  workbuddy: 'https://www.workbuddy.cn',
}

/** 客户端字典：id → 面板展示名。 */
export const CODEBUDDY_CLIENT_LABELS: Readonly<Record<CodeBuddyClientId, string>> = {
  cli: 'CodeBuddy CLI',
  workbuddy: 'WorkBuddy',
}

/** 全部客户端 id，供选择器按稳定顺序枚举。 */
export const CODEBUDDY_CLIENT_IDS: readonly CodeBuddyClientId[] = ['cli', 'workbuddy']

/** 默认客户端：既有账号都是 CLI，保持向后兼容。 */
export const CODEBUDDY_DEFAULT_CLIENT: CodeBuddyClientId = 'cli'

/** 把任意输入收敛为合法客户端 id（历史数据缺字段时回退到 CLI）。 */
export function normalizeClientId(value: unknown): CodeBuddyClientId {
  return value === 'workbuddy' ? 'workbuddy' : 'cli'
}

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
