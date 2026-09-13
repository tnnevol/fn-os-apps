/**
 * fnOS 插件静态资源的同源前缀。
 *
 * 插件的前端资源不内联进客户端 bundle，而是由插件自己在 DSH 注册的路由提供。
 * 客户端用这个前缀引用，例如：
 *
 * ```text
 * /fnos-plugins/static/dsh-fnos/file-manager.png
 * ```
 *
 * 该前缀同时列在网关的 `builtinPaths` 中，浏览器 bridge 才会为它补上
 * `/app/fn-deepseek-harness` 应用前缀——与 `/api`、`/plugins`、`/open-in-app`
 * 同一机制。少了这一条，fnOS 宿主会用自己的 404 回应，资源就取不到。
 *
 * 命名空间归插件所有：它不代理到 DSH 的既有路径，也不读取 fnOS 宿主的静态
 * 资源目录（那是宿主未公开的内部布局，随版本可能变动）。
 */

/** 客户端引用与插件路由共用的前缀。 */
export const FNOS_STATIC_PREFIX = '/fnos-plugins/static/dsh-fnos'

/**
 * 允许通过该前缀读取的资源文件名。
 *
 * 显式列举而不是拼接请求路径：请求路径只用于查表，未命中即 404，因此不存在
 * 路径穿越的余地。新增资源要在插件包里同时放进对应的源文件。
 */
export const FNOS_STATIC_ASSETS = ['file-manager.png'] as const

export type FnosStaticAsset = typeof FNOS_STATIC_ASSETS[number]

/** 图片资源的文件名到 content-type 映射；只列已知类型。 */
export function contentTypeOf(name: string): string | undefined {
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.svg')) return 'image/svg+xml'
  return undefined
}
