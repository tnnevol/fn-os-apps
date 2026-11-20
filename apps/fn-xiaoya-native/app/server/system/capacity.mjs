/**
 * 设备性能探测与并发度推荐。
 *
 * 元数据同步是大量「抓小文件」的 IO 任务，并发数主要受两个因素限制：
 * CPU 核数（TLS 握手与正则解析都吃 CPU）与内存（每个连接持有缓冲区）。
 *
 * ## 16 是推荐值而不是上限
 *
 * 按设备性能算出的 16 只是「默认给多少」的建议值，用户完全可以在面板上
 * 调到更高——上游脚本本身就没有上限概念（它按网盘类型给 2/4/6 线程）。
 * 这里保留一个 64 的硬上限，纯粹是为了拦住明显有问题的输入
 * （手滑多打一个 0 之类），不代表鼓励用满。
 */
import { cpus, freemem, totalmem } from 'node:os'

/**
 * 允许配置的最大并发。
 *
 * 注意这不是「推荐值」——推荐值由 detectCapacity 按设备性能算出，
 * 典型设备落在 16。这里只是输入合法性边界，防止误填天文数字。
 */
export const MAX_CONCURRENCY = 64

/** 推荐值的收敛上限：设备再好也不主动推荐超过这个数。 */
export const RECOMMENDED_CAP = 16

/** 硬下限：低于 4 会把一次同步拖到不可接受。 */
export const MIN_CONCURRENCY = 4

/**
 * 探测设备性能并给出推荐并发数。
 *
 * 判定顺序：
 * 1. 以 CPU 核数为基准（每核 2 个并发，覆盖 TLS 握手的等待）；
 * 2. 小内存设备下调：总内存 ≤2GB 时收敛到 4——每个并发连接在 Node 里
 *    都有可观的缓冲开销，小内存设备并发过高会触发 GC 抖动；
 * 3. 收敛到 [4, 16]。
 *
 * 为什么用总内存而不是可用内存：`os.freemem()` 拿到的是 MemFree，
 * Linux 会把大量内存用作 page cache，导致「可用」长期很低（实测本机
 * 32GB 只报 67MB 可用），据此判断会把正常设备的并发错误地砍半。
 * 总内存稳定、能准确区分设备档次。
 *
 * @returns {{recommended: number, cores: number, freeMb: number, totalMb: number, reason: string}} 推荐值与依据
 */
export function detectCapacity() {
  let cores = 1
  try {
    cores = cpus().length || 1
  }
  catch {
    // 极端环境读不到 CPU 信息，按单核保守处理
    cores = 1
  }

  let freeMb = 0
  let totalMb = 0
  try {
    freeMb = Math.floor(freemem() / 1024 ** 2)
    totalMb = Math.floor(totalmem() / 1024 ** 2)
  }
  catch {
    // 读不到内存就不作为下调依据
  }

  // 每核 2 并发：抓小文件时一半时间在等网络，适度放大能提高吞吐
  let recommended = cores * 2
  let reason = `检测到 ${cores} 核 CPU`

  // 小内存设备收敛到下限，避免频繁 GC
  if (totalMb > 0 && totalMb <= 2048) {
    recommended = MIN_CONCURRENCY
    reason += `，总内存 ${totalMb}MB 属于小内存设备，已收敛到 ${MIN_CONCURRENCY}`
  }

  recommended = Math.min(Math.max(recommended, MIN_CONCURRENCY), RECOMMENDED_CAP)
  if (recommended === RECOMMENDED_CAP) reason += `，推荐值已到 ${RECOMMENDED_CAP}（仍可手动调高）`

  return {
    recommended,
    cores,
    freeMb,
    totalMb,
    reason,
  }
}
