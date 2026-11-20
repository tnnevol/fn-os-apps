/**
 * API 响应类型定义模块
 *
 * 提供统一的 API 响应结构类型定义
 *
 * ## 主要功能
 *
 * - 基础响应结构定义
 * - 泛型支持（适配不同数据类型）
 * - 统一的响应格式约束
 *
 * ## 使用场景
 *
 * - API 请求响应类型约束
 * - 接口数据类型定义
 * - 响应数据解析
 *
 * @module types/common/response
 * @author Art Design Pro Team
 */

/** 基础 API 响应结构（与本应用后端一致：{ code, message, data }） */
export interface BaseResponse<T = unknown> {
  /** 状态码：0 表示成功，非 0 时即 HTTP 状态码 */
  code: number
  /** 消息 */
  message: string
  /** 处理建议：错误时后端会给出可执行的操作提示 */
  suggestion?: string
  /** 数据 */
  data: T
}
