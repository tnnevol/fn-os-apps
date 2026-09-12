

/** 与 cordis 兼容的 logger 接口，使 session 可以脱离宿主直接使用。 */
export interface SessionLogger {
  warn: (message: unknown) => void
  error: (message: unknown) => void
}
