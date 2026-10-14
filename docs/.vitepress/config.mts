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
  { text: '禅道', link: '/apps/fn-zentao' },
  { text: 'IT-Tools', link: '/apps/fn-it-tools' },
  { text: 'Linux Command', link: '/apps/fn-linux-command' },
  { text: 'Adminer', link: '/apps/fn-adminer' },
  { text: 'Browserless', link: '/apps/fn-browserless' },
  { text: 'ChatGPT-Next-Web', link: '/apps/fn-chatgpt-next-web' },
  { text: 'cloudflared', link: '/apps/fn-cloudflared' },
  { text: 'CyberChef', link: '/apps/fn-cyberchef' },
  { text: 'llama.cpp', link: '/apps/fn-llama-cpp' },
  { text: 'LobeChat', link: '/apps/fn-lobe-chat' },
  { text: 'Memcached', link: '/apps/fn-memcached' },
  { text: 'Web-Check', link: '/apps/fn-web-check' },
  { text: 'WeChat Markdown Editor', link: '/apps/fn-wechatmarkdowneditor' },
  { text: 'YesPlayMusic', link: '/apps/fn-yesplaymusic' },
  { text: 'Zabbix Agent', link: '/apps/fn-zabbix-agent' },
  { text: '2FAuth', link: '/apps/fn-2fauth' },
  { text: '1Panel AI 门户', link: '/apps/fn-ai-portal' },
  { text: 'Answer', link: '/apps/fn-answer' },
  { text: 'Artalk', link: '/apps/fn-artalk' },
  { text: 'Bytebase', link: '/apps/fn-bytebase' },
  { text: 'Certimate', link: '/apps/fn-certimate' },
  { text: 'Changedetection.io', link: '/apps/fn-changedetectionio' },
  { text: 'ClawSwarm', link: '/apps/fn-clawswarm' },
  { text: 'code-server', link: '/apps/fn-code-server' },
  { text: 'FreshRSS', link: '/apps/fn-freshrss' },
  { text: 'Gotify', link: '/apps/fn-gotify' },
  { text: 'linkding', link: '/apps/fn-linkding' },
  { text: 'MaxKB', link: '/apps/fn-maxkb' },
  { text: '青龙', link: '/apps/fn-qinglong' },
  { text: 'n8n', link: '/apps/fn-n8n' },
  { text: 'NewsNow', link: '/apps/fn-newsnow' },
  { text: 'OpenLDAP', link: '/apps/fn-openldap' },
  { text: 'Laya Server', link: '/apps/fn-laya-server' },
  { text: 'ArchiveBox', link: '/apps/fn-archivebox' },
  { text: '哔哩哔哩直播姬', link: '/apps/fn-bililive-go' },
  { text: 'CloudBeaver', link: '/apps/fn-cloudbeaver' },
  { text: 'ComfyUI', link: '/apps/fn-comfyui' },
  { text: 'ConvertX', link: '/apps/fn-convertx' },
  { text: 'DosGame', link: '/apps/fn-dosgame' },
  { text: 'FileCodeBox', link: '/apps/fn-filecodebox' },
  { text: 'Ollama', link: '/apps/fn-ollama' },
  { text: 'AI 网关', link: '/apps/fn-ai-gateway' },
  { text: 'Kirara Agent', link: '/apps/fn-kirara-agent' },
  { text: 'kkFileView', link: '/apps/fn-kkfileview' },
  { text: 'Kodbox', link: '/apps/fn-kodbox' },
  { text: 'Komari Monitor', link: '/apps/fn-komari' },
  { text: 'LocalAI', link: '/apps/fn-localai' },
  { text: 'MBlog', link: '/apps/fn-mblog' },
  { text: 'MkDocs Material', link: '/apps/fn-mkdocs-material' },
  { text: 'Nexus Repository', link: '/apps/fn-nexus' },
  { text: 'Nezha', link: '/apps/fn-nezha' },
  { text: 'Node-RED', link: '/apps/fn-node-red' },
  { text: 'Octop', link: '/apps/fn-octop' },
  { text: 'Open WebUI', link: '/apps/fn-ollama-webui' },
  { text: 'Opengist', link: '/apps/fn-opengist' },
  { text: 'pgAdmin 4', link: '/apps/fn-pgadmin4' },
  { text: '签到框架', link: '/apps/fn-qiandao' },
  { text: 'ShowDoc', link: '/apps/fn-showdoc' },
  { text: '思源笔记', link: '/apps/fn-siyuan' },
  { text: 'Synapse', link: '/apps/fn-synapse' },
  { text: 'Tiny RDM', link: '/apps/fn-tinyrdm' },
  { text: 'TrendRadar', link: '/apps/fn-trendradar' },
  { text: 'Vane', link: '/apps/fn-vane' },
  { text: 'Waline', link: '/apps/fn-waline' },
  { text: 'Apache Tomcat', link: '/apps/fn-tomcat' },
  { text: 'Beszel', link: '/apps/fn-beszel' },
  { text: 'Domain Admin', link: '/apps/fn-domain-admin' },
  { text: 'File Browser', link: '/apps/fn-filebrowser' },
  { text: 'Gatus', link: '/apps/fn-gatus' },
  { text: 'Kibana', link: '/apps/fn-kibana' },
  { text: 'NodeBB', link: '/apps/fn-nodebb' },
  { text: 'ONLYOFFICE Docs', link: '/apps/fn-onlyoffice' },
  { text: 'Stirling PDF', link: '/apps/fn-stirling-pdf' },
  { text: 'Sun-Panel', link: '/apps/fn-sun-panel' },
  { text: 'Twikoo', link: '/apps/fn-twikoo' },
  { text: 'UPage', link: '/apps/fn-upage' },
  { text: 'Uptime Kuma', link: '/apps/fn-uptime-kuma' },
  { text: 'Verdaccio', link: '/apps/fn-verdaccio' },
  { text: 'Wallos', link: '/apps/fn-wallos' },
  { text: 'ZFile', link: '/apps/fn-zfile' },
  { text: 'CoPaw', link: '/apps/fn-copaw' },
  { text: 'Dashy', link: '/apps/fn-dashy' },
  { text: 'EasyImage 2.0', link: '/apps/fn-easyimage2' },
  { text: 'Focalboard', link: '/apps/fn-focalboard' },
  { text: 'Glance', link: '/apps/fn-glance' },
  { text: 'Nextcloud', link: '/apps/fn-nextcloud' },
  { text: 'ntfy', link: '/apps/fn-ntfy' },
  { text: 'Obsidian LiveSync', link: '/apps/fn-obsidian-livesync' },
  { text: 'OpenClaw', link: '/apps/fn-openclaw' },
  { text: '幻兽帕鲁服务器工具', link: '/apps/fn-palworld-server-tool' },
  { text: 'phpMyAdmin', link: '/apps/fn-phpmyadmin' },
  { text: 'Jellyfin', link: '/apps/fn-jellyfin' },
  { text: 'Trilium Notes', link: '/apps/fn-trilium' },
  { text: 'Cordys CRM', link: '/apps/fn-cordys-crm' },
  { text: 'DataEase', link: '/apps/fn-dataease' },
  { text: 'DBHub', link: '/apps/fn-dbhub' },
  { text: 'DBX', link: '/apps/fn-dbx' },
  { text: 'Gitea', link: '/apps/fn-gitea' },
  { text: 'Nginx Proxy Manager', link: '/apps/fn-nginx-proxy-manager' },
  { text: 'SFTPGo', link: '/apps/fn-sftpgo' },
  { text: 'SQLBot', link: '/apps/fn-sqlbot' },
  { text: 'Umami', link: '/apps/fn-umami' },
  { text: 'WordPress', link: '/apps/fn-wordpress' },
  { text: 'Zabbix Proxy', link: '/apps/fn-zabbix-proxy' },
  { text: 'Zabbix Server', link: '/apps/fn-zabbix-server' },
  { text: 'AdGuard Home', link: '/apps/fn-adguardhome' },
  { text: 'Blinko', link: '/apps/fn-blinko' },
  { text: 'Casdoor', link: '/apps/fn-casdoor' },
  { text: 'Certd', link: '/apps/fn-certd' },
  { text: 'Cloudreve', link: '/apps/fn-cloudreve' },
  { text: 'Discuz!', link: '/apps/fn-discuz' },
  { text: 'draw.io', link: '/apps/fn-drawio' },
  { text: 'Firefly III', link: '/apps/fn-firefly-iii' },
  { text: 'Flarum', link: '/apps/fn-flarum' },
  { text: 'Ghost', link: '/apps/fn-ghost' },
  { text: 'Keycloak', link: '/apps/fn-keycloak' },
  { text: 'Logto', link: '/apps/fn-logto' },
  { text: 'Manticore Search', link: '/apps/fn-manticoresearch' },
  { text: 'Mattermost', link: '/apps/fn-mattermost' },
  { text: 'AFFiNE', link: '/apps/fn-affine' },
  { text: 'AList', link: '/apps/fn-alist' },
  { text: 'AstrBot', link: '/apps/fn-astrbot' },
  { text: 'BettaFish', link: '/apps/fn-bettafish' },
  { text: 'Discourse', link: '/apps/fn-discourse' },
  { text: 'Heimdall', link: '/apps/fn-heimdall' },
  { text: 'Koishi', link: '/apps/fn-koishi' },
  { text: 'LangBot', link: '/apps/fn-langbot' },
  { text: 'LangFlow', link: '/apps/fn-langflow' },
  { text: 'Maddy Mail Server', link: '/apps/fn-maddy-mail' },
  { text: 'Metabase', link: '/apps/fn-metabase' },
  { text: 'Miniflux', link: '/apps/fn-miniflux' },
  { text: 'DWZ', link: '/apps/fn-mliev-dwz' }
]

