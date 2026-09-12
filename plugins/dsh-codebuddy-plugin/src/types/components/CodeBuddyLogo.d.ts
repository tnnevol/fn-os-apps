/** CodeBuddy 类型声明；由原模块抽取，运行时实现保留在 src 下。 */

export interface CodeBuddyLogoProps {
  size?: number
  /** `brand` 保持官方配色；`mono` 跟随 DSH 主题。 */
  variant?: 'brand' | 'mono'
}
