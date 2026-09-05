import { defineConfig } from 'vitepress'
import d2 from 'vitepress-plugin-d2'
import { FileType, Layout, Theme } from 'vitepress-plugin-d2/dist/config'
import packageJson from '../../package.json'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'fn-os-apps'
const base = process.env.DOCS_BASE || (process.env.GITHUB_ACTIONS === 'true' ? `/${repositoryName}/` : '/')

const markStatusTableColumns = (md: Parameters<NonNullable<Parameters<typeof defineConfig>[0]['markdown']>['config']>[0]) => {
  md.core.ruler.after('block', 'status-table-columns', (state) => {
    const { tokens } = state

    for (let tableStart = 0; tableStart < tokens.length; tableStart += 1) {
      if (tokens[tableStart].type !== 'table_open') continue

      const tableEnd = tokens.findIndex((token, index) => index > tableStart && token.type === 'table_close')
      if (tableEnd === -1) continue

      let headerColumn = 0
      let statusColumn = -1

      for (let index = tableStart + 1; index < tableEnd; index += 1) {
        const token = tokens[index]
        if (token.type === 'thead_close') break
        if (token.type !== 'th_open') continue

        const content = tokens[index + 1]?.type === 'inline' ? tokens[index + 1].content.trim() : ''
        if (content === '状态') statusColumn = headerColumn
        headerColumn += 1
      }

      if (statusColumn === -1) {
        tableStart = tableEnd
        continue
      }

      let cellColumn = 0
      for (let index = tableStart + 1; index < tableEnd; index += 1) {
        const token = tokens[index]
        if (token.type === 'tr_open') cellColumn = 0
        if (token.type !== 'th_open' && token.type !== 'td_open') continue

        if (cellColumn === statusColumn) token.attrJoin('class', 'status-column')
        cellColumn += 1
      }

      tableStart = tableEnd
    }
  })
}

const configureMarkdown = (md: Parameters<NonNullable<Parameters<typeof defineConfig>[0]['markdown']>['config']>[0]) => {
  markStatusTableColumns(md)
  md.use(d2, {
    layout: Layout.ELK,
    theme: Theme.NEUTRAL_DEFAULT,
    darkTheme: Theme.DARK_MUAVE,
    // 固定 SVG 的固有宽高，避免 image viewer 中 img 无法计算尺寸。
    scale: 1,
    // 输出为 img 可识别的 Base64 SVG，由 image viewer 提供放大、拖拽和全屏预览。
    fileType: FileType.BASE64_SVG,
    directory: '.vitepress/cache/d2'
  })
}

const appItems = [
  { text: '应用总览', link: '/apps/' },
  { text: 'Memos', link: '/apps/fn-memos' },
  { text: 'MoviePilot', link: '/apps/fn-moviepilot' },
  { text: 'Hermes Agent', link: '/apps/fn-hermes-agent' },
  { text: 'DeepSeek Harness', link: '/apps/fn-deepseek-harness' },
  { text: 'uv', link: '/apps/fn-uv' },
  { text: 'NVM', link: '/apps/fn-nvm' },
  { text: 'Oh My Zsh', link: '/apps/fn-ohmyzsh' },
  { text: '阅读', link: '/apps/fn-reader' },
  { text: '小雅', link: '/apps/fn-xiaoya-only' },
  { text: 'Bitwarden', link: '/apps/fn-bitwarden' },
  { text: 'MySQL v8', link: '/apps/fn-mysql-v8' },
  { text: 'Halo', link: '/apps/fn-halo' },
  { text: '夸克转存', link: '/apps/fn-quark-auto-save' },
  { text: 'New API', link: '/apps/fn-new-api' },
  { text: '禅道', link: '/apps/fn-zentao' }
]

const developmentSidebar = [
  {
    text: '开发指南',
    items: [
      { text: '开发环境与脚本', link: '/development/environment-and-scripts' },
      { text: 'Package 任务与 Turbo', link: '/development/package-tasks-and-turbo' },
      { text: 'GitHub Workflow', link: '/development/github-workflows' },
      { text: 'Manifest 配置', link: '/development/manifest' },
      { text: '生命周期脚本', link: '/development/lifecycle' },
      { text: '权限与入口', link: '/development/permissions' },
      { text: '用户向导', link: '/development/wizard' }
    ]
  },
  {
    text: '构建发布',
    items: [
      { text: 'fnpack 打包', link: '/build/fnpack' },
      { text: '版本管理', link: '/build/versioning' },
      { text: 'CI 构建', link: '/build/ci' },
      { text: '发布流程', link: '/build/release' }
    ]
  },
  {
    text: '问题排查',
    items: [{ text: '常见问题', link: '/troubleshooting' }]
  }
]

