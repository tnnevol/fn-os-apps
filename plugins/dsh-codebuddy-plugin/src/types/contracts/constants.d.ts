
/** CodeBuddy 类型声明；由原模块抽取，运行时实现保留在 src 下。 */
import type { CODEBUDDY_ENVIRONMENTS } from '../../contracts/constants.ts'

/** 一个网络环境 id。 */
export type CodeBuddyEnvironment = (typeof CODEBUDDY_ENVIRONMENTS)[number]
/**
 * 登录/请求时声明的客户端身份。
 *
 * 服务端用 `platform` 参数（`/plugin/auth/state?platform=<id>`）区分客户端类型，
 * 并把该值原样回填进 `authUrl`；不同客户端的登录页与用量平面都可能不同：
 *
 * - `cli`：CodeBuddy CLI（`platform=CLI`），走 `CODEBUDDY_ENVIRONMENT_ENDPOINTS`
 *   定义的服务地址。
 * - `workbuddy`：WorkBuddy 客户端（`platform=WorkBuddy`），登录与计费都在
 *   `www.workbuddy.cn`。
 *
 * 两者的**版本号都是产品发布版本、固定不变**（不是随机值也不是每次会话新生成）：
 * 服务端以此把请求归因到具体客户端版本，随机化会让归因失真。
 */
export type CodeBuddyClientId = 'cli' | 'workbuddy'
