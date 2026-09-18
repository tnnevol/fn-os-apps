# GitHub Workflow

本页说明 `.github/workflows/` 当前有效的 GitHub Actions，以及它们与仓库文件、包和外部工具的依赖关系。

## Workflow 总览

当前自动化分成三条路径：

- `v*` Tag 触发发布链路，构建 FPK 并发布 GitHub Release。
- Pull Request 或手动触发质量链路，检查 SDD、文档和包。
- `v*` Tag 或手动触发文档部署链路，构建并部署 VitePress。

```mermaid
flowchart TD
  tag["推送 v* Tag"] --> releaseWorkflow[".github/workflows/build-release.yml"] --> prepare["prepare-release：创建或重置草稿 Release"]
  prepare --> common["build-common：可复用 Workflow"]
  common --> publish["publish-release：上传完成并生成 Release 说明"]
  publish --> releaseStatus{"发布链路成功？"}
  releaseStatus -->|是| releaseDone["发布 Release"]
  releaseStatus -->|否| releaseFailure["report-failure 保留失败草稿"]
  prepare -->|失败| releaseFailure
  common -->|失败| releaseFailure

  qualityTrigger["Pull Request / workflow_dispatch"] --> sddWorkflow[".github/workflows/sdd-check.yml"] --> sddRun["pnpm run check -- --all"] --> sddDone["SDD、文档和包检查完成"]
  docsTrigger["v* Tag / workflow_dispatch"] --> docsWorkflow[".github/workflows/deploy-docs.yml"] --> docsRun["pnpm exec fn-apps-cli build --docs"] --> pages["上传 Pages artifact → 部署 GitHub Pages"]
```

## 发布 Job 的时序

`prepare-release` 完成后，`build-common` 作为可复用 Workflow 执行；它完成后 `publish-release` 才继续。

```mermaid
sequenceDiagram
  participant github as GitHub Actions
  participant prepare as prepare-release<br/>创建或重置草稿 Release
  participant common as build-common<br/>可复用 Workflow
  participant discover as discover<br/>扫描 apps/*/manifest
  participant commonBuild as matrix build<br/>fnpack build + 上传 FPK
  participant publish as publish-release<br/>等待构建 Job
  participant notes as pnpm run release:notes<br/>调用 changelogithub
  participant release as GitHub Release

  github->>prepare: push v* Tag
  prepare->>github: release_id
  prepare->>common: workflow_call(release_tag, release_id)
  common->>discover: checkout + 扫描
  discover->>common: matrix
  common->>commonBuild: 每个 matrix.app
  commonBuild->>common: FPK assets uploaded
  common->>publish: completed
  publish->>notes: assets 全部上传后
  notes->>release: changelogithub 执行完成
  release->>github: 发布 Release
```

### `changelogithub` 的执行时机

Release 日志不是在 `build-common-fn.yml` 中生成的，而是在 `build-release.yml` 的 `publish-release` Job 中执行。具体顺序是：

1. `prepare-release` 创建或重置草稿 Release，并输出 `release_id`。
2. `build-common` 构建并上传全部 FPK。
3. 构建 Job 成功后，`publish-release` 开始发布任务；成功路径不再写入自定义 Release `name/body`。
4. `publish-release` 设置 Node.js / pnpm，安装 CLI 依赖。
5. 执行 `pnpm run release:notes`，由 `fn-apps-cli release:notes` 调用 `changelogithub`，生成并写入完整 Release `name/body`。
6. Release 日志生成完成后，GitHub Release 才会被发布；失败路径只把诊断信息写入 Actions Summary，并保留草稿。

成功路径不再通过 `gh api` 写入自定义 Release `name` 或 `body`，避免与 `changelogithub` 的完整更新结果产生覆盖或拼接耦合。失败信息属于运行诊断，写入 `$GITHUB_STEP_SUMMARY`，不作为 Release 日志内容。

### `build-common-fn.yml` 内部步骤

```mermaid
flowchart TD
  workflow["build-common-fn.yml"] --> discover["discover：checkout 后扫描 apps/*"]
  discover --> manifestStatus{"存在 manifest？"}
  manifestStatus -->|否| skip["跳过目录"]
  manifestStatus -->|是| matrix["生成 app matrix"]
  matrix --> checkout["matrix job：checkout"] --> tooling["Node 24 + pnpm 11.16"] --> cliInstall["pnpm install --filter @tnnevol/fn-os-apps-cli"] --> fnpack["安装 fnpack 1.2.1"] --> cli["fn-apps-cli build --fpk --app &lt;app&gt;"] --> rename["重命名 &lt;app&gt;-&lt;RELEASE_TAG&gt;.fpk"] --> upload["上传 FPK 到 Release"] --> status{"上传成功？"}
  status -->|是| done["该应用完成"]
  status -->|否| fail["重试 5 次后失败"]
```

