/**
 * 网关身份与鉴权。
 *
 * 生产环境：请求由飞牛统一网关转发，用户信息放在三个 Header 里。
 * 开发环境：没有网关，使用固定的本地开发身份，绝不把 Header 当作可信来源。
 *
 * 两者必须显式区分：开发环境若信任 `X-Trim-Isadmin`，本地任何人都能自封管理员；
 * 生产环境若不校验，未登录请求就能拿到管理员接口。
 */
import { isDev } from '../paths.mjs'
import { forbidden, unauthorized } from './respond.mjs'

/** 开发环境的固定身份。 */
const devUser = {
  uid: 'dev',
  username: 'developer',
  isAdmin: true,
  source: 'development',
}

/**
 * 从请求解析用户上下文。
 *
 * @param {import('node:http').IncomingMessage} req
 * @returns {{uid: string, username: string, isAdmin: boolean, source: string}}
 */
export function resolveUser(req) {
  if (isDev) return devUser

  const uid = req.headers['x-trim-userid']
  if (typeof uid !== 'string' || uid === '') {
    // 没有网关 Header 说明请求绕过了网关（例如直连应用端口）
    throw unauthorized('缺少网关身份信息')
  }
  return {
    uid,
    username: typeof req.headers['x-trim-username'] === 'string' ? req.headers['x-trim-username'] : '',
    isAdmin: req.headers['x-trim-isadmin'] === 'true',
    source: 'gateway',
  }
}

/**
 * 要求管理员身份。
 *
 * 写配置、管理容器、创建任务都属于高风险操作，普通用户不允许调用。
 *
 * @param {{isAdmin: boolean}} user
 */
export function requireAdmin(user) {
  if (!user.isAdmin) throw forbidden()
}
