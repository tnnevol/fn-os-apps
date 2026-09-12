/** CodeBuddy 类型声明；由原模块抽取，运行时实现保留在 src 下。 */

/** 账户身份明细（host 的 `panelStatus` 与 `accounts` 同一份数据）。 */
export interface AccountIdentityDetail {
  uid: string
  nickname: string
  /** 本地备注名；仅当与昵称不同才有展示价值。 */
  label?: string
  uin?: string
  enterpriseId?: string
  enterpriseName?: string
  enterpriseUserName?: string
  departmentFullName?: string
}
/** 弹框里一行「标签 / 值」。 */
export interface IdentityRow {
  key: string
  value: string
}
