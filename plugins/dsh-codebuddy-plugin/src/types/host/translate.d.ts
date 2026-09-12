

/** 修复线缆参数时需要的 harness Tool 定义子集。 */
export interface ToolDefinition {
  name: string
  parameters: Record<string, unknown>
}
/** JSON Schema 对象，仅收窄到足以做属性级检查的程度。 */
export interface ObjectSchema {
  properties?: Record<string, unknown>
}
/** 组装过程中的一个已打开块。 */
export interface OpenBlock {
  index: number
  kind: 'text' | 'reasoning' | 'tool-call'
  text: string
  callId?: string
  name?: string
}
