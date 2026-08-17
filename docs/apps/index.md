# 应用目录

本项目按应用目录维护 fnOS 应用的打包配置。应用版本由根目录 `package.json` 和 `bump` 脚本统一维护，具体运行依赖以各应用的 `manifest` 为准。

| 图标 | 应用 | <span style="white-space: nowrap">应用目录</span> | 类型 / 平台 | 运行依赖 | 项目源码 |
| --- | --- | --- | --- | --- | --- |
| <AppIcon name="fn-memos" alt="Memos 图标" :size="30" /> | [Memos](./fn-memos) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-memos) | Native / x86 | — | [源码](https://github.com/usememos/memos) |
| <AppIcon name="fn-moviepilot" alt="MoviePilot 图标" :size="30" /> | [MoviePilot](./fn-moviepilot) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-moviepilot) | Native / x86 | Python 3.12、Node.js 20 | [源码](https://github.com/jxxghp/MoviePilot) |
| <AppIcon name="fn-hermes-agent" alt="Hermes Agent 图标" :size="30" /> | [Hermes Agent](./fn-hermes-agent) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-hermes-agent) | Native / x86 | Python 3.11、fn-nvm、fn-uv | [源码](https://github.com/NousResearch/hermes-agent) |
| <AppIcon name="fn-deepseek-harness" alt="DeepSeek Harness 图标" :size="30" /> | [DeepSeek Harness](./fn-deepseek-harness) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-deepseek-harness) | Native / x86 | nodejs_v24 | [源码](https://github.com/deepseek-ai/deepseek-harness) |
| <AppIcon name="fn-uv" alt="uv 图标" :size="30" /> | [uv](./fn-uv) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-uv) | Native / x86 | — | [源码](https://github.com/astral-sh/uv) |
| <AppIcon name="fn-nvm" alt="NVM 图标" :size="30" /> | [NVM](./fn-nvm) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-nvm) | Native / x86 | — | [源码](https://github.com/nvm-sh/nvm) |
| <AppIcon name="fn-ohmyzsh" alt="Oh My Zsh 图标" :size="30" /> | [Oh My Zsh](./fn-ohmyzsh) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-ohmyzsh) | Native / x86 | — | [源码](https://github.com/ohmyzsh/ohmyzsh) |
| <AppIcon name="fn-reader" alt="阅读图标" :size="30" /> | [阅读](./fn-reader) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-reader) | Native / x86 | — | [源码](https://github.com/hectorqin/reader) |
| <AppIcon name="fn-xiaoya-only" alt="小雅图标" :size="30" /> | [小雅](./fn-xiaoya-only) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-xiaoya-only) | Native / x86 | — | [源码](https://github.com/xiaoyaLL/xiaoya) |
| <AppIcon name="fn-bitwarden" alt="Bitwarden 图标" :size="30" /> | [Bitwarden](./fn-bitwarden) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-bitwarden) | Native / x86 | — | [源码](https://github.com/bitwarden/server) |
| <AppIcon name="fn-mysql-v8" alt="MySQL v8 图标" :size="30" /> | [MySQL v8](./fn-mysql-v8) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-mysql_v8) | Native / x86_64 | — | [源码](https://github.com/mysql/mysql-server) |
| <AppIcon name="fn-halo" alt="Halo 图标" :size="30" /> | [Halo](./fn-halo) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-halo) | Native / x86 | — | [源码](https://github.com/halo-dev/halo) |
| <AppIcon name="fn-quark-auto-save" alt="夸克转存图标" :size="30" /> | [夸克转存](./fn-quark-auto-save) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-quark-auto-save) | Native / x86 | — | [源码](https://github.com/Cp0204/quark-auto-save) |
| <AppIcon name="fn-new-api" alt="New API 图标" :size="30" /> | [New API](./fn-new-api) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-new-api) | Native / x86 | Redis | [源码](https://github.com/QuantumNous/new-api) |
| <AppIcon name="fn-zentao" alt="禅道图标" :size="30" /> | [禅道](./fn-zentao) | [GitHub](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-zentao) | Native / x86 | — | [源码](https://github.com/easycorp/zentao) |

## 安装方式

应用可以从 [GitHub Releases](https://github.com/tnnevol/fn-os-apps/releases) 下载 `.fpk` 文件后，在 fnOS 应用中心手动安装；开发调试时可使用 `appcenter-cli install-local`。涉及应用专属配置时，以对应应用页面为准。

## 下载

应用安装包可在 [GitHub Releases](https://github.com/tnnevol/fn-os-apps/releases) 页面下载。
