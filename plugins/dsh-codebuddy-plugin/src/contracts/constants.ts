import type { CodeBuddyEnvironment, CodeBuddyClientId } from '../types/contracts/constants'
export type { CodeBuddyEnvironment, CodeBuddyClientId } from '../types/contracts/constants'
/**
 * CodeBuddy 服务的固定事实。
 *
 * 这些是协议常量而非用户配置：endpoint 是 OAuth 握手与模型目录
 * 共同所在之处，version 字符串则是服务端期望插件客户端自报身份
 * 的取值。
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

/** 模型选择器与设置界面中展示的名称。 */
export const CODEBUDDY_DISPLAY_NAME = 'CodeBuddy'

/**
 * 官方客户端区分的网络环境，与 `CODEBUDDY_INTERNET_ENVIRONMENT` 及官方 CLI
 * 附带的 `product.<env>.json` 文件对应。endpoint 决定 OAuth 握手、模型目录、
 * 计量与 OpenAI 兼容聊天路由所在之处；authority 部分同时兼作默认的
 * `X-Domain` 请求头取值。
 */
export const CODEBUDDY_ENVIRONMENTS = ['external', 'internal', 'ioa', 'cloudhosted', 'selfhosted'] as const

/** external 环境的默认服务根（`product.json`）。 */
export const CODEBUDDY_ENDPOINT_EXTERNAL = 'https://www.codebuddy.ai'

/** internal 与 ioa 环境的默认服务根
 *  （`product.internal.json` / `product.ioa.json` — 两者都指向这里）。 */
export const CODEBUDDY_ENDPOINT_INTERNAL = 'https://copilot.tencent.com'

/**
 * 按环境索引的默认 endpoint。特意不提供 `cloudhosted`/`selfhosted`：
 * 官方 CLI 没有为它们提供默认值，而是要求使用企业自己的服务地址，
 * 因此这两种环境下的账号必须显式携带 endpoint。
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
 * 仅 IOA 环境使用的默认请求头，由官方客户端应用
 * （`IOAUtils.applyIOADefaultHeaders`）：认证域默认取 SSO 主机而非 endpoint
 * authority，且不带企业的个人会话携带该产品的默认企业 id。
 */
export const CODEBUDDY_IOA_DOMAIN = 'tencent.sso.copilot.tencent.com'
export const CODEBUDDY_IOA_DEFAULT_ENTERPRISE_ID = 'etahzsqej0n4'

/**
 * 旧版硬编码 endpoint。环境概念出现之前存储的账号全部是对中国服务
 * 登录的，因此迁移而来的旧条目以及任何缺少显式环境事实的文档都解析到这里。
 */
export const CODEBUDDY_ENDPOINT = 'https://copilot.tencent.com'

/** 默认环境；官方 CLI 把缺省当作 external。 */
export const CODEBUDDY_DEFAULT_ENVIRONMENT: CodeBuddyEnvironment = 'internal'

/**
 * 官方客户端插入在 `/v2` 与认证路由之间的路径前缀
 * （`authentication.attributes.prefixPath`）。
 */
export const CODEBUDDY_PLUGIN_PREFIX = '/plugin'

/**
 * OpenAI 兼容聊天的 base。只有聊天的线上路由是兼容的；`/v3/config` 的模型
 * 目录并不兼容，这正是本插件自持目录读取逻辑、而不使用 OpenAI `GET /models`
 * 列表的原因。
 */
export const CODEBUDDY_CHAT_BASE = `${CODEBUDDY_ENDPOINT}/v2`

/** 读取配置/模型目录时上报的 IDE 版本。 */
export const CODEBUDDY_IDE_VERSION = '4.9.8'

/**
 * 聊天请求上报的 CLI 版本。
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
 * 客户端字典：id → 客户端**标识**（登录 `platform` 参数 + 请求的 `X-IDE-Type`/`X-IDE-Name`）。
 *
 * 一个取值同时供多处使用，因此大小写在这里统一：
 *  - 登录握手的 `?platform=` 查询参数（服务端**原样回填**进 `authUrl`）；
 *  - 请求头的 `X-IDE-Type` / `X-IDE-Name`（见 adapter 的 clientIdentityHeaders）。
 *
 * 两个客户端都写成产品名形态（`CLI` / `WorkBuddy`），不再混用小写。
 *
 * **为什么改大小写是安全的**（已核实，非推测）：
 *  - 服务端不校验：实测 `workbuddy` / `WorkBuddy` / `WORKBUDDY` 三种都返回 200，
 *    并原样回填进 `authUrl`；
 *  - 登录页显式做大小写归一：其前端 bundle 里两处比较都是
 *    `get("platform")?.toLowerCase() === "workbuddy"`，没有精确匹配。
 */
export const CODEBUDDY_CLIENT_PLATFORMS: Readonly<Record<CodeBuddyClientId, string>> = {
  cli: 'CLI',
  workbuddy: 'WorkBuddy',
}

/** 客户端字典：id → 固定版本号。 */
export const CODEBUDDY_CLIENT_VERSIONS: Readonly<Record<CodeBuddyClientId, string>> = {
  cli: CODEBUDDY_CLI_VERSION,
  workbuddy: '5.5.6',
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
/**
 * 把任意输入收敛为合法客户端 id（历史数据缺字段时回退到 CLI）。
 *
 * 大小写不敏感：标识在不同场合出现过 `workbuddy` / `WorkBuddy` / `WORKBUDDY`
 * 等写法，存储里也可能残留旧值。归一化时统一小写比较，避免同一客户端被识别成
 * 两个（那会让「按账号取标识」的判定失效，回退到 CLI）。
 * @param value - 存储或调用方给出的原始值。
 * @returns 合法的客户端 id。
 */
export function normalizeClientId(value: unknown): CodeBuddyClientId {
  return typeof value === 'string' && value.trim().toLowerCase() === 'workbuddy'
    ? 'workbuddy'
    : 'cli'
}

/**
 * 目录完全没有描述的模型所假定的上下文容量。
 *
 * 这是一个约定值，不是 CodeBuddy 提供的数字：服务端按模型披露
 * `maxAllowedSize`，没有可回退的全局默认值。因此列出的模型从不以这个值
 * 定容量——不肯披露容量的条目会直接从列表中剔除。它只适用于被显式点名、
 * 但目录未列出的 id，此时必须假定一个值才能解析路由。
 */
export const DEFAULT_CONTEXT_WINDOW = 128_000

/** 未列出模型假定的输出上限；约定值，同上。 */
export const DEFAULT_MAX_TOKENS = 8_192

/** 一次流式读进行中时，provider 允许的最大空闲时间。 */
export const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000

/** 浏览器登录流程等待用户完成的时长（ms）。 */
export const LOGIN_TIMEOUT_MS = 10 * 60 * 1000

/** 等待浏览器登录完成时的轮询间隔（ms）。 */
export const LOGIN_POLL_INTERVAL_MS = 1_000

/** 表示「浏览器登录尚未完成」的服务错误码。 */
export const AUTH_PENDING_CODE = 11217
