
import type { CodeBuddyClientId } from '../../contracts/constants.ts'

/** 一条已存储的账号：凭据事实外加签发这些凭据时对应的账号事实。 */
export interface CodeBuddyAccountEntry {
  /** 本条目的稳定本地 id，登录时分配，用于切换。 */
  id: string
  auth: {
    accessToken: string
    /** 绝对过期时间（epoch 毫秒）。 */
    expiresAt: number
    refreshToken: string
    /** refresh token 的绝对过期时间（epoch 毫秒）。 */
    refreshExpiresAt: number
    domain: string
  }
  account: {
    uid: string
    nickname: string
    /** 登录时设置的本地展示备注名；缺省时回落到 `nickname`。 */
    label?: string
    /** 腾讯用户身份号（如 QQ openid），当账号披露时。 */
    uin?: string
    enterpriseId?: string
    /** 企业展示名，当账号是企业租户时。 */
    enterpriseName?: string
    /** 企业用户名（账号在租户内的名字）。 */
    enterpriseUserName?: string
    departmentFullName?: string
  }
  /**
   * 这份凭据签发时所针对的网络环境
   * （`CODEBUDDY_INTERNET_ENVIRONMENT`）。在环境概念出现之前存储的条目上
   * 不存在；此时 {@link resolveEntryEndpoint} 出于兼容把该条目视为
   * `internal`——即旧版硬编码端点。
   */
  environment?: string
  /**
   * `cloudhosted`/`selfhosted` 账号的显式服务根地址（企业自己的地址）。
   * 缺省表示"使用环境默认值"。
   */
  endpoint?: string
  /**
   * 登录时声明的客户端身份（`cli` / `workbuddy`）。
   *
   * 决定登录页与用量平面：WorkBuddy 走 `www.workbuddy.cn`，CLI 走环境默认地址。
   * 缺省视为 `cli`——历史条目在建此字段之前全部由 CLI 登录产生。
   */
  client?: CodeBuddyClientId
  /**
   * 该客户端上报的固定版本号（CLI 2.145.0 / WorkBuddy 5.5.6）。
   *
   * 存下来是为了让面板展示与实际请求一致：版本是产品发布版本、不随时间变化，
   * 因此它是账号属性而不是运行时随机值。
   */
  clientVersion?: string
}
/**
 * 持久化结构。成功保存之后 `activeId` 总是指向 `accounts` 中的某一条；
 * 瞬时的不匹配（手工编辑过的文件）读作"第一条为活动"而不是"没有账号"。
 */
export interface CodeBuddyStorage {
  /** 每个请求都用它认证的那条条目的 id。 */
  activeId: string
  accounts: CodeBuddyAccountEntry[]
}
/**
 * @deprecated 旧的单账号结构，由 {@link loadStorage} 迁移。
 */
export interface LegacyCodeBuddyStorage {
  auth: CodeBuddyAccountEntry['auth']
  account: CodeBuddyAccountEntry['account']
}
/** 持久化的自动切号偏好，存放在凭据文件旁边。 */
export interface AutoSwitchConfig {
  enabled: boolean
  thresholdPct: number
  /**
   * 磁盘上是否确实存在这份配置。
   *
   * 区分「读到了真实配置」与「文件不存在、返回了默认值」——调用方据此判断
   * 能否让客户端把已有的 localStorage 值迁移上来（老用户升级），还是必须
   * 一律以 Host 为准（否则就是用旧值覆盖新值）。
   */
  fromDisk: boolean
}
/** 持久化的自动签到偏好：插件是否每天自动为所有账号签到而无需手动
 *  操作。默认开启，与官方 workbuddy-switch 托盘行为一致。 */
export interface AutoCheckinConfig {
  enabled: boolean
}
/** 持久化的自动出游偏好：插件是否自动派发成长中心的伙伴出游（并领取
 *  其奖励）而无需手动操作。默认开启，与 workbuddy-switch 一致。 */
export interface AutoTravelConfig {
  enabled: boolean
}