const startItems = [
  { text: '快速开始', link: '/development/quick-start' },
  { text: '仓库结构', link: '/development/repository-structure' },
  { text: 'SDD 维护规范', link: '/development/sdd-workflow' }
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
      { text: '1Panel 转换规约', link: '/development/1panel-conversion' },
      { text: '1Panel 应用转换清单', link: '/development/1panel-conversion-inventory' },
      { text: '转换踩坑与经验教训', link: '/development/1panel-conversion-lessons' },
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
    items: [
      { text: '规范', link: '/requirements/' },
      { text: 'FNOS-001 1Panel 应用转换', link: '/requirements/FNOS-001-1panel-app-conversion' }
    ]
  }
]

const plansSidebar = [
  {
    text: '详细计划',
    items: [
      { text: '规范', link: '/plans/' },
      { text: 'PLAN-FNOS-001 1Panel 应用转换执行计划', link: '/plans/PLAN-FNOS-001-1panel-app-conversion' }
    ]
  }
]

const testingSidebar = [
  {
    text: '测试用例',
    items: [
      { text: '规范', link: '/testing/' },
      { text: 'FNOS-001 1Panel 应用转换测试用例', link: '/testing/FNOS-001-test-cases' },
      { text: 'T0 试点第 1 轮报告', link: '/testing/FNOS-001-t0-round1-report' },
      { text: 'T0 收尾轮报告', link: '/testing/FNOS-001-t0-round2-report' },
      { text: 'T1 第 1 组报告', link: '/testing/FNOS-001-t1-group1-report' }
    ]
  }
]

const validationSidebar = [
  {
    text: '验收记录',
    items: [
      { text: '规范', link: '/validation/README' },
      { text: 'FNOS-001 真实环境验收记录（2026-10-09）', link: '/validation/FNOS-001-fnos-nas-2026-10-09' }
    ]
  }
]

export default withMermaid(defineConfig({
  lang: 'zh-CN',
  title: 'fnOS Apps',
  description: '飞牛 fnOS 应用开发、构建与使用文档。',
  base,
  vite: {
    resolve: {
      alias: [{
        find: /^dayjs$/,
        replacement: 'dayjs/esm/index'
      }]
    },
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
      { text: '详细计划', link: '/plans/' },
      { text: '测试与验收', link: '/testing/' }
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
      '/testing/': testingSidebar,
      '/validation/': validationSidebar,
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
