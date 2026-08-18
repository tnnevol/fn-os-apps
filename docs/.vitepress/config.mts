import { defineConfig } from 'vitepress'
import packageJson from '../../package.json'

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'fn-os-apps'
const base = process.env.DOCS_BASE || (process.env.GITHUB_ACTIONS === 'true' ? `/${repositoryName}/` : '/')

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

export default defineConfig({
  lang: 'zh-CN',
  title: 'fnOS Apps',
  description: '飞牛 fnOS 应用开发、构建与使用文档。',
  base,
  head: [['link', { rel: 'icon', href: `${base}icons/site-icon.png` }]],
  cleanUrls: true,
  lastUpdated: true,
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
      { text: '开发指南', link: '/development/manifest' },
      { text: '构建发布', link: '/build/fnpack' },
      { text: '问题排查', link: '/troubleshooting' }
    ],
    sidebar: {
      '/guide/': [
        {
          text: '开始使用',
          items: [
            { text: '快速开始', link: '/guide/quick-start' },
            { text: '仓库结构', link: '/guide/repository-structure' }
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
          items: [{ text: '插件总览', link: '/plugins/' }]
        }
      ],
      '/development/': [
        {
          text: '开发指南',
          items: [
            { text: 'Manifest 配置', link: '/development/manifest' },
            { text: '生命周期脚本', link: '/development/lifecycle' },
            { text: '用户向导', link: '/development/wizard' },
            { text: '权限与入口', link: '/development/permissions' }
          ]
        }
      ],
      '/build/': [
        {
          text: '构建与发布',
          items: [
            { text: 'fnpack 打包', link: '/build/fnpack' },
            { text: '版本管理', link: '/build/versioning' },
            { text: 'CI 构建', link: '/build/ci' },
            { text: '发布流程', link: '/build/release' }
          ]
        }
      ],
      '/troubleshooting': [
        {
          text: '问题排查',
          items: [{ text: '常见问题', link: '/troubleshooting' }]
        }
      ],
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
