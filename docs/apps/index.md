# 应用目录

本项目按应用目录维护 fnOS 应用的打包配置。项目/FPK 版本由根目录 `version` 任务和 `bumpp` 维护，插件版本独立处理，具体运行依赖以各应用的 `manifest` 为准。

| 图标 | 应用 | <span style="white-space: nowrap">应用目录</span> | 类型 / 平台 | 运行依赖 | 项目源码 |
| --- | --- | --- | --- | --- | --- |
| <AppIcon name="fn-memos" alt="Memos 图标" :size="30" /> | [Memos](./fn-memos) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-memos) | Native / x86 | — | [源码](https://github.com/usememos/memos) |
| <AppIcon name="fn-moviepilot" alt="MoviePilot 图标" :size="30" /> | [MoviePilot](./fn-moviepilot) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-moviepilot) | Native / x86 | Python 3.12、Node.js 20 | [源码](https://github.com/jxxghp/MoviePilot) |
| <AppIcon name="fn-hermes-agent" alt="Hermes Agent 图标" :size="30" /> | [Hermes Agent](./fn-hermes-agent) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-hermes-agent) | Native / x86 | Python 3.11、fn-nvm、fn-uv | [源码](https://github.com/NousResearch/hermes-agent) |
| <AppIcon name="fn-uv" alt="uv 图标" :size="30" /> | [uv](./fn-uv) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-uv) | Native / x86 | — | [源码](https://github.com/astral-sh/uv) |
| <AppIcon name="fn-nvm" alt="NVM 图标" :size="30" /> | [NVM](./fn-nvm) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-nvm) | Native / x86 | — | [源码](https://github.com/nvm-sh/nvm) |
| <AppIcon name="fn-ohmyzsh" alt="Oh My Zsh 图标" :size="30" /> | [Oh My Zsh](./fn-ohmyzsh) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-ohmyzsh) | Native / x86 | — | [源码](https://github.com/ohmyzsh/ohmyzsh) |
| <AppIcon name="fn-reader" alt="阅读图标" :size="30" /> | [阅读](./fn-reader) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-reader) | Docker / x86 | — | [源码](https://github.com/hectorqin/reader) |
| <AppIcon name="fn-xiaoya-only" alt="小雅图标" :size="30" /> | [小雅](./fn-xiaoya-only) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-xiaoya-only) | Docker / x86 | — | [源码](https://github.com/xiaoyaLL/xiaoya) |
| <AppIcon name="fn-bitwarden" alt="Bitwarden 图标" :size="30" /> | [Bitwarden](./fn-bitwarden) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-bitwarden) | Docker / x86 | — | [源码](https://github.com/bitwarden/server) |
| <AppIcon name="fn-mysql-v8" alt="MySQL v8 图标" :size="30" /> | [MySQL v8](./fn-mysql-v8) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-mysql_v8) | Native / x86_64 | — | [源码](https://github.com/mysql/mysql-server) |
| <AppIcon name="fn-halo" alt="Halo 图标" :size="30" /> | [Halo](./fn-halo) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-halo) | Docker / x86 | — | [源码](https://github.com/halo-dev/halo) |
| <AppIcon name="fn-quark-auto-save" alt="夸克转存图标" :size="30" /> | [夸克转存](./fn-quark-auto-save) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-quark-auto-save) | Docker / x86 | — | [源码](https://github.com/Cp0204/quark-auto-save) |
| <AppIcon name="fn-new-api" alt="New API 图标" :size="30" /> | [New API](./fn-new-api) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-new-api) | Docker / x86 | Redis | [源码](https://github.com/QuantumNous/new-api) |
| <AppIcon name="fn-zentao" alt="禅道图标" :size="30" /> | [禅道](./fn-zentao) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-zentao) | Docker / x86 | — | [源码](https://github.com/easycorp/zentao) |
| <AppIcon name="fn-it-tools" alt="IT-Tools 图标" :size="30" /> | [IT-Tools](./fn-it-tools) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-it-tools) | Docker / x86 | — | [源码](https://github.com/CorentinTh/it-tools) |
| <AppIcon name="fn-linux-command" alt="Linux Command 图标" :size="30" /> | [Linux Command](./fn-linux-command) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-linux-command) | Docker / x86 | — | [源码](https://github.com/jaywcjlove/linux-command) |
| <AppIcon name="fn-adminer" alt="Adminer 图标" :size="30" /> | [Adminer](./fn-adminer) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-adminer) | Docker / x86 | — | [源码](https://github.com/vrana/adminer) |
| <AppIcon name="fn-browserless" alt="Browserless 图标" :size="30" /> | [Browserless](./fn-browserless) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-browserless) | Docker / x86 | — | [源码](https://github.com/browserless/browserless) |
| <AppIcon name="fn-chatgpt-next-web" alt="ChatGPT-Next-Web 图标" :size="30" /> | [ChatGPT-Next-Web](./fn-chatgpt-next-web) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-chatgpt-next-web) | Docker / x86 | — | [源码](https://github.com/Yidadaa/ChatGPT-Next-Web) |
| <AppIcon name="fn-cloudflared" alt="cloudflared 图标" :size="30" /> | [cloudflared](./fn-cloudflared) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-cloudflared) | Docker / x86 | Cloudflare 隧道 | [源码](https://github.com/cloudflare/cloudflared) |
| <AppIcon name="fn-cyberchef" alt="CyberChef 图标" :size="30" /> | [CyberChef](./fn-cyberchef) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-cyberchef) | Docker / x86 | — | [源码](https://github.com/gchq/CyberChef) |
| <AppIcon name="fn-llama-cpp" alt="llama.cpp 图标" :size="30" /> | [llama.cpp](./fn-llama-cpp) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-llama-cpp) | Docker / x86 | GGUF 模型文件 | [源码](https://github.com/ggml-org/llama.cpp) |
| <AppIcon name="fn-lobe-chat" alt="LobeChat 图标" :size="30" /> | [LobeChat](./fn-lobe-chat) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-lobe-chat) | Docker / x86 | — | [源码](https://github.com/lobehub/lobe-chat) |
| <AppIcon name="fn-memcached" alt="Memcached 图标" :size="30" /> | [Memcached](./fn-memcached) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-memcached) | Docker / x86 | — | [源码](https://github.com/memcached/memcached) |
| <AppIcon name="fn-web-check" alt="Web-Check 图标" :size="30" /> | [Web-Check](./fn-web-check) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-web-check) | Docker / x86 | — | [源码](https://github.com/lissy93/web-check) |
| <AppIcon name="fn-wechatmarkdowneditor" alt="WeChat Markdown Editor 图标" :size="30" /> | [WeChat Markdown Editor](./fn-wechatmarkdowneditor) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-wechatmarkdowneditor) | Docker / x86 | — | [源码](https://github.com/doocs/md) |
| <AppIcon name="fn-yesplaymusic" alt="YesPlayMusic 图标" :size="30" /> | [YesPlayMusic](./fn-yesplaymusic) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-yesplaymusic) | Docker / x86 | — | [源码](https://github.com/qier222/YesPlayMusic) |
| <AppIcon name="fn-zabbix-agent" alt="Zabbix Agent 图标" :size="30" /> | [Zabbix Agent](./fn-zabbix-agent) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-zabbix-agent) | Docker / x86 | Zabbix Server | [源码](https://github.com/zabbix/zabbix) |
| <AppIcon name="fn-2fauth" alt="2FAuth 图标" :size="30" /> | [2FAuth](./fn-2fauth) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-2fauth) | Docker / x86 | — | [源码](https://github.com/Bubka/2FAuth) |
| <AppIcon name="fn-ai-portal" alt="1Panel AI 门户图标" :size="30" /> | [1Panel AI 门户](./fn-ai-portal) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-ai-portal) | Docker / x86 | 1Panel 企业版实例 | [源码](https://github.com/1Panel-dev/AI-Portal) |
| <AppIcon name="fn-answer" alt="Answer 图标" :size="30" /> | [Answer](./fn-answer) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-answer) | Docker / x86 | — | [源码](https://github.com/answerdev/answer) |
| <AppIcon name="fn-artalk" alt="Artalk 图标" :size="30" /> | [Artalk](./fn-artalk) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-artalk) | Docker / x86 | — | [源码](https://github.com/ArtalkJS/Artalk) |
| <AppIcon name="fn-bytebase" alt="Bytebase 图标" :size="30" /> | [Bytebase](./fn-bytebase) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-bytebase) | Docker / x86 | — | [源码](https://github.com/bytebase/bytebase) |
| <AppIcon name="fn-certimate" alt="Certimate 图标" :size="30" /> | [Certimate](./fn-certimate) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-certimate) | Docker / x86 | — | [源码](https://github.com/usual2970/certimate) |
| <AppIcon name="fn-changedetectionio" alt="Changedetection.io 图标" :size="30" /> | [Changedetection.io](./fn-changedetectionio) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-changedetectionio) | Docker / x86 | — | [源码](https://github.com/dgtlmoon/changedetection.io) |
| <AppIcon name="fn-clawswarm" alt="ClawSwarm 图标" :size="30" /> | [ClawSwarm](./fn-clawswarm) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-clawswarm) | Docker / x86 | — | [源码](https://github.com/1Panel-dev/ClawSwarm) |
| <AppIcon name="fn-code-server" alt="code-server 图标" :size="30" /> | [code-server](./fn-code-server) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-code-server) | Docker / x86 | — | [源码](https://github.com/coder/code-server) |
| <AppIcon name="fn-freshrss" alt="FreshRSS 图标" :size="30" /> | [FreshRSS](./fn-freshrss) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-freshrss) | Docker / x86 | — | [源码](https://github.com/FreshRSS/FreshRSS) |
| <AppIcon name="fn-gotify" alt="Gotify 图标" :size="30" /> | [Gotify](./fn-gotify) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-gotify) | Docker / x86 | — | [源码](https://github.com/gotify/server) |
| <AppIcon name="fn-linkding" alt="linkding 图标" :size="30" /> | [linkding](./fn-linkding) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-linkding) | Docker / x86 | — | [源码](https://github.com/sissbruecker/linkding) |
| <AppIcon name="fn-maxkb" alt="MaxKB 图标" :size="30" /> | [MaxKB](./fn-maxkb) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-maxkb) | Docker / x86 | — | [源码](https://github.com/1Panel-dev/MaxKB) |
| <AppIcon name="fn-qinglong" alt="青龙图标" :size="30" /> | [青龙](./fn-qinglong) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-qinglong) | Docker / x86 | — | [源码](https://github.com/whyour/qinglong) |
| <AppIcon name="fn-ai-gateway" alt="1Panel AI 网关图标" :size="30" /> | [1Panel AI 网关](./fn-ai-gateway) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-ai-gateway) | Docker / x86 | — | [源码](https://github.com/1Panel-dev/1Panel-Gateway) |
| <AppIcon name="fn-archivebox" alt="ArchiveBox 图标" :size="30" /> | [ArchiveBox](./fn-archivebox) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-archivebox) | Docker / x86 | — | [源码](https://github.com/ArchiveBox/ArchiveBox) |
| <AppIcon name="fn-bililive-go" alt="Bililive-go 图标" :size="30" /> | [Bililive-go](./fn-bililive-go) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-bililive-go) | Docker / x86 | — | [源码](https://github.com/hr3lxphr6j/bililive-go) |
| <AppIcon name="fn-cloudbeaver" alt="CloudBeaver 图标" :size="30" /> | [CloudBeaver](./fn-cloudbeaver) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-cloudbeaver) | Docker / x86 | — | [源码](https://github.com/dbeaver/cloudbeaver) |
| <AppIcon name="fn-comfyui" alt="ComfyUI 图标" :size="30" /> | [ComfyUI](./fn-comfyui) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-comfyui) | Docker / x86 | — | [源码](https://github.com/Comfy-Org/ComfyUI) |
| <AppIcon name="fn-convertx" alt="ConvertX 图标" :size="30" /> | [ConvertX](./fn-convertx) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-convertx) | Docker / x86 | — | [源码](https://github.com/C4illin/ConvertX) |
| <AppIcon name="fn-dosgame" alt="中文 DOS 游戏图标" :size="30" /> | [中文 DOS 游戏](./fn-dosgame) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-dosgame) | Docker / x86 | — | [源码](https://github.com/rwv/chinese-dos-games) |
| <AppIcon name="fn-filecodebox" alt="FileCodeBox 图标" :size="30" /> | [FileCodeBox](./fn-filecodebox) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-filecodebox) | Docker / x86 | — | [源码](https://github.com/vastsa/FileCodeBox) |
| <AppIcon name="fn-laya-server" alt="Laya Server 图标" :size="30" /> | [Laya Server](./fn-laya-server) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-laya-server) | Docker / x86 | — | [源码](https://github.com/1Panel-dev/laya-server) |
| <AppIcon name="fn-n8n" alt="n8n 图标" :size="30" /> | [n8n](./fn-n8n) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-n8n) | Docker / x86 | — | [源码](https://github.com/n8n-io/n8n) |
| <AppIcon name="fn-newsnow" alt="NewsNow 图标" :size="30" /> | [NewsNow](./fn-newsnow) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-newsnow) | Docker / x86 | — | [源码](https://github.com/ourongxing/newsnow) |
| <AppIcon name="fn-ollama" alt="Ollama 图标" :size="30" /> | [Ollama](./fn-ollama) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-ollama) | Docker / x86 | — | [源码](https://github.com/ollama/ollama) |
| <AppIcon name="fn-openldap" alt="OpenLDAP 图标" :size="30" /> | [OpenLDAP](./fn-openldap) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-openldap) | Docker / x86 | — | [源码](https://github.com/openldap/openldap) |

## 安装方式

应用可以从 [GitHub Releases](https://github.com/tnnevol/fn-os-apps/releases) 下载 `.fpk` 文件后，在 fnOS 应用中心手动安装；开发调试时可使用 `appcenter-cli install-local`。涉及应用专属配置时，以对应应用页面为准。

## 下载

应用安装包可在 [GitHub Releases](https://github.com/tnnevol/fn-os-apps/releases) 页面下载。
