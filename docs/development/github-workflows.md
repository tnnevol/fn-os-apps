# GitHub Workflow

本页说明 `.github/workflows/` 当前有效的 GitHub Actions，以及它们与仓库文件、包和外部工具的依赖关系。

## Workflow 总览

当前自动化分成三条路径：

- `v*` Tag 触发发布链路，构建 FPK 并发布 GitHub Release。
- Pull Request 或手动触发质量链路，检查 SDD、文档、共享包和 harness 插件。
- `v*` Tag 或手动触发文档部署链路，构建并部署 VitePress。

```d2
direction: down

tag: "推送 v* Tag"
releaseWorkflow: ".github/workflows/build-release.yml"
prepare: "prepare-release：创建或重置草稿 Release"
common: "build-common：可复用 Workflow"
dsh: "build-dsh：可复用 Workflow"
publish: "publish-release：上传完成并生成 Release 说明"
releaseStatus: {
  label: "发布链路成功？"
  shape: diamond
}
releaseDone: "是：发布 Release"
releaseFailure: "否：report-failure 保留失败草稿"

qualityTrigger: "Pull Request / workflow_dispatch"
sddWorkflow: ".github/workflows/sdd-check.yml"
sddRun: "pnpm run check -- --all"
sddDone: "SDD、文档、包和 harness 插件检查完成"

docsTrigger: "v* Tag / workflow_dispatch"
docsWorkflow: ".github/workflows/deploy-docs.yml"
docsRun: "pnpm exec fn-apps-cli build --docs"
pages: "上传 Pages artifact → 部署 GitHub Pages"

tag -> releaseWorkflow -> prepare
prepare -> common
prepare -> dsh
common -> publish
dsh -> publish
publish -> releaseStatus
releaseStatus -> releaseDone: 是
releaseStatus -> releaseFailure: 否
prepare -> releaseFailure: 失败
common -> releaseFailure: 失败
dsh -> releaseFailure: 失败

qualityTrigger -> sddWorkflow -> sddRun -> sddDone
docsTrigger -> docsWorkflow -> docsRun -> pages
```

## 三个发布 Job 的时序

`prepare-release` 完成后，`build-common` 和 `build-dsh` 作为两个可复用 Workflow 并行执行；只有两者都完成，`publish-release` 才会继续。图中的 `[并行]` 表示两个 Job 不存在先后依赖。

```d2
shape: sequence_diagram

github: GitHub Actions
prepare: "prepare-release\n创建或重置草稿 Release"
common: "build-common\n可复用 Workflow [并行]"
dsh: "build-dsh\n可复用 Workflow [并行]"
discover: "discover\n扫描 apps/*/manifest"
commonBuild: "matrix build\nfnpack build + 上传 FPK"
gateway: "build:gateway\n构建 fnOS Gateway"
native: "prepare_dsh\n准备 DSH native"
dshBuild: "build\n构建 Harness FPK + 上传"
publish: "publish-release\n等待两个构建 Job"
notes: "pnpm run release:notes\n调用 changelogithub"
release: GitHub Release

github -> prepare: push v* Tag
prepare -> github: release_id
prepare -> common: workflow_call(release_tag, release_id)
prepare -> dsh: workflow_call(release_tag, release_id)
common -> discover: checkout + 扫描
discover -> common: matrix
common -> commonBuild: 每个 matrix.app
commonBuild -> common: FPK assets uploaded
dsh -> gateway: fn-apps-cli build:gateway
gateway -> dsh: Gateway bundle
dsh -> native: prepare-dsh-native.sh
native -> dsh: resolved DSH_VERSION
dsh -> dshBuild: fn-apps-cli build --fpk
dshBuild -> dsh: FPK asset uploaded
common -> publish: completed
dsh -> publish: completed
publish -> notes: assets 全部上传后
notes -> release: changelogithub 执行完成
release -> github: 发布 Release
```

### `changelogithub` 的执行时机

Release 日志不是在 `build-common-fn.yml` 或 `build-dsh-fn.yml` 中生成的，而是在 `build-release.yml` 的 `publish-release` Job 中执行。具体顺序是：

1. `prepare-release` 创建或重置草稿 Release，并输出 `release_id`。
2. `build-common` 和 `build-dsh` 并行构建并上传全部 FPK。
3. 两个构建 Job 成功后，`publish-release` 开始发布任务；成功路径不再写入自定义 Release `name/body`。
4. `publish-release` 设置 Node.js / pnpm，安装 CLI 依赖。
5. 执行 `pnpm run release:notes`，由 `fn-apps-cli release:notes` 调用 `changelogithub`，生成并写入完整 Release `name/body`。
6. Release 日志生成完成后，GitHub Release 才会被发布；失败路径只把诊断信息写入 Actions Summary，并保留草稿。

