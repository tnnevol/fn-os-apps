/**
 * fnOS 原生文件操作：把文件管理器调用从 React 组件里分离出来。
 *
 * 单独成模块有两个原因：组件一旦被 import 就会拉起 Semi 组件，测试环境解析
 * 不了；而这里的调用逻辑（web carrier 校验、路径直传）本身是纯的，可以独立
 * 断言。SDK 工厂由调用方注入，与 `sdk-title.ts` 的 `installFnosPageTitle`
 * 同一手法——该模块也不 import `sdk.ts`，因为 `@trimjs/web-app` 在 import 期
 * 就会读 `window`，测试环境没有 DOM。
 */

/**
 * 打开文件管理器所需的 SDK 最小形状。
 *
 * 显式声明而不是直接用 `TrimApp`：测试可以注入一个假实现。
 */
export interface FileManagerSdk {
  readonly isWeb: boolean
  readonly isStandaloneWeb: boolean
  ready(): Promise<unknown>
  openFileManager(path: string): Promise<unknown>
}

/**
 * 用 fnOS SDK 打开 NAS 文件管理器并定位到给定路径。
 *
 * 只在 web carrier 就绪时调用：fnOS iframe 未连上宿主时 SDK 会以 standalone
 * 模式启动，此时调用静默无效，必须显式失败。失败向上抛出，由调用方转成可见
 * 提示，不回退到 DSH 原生打开逻辑——NAS 服务容器里没有 `xdg-open`，回退只会
 * 把错误藏起来。
 *
 * 用 `openFileManager` 而不是 `openFile`：后者按文件类型交给系统默认应用打开，
 * 对目录没有意义，而这里的目标就是会话工作目录。
 *
 * @param path - 目标目录，通常是当前会话的工作目录。
 * @param createSdk - SDK 工厂，由组件传入（它负责 User-Agent 归一化）。
 */
export async function openFnosFileManager(
  path: string,
  createSdk: () => FileManagerSdk,
): Promise<void> {
  const sdk = createSdk()
  await sdk.ready()
  if (!sdk.isWeb || sdk.isStandaloneWeb) {
    throw new Error('fnOS iframe SDK did not initialize its web carrier')
  }
  // 不预检插件自己展示的授权目录列表：该列表用于浏览和选择，可能滞后于 fnOS
  // ACL 状态，预检会误拒合法路径。是否允许由 fnOS 自行判断。
  await sdk.openFileManager(path)
}
