/**
 * 本地 ESLint 插件：shell 脚本格式化与语法校验。
 *
 * 背景：仓库 shell 文件为 fnOS 生命周期脚本（apps/<app>/cmd/ 下无扩展名
 * 文件）与少量 .sh。此前由 `rg '^#!' | shfmt -d` 校验，但按内容匹配会误抓
 * markdown 示例、TS 字符串等含 shebang 字样的文件，导致 shfmt 解析无关
 * 文本失败。
 *
 * 本插件通过 @wasm-fmt/shfmt（shfmt 官方 Go 代码的 wasm 编译产物）在
 * ESLint 规则内完成：
 * - 语法校验：解析失败转为带行列的 lint error（消息与 shfmt CLI 逐字一致）
 * - 格式校验：format() 输出与源码不一致即报错，并支持 eslint --fix 自动修复
 *
 * 格式选项与 `shfmt -d -i 4` 对齐（indent 4 空格，其余默认），已对仓库全部
 * shell 文件验证 wasm 输出与本地 CLI 3.13.1 逐字节一致。
 *
 * @module eslint-plugin-shell-format
 */
import { format } from '@wasm-fmt/shfmt/node'
import type { Rule } from 'eslint'

/** shfmt CLI `-i 4` 对应的格式化选项。 */
const FORMAT_OPTIONS = { indent: 4 } as const

const shellFormatRule: Rule.RuleModule = {
  meta: {
    type: 'layout',
    schema: [],
    fixable: 'whitespace',
    docs: {
      description: 'shell 脚本必须通过 shfmt 格式检查（indent 4）',
    },
  },
  create(context) {
    return {
      Program(program): void {
        const source = context.sourceCode.getText()

        let formatted: string
        try {
          formatted = format(source, context.filename, FORMAT_OPTIONS)
        }
        catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          // wasm 报错形如 `path:2:1: \`|\` can only ...`，去掉路径前缀保留行列。
          const detail = message.replace(/^[^:]*:\d+:\d+:\s*/, '')
          const lineMatch = /:(\d+):(\d+):/.exec(message)
          const line = lineMatch ? Number(lineMatch[1]) : 1
          const column = lineMatch ? Number(lineMatch[2]) : 1
          context.report({
            loc: { line, column },
            message: `shell 语法错误：${detail}`,
          })
          return
        }

        if (formatted === source) return

        context.report({
          loc: { line: 1, column: 0 },
          message: 'shell 脚本不符合 shfmt 格式（indent 4），运行 eslint --fix 自动修复',
          fix: fixer => fixer.replaceTextRange([0, program.range![1]], formatted),
        })
      },
    }
  },
}

export const plugin = {
  meta: { name: 'eslint-plugin-shell-format' },
  rules: {
    format: shellFormatRule,
  },
}
