/**
 * DeepSeek Harness 的腾讯 CodeBuddy provider 插件。
 *
 * 在 `ctx.llm` 上注册一个 `codebuddy` 路由，通过浏览器 OAuth 登录而非
 * API key 完成授权，并 serving CodeBuddy 自有（非 OpenAI）目录端点
 * 报告的模型。
 *
 * 一切操作——登录、登出、账号信息、用量偏好——都在 Web UI 的
 * 设置 → CodeBuddy 中完成。无需 API key，运行中的 harness 无需重启
 * 即可拾取凭据。
 *
 * @module dsh-codebuddy
 */

import type { Context } from '@deepseek-ai/cordis'
import { CodeBuddyAdapter } from './host/adapter.ts'
import type { CodeBuddyConnectionOptions } from './host/adapter.ts'
import { CodeBuddyAuthService } from './host/auth-service.ts'
import type { SessionAnalyticsServices } from './host/auth-service.ts'
import {
  CODEBUDDY_CHAT_BASE,
  CODEBUDDY_PROVIDER,
  DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MAX_TOKENS,
  DEFAULT_STREAM_IDLE_TIMEOUT_MS,
} from './contracts/constants.ts'
import { CodeBuddySession } from './host/session.ts'
import { resolveImageAttachmentAccess } from '@deepseek-ai/dsh-llm'
import type { AttachmentStore } from '@deepseek-ai/dsh-attachment'

export { CodeBuddyAdapter, httpErrorCode } from './host/adapter.ts'
export type { CodeBuddyAdapterOptions, CodeBuddyConnectionOptions } from './host/adapter.ts'
export { CodeBuddyAuthService } from './host/auth-service.ts'
export type {
  CodeBuddyAuthStatus,
  CodeBuddyLoginStart,
  CodeBuddyLoginPoll,
  CodeBuddyUsageResult,
  CodeBuddyUsageWindow,
} from './host/auth-service.ts'
export { CodeBuddySession, NotLoggedInError } from './host/session.ts'
export { buildStorage, clearStorage, getStoragePath, loadStorage, saveStorage } from './host/storage.ts'
export type { CodeBuddyStorage } from './host/storage.ts'
export { fetchUsage, fetchPersonalUsage, fetchEnterpriseUsage, parseUsage } from './host/usage.ts'
export type { UsageSnapshot, UsageWindow } from './host/usage.ts'
export { collectCodeBuddyTokenStats } from './host/token-stats.ts'
export type {
  CodeBuddyTokenStatsRequest,
  CodeBuddyTokenStats,
  CodeBuddyTokenBucket,
  CodeBuddyTokenDay,
  CodeBuddyTokenActivity,
  CodeBuddyTokenBreakdown,
  CodeBuddyTokenSession,
} from './host/token-stats.ts'
export * from './contracts/constants.ts'
export { hasDisclosedCapacity } from './host/types.ts'
export type * from './host/types.ts'

/** Cordis 插件名。 */
export const name = 'dsh-codebuddy'

/** 路由需要 llm；用量统计需要逻辑 DSH 会话查询接缝。 */
export const inject = ['llm', 'sessionQuery']

// 本模块刻意只以命名成员导出，不提供默认导出。Cordis 的加载器会通过
// `exports.default ?? exports` 收敛模块，因此 `export default apply` 会让插件
// 退化为一个裸函数，连同丢弃 `inject` 与 `name`——挂载随即报错
// `cannot get property "llm" without inject`。

/**
 * 插件配置。每个字段都是可选的：随包默认值直连公开的 CodeBuddy 服务，
 * 并且设计上完全没有凭据字段——唯一的进入方式就是浏览器登录。
 */
export interface Config {
  /** 聊天 endpoint base；默认为 CodeBuddy 的 OpenAI 兼容路由。 */
  baseURL?: string
  /** 目录未给出容量的模型所用的上下文容量。 */
  defaultContextWindow?: number
  /** 目录未设上限的模型所用的单请求输出上限。 */
  defaultMaxTokens?: number
  /** 一次流式读进行中时 provider 允许的最大空闲时间。 */
  streamIdleTimeoutMs?: number
}