成功路径不再通过 `gh api` 写入自定义 Release `name` 或 `body`，避免与 `changelogithub` 的完整更新结果产生覆盖或拼接耦合。失败信息属于运行诊断，写入 `$GITHUB_STEP_SUMMARY`，不作为 Release 日志内容。

### `build-common-fn.yml` 内部步骤

```d2
direction: down

workflow: "build-common-fn.yml"
discover: "discover：checkout 后扫描 apps/*"
manifestStatus: {
  label: "存在 manifest 且不是 Harness？"
  shape: diamond
}
skip: "跳过目录"
matrix: "生成 app matrix"
checkout: "matrix job：checkout"
tooling: "Node 24 + pnpm 11.16"
cliInstall: "pnpm install --filter @tnnevol/fn-os-apps-cli"
fnpack: "安装 fnpack 1.2.1"
cli: "fn-apps-cli build --fpk --app <app>"
rename: "重命名 <app>-<RELEASE_TAG>.fpk"
upload: "上传 FPK 到 Release"
status: {
  label: "上传成功？"
  shape: diamond
}
done: "是：该应用完成"
fail: "否：重试 5 次后失败"

workflow -> discover -> manifestStatus
manifestStatus -> skip: 否
manifestStatus -> matrix: 是
matrix -> checkout -> tooling -> cliInstall -> fnpack -> cli -> rename -> upload -> status
status -> done: 是
status -> fail: 否
```

### `build-dsh-fn.yml` 内部步骤

```d2
direction: down

workflow: "build-dsh-fn.yml"
checkout: "checkout"
tooling: "Node 24 + pnpm 11"
install: "安装 fnos-gateway... 与 CLI 依赖"
gateway: "fn-apps-cli build:gateway"
native: "prepare-dsh-native.sh"
nativeStatus: {
  label: "DSH_VERSION 已解析？"
  shape: diamond
}
fnpack: "安装 fnpack 1.2.1"
build: "fn-apps-cli build --fpk --app fn-deepseek-harness"
rename: "重命名并附加 DSH_VERSION"
upload: "上传 Harness FPK 到 Release"
status: {
  label: "上传成功？"
  shape: diamond
}
done: "是：构建完成"
nativeFail: "否：native 准备失败"
uploadFail: "否：重试 5 次后失败"

workflow -> checkout -> tooling -> install -> gateway -> native -> nativeStatus
nativeStatus -> fnpack: 是
nativeStatus -> nativeFail: 否
fnpack -> build -> rename -> upload -> status
status -> done: 是
status -> uploadFail: 否
```

`build-common-fn.yml` 和 `build-dsh-fn.yml` 只接受 `workflow_call`，不会自行响应 push；它们必须由 `build-release.yml` 传入 `release_tag` 和 `release_id`。

## Workflow 与文件、包的依赖关系

下图只展示运行时真正读取或调用的边界：Workflow 调用 CLI，CLI 再调用 Turbo、VitePress、fnpack 或包内脚本；应用的 `manifest` 决定是否进入 FPK 矩阵。

```d2
direction: right

workflows: {
  label: "GitHub Workflows"
  release: ".github/workflows/build-release.yml"
  common: ".github/workflows/build-common-fn.yml"
  dsh: ".github/workflows/build-dsh-fn.yml"
  docs: ".github/workflows/deploy-docs.yml"
  sdd: ".github/workflows/sdd-check.yml"
}

repo: {
  label: "仓库入口与配置"
  rootPackage: "package.json"
  lockfile: "pnpm-lock.yaml"
  turbo: "turbo.json"
  docsConfig: "docs/.vitepress/config.mts"
}

cli: {
  label: "fn-apps-cli CLI"
  program: "tooling/fn-os-apps-cli/src/program.ts"
  commands: "tooling/fn-os-apps-cli/src/commands/*.ts"
  build: "build / build:gateway"
  check: "check"
  release: "release:notes"
}

packages: {
  label: "Workspace packages"
  gateway: "packages/fnos-gateway"
  sharedUi: "packages/dsh-semi-ui"
  harnessPlugins: "plugins/* harness 插件"
}

apps: {
  label: "FPK 应用"
  manifests: "apps/*/manifest"
  commonApps: "apps/*（排除 fn-deepseek-harness）"
  harnessApp: "apps/fn-deepseek-harness"
}

tools: {
  label: "外部工具与发布服务"
  fnpack: "fnpack 1.2.1（CI）"
  d2: "D2 0.7.1"
  native: ".github/scripts/prepare-dsh-native.sh"
  nativeConfig: ".github/config/dsh-native-0.1.2-rc.1.env"
  github: "GitHub Release / Pages API"
}

workflows.release -> workflows.common: workflow_call
workflows.release -> workflows.dsh: workflow_call
workflows.release -> cli.release
workflows.common -> apps.manifests: 扫描 manifest
workflows.common -> cli.build
workflows.common -> tools.fnpack
workflows.common -> tools.github: 上传 FPK
workflows.dsh -> cli.build: build:gateway + FPK
workflows.dsh -> packages.gateway
workflows.dsh -> tools.native
workflows.dsh -> tools.nativeConfig
workflows.dsh -> apps.harnessApp
workflows.dsh -> tools.fnpack
workflows.dsh -> tools.github: 上传 FPK
workflows.docs -> cli.build: --docs
workflows.docs -> repo.docsConfig
workflows.docs -> tools.d2
workflows.docs -> tools.github: Pages
workflows.sdd -> cli.check: --all
workflows.sdd -> repo.docsConfig
workflows.sdd -> tools.d2
workflows.sdd -> repo.rootPackage
workflows.sdd -> repo.lockfile
workflows.sdd -> packages.harnessPlugins
workflows.sdd -> apps.manifests

cli.build -> repo.turbo
cli.build -> packages.sharedUi: ^build
cli.build -> packages.gateway: build:app
cli.check -> repo.turbo
cli.check -> packages.sharedUi
cli.check -> packages.harnessPlugins
repo.turbo -> packages.sharedUi
repo.turbo -> packages.harnessPlugins
```

