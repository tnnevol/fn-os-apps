import { afterEach, describe, expect, it, vi } from 'vitest'
import { openFnosFileManager, type FileManagerSdk } from '../../src/client/services/file-manager.ts'

/**
 * fnOS 原生文件入口的 SDK 调用。
 *
 * 这组测试守的是「打开文件管理器」这一步的契约：
 *
 * 1. 走 fnOS SDK 的 `openFileManager` 并把工作目录原样传下去（而不是
 *    `openFile`——后者对目录无意义）；
 * 2. 只在 web carrier 就绪时调用。非 web carrier 是真实失败模式：fnOS iframe
 *    没有连上宿主时 SDK 会以 standalone 模式启动，此时调用会静默无效；
 * 3. 失败向上抛出，由组件转成可见提示。不回退到 DSH 原生打开逻辑——NAS 服务
 *    容器里没有 `xdg-open`，回退只会把错误藏起来。
 */
function sdk(options: Partial<FileManagerSdk> = {}): FileManagerSdk {
  return {
    isWeb: true,
    isStandaloneWeb: false,
    ready: async () => undefined,
    openFileManager: async () => undefined,
    ...options,
  }
}

function factory(instance: FileManagerSdk): () => FileManagerSdk {
  return () => instance
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fnOS 文件管理器调用', () => {
  it('把工作目录原样交给 openFileManager', async () => {
    const opened: string[] = []
    await openFnosFileManager('/vol1/1000/project', factory(sdk({ openFileManager: async path => { opened.push(path) } })))
    expect(opened).toEqual(['/vol1/1000/project'])
  })

  it('先等待 SDK ready 再调用', async () => {
    const order: string[] = []
    await openFnosFileManager('/vol1/1000', factory(sdk({
      ready: async () => { order.push('ready') },
      openFileManager: async () => { order.push('open') },
    })))
    expect(order).toEqual(['ready', 'open'])
  })

  it('非 web carrier 时抛出而不是静默失败', async () => {
    await expect(openFnosFileManager('/vol1/1000', factory(sdk({ isWeb: false }))))
      .rejects.toThrow('web carrier')
  })

  it('standalone web 时同样抛出（未连上 fnOS 宿主）', async () => {
    await expect(openFnosFileManager('/vol1/1000', factory(sdk({ isStandaloneWeb: true }))))
      .rejects.toThrow('web carrier')
  })

  it('SDK 自身失败时向上传播，不回退到 DSH 原生打开', async () => {
    const opened: string[] = []
    await expect(openFnosFileManager('/vol1/1000', factory(sdk({
      openFileManager: async (path) => { opened.push(path); throw new Error('host refused') },
    })))).rejects.toThrow('host refused')
    expect(opened).toEqual(['/vol1/1000'])
  })

  it('不预检授权目录：路径直接交给 fnOS', async () => {
    // 授权列表可能滞后于 fnOS ACL，预检会误拒合法路径。
    const opened: string[] = []
    await openFnosFileManager('/vol4/not-in-plugin-list', factory(sdk({ openFileManager: async path => { opened.push(path) } })))
    expect(opened).toEqual(['/vol4/not-in-plugin-list'])
  })
})
