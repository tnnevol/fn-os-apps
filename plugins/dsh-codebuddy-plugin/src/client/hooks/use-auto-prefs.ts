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
      $autoSwitch.set(host.autoSwitch)
      $autoCheckin.set(host.autoCheckin)
      $autoTravel.set(host.autoTravel)
    })
    // 偏好变化后把新值同步给 host。展示值本身由 store 驱动（见上面的 useStore），
    // 这里只负责 host 侧：面板关闭时组件仍挂载，设置页改动的开关必须让 host 也知道。
    return subscribeUsagePref(() => {
      void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoCheckin', { enabled: $autoCheckin.get() })
      void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoTravel', { enabled: $autoTravel.get() })
      void rpc.call(CODEBUDDY_AUTH_CHANNEL, 'autoSwitch', { enabled: $autoSwitch.get() })
    })
    // eslint-disable-next-line react/exhaustive-deps -- deps 有意收窄，见上方注释
  }, [rpc])

  return { autoCheckin: autoCheckinOn, autoSwitch: autoSwitchOn, autoTravel: autoTravelOn }
}
