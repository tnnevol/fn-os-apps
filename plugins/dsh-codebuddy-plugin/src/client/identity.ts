/**
 * 账户身份信息的展示辅助。
 *
 * 单独成模块（不放进 panel.tsx）是为了可测：panel.tsx 一旦被 import 就会拉起
 * Semi 组件，测试环境解析不了 JSX/样式。设置页与面板的「账户信息」弹框都需要
 * 这几个函数，放在这里避免两处各写一份。
 *
 * @module dsh-codebuddy/identity
 */

/**
 * 解码部门名。
 *
 * 服务端把部门路径按 UTF-8 字节做 base64（如 `5oqA5pyv6YOo` → `技术部`），
 * 直接展示会是一串乱码。解码失败时原样返回：宁可显示原始串，也不要因为一个
 * 字段解析不了就让整行消失。
 */
export function decodeDepartment(raw: string): string {
  try {
    const decoded = atob(raw)
    return new TextDecoder().decode(Uint8Array.from(decoded, (c) => c.charCodeAt(0)))
  } catch {
    return raw
  }
}

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

/**
 * 把账户身份明细整理成待展示的行。
 *
 * 只保留**有值**的字段：缺字段渲染成「—」会让弹框塞满占位符，反而看不清哪些
 * 信息是真的有。备注名也只在与昵称不同时才列出——相同时它不提供增量信息。
 *
 * @param account - 账户身份明细。
 * @param labels - 各字段的本地化标签。
 * @returns 按「标识 → 归属 → 部门」顺序排列的行。
 */
export function identityRows(
  account: AccountIdentityDetail,
  labels: {
    uid: string
    nickname: string
    label: string
    uin: string
    enterprise: string
    enterpriseId: string
    enterpriseUser: string
    department: string
  },
): IdentityRow[] {
  const rows: IdentityRow[] = [{ key: labels.uid, value: account.uid }]
  // 昵称与备注名总是成对展示：账号列表里显示的是备注名（若有），用户需要知道
  // 它对应哪个真实昵称。
  rows.push({ key: labels.nickname, value: account.nickname })
  if (account.label !== undefined && account.label !== account.nickname) {
    rows.push({ key: labels.label, value: account.label })
  }
  if (account.uin !== undefined) rows.push({ key: labels.uin, value: account.uin })
  if (account.enterpriseName !== undefined) rows.push({ key: labels.enterprise, value: account.enterpriseName })
  if (account.enterpriseId !== undefined) rows.push({ key: labels.enterpriseId, value: account.enterpriseId })
  if (account.enterpriseUserName !== undefined) {
    rows.push({ key: labels.enterpriseUser, value: account.enterpriseUserName })
  }
  if (account.departmentFullName !== undefined) {
    rows.push({ key: labels.department, value: decodeDepartment(account.departmentFullName) })
  }
  return rows
}
