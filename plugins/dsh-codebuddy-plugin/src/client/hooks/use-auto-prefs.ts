/**
 * 三个 auto* 偏好的统一管理 hook。
 *
 * 拆出来的原因：AccountsPage 与设置页（CodeBuddySettings）共用同一组偏好
 * 持久化 + Host 同步，不集中写一处就得两边各抄一份、把那一组 RPC + store
 * 双向同步逻辑都重新维护。集中后的契约：
 *
 *  - store（`$autoCheckin` / `$autoSwitch` / `$autoTravel`）是展示态来源；
 *  - 挂载时**采纳** Host 的值（已持久化的部分），不把本地推过去；
 *  - 后续 store 变化（任何标签页/任何面板）都同步给 Host。
 *
 * 设置页的 mount 行为完全一样；迁移期的「老用户升级」处理交由设置页（面板
 * 不重复推），这个 hook 只关心挂载后的一致性。
 *
 * @module dsh-codebuddy/hooks/use-auto-prefs
 */

import { useEffect } from 'react'
import { useStore } from '@nanostores/react'
import { CODEBUDDY_AUTH_CHANNEL } from '../../contracts/constants.ts'
import type { ConnectionRpc } from '../rpc.ts'
import {
  $autoCheckin,
  $autoSwitch,
  $autoTravel,
  adoptHostPrefs,
  isAdoptingPrefs,
  subscribeUsagePref,
} from '../store/usage-prefs.ts'

/**
 * 把「三个偏好」绑到当前组件生命周期上：
 *  - 展示值用 `useStore`（底层即 useSyncExternalStore，订阅 store 变化）；
 *  - 挂载时 fetch Host 已持久化的偏好并写回 store；
 *  - 卸载/重 mount 时清理订阅。
 *
 * Host 采纳失败的兜底：失败时不写 store（store 现有值保留），让 UI 显示的
 * 是之前任一通道写入的值——总比回退成默认更稳定。
 *
 * @returns 三个偏好当前值（实时）+ 三个 setter。
 */
export function useAutoPrefs(rpc: ConnectionRpc): {
  autoCheckin: boolean
  autoSwitch: boolean
  autoTravel: boolean
} {
  const autoCheckinOn = useStore($autoCheckin)
  const autoSwitchOn = useStore($autoSwitch)
  const autoTravelOn = useStore($autoTravel)

  useEffect(() => {
    // 挂载时**从 Host 采纳**配置，而不是把本地的推上去。
    //
    // 曾经这里把三个开关的持久化值推给主机，会让 Host 上更新的值被旧 localStorage
    // 静默覆盖（与设置页同一问题）。现在方向统一为「Host 为准」；store 的 set 带
    // 相等性检查，值相同时不通知，因此不会触发回写循环。
    void rpc.call<{
      autoSwitch: boolean
      autoSwitchThresholdPct: number
      autoCheckin: boolean
      autoTravel: boolean
      hasStoredPrefs: boolean
    }>(CODEBUDDY_AUTH_CHANNEL, 'autoPrefs', {}).then((result) => {
      if (!result.ok) return
      const host = result.value
      if (!host.hasStoredPrefs) return   // 老用户升级由设置页负责迁移，面板不重复推
      /**
       * 整组原子采纳（含阈值），与设置页共用同一实现。
       *
       * 这里曾自己逐个 `set` 且**漏掉阈值**：设置页采纳 4 项、hook 只采纳 3 项，
       * 于是同一份 Host 配置在两端得到不同的本地副本（阈值是共享的持久化 atom）。
       * 两处各写一份必然漂移，因此收敛到 `adoptHostPrefs`。
       *
       * 该函数内部还会整组抑制回推：逐个 `set` 会同步触发下面的订阅回调，而回调
       * 推的是「当前全部偏好」——第一个 `set` 触发时其余尚未采纳，会把本地旧值
       * 推给 Host，把「Host 为准」反转成「本地为准」。
       */
      adoptHostPrefs(host)
    })
    /**
     * 偏好变化后把新值同步给 host。展示值本身由 store 驱动（见上面的 useStore），
     * 这里只负责 host 侧：面板关闭时组件仍挂载，设置页改动的开关必须让 host 也知道。
     *
     * 采纳期间**不回推**：那些变化源自 Host 自己，绕一圈推回去没有新信息，还会
     * 覆盖别的窗口在此期间做的修改（见 `whileAdoptingPrefs` 的说明）。
     *
     * 这里**故意不带** `thresholdPct`：阈值的写入方是设置页的滑杆（它已显式带上
     * 该字段），而 host 在字段缺省时会保留现值。若在这里也带上，等于让一个只关心
     * 布尔开关的回调去改写阈值——一旦将来有哪条路径让本地副本先于采纳变陈旧，
     * 就会把旧阈值推给 Host，正是这类不一致最难排查的形态。
     */
    return subscribeUsagePref(() => {
      if (isAdoptingPrefs()) return
      void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoCheckin', { enabled: $autoCheckin.get() })
      void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoTravel', { enabled: $autoTravel.get() })
      void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoSwitch', { enabled: $autoSwitch.get() })
    })
  }, [rpc])

  return { autoCheckin: autoCheckinOn, autoSwitch: autoSwitchOn, autoTravel: autoTravelOn }
}
