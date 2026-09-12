

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
