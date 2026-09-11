/**
 * 文案索引：对外保持与旧单文件相同的导入形态
 * （`import { en, zh, type CodeBuddyLocaleKey } from './locales/index.ts'`）。
 *
 * 实际内容按语言拆在 `en.ts` / `zh.ts`——两文件各管一种语言，新增文案先 en 后 zh。
 *
 * @module dsh-codebuddy/locales
 */

export { en, type CodeBuddyLocaleKey } from './en.ts'
export { zh } from './zh.ts'
