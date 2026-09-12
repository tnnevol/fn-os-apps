import type { CodeBuddyModel, WireError } from '../types/host/types'
export type { ResponseBase, AuthState, AuthStateResponse, AuthToken, AuthTokenResponse, Account, AccountResponse, CodeBuddyReasoning, CodeBuddyModel, CodeBuddyConfig, ConfigResponse, CodeBuddyEnterpriseModel, CodeBuddyEnterpriseModelsResponse, WireError, WireUsage, WireToolCall, WireChunk, WirePart, WireContent, WireMessage, WireTool, WireRequest } from '../types/host/types'


/**
 * 目录是否披露了 harness 所需的容量。
 *
 * harness 对其提供的每个模型都需要正的 `contextWindow` 与输出上限，而
 * CodeBuddy 在非聊天模型的条目上两者都省略（补全、改写/跳转、图像生成）。
 * 为这些条目编造数字，会让按猜测定容量的不可用模型混进选择器，因此调用方
 * 改为直接丢弃它们。此判断放在线缆类型旁边，让列表与解析路径对「哪些条目
 * 可提供」不可能产生分歧。
 * @param model - 一个目录条目。
 * @returns 两项容量都存在且为正时为 true。
 */
export function hasDisclosedCapacity(model: CodeBuddyModel): boolean {
  return model.maxAllowedSize !== undefined && model.maxAllowedSize > 0
    && model.maxOutputTokens !== undefined && model.maxOutputTokens > 0
}

/**
 * 从任一错误信封里取出**能给人看的那句话**。
 *
 * 优先级：OpenAI 的 `error.message` → 嵌套的 `error.data.msg|message` → 顶层的
 * `msg`。取第一个非空值；都没有时返回 `undefined`，由调用方回退到带 HTTP 状态的
 * 兜底文案。
 * @param body - 已解析的错误响应体。
 * @returns 服务端原文，或 `undefined`。
 */
export function wireErrorMessage(body: WireError | undefined): string | undefined {
  if (body === undefined) return undefined
  const candidates: Array<string | undefined> = [
    body.error?.message,
    body.error?.data?.msg,
    body.error?.data?.message,
    body.msg,
  ]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate
  }
  return undefined
}

/**
 * 供**错误分类**使用的文本（业务 code + type + message 拼起来）。
 *
 * `httpErrorCode` 用它判断「额度耗尽 / 上下文超限」。注意 CodeBuddy 的文案是
 * **中文**，而 DSH 的判定正则是英文，因此中文文案本身匹配不上 —— 但业务 `code`
 * 能帮上忙，所以这里把 code 一并拼进去，让分类至少有据可依。
 * @param body - 已解析的错误响应体。
 * @returns 供正则匹配的文本（可能为空串）。
 */
export function wireErrorDetail(body: WireError | undefined): string {
  if (body === undefined) return ''
  const nested = body.error?.data
  return [
    body.code,
    body.error?.code,
    nested?.code,
    body.error?.type,
    nested?.type,
    wireErrorMessage(body),
  ]
    .filter(value => value !== undefined && value !== '')
    .map(String)
    .join(' ')
}