const requirementsSidebar = [
  {
    text: '需求清单',
    items: [
      { text: '规范', link: '/requirements/' },
      {
        text: 'FNOS-001 DSH 飞牛 NAS 适配',
        link: '/requirements/FNOS-001-dsh-fnos-adaptation'
      },
      {
        text: 'FNOS-002 DSH 应用与插件优化',
        link: '/requirements/FNOS-002-dsh-app-plugin-optimization'
      },
      {
        text: 'FNOS-003 FPK 应用运行设置统一',
        link: '/requirements/FNOS-003-fpk-runtime-settings'
      }
    ]
  }
]

const plansSidebar = [
  {
    text: '详细计划',
    items: [
      { text: '规范', link: '/plans/' },
      {
        text: 'PLAN-FNOS-001 DSH 飞牛 NAS 适配',
        link: '/plans/PLAN-FNOS-001-dsh-fnos-adaptation'
      },
      {
        text: 'PLAN-FNOS-002 DSH 应用与插件优化',
        link: '/plans/PLAN-FNOS-002-dsh-app-plugin-optimization'
      },
      {
        text: 'PLAN-FNOS-003 FPK 应用运行设置统一',
        link: '/plans/PLAN-FNOS-003-fpk-runtime-settings'
      }
    ]
  }
]

const testCasesSidebar = [
  {
    text: '测试用例',
    items: [
      { text: '规范', link: '/test-cases/' },
      { text: 'FNOS-002 测试用例明细', link: '/test-cases/FNOS-002-test-cases' }
    ]
  }
]

export default defineConfig({
  lang: 'zh-CN',
  title: 'fnOS Apps',
  description: '飞牛 fnOS 应用开发、构建与使用文档。',
  base,
  vite: {
    server: {
      port: 9876
    }
  },
  head: [['link', { rel: 'icon', href: `${base}icons/site-icon.png` }]],
  cleanUrls: true,
  lastUpdated: true,
  markdown: {
    config: configureMarkdown
  },
  themeConfig: {
    siteTitle: 'fnOS Apps',
    logo: {
      src: '/icons/site-icon.png',
      alt: '三方飞牛应用'
    },
    version: packageJson.version,
    nav: [
      { text: '开始使用', link: '/guide/quick-start' },
      { text: '应用文档', link: '/apps/' },
      { text: 'Harness 插件', link: '/plugins/' },
      { text: '开发指南', link: '/development/environment-and-scripts' },
      { text: '需求清单', link: '/requirements/' },
      { text: '详细计划', link: '/plans/' },
      { text: '测试用例', link: '/test-cases/' }
    ],
    sidebar: {
      '/guide/': [
        {
          text: '开始使用',
          items: [
            { text: '快速开始', link: '/guide/quick-start' },
            { text: '仓库结构', link: '/guide/repository-structure' },
            { text: 'SDD 维护规范', link: '/guide/sdd-workflow' },
            { text: 'SDD 模式转换报告', link: '/guide/sdd-transition-report' }
          ]
        }
      ],
      '/apps/': [
        {
          text: '应用文档',
          items: appItems
        }
      ],
      '/plugins/': [
        {
          text: 'Harness 插件',
          items: [
            { text: '插件总览', link: '/plugins/' },
            { text: 'dsh-fnos', link: '/plugins/dsh-fnos' },
            { text: 'dsh-codex-auth', link: '/plugins/dsh-codex-auth' },
            { text: 'DSH Semi UI', link: '/plugins/dsh-semi-ui' },
            { text: 'Semi UI 组件总览', link: '/plugins/semi-ui' },
            { text: 'DSH Semi UI 总览', link: '/plugins/dsh-semi-ui-showcase' }
          ]
        }
      ],
      '/development/': developmentSidebar,
      '/build/': developmentSidebar,
      '/troubleshooting': developmentSidebar,
      '/requirements/': requirementsSidebar,
      '/plans/': plansSidebar,
      '/test-cases/': testCasesSidebar,
      '/contributing': [
        {
          text: '参与贡献',
          items: [{ text: '贡献指南', link: '/contributing' }]
        }
      ]
    },
    outline: {
      level: [2, 3],
      label: '本页目录'
    },
    search: {
      provider: 'local'
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/tnnevol/fn-os-apps' }
    ],
    footer: {
      message: '基于 VitePress 构建',
      copyright: '© fnOS Apps Contributors'
    },
    docFooter: {
      prev: '上一页',
      next: '下一页'
    },
    lastUpdatedText: '最后更新'
  }
})
