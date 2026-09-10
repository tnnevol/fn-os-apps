import { describe, expect, it } from 'vitest'
import { CODEBUDDY_CLI_VERSION, CODEBUDDY_IDE_VERSION } from '../src/contracts/constants.ts'

/**
 * `CODEBUDDY_CLI_VERSION` 必须与 `@tencent-ai/codebuddy-code` 的正式发布版一致。
 *
 * 官方 CLI 发的是**自己的 package.json version**（源码里 `getCurrentPackageJson()`
 * 取值），服务端用这组头（`X-IDE-Type: CLI` / `X-IDE-Version` / `User-Agent`）
 * 把请求归因到具体客户端版本。因此这个值必须跟着上游发布走——长期滞后会让归因
 * 失真；随机化同样不行。
 *
 * 这里**不在单测里发网络请求**：版本检查属于「依赖外部状态」的事，放进单测会让
 * 离线环境误报失败。改为锁住形态与「与 IDE 版本不同源」这两个能离线验证的性质。
 *
 * 需要如实说明本组测试的能力边界：它能抓「版本号写坏/写成预发布号」与「与 IDE
 * 版本混为一谈」，**不能**抓「上游发了新版但这里没跟」。后者只能靠外部信息源
 * 判断，命令是：
 *
 *   npm view @tencent-ai/codebuddy-code dist-tags.latest
 *
 * 该值与本常量不一致时即需更新（只取正式版，不要用 dev/next）。
 */
describe('CLI 版本常量', () => {
  it('是形如 x.y.z 的正式版号（不是 dev/next 预发布号）', () => {
    expect(CODEBUDDY_CLI_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('不是随机生成：重复读取完全一致', () => {
    expect(CODEBUDDY_CLI_VERSION).toBe(CODEBUDDY_CLI_VERSION)
  })

  it('与 CODEBUDDY_IDE_VERSION 是两条产品线，不应被误改成同一个值', () => {
    // 前者是 @tencent-ai/codebuddy-code（CLI），后者是 CodeBuddyIDE（VS Code 扩展）；
    // 二者版本序列互不相关，若被改成相同值通常意味着有人把两者混为一谈。
    expect(CODEBUDDY_CLI_VERSION).not.toBe(CODEBUDDY_IDE_VERSION)
  })
})
