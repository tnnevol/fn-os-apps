

/** 与 panel.tsx 的 TokenStats 同形；这里只要求可缓存即可。 */
export interface TokenStatsPayload {
  rangeDays: number
  [key: string]: unknown
}
