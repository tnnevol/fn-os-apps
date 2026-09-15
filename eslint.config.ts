import antfu from '@antfu/eslint-config'
import { plugin as jsonConfig } from './scripts/eslint-plugin-json-config.ts'

export default antfu(
  {
    stylistic: false,
    typescript: true,
    vue: true,
    react: true,
    formatters: false,
    jsonc: true,
    yaml: false,
    ignores: [
      '**/lib/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/coverage/**',
      'packages/fnos-gateway/src/client/bridge.ts',
    ],
  },
  {
    rules: {
      'antfu/if-newline': 'off',
      'antfu/no-top-level-await': 'off',
      'antfu/consistent-list-newline': 'off',
      'import/consistent-type-specifier-style': 'off',
      'import/first': 'off',
      'import/no-duplicates': 'off',
      'perfectionist/sort-imports': 'off',
      'perfectionist/sort-named-imports': 'off',
      'perfectionist/sort-exports': 'off',
      'perfectionist/sort-named-exports': 'off',
      'node/prefer-global/buffer': 'off',
      'node/prefer-global/process': 'off',
      'prefer-template': 'off',
      'regexp/no-super-linear-backtracking': 'off',
      'regexp/no-useless-non-capturing-group': 'off',
      'regexp/optimal-quantifier-concatenation': 'off',
      'regexp/no-misleading-capturing-group': 'off',
      'regexp/use-ignore-case': 'off',
      'regexp/prefer-w': 'off',
      'ts/consistent-type-definitions': 'off',
      'ts/method-signature-style': 'off',
      'ts/no-import-type-side-effects': 'off',
      'ts/no-use-before-define': 'off',
      'style/brace-style': 'off',
      'style/max-statements-per-line': 'off',
      'style/operator-linebreak': 'off',
      'style/jsx-one-expression-per-line': 'off',
      'style/jsx-curly-brace-presence': 'off',
      'style/member-delimiter-style': 'off',
      'style/quote-props': 'off',
      'test/prefer-lowercase-title': 'off',
      'no-console': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['plugins/**/*.ts', 'plugins/**/*.tsx'],
    rules: {
      'no-console': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['docs/**/*.ts', 'docs/**/*.mts', 'docs/**/*.vue'],
    rules: {
      'no-console': 'off',
    },
  },
  // fnOS 无扩展名 JSON 配置：语法由 jsonc/x 语言守住（解析失败即 fatal），
  // 结构不变量由本地 json-config 插件校验。两类文件各挂各的规则，避免交叉误报。
  {
    files: ['apps/*/app/ui/config'],
    language: 'jsonc/x',
    plugins: { 'json-config': jsonConfig },
    rules: {
      'json-config/ui-config': 'error',
    },
  },
  {
    // 注意：无扩展名文件对末段 `*` / `**` 不匹配，必须枚举字面文件名
    // （fnOS 向导目前只有这三种；新增文件名时需同步更新此列表）。
    files: ['apps/*/wizard/{install,uninstall,config}'],
    language: 'jsonc/x',
    plugins: { 'json-config': jsonConfig },
    rules: {
      'json-config/wizard': 'error',
    },
  },
  // apps 打包目录内的运行时脚本：属应用产物而非仓库源码，只保留语法与
  // 安全基线，不套用仓库的代码风格规则。
  {
    files: ['apps/**/app/**/*.{js,mjs,cjs}'],
    rules: {
      'no-var': 'off',
      'vars-on-top': 'off',
      'prefer-const': 'off',
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'off',
      'unused-imports/no-unused-vars': 'off',
      'ts/no-unused-vars': 'off',
      'eqeqeq': 'off',
      'no-console': 'off',
      'prefer-arrow-callback': 'off',
      'object-shorthand': 'off',
    },
  },
  // .json/.jsonc 严格门禁：jsonc/x 语言按 EXTENDED 模式解析（允许注释与
  // 尾逗号），这两条规则把 node 消费 .json 所需的严格性补回来。
  {
    rules: {
      'jsonc/no-comments': 'error',
      'jsonc/comma-dangle': ['error', 'never'],
    },
  },
)
