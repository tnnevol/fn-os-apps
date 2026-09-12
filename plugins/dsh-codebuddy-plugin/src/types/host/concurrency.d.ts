/** CodeBuddy 类型声明；由原模块抽取，运行时实现保留在 src 下。 */

export interface RunHandle {
  /** 幂等释放。 */
  release: () => void
}
