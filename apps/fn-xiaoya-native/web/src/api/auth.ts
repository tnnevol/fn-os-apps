/**
 * 身份获取。
 *
 * 本应用没有「用户名 + 密码换 token」这一步：
 * - 生产环境由飞牛统一网关先校验登录态，再把用户信息注入 Header；
 * - 开发环境后端直接返回固定的本地开发身份。
 *
 * 所以这里只需要问后端「当前是谁」。刻意保留 `fetchGetUserInfo` 这个函数名，
 * 是为了让脚手架的守卫与状态管理不用改动调用点。
 */
import request from '@/utils/http'

/** 当前用户信息，字段与脚手架 `Api.Auth.UserInfo` 对齐。 */
export interface CurrentUser {
  userId: string
  userName: string
  roles: string[]
  buttons: string[]
}

interface ContextEnvelope {
  code: number
  message: string
  data: {
    user: { uid: string; username: string; isAdmin: boolean; source: string }
    mode: 'development' | 'production'
    version: string
  }
}

/**
 * 获取当前用户。
 *
 * 管理员映射为 `R_SUPER`，普通用户映射为 `R_USER`：
 * 脚手架的菜单与按钮权限都按角色名判断，这里做一次收敛，
 * 避免把飞牛的布尔值散落到各个页面里。
 */
export function fetchGetUserInfo() {
  return request.get<ContextEnvelope>({ url: '/api/system/context' }).then((response) => {
    const { user, mode, version } = response.data
    return {
      userId: user.uid,
      userName: user.username || user.uid,
      roles: [user.isAdmin ? 'R_SUPER' : 'R_USER'],
      buttons: [],
      // 附加字段供界面展示运行模式，不影响脚手架原有逻辑
      mode,
      version
    } as CurrentUser & { mode: string; version: string }
  })
}

/** 保留导出名兼容脚手架的引用，不再提供本地登录。 */
export function fetchLogin() {
  return Promise.reject(new Error('本应用通过飞牛网关鉴权，无需账号密码登录'))
}
