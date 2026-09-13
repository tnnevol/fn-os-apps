/**
 * 插件自带静态资源的 DSH 侧路由。
 *
 * 客户端以 `/fnos-plugins/static/dsh-fnos/<资源>` 引用插件资源；该前缀同时
 * 列在网关 `builtinPaths` 中，浏览器 bridge 才会为它补上应用前缀，fnOS 宿主
 * 再把请求转到网关、由网关转发到 DSH，最终落到这里。
 *
 * 安全性：请求路径只用于**查表**，未命中即 404。不把请求路径拼进文件系统
 * 路径，因此不存在路径穿越；也不读取 fnOS 宿主的静态目录。资源随插件包发布，
 * 由构建阶段从 `src/assets/` 拷到 `lib/assets/`。
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { contentTypeOf, FNOS_STATIC_ASSETS, FNOS_STATIC_PREFIX, type FnosStaticAsset } from '../contracts/static-assets-contract.ts'

export interface StaticAssetRouteOptions {
  /**
   * 资源目录覆盖，仅用于测试。
   *
   * 生产环境按编译产物定位：host 半边被打包成单个 `lib/index.js`，因此
   * `import.meta.url` 指向 `lib/`，资源在 `lib/assets/`。测试直接加载源码时
   * 该相对位置不成立，于是显式传入夹具目录，而不是往构建产物里写占位文件。
   */
  assetsDirectory?: string
}

/** 资源随构建拷贝到 `lib/assets/`，与编译后的 `lib/index.js` 同级。 */
function defaultAssetsDirectory(): string {
  return join(dirname(fileURLToPath(import.meta.url)), 'assets')
}

function isKnownAsset(name: string): name is FnosStaticAsset {
  return (FNOS_STATIC_ASSETS as readonly string[]).includes(name)
}

function sendNotFound(res: ServerResponse): void {
  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ error: 'static-asset-not-found' }))
}

/**
 * 取请求路径里最后一段作为资源名。
 *
 * 只看最后一段：前缀本身由 webServer 的路由前缀匹配保证，资源名不允许再带
 * 斜杠，因此不需要也不应该解析任意相对路径。
 */
function assetNameOf(url: string | undefined): string | undefined {
  const pathname = String(url ?? '').split('?', 1)[0] ?? ''
  const name = pathname.slice(FNOS_STATIC_PREFIX.length).replace(/^\/+/, '')
  if (name === '' || name.includes('/')) return undefined
  return name
}

export function registerStaticAssetRoute(ctx: Context, options: StaticAssetRouteOptions = {}): void {
  const directory = options.assetsDirectory ?? defaultAssetsDirectory()
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: FNOS_STATIC_PREFIX,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { allow: 'GET, HEAD' })
        res.end()
        return
      }
      const name = assetNameOf(req.url)
      if (name === undefined || !isKnownAsset(name)) {
        sendNotFound(res)
        return
      }
      let bytes: Buffer
      try {
        bytes = await readFile(join(directory, name))
      } catch {
        // 构建没有把资源拷进来时走这里：明确 404，而不是回退到宿主目录。
        sendNotFound(res)
        return
      }
      res.writeHead(200, {
        'content-type': contentTypeOf(name) ?? 'application/octet-stream',
        // 资源随插件版本发布，文件名不变即内容不变。
        'cache-control': 'public, max-age=86400',
      })
      res.end(req.method === 'HEAD' ? undefined : bytes)
    },
  }), 'dsh-fnos: static assets')
}
