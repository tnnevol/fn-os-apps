
/** CodeBuddy 类型声明；由原模块抽取，运行时实现保留在 src 下。 */
import type { en } from '../../../client/locales/en.ts'

/** 全部文案键的联合类型；zh 文件以此约束键集合。 */
export type CodeBuddyLocaleKey = keyof typeof en