/**
 * 校验并补全原始配置。
 *
 * 编程式构造可以绕过任何 schema，因此在这里判定边界，坏值会在加载时
 * 带字段名失败，而不是等到请求中途。
 * @param config - 原始入口配置。
 * @returns 解析后的连接事实。
 */
export function resolveConnectionOptions(config: Config = {}): CodeBuddyConnectionOptions {
  const positiveInteger = (value: number | undefined, field: string, fallback: number): number => {
    if (value === undefined) return fallback
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`dsh-codebuddy: ${field} must be a positive integer`)
    }
    return value
  }
  const streamIdleTimeoutMs = config.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS
  if (!Number.isFinite(streamIdleTimeoutMs) || streamIdleTimeoutMs <= 0) {
    throw new Error('dsh-codebuddy: streamIdleTimeoutMs must be a positive finite number')
  }
  const baseURL = config.baseURL ?? CODEBUDDY_CHAT_BASE
  if (baseURL.length === 0) {
    throw new Error('dsh-codebuddy: baseURL must not be empty')
  }
  return {
    // 末尾斜杠会产生 `//chat/completions`，某些网关对它的路由方式不同。
    baseURL: baseURL.replace(/\/+$/, ''),
    defaultContextWindow: positiveInteger(
      config.defaultContextWindow,
      'defaultContextWindow',
      DEFAULT_CONTEXT_WINDOW,
    ),
    defaultMaxTokens: positiveInteger(config.defaultMaxTokens, 'defaultMaxTokens', DEFAULT_MAX_TOKENS),
    streamIdleTimeoutMs,
  }
}

/** 挂载插件：解析配置，然后注册路由。 */
export function apply(ctx: Context, config: Config = {}): void {
  // 在加载时解析一次，让坏的入口配置在这里响亮地失败；thunk 让 adapter
  // 在每次操作时读取它。
  const resolved = resolveConnectionOptions(config)
  const session = new CodeBuddySession(ctx.logger)

  // 当前账号切换（手动 / 删除 / 新登录 / 自动接管）后，通过 adapter replace 广播
  // harness 的 `llm/adapters-updated`：模型选择器重新拉目录、用量指示器即时重拉，
  // 数据随账号即时同步，无需刷新页面。replace 保持同一 adapter 实例、原子交换
  // 同组路由，不产生请求窗口。
  let adapterHandle: { replace(providers: readonly string[]): void } | undefined
  const notifyModels = (): void => {
    try {
      adapterHandle?.replace([CODEBUDDY_PROVIDER])
    } catch (error) {
      ctx.logger.warn('dsh-codebuddy: model-catalog refresh after account switch failed')
      ctx.logger.warn(error)
    }
  }
  const runtimeServices = ctx as unknown as { get: (key: string) => unknown }
  const analytics: SessionAnalyticsServices = {
    sessionQuery: runtimeServices.get('sessionQuery') as SessionAnalyticsServices['sessionQuery'],
  }
  const auth = new CodeBuddyAuthService(ctx, session, notifyModels, analytics)
  const attachmentStore = (): AttachmentStore | undefined => runtimeServices.get('attachments') as AttachmentStore | undefined
  const adapter = new CodeBuddyAdapter({
    session,
    options: () => resolved,
    autoSwitch: () => auth.autoSwitch,
    onAccountSwitched: notifyModels,
    resolveAttachments: attachmentStore,
    resolveImageAccess: (attachments, ref) => resolveImageAttachmentAccess(
      attachments,
      hostPath => (runtimeServices.get('fs') as { processPathFromHostPath: (p: string) => string | undefined } | undefined)
        ?.processPathFromHostPath(hostPath),
      ref,
    ),
  })

  adapterHandle = ctx.llm.registerAdapter([CODEBUDDY_PROVIDER], adapter) as unknown as {
    replace(providers: readonly string[]): void
  }

  // 未登录时挂载是合法状态：路由照常注册，第一个请求会说明如何登录。
  // 在加载时说明一次，避免用户在第一条 prompt 时才意外发现。
  void session.isLoggedIn().then((loggedIn) => {
    if (loggedIn) return
    ctx.logger.info(
      'dsh-codebuddy: no CodeBuddy session stored; sign in through the Settings'
      + ' → CodeBuddy page in the Web UI (no API key needed).',
    )
  }).catch(() => {
    // 上报登录状态只是提示性质，绝不能让挂载失败。
  })
}
