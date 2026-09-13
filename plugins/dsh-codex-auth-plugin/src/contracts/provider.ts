/**
 * Codex 供应商标识：host 与 client 共用的契约。
 *
 * 这个常量原先定义在 `host/store.ts`，那个文件 import 了 `node:fs/promises`
 * 和 `dsh-atomic-write`，浏览器端不能引入。客户端的用量图标需要按选中模型的
 * 供应商判断显隐，因此把常量挪到这里，两端引用同一个值，不在组件里再写一份
 * 字面量——两处字符串漂移过一次就会静默不匹配。
 *
 * @module dsh-codex-auth/provider
 */

/** pi-ai provider id used by ChatGPT Codex OAuth. */
export const CODEX_PROVIDER = 'openai-codex'