`build-common-fn.yml` 只接受 `workflow_call`，不会自行响应 push；它必须由 `build-release.yml` 传入 `release_tag` 和 `release_id`。

## Workflow 与文件、包的依赖关系

下图只展示运行时真正读取或调用的边界：Workflow 调用 CLI，CLI 再调用 Turbo、VitePress 或 fnpack；应用的 `manifest` 决定是否进入 FPK 矩阵。

```mermaid
flowchart LR
  subgraph workflows["GitHub Workflows"]
    release[".github/workflows/build-release.yml"]
    common[".github/workflows/build-common-fn.yml"]
    docs[".github/workflows/deploy-docs.yml"]
    sdd[".github/workflows/sdd-check.yml"]
  end

  subgraph repo["仓库入口与配置"]
    rootPackage["package.json"]
    lockfile["pnpm-lock.yaml"]
    turbo["turbo.json"]
    docsConfig["docs/.vitepress/config.mts"]
  end

  subgraph cli["fn-apps-cli CLI"]
    commands["tooling/fn-os-apps-cli/src/commands/*.ts"]
    build["build"]
    check["check"]
    releaseNotes["release:notes"]
  end

  subgraph apps["FPK 应用"]
    manifests["apps/*/manifest"]
  end

  subgraph tools["外部工具与发布服务"]
    fnpack["fnpack 1.2.1（CI）"]
    github["GitHub Release / Pages API"]
  end

  release -->|workflow_call| common
  release --> releaseNotes
  common -->|扫描 manifest| manifests
  common --> build
  common --> fnpack
  common -->|上传 FPK| github
  docs -->|--docs| build
  docs --> docsConfig
  docs --> github
  sdd -->|--all| check
  sdd --> docsConfig
  sdd --> rootPackage
  sdd --> lockfile
  sdd --> manifests
  build --> turbo
  check --> turbo
```

## 各 Workflow 的职责

| Workflow | 触发方式 | 主要职责 | 关键输入 |
| --- | --- | --- | --- |
| `build-release.yml` | 推送 `v*` Tag | 创建草稿 Release、调用 FPK 构建、发布 Release | `github.ref_name`、Release ID |
| `build-common-fn.yml` | 仅 `workflow_call` | 扫描应用并按矩阵构建、重命名、上传 FPK | `release_tag`、`release_id` |
| `deploy-docs.yml` | `v*` Tag / 手动 | 构建 VitePress 并部署 GitHub Pages | `DOCS_BASE=/` |
| `sdd-check.yml` | Pull Request / 手动 | 执行完整 SDD、文档和包检查 | 变更路径 |

## 发布链路

### 1. 创建版本 Tag

版本命令由根 CLI 执行，项目/FPK 使用 `v<版本号>` Tag：

```bash
pnpm run version -- patch
git push origin main
git push origin v<版本号>
```

### 2. 构建 FPK

`build-common-fn.yml` 扫描 `apps/*`，只保留包含 `manifest` 的目录，然后为每个应用创建独立矩阵任务：

```bash
pnpm exec fn-apps-cli build --fpk --app <app-name>
```

### 3. 发布 Release

FPK 都上传成功后，`publish-release` 执行根 `release:notes`：

```bash
pnpm run release:notes
```

任一阶段失败时，`report-failure` 会将阶段状态写回草稿 Release；草稿不会被误发布。

## 文档与 SDD 链路

文档和 SDD Workflow 都不需要额外安装图形工具：Mermaid 图由插件在浏览器端渲染。

```bash
pnpm run build -- --docs
pnpm run check -- --all
```

- `deploy-docs.yml` 构建 `docs/.vitepress/dist`，上传后由 `deploy-pages` 发布。
- `sdd-check.yml` 对 Pull Request 的指定路径执行完整 `check --all`。
- 只修改应用时，仍会触发 SDD Workflow，因为 `apps/**` 在路径过滤器中；FPK 的真实安装行为还必须在 fnOS 设备上验收。

## 修改 Workflow 的检查清单

- [ ] 新增或修改触发器后，更新本页的触发条件和总览图。
- [ ] 可复用 Workflow 的输入、输出和 `needs` 关系保持一致。
- [ ] FPK 构建继续通过 `fn-apps-cli` 和 `fnpack`，不在 Workflow 中复制 CLI 逻辑。
- [ ] 版本和 fnpack 版本来源与配置文件保持一致。
- [ ] 文档或流程图改动通过 `pnpm run build -- --docs`。
- [ ] 提交前运行 `pnpm run check -- --all`。
- [ ] 不把 `.fpk`、native 临时目录或 GitHub Token 写入仓库。

## 相关文档

- [开发环境与脚本](./environment-and-scripts)
- [Package 任务与 Turbo](./package-tasks-and-turbo)
- [CI 构建](../build/ci)
- [版本管理](../build/versioning)
- [发布流程](../build/release)
