import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-mermaid-plugin'
import packageJson from '../package.json'

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
}

const appItems = [
  { text: '应用总览', link: '/apps/' },
  { text: 'Memos', link: '/apps/fn-memos' },
  { text: 'MoviePilot', link: '/apps/fn-moviepilot' },
  { text: 'Hermes Agent', link: '/apps/fn-hermes-agent' },
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

const startItems = [
  { text: '快速开始', link: '/development/quick-start' },
  { text: '仓库结构', link: '/development/repository-structure' },
  { text: 'SDD 维护规范', link: '/development/sdd-workflow' },
  { text: 'SDD 模式转换报告', link: '/development/sdd-transition-report' }
]

const developmentSidebar = [
  {
    text: '开始使用',
    items: startItems
  },
  {
    text: '开发指南',
    items: [
      { text: '开发环境与脚本', link: '/development/environment-and-scripts' },
      { text: 'Package 任务与 Turbo', link: '/development/package-tasks-and-turbo' },
      { text: 'GitHub Workflow', link: '/development/github-workflows' },
      { text: 'Manifest 配置', link: '/development/manifest' },
      { text: '生命周期脚本', link: '/development/lifecycle' },
      { text: '权限与入口', link: '/development/permissions' },
      { text: '用户向导', link: '/development/wizard' },
      { text: '贡献指南', link: '/contributing' }
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
    items: [{ text: '规范', link: '/requirements/' }]
  }
]

const plansSidebar = [
  {
    text: '详细计划',
    items: [{ text: '规范', link: '/plans/' }]
  }
]

export default withMermaid(defineConfig({
  lang: 'zh-CN',
  title: 'fnOS Apps',
  description: '飞牛 fnOS 应用开发、构建与使用文档。',
  base,
  vite: {
    server: {
      port: 9876
    }
  },
  // 亮色模式使用 neutral 主题；深色模式由插件在检测到 `.dark` 后自动切到 `dark`。
  mermaid: {
    theme: 'neutral',
    flowchart: {
      curve: 'basis',
      useMaxWidth: true
    },
    sequence: {
      useMaxWidth: true
    }
  },
  mermaidPlugin: {
    class: 'mermaid-diagram'
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
      { text: '开发指南', link: '/development/quick-start' },
      { text: '应用文档', link: '/apps/' },
      { text: '需求清单', link: '/requirements/' },
      { text: '详细计划', link: '/plans/' }
    ],
    sidebar: {
      '/apps/': [
        {
          text: '应用文档',
          items: appItems
        }
      ],
      '/development/': developmentSidebar,
      '/build/': developmentSidebar,
      '/troubleshooting': developmentSidebar,
      '/requirements/': requirementsSidebar,
      '/plans/': plansSidebar,
      '/contributing': developmentSidebar
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
}))
