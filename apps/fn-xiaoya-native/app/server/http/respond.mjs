/**
 * 统一响应与错误约定。
 *
 * 所有接口返回 `{ code, message, data }`。错误消息必须包含「原因 + 处理建议」，
 * 这样面板可以直接展示，用户不用回终端猜。
 */

/** 业务错误：带 HTTP 状态码与可展示的建议。 */
export class AppError extends Error {
  constructor(status, message, suggestion) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.suggestion = suggestion
  }

  /** 转成响应体。 */
  toBody() {
    return {
      code: this.status,
      message: this.message,
      suggestion: this.suggestion,
      data: null,
    }
  }
}

/** 400：请求参数不合法。 */
export function badRequest(message, suggestion) {
  return new AppError(400, message, suggestion)
}

/** 401：未认证。 */
export function unauthorized(message = '未认证') {
  return new AppError(401, message, '请从飞牛桌面重新打开应用')
}

/**
 * 403：已认证但无权限。
 *
 * suggestion 必须可覆盖：403 的原因不止「不是管理员」，
 * 还有「目录未授权」「当前用户对该路径无权限」等，
 * 统一硬编码成「请用管理员账号登录」会把用户引向完全错误的方向。
 */
export function forbidden(message = '需要管理员权限', suggestion = '请使用管理员账号登录飞牛后再操作') {
  return new AppError(403, message, suggestion)
}

/** 404：目标不存在。 */
export function notFound(message = '目标不存在', suggestion) {
  return new AppError(404, message, suggestion)
}

/** 409：状态冲突（例如任务已存在）。 */
export function conflict(message, suggestion) {
  return new AppError(409, message, suggestion)
}

/** 500：服务端失败。 */
export function serverError(message, suggestion) {
  return new AppError(500, message, suggestion)
}

/** 成功响应体。 */
export function ok(data = null, message = 'ok') {
  return { code: 0, message, data }
}

/**
 * 把未知错误归一化。
 *
 * Docker 不可用、命令不存在这类环境问题在消息上会重复出现，
 * 这里统一补一条可执行建议，避免把裸 `exit code 1` 抛给用户。
 */
export function normalizeError(error) {
  if (error instanceof AppError) return error
  const message = error instanceof Error ? error.message : String(error)
  if (/ENOENT/.test(message) && /docker/.test(message)) {
    return serverError('Docker 命令不可用', '请确认飞牛已安装 Docker 服务，且应用用户已加入 docker 组')
  }
  /**
   * 注意：不要把「文本里含 EACCES」一律归为目录权限问题。
   *
   * Docker 的报错里经常出现 permission denied（例如连接 socket 失败、
   * 挂载点不可写），但真实原因可能是 docker 组、SELinux 或 compose 文件问题。
   * 之前这里统一返回「应用数据目录归属」，把排查方向带偏了。
   *
   * 现在只在明确是文件系统路径操作失败时才给目录建议，
   * 其余情况把原始信息透出来，便于定位。
   */
  if (/EACCES/.test(message) && /(?:vol|var|etc|home)\d*\//.test(message)) {
    return serverError(
      `没有访问权限：${message}`,
      '请确认该路径归属应用用户（可查看 /api/system/diag 的归属与可写性）',
    )
  }
  if (/permission denied/i.test(message)) {
    return serverError(
      `权限不足：${message}`,
      '若与 Docker 相关，请确认应用用户已加入 docker 组；否则请查看应用日志',
    )
  }
  return serverError(message || '未知错误', '可查看应用日志获取详细信息')
}