## 各 Workflow 的职责

| Workflow | 触发方式 | 主要职责 | 关键输入 |
| --- | --- | --- | --- |
| `build-release.yml` | 推送 `v*` Tag | 创建草稿 Release、并行调用 FPK 构建、发布 Release | `github.ref_name`、Release ID |
| `build-common-fn.yml` | 仅 `workflow_call` | 扫描普通应用并按矩阵构建、重命名、上传 FPK | `release_tag`、`release_id` |
| `build-dsh-fn.yml` | 仅 `workflow_call` | 构建 Gateway、准备 DSH native、构建 Harness FPK | `release_tag`、`release_id`、native 配置 |
| `deploy-docs.yml` | `v*` Tag / 手动 | 构建 VitePress 并部署 GitHub Pages | D2、`DOCS_BASE=/` |
| `sdd-check.yml` | Pull Request / 手动 | 执行完整 SDD、文档、包和 harness 插件检查 | 变更路径、D2 |

## 发布链路

### 1. 创建版本 Tag

版本命令由根 CLI 执行，项目/FPK 使用 `v<版本号>` Tag：

```bash
pnpm run version -- project patch
git push origin main
git push origin v<版本号>
```

### 2. 构建普通 FPK

`build-common-fn.yml` 扫描 `apps/*`，只保留包含 `manifest` 且不是 `fn-deepseek-harness` 的目录，然后为每个应用创建独立矩阵任务：

```bash
pnpm exec fn-apps-cli build --fpk --app <app-name>
```

### 3. 构建 DeepSeek Harness FPK

`build-dsh-fn.yml` 的顺序不能省略：

1. 安装 Gateway 构建依赖。
2. 执行 `pnpm exec fn-apps-cli build:gateway`。
3. 根据 `.github/config/dsh-native-0.1.2-rc.1.env` 准备 native 依赖。
4. 执行 `pnpm exec fn-apps-cli build --fpk --app fn-deepseek-harness`。
5. 按 Release Tag 和 DSH 版本重命名并上传 FPK。

### 4. 发布 Release

普通应用和 Harness FPK 都上传成功后，`publish-release` 执行根 `release:notes`：

```bash
pnpm run release:notes
```

任一阶段失败时，`report-failure` 会将阶段状态写回草稿 Release；草稿不会被误发布。

## 文档与 SDD 链路

文档和 SDD Workflow 都需要 D2，因为页面包含 `d2` 代码块：

```bash
d2 version
pnpm run build -- --docs
pnpm run check -- --all
```

- `deploy-docs.yml` 构建 `docs/.vitepress/dist`，上传后由 `deploy-pages` 发布。
- `sdd-check.yml` 对 Pull Request 的指定路径执行完整 `check --all`。
- 只修改普通应用时，仍会触发 SDD Workflow，因为 `apps/**` 在路径过滤器中；FPK 的真实安装行为还必须在 fnOS 设备上验收。

## 修改 Workflow 的检查清单

- [ ] 新增或修改触发器后，更新本页的触发条件和总览图。
- [ ] 可复用 Workflow 的输入、输出和 `needs` 关系保持一致。
- [ ] FPK 构建继续通过 `fn-apps-cli` 和 `fnpack`，不在 Workflow 中复制 CLI 逻辑。
- [ ] 版本、DSH native 和 fnpack 版本来源与配置文件保持一致。
- [ ] 文档或 D2 改动通过 `pnpm run build -- --docs`。
- [ ] 提交前运行 `pnpm run check -- --all`。
- [ ] 不把 `.fpk`、native 临时目录或 GitHub Token 写入仓库。

## 相关文档

- [开发环境与脚本](./environment-and-scripts)
- [Package 任务与 Turbo](./package-tasks-and-turbo)
- [CI 构建](../build/ci)
- [版本管理](../build/versioning)
- [发布流程](../build/release)
