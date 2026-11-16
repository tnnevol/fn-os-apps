---
title: FNOS-001 镜像运行身份审计（2026-11-05）
description: 逐个查询镜像 config.User，判定「容器会不会以 root 写数据」，把 186 个 Docker 应用分成 A/B/C/D 四类并给出整改批量方案。
feature: FNOS-001
lastVerified: 2026-11-05
---

# FNOS-001 镜像运行身份审计（2026-11-05）

## 为什么要做这次审计

[同步批次安装测试报告](/testing/FNOS-001-sync-2026-11-05-install-report) 定案了一条规则：compose 需要写 `user:` 时
一律用 `user: "${TRIM_UID}:${TRIM_GID}"`，并已由 `pnpm run check -- --apps` 机器校验。

但那条校验只覆盖「**写了 `user:` 但值不对**」。真正决定容器身份的还有另一半：**compose 不写 `user:` 时，
容器以镜像层 `config.User` 运行**——镜像没设置就是 **root**。以 root 写数据正是「卸载选删除所有数据仍残留」的
根因，所以必须把每个应用的镜像默认身份查清楚，不能只看 compose。

## 方法

| 项 | 说明 |
| --- | --- |
| 数据来源 | registry 的 image config blob（`config.User`），**不拉镜像层**，只看身份字段 |
| 覆盖 | 186 个 Docker 应用（另有 7 个原生应用无 compose，不在范围内） |
| 工具 | `node scripts/audit-image-user.mjs`（可重复运行，结果缓存到 `tmp/image-user-cache.json`） |
| 平台 | 取 manifest 列表里的 `linux/amd64`，与转换登记的目标平台一致 |
| 容器变量镜像 | `${IMAGE_NAME}` 这类变量引用无法静态解析（如 `fn-neko`），单列 D 类 |

分类口径：

| 类别 | 含义 | 后果 |
| --- | --- | --- |
| **A** | 镜像默认 root **且** compose 未写 `user:` | 容器以 root 写挂载目录 → 卸载「删除所有数据」残留（**缺陷候选**） |
| **B** | 镜像默认 root 且 compose 写了 `user:` | 已按规约对齐包用户，运行身份正确 |
| **C** | 镜像自带非 root 且 compose 未写 `user:` | 容器以镜像内固定 uid 运行；`install_callback` 建的目录属包用户、mount `770`，该 uid 可能**无权写**（属主待验证） |
| **D** | 查询失败 | 私有仓库鉴权、Docker Hub 匿名限流（HTTP 429）或变量镜像，需稍后重跑补齐 |

## 结论

| 类别 | 数量 | 占比 |
| --- | --- | --- |
| A（root 且无 `user:`，缺陷候选） | **96** | 51.6% |
| B（已对齐包用户） | 15 | 8.1% |
| C（镜像自带非 root，属主待验证） | 31 | 16.7% |
| D（未解析） | 38 | 20.4% |
| 合计 | 186 | 100% |

**A 类远多于此前估计**：本轮修复的 3 个应用只是其中极小一部分，说明「容器以 root 写数据」是转换批次的
**系统性问题**，不是个别应用的手误。

## 整改方案（分批，需真机逐个验证）

不能机械地给 96 个应用一起加 `user:`——有几类镜像加了会起不来：

| 情形 | 处置 |
| --- | --- |
| 普通 Web 应用（自己不需要 root 初始化） | 直接加 `user: "${TRIM_UID}:${TRIM_GID}"` + `install_callback` 预建挂载源目录 |
| 镜像初始化强依赖 root（s6 / supervisord / 启动必执行 `chown`） | 保持原样，`user: "0:0"` + `# USER-EXCEPTION: <原因>`，并接受「数据可能是 root 属主」这一既知限制 |
| 数据库/有状态服务（`postgres`/`mysql` 等以自有 uid 建数据目录） | 加 `user:` 让数据属包用户；需验证 initdb/初始化在非 root 下仍成立 |
| 运行时把 `HOME`/缓存写进镜像层路径的（如 `fn-upage`） | 加 `user:` 的同时把 `HOME`/缓存目录指到已挂载、属主为包用户的路径 |

验证方式沿用既有批量验收器 `scripts/batch-verify.mjs`：它逐应用执行「安装 → 等 running → 探入口 → 卸载（删除数据）
→ 记录残留条目」，正好能对 A 类逐个判定「加 `user:` 后是否仍可用、残留是否归零」。

**本轮未改动 A 类的任何应用**：批量改 96 个应用必须配同样的批量真机验证，否则等于用未验证的改动替换已验证的漏洞。

## 第一批样例（已真机验证，4 个应用 / 3 种形态）

按「先跑不同形态」的原则，从 A 类里挑了 4 个：单容器 Web、带上传目录、带 SQLite 库、带**外部 MySQL**。

| 应用 | 形态 | 改动 | 结果 |
| --- | --- | --- | --- |
| `fn-glance` | Go 单二进制 + 单文件挂载 | 只加 `user:` | 包用户运行、入口 `200`、卸载残留 **0** |
| `fn-gotify` | 带上传目录（`data/images`）+ SQLite | 加 `user:` + `install_callback` 预建 `data` | 包用户运行（`User=913:908`）、入口 `200`、`gotify.db`/`images`/`plugins` 全属包用户、卸载残留 **0** |
| `fn-mblog` | 带 SQLite 数据库 | 加 `user:` + 预建 `data` | 包用户运行（`889:882`）、入口 `200`、`data.sqlite` 属包用户、卸载残留 **0** |
| `fn-sun-panel` | 多目录（`conf`/`uploads`/`database`） | 见下方「变体一」 | 包用户运行（`843:836`）、入口 `200`、卸载残留 **0** |

### 变体一：应用会往**镜像层目录**写东西（`fn-sun-panel`）

加了 `user:` 后容器反复重启，日志依次报：

1. `panic: failed to create log file ./runtime/runlog/running.log` —— 应用在 WorkDir(`/app`) 下的 `./runtime/runlog` 写日志；
2. 补挂 `/app/runtime` 后改为 `ERROR lang/lang.go:23 输出语言文件出错: mkdir lang: permission denied` —— 它还要在 `/app/lang` 导出语言文件。

两者在镜像里都属 `root`（`runtime/runlog` 存在、`lang` 不存在），非 root 写不了。处置：把这两处也挂到应用数据目录并预创建

```yaml
- "${TRIM_PKGVAR}/data/runtime:/app/runtime"
- "${TRIM_PKGVAR}/data/lang:/app/lang"
```

**教训**：给「镜像层默认 root」的应用加 `user:` 时，要先看它启动时往镜像层哪些路径写。`/app/runtime`、`/app/lang` 这类**运行期产物目录**单独挂出来即可（镜像内为空，不遮蔽静态资源）；一旦发现，批量整改时同类应用要一并处理。

### 变体二：镜像**自己降权**，不需要也不应该加 `user:`（`fn-flarum`）

`fn-flarum` 在 A 类名单里（镜像 `config.User` 为空），但 compose 里已有：

```yaml
- PUID=${TRIM_UID}
- PGID=${TRIM_GID}
```

真机验证：容器虽以 root 启动，但镜像内的 s6 初始化按 `PUID/PGID` 降权，**写入的文件属主全是包用户**（`/vol2/@appdata/fn-flarum/data/{assets,extensions,storage}` 均属 `docker-fn-flarum`）。所以它**不会**产生「卸载删不掉」的残留，也没有改 compose；这类镜像加 `user:` 反而会打断 s6 初始化。

**结论**：审计只能筛出「可疑」，最终定性要看镜像是否自带降权机制（`PUID/PGID`、`NB_UID`、s6/supervisord 内部 `runuser` 等）。判定顺序与[转换规约](/development/1panel-conversion)的「裁决 B」一致。

### 同时观测到的两类目录残留（与本轮改动无关）

| 现象 | 实测 | 说明 |
| --- | --- | --- |
| `@appconf/<app>` 空目录不回收 | 设备上累计 **195 个**（每个装过的应用一个，均为 0 条目） | 框架创建后不随卸载删除；属平台侧行为，批量整改时需确认是否可安全清理 |
| `@appdata/<app>` 父目录保留 | 卸载「删除所有数据」后父目录仍在、条目数 **0** | 与既有结论一致：平台保留目录，应用只删内容 |

## A 类批量推进与第 1 批真机结果（2026-11-05 下午）

机械改造：76 个应用加 `user: "${TRIM_UID}:${TRIM_GID}"`，35 个 `install_callback` 补「由包用户预建挂载源目录」。
排除 10 个自带降权变量的镜像（`PUID/PGID/NB_UID/CHOWN_HOME`）。

第 1 批（6 个无外部依赖应用，逐装-探-卸）：

| 应用 | 判定 | 说明 |
| --- | --- | --- |
| `fn-beszel` / `fn-gatus` / `fn-artalk` | **PASS** | 入口 200 / 200 / 302 |
| `fn-it-tools` | FAIL → **PASS** | nginx 非 root 建不了 `/var/cache/nginx/client_temp`；补挂 `cache`+`run` 后 200 |
| `fn-kirara-agent` | FAIL → **PASS** | Python 在工作目录建 `logs` 被拒；补挂 `logs` 后 200 |
| `fn-jsonhero` | FAIL → **PASS** | 该镜像需要 root 重建前端（原注释已写），撤销 `user:` 并标 `# USER-EXCEPTION`，200 |

### 教训：批量脚本会覆盖「已记录的例外」

`fn-jsonhero`/`fn-emlog`/`fn-lsky-pro`/`fn-music-tag-web` 四个应用的 compose 里**原本就有真机结论**
写明「必须 root、加 `user:` 会 Permission denied」。机械改造把它们一起改了。已全部撤销并补
`# USER-EXCEPTION: <原因>` 标记（check 现在会放行带标记的例外）。

**因此在批量整改前应先扫一遍「注释里已有 root 结论」的应用**，判据是 compose 注释含
「不指定 user / 需要 root / Permission denied / 降权失败」等字样——本次用这条规则找回了 4 个。

### 加 `user:` 后常见的两类补救（真机验证）

| 现象（容器日志） | 原因 | 补救 |
| --- | --- | --- |
| `mkdir() "/var/cache/nginx/client_temp" failed (13: Permission denied)` | nginx 临时目录在镜像层、归 root | 挂 `${TRIM_PKGVAR}/cache:/var/cache/nginx`、`${TRIM_PKGVAR}/run:/var/run` |
| `PermissionError: [Errno 13] Permission denied: 'logs'`（相对路径） | 应用在 WorkDir 建目录 | 挂 `${TRIM_PKGVAR}/logs:<对应路径>` |
| `EACCES ... /.npm` / `HOME` 不可写 | Home 指向 `/` | 设 `HOME`/`XDG_CACHE_HOME`/`npm_config_cache` 到已挂载的可写目录 |
| `cp: cannot create regular file '/app/.env': Permission denied`（反复重启） | 镜像启动脚本要把生成的配置写回**镜像层目录**，而该目录属镜像内用户/root，包用户不在其组 | 把该文件改成**宿主持久文件的单文件挂载**，由 `cmd/install_callback` 首次生成内容（见下） |
| s6/supervisord 初始化失败 | 镜像初始化强依赖 root | 不加 `user:`，标 `# USER-EXCEPTION` |

**「镜像要回写配置到镜像层」这一类怎么修**（`fn-huginn` 实测）：镜像的 `/scripts/setup_env`
末尾会 `cp /tmp/.env /app/.env && chmod ugo+r /app/.env`，而 `/app` 属 `default:root(775)`，
容器以包用户运行时不在 root 组 → 每次启动都 `Permission denied` → `Restarting` 死循环，
应用中心只显示「启用」。修法不是加回 root，而是把那个文件变成宿主持久文件：

```yaml
volumes:
  - "${TRIM_PKGVAR}/data:/var/lib/mysql"
  # 镜像启动脚本要写 /app/.env（属 default:root，包用户不可写），改为挂宿主持久文件
  - "${TRIM_PKGVAR}/data/dot-env:/app/.env"
```

`cmd/install_callback` 负责在安装时**生成一次**该文件（存在则复用，避免重启后会话失效）：

```bash
ENV_FILE="${TRIM_PKGVAR}/data/dot-env"
if [ ! -f "${ENV_FILE}" ]; then
    SECRET="$(dd if=/dev/urandom bs=36 count=1 2>/dev/null | base64 | tr -d '\n')"
    printf 'APP_SECRET_TOKEN=%s\n' "${SECRET}" >"${ENV_FILE}"
    chmod 660 "${ENV_FILE}"
fi
```

要点：单文件挂载的**源文件必须在容器启动前已存在**（Docker 不会为 `-v file:file` 自动建文件，
且会以 root 建出错误属主），所以生成动作必须放在 `install_callback`，不能只在 compose 里写路径。

## 第 2、3 批真机结果（2026-11-05 晚）

第 2 批（5 个）：`fn-clawswarm` PASS(200)、`fn-kkfileview` PASS(302)、`fn-certd` PASS(200)、
`fn-bililive-go` PASS(200)、`fn-ai-portal` PASS(200)——后三者首轮 FAIL，按下表修好后复测通过。

第 3 批（5 个）：`fn-adguardhome` PASS(302)；`fn-koishi` / `fn-archivebox` / `fn-laya-server` 首轮属**安装轮询超时**（镜像拉取慢）；
`fn-laya-server` 预拉镜像后复测 **PASS(200)**；`fn-koishi` / `fn-archivebox` 每次卸载都会删镜像，
而这两个镜像（archivebox ~1GB、koishi ~0.8GB）在本网络下单次 `docker pull` 240 秒仍拉不完，
反复 BLOCKED，**登记为待补测**（环境限制，非应用缺陷）；`fn-llama-cpp` 判定 **BLOCKED**：
容器日志 `failed to load model '/models/model.gguf'`——该应用需用户自备模型文件。

`fn-archivebox` 另有一条真机结论：其 entrypoint 内置**固定 uid=960 gid=955** 并内部 chown，
与 `TRIM_UID` 不一致时报
`archivebox user (uid=960 gid=955) cannot write to /opt/archivebox. Current owner is 911:911`，
因此**不该覆盖运行身份**，已撤销 `user:` 并标 `# USER-EXCEPTION`（属 C 类「镜像自带固定 uid」）。

### 本轮新增的 root 例外（真机证据）

| 应用 | 容器日志 | 结论 |
| --- | --- | --- |
| `fn-bililive-go` | `chown: .../opt/bililive: Operation not permitted` + `failed switching to "0:0"` | entrypoint 必须 root chown 后 gosu 切换 |
| `fn-koishi` | `chown: /koishi: Operation not permitted` | 启动要 chown 应用目录 |
| `fn-ai-portal` | `su: must be suid to work properly`（反复） | 镜像 entrypoint 内部用 `su` 降权 |
| `fn-adguardhome` | `is the first launch of adguard home; you must run it as administrator` | 首启要求管理员身份 |
| `fn-jsonhero`/`fn-emlog`/`fn-lsky-pro`/`fn-music-tag-web` | 见上节 | 批量前已存在的既有结论，被我误改后回滚 |

以上均按规则撤销 `user:` 并加 `# USER-EXCEPTION: <原因>`，`check --apps` 放行。

### 可修的失败（非例外）

| 应用 | 日志 | 补救 |
| --- | --- | --- |
| `fn-certd` | `EACCES ... open 'logs/app.log'`（log4js） | 挂 `${TRIM_PKGVAR}/logs:/app/logs` |
| `fn-archivebox` | `archivebox user cannot write to /data ... Current owner is 0:0` | 历史残留（改造前以 root 建目录）；清掉 `@appdata/fn-archivebox` 重装即通过预建 |
| `fn-it-tools` | nginx 缓存目录 | 见上节 |
| `fn-kirara-agent` | `logs` 相对目录 | 见上节 |

## 第 5 批与网络恢复后的补测（2026-11-09）

第 5 批（5 个，镜像不在 Docker Hub 的应用）：`fn-newsnow` **PASS(200)**；
`fn-nezha` / `fn-opengist` / `fn-octop` 因 ghcr 拉取超时 BLOCKED；`fn-forgejo` 当时 BLOCKED。

**网络问题的定性**：设备上运行 Clash(mihomo)，用 `198.18.0.x` fake-IP 劫持 DNS。实测
`registry-1.docker.io` 被解析成 IPv6 fake-IP 后连接超时（`000`），`ghcr.io` 时通时不通。
逐源实测：`docker.1ms.run` 可用（小镜像能拉完，大镜像 420s 拉不完）、
`docker.1panel.top` / `docker.m.daocloud.io` / `hub.rat.dev` 均超时、
`docker.1panel.live` / `proxy.1panel.live` / `dockerproxy.cn` 不可达。
批量的可用前置条件：镜像能拉下来。拉取受限时一律判 BLOCKED，不计应用缺陷。

> 上面这段是**关闭 Clash 之前**的记录，结论已被后面的复测推翻（当时是代理策略在干扰）。
> 以下是 2026-11-09 关闭 Clash 后的重新实测，以本节为准。

#### 关闭 Clash 后的复测（2026-11-09 12:30 起）

关掉 Clash 后症状没有消失，反而定位到两个独立问题：

**问题一：DNS 污染，且设备没有 IPv6 出网能力。** 设备上已无任何 `clash`/`mihomo` 进程，
但 `registry-1.docker.io` 仍被解析到 `2a03:2880:f1xx:83:face:b00c:0:25de`（Facebook 的 IPv6
网段）与 `202.160.128.238`；而设备**没有 IPv6 全局地址、也没有 IPv6 默认路由**
（`ip -6 route show default` 为空）。公共 DNS 全部返回同样的污染结果：

| DNS | registry-1.docker.io 解析结果 |
| --- | --- |
| 223.5.5.5 | `108.160.166.137` + `2a03:2880:f12d:83:face:b00c:0:25de` |
| 119.29.29.29 | `31.13.85.2` + `2a03:2880:f127:83:face:b00c:0:25de` |
| 8.8.8.8 | `199.59.149.235` + `2a03:2880:f107:83:face:b00c:0:25de` |

所以直连 Hub 必然 `context deadline exceeded`。**结论：Docker Hub 直连在该网络下不可用，
必须走镜像源。**

**问题二：`registry-mirrors` 只对 Docker Hub 生效，不覆盖 ghcr.io。** 这是本轮最容易踩的坑：
把 `registry-mirrors` 换成可用源之后，Hub 镜像确实快了（无前缀 `docker pull busybox` 7s），
但 huginn（`ghcr.io/huginn/huginn:latest`）依旧卡在安装进度 80% —— 因为 ghcr 域名**根本不经过**
`registry-mirrors`。设备上 `docker compose create` 进程会一直挂着等镜像，应用中心只是显示 80%，
**不报错、不超时、不给原因**。

**实测可用的源（关 Clash 后，2026-11-09）**

| 用途 | 源 | 验证结果 |
| --- | --- | --- |
| Docker Hub | `docker.m.daocloud.io` | busybox 4s；**metabase 1030MB / 141s（≈7.3MB/s）** |
| Docker Hub | `docker.1ms.run` | busybox 5s，连续 3/3 成功 |
| Docker Hub | `hub.rat.dev` | busybox 5s，连续 3/3 成功 |
| ghcr.io | `ghcr.dockerproxy.net` | **huginn 3.02GB / 134s** |
| ghcr.io | `ghcr.io` 直连 | 240s 仍卡在 `Verifying Checksum`，不可用 |
| ghcr.io | `ghcr.nju.edu.cn` | 300s 未完成，不可用 |
| 不可用 | `docker.fnnas.com`（fnOS 默认） | `/v2/` 回 401 但拉取返回 openresty 错误页 |
| 不可用 | `registry.hub.docker.com`（fnOS 默认） | 超时 |
| 不可用 | `docker.aityp.com` / `docker.amingg.com` / `dockerproxy.link` / `docker.xuanyuan.me` / `docker.1panel.top` / `dockerpull.org` | 全部 0/2 |

`registry-mirrors` 生效后的配置（`/etc/docker/daemon.json`，改完必须
`sudo systemctl restart docker`）：

```json
"registry-mirrors":[
  "https://docker.m.daocloud.io",
  "https://docker.1ms.run",
  "https://hub.rat.dev"
]
```

> 保留 fnOS 自带的 `docker.fnnas.com`、`registry.hub.docker.com` 只会让最终失败多等约 30s，
> 建议删掉。

**ghcr.io 镜像怎么办**：`registry-mirrors` 帮不上，三条现实路径（按推荐度）：
1. **设备上预拉代理地址并重打 tag**（不改仓库、不影响用户）：
   `docker pull ghcr.dockerproxy.net/huginn/huginn:latest && docker tag … ghcr.io/huginn/huginn:latest`
   —— 但卸载会删镜像，每次验证都要重来，且**发布给最终用户无效**；
2. **在应用侧加国内 ghcr 代理**：把 compose 的 `image:` 改成代理地址，属于打包层面的取舍，
   需要逐个评估代理稳定性，不适合作为默认；
3. 用户自备代理 / 等网络条件改善。


**`fn-mkdocs-material` 实测 PASS**：容器 `running`、以包用户 `883:876` 运行、
宿主端口 `8000/tcp → 8111` 绑定正确、入口 `http://${FNOS_HOST}:8111/` 连测三次 `200`。

> **验收器缺陷（已修，`142849e8`）**：该应用被批量器判成 `BLOCKED`，`stage=pre-uninstall`、
> `err=轮询超时: pre-uninstall`，但当时容器已经 `Up` 且入口可访问。原因是卸载前置清理阶段
> 轮询超时后被判整条失败，**没有回退到「容器在跑就探入口」**。这条会造成假阴性。
> 已把前置清理改为非致命：超时只记 `rec.preUninstallTimeout`，继续安装与探测。

## 第 6 批：全程 GUI 安装验证（2026-11-09）

本节用例**完全通过 NAS 应用中心界面操作**（chrome-devtools 驱动「手动安装」→ 向导 → 已安装列表 →
详情页「打开 ▾」下拉 → 卸载向导），不调用安装/卸载接口，也不直接操作容器。shell 仅用于拉取镜像
与只读查证（`docker ps/inspect/logs`、目录清点、端口探测）。

### `fn-nezha` PASS（含「删除所有数据」实测）

| 观察点 | 结果 |
| --- | --- |
| FPK 注入 | 隐藏 input 注入 `fn-nezha.fpk`（72709 字节，`sha256=95d343e1…`），安全提示显示应用名 **Nezha** |
| 向导默认值 | 「Web 访问端口」默认 **8008**（非空），部署前确认端口未被占用 |
| 安装结果 | 容器 `Up`，入口 `http://192.168.0.17:8008/` → **200**；桌面出现 Nezha 图标 |
| 运行身份 | `Config.User=**873:866**` —— `${TRIM_UID}:${TRIM_GID}` 已正确展开为包用户 |
| 数据目录 | `@appconf` / `@appdata` / `@apphome` 属主均为 `docker-fn-nezha`，非 root |
| 日志 | GIN 请求日志均为 `200`，无错误行 |
| 卸载路径 | 详情页「打开 ▾」→「卸载」→ 系统确认 → 向导选「删除所有数据」→「卸载」 |
| 卸载后 | 已安装列表无 Nezha、无容器、镜像已删除、端口 8008 已释放 |

**「删除所有数据」结论**：`@appconf` / `@appdata` / `@apphome` 三个目录**内容条目数均为 0**（只剩平台
保留的空目录壳）。对比此前 A 类应用出现 `RESIDUAL_COUNT`（目录里仍有 root 属主文件删不掉），
可以确认 `user: "${TRIM_UID}:${TRIM_GID}"` 的修复对「卸载残留」有效——容器以包用户写数据，
卸载时包用户能删干净自己的文件。

> **判定口径补充**：卸载后目录壳仍在属**平台行为**（每个应用安装都会建、卸载不回收），
> 判定残留要看**目录内条目数**，不能只看目录是否存在。

### `fn-huginn` 首轮 FAIL（真缺陷）→ 已修，复测 ENV_BLOCKED

GUI 安装后应用中心显示「启用」（= 未运行），入口 `3000` 三次探测均 `000`。这是本轮**唯一
一个由 GUI 流程确认的真实缺陷**，而且正是「加 `user:` 之后才暴露」的那一类：

```
cp: cannot create regular file '/app/.env': Permission denied   （重复 9 次后崩溃重启）
```

| 项 | 值 |
| --- | --- |
| 容器状态 | `Restarting (1)`，反复重启 |
| `Config.User` | `910:905`（包用户，`user:` 已生效） |
| 镜像内 `/app` | `drwxrwxr-x default root` —— 属 `default`、组 `root`、775 |
| 根因 | `/scripts/setup_env` 末尾 `cp /tmp/.env /app/.env`；包用户 `910:905` 既不是 `default`(1001) 也不在 `root`(0) 组，无权写镜像层 |

修复（不走回 root 例外）：

- `app/docker/docker-compose.yaml`：新增单文件挂载 `${TRIM_PKGVAR}/data/dot-env:/app/.env`；
- `cmd/install_callback`：首次安装生成该文件（`dd if=/dev/urandom bs=36 count=1 | base64` 写入
  `APP_SECRET_TOKEN`，已存在则复用，chmod 660）。单文件挂载源必须预先存在，否则 Docker 会以
  root 建出错误属主。

**复测结论：ENV_BLOCKED（不是应用缺陷）**。修好后的 FPK（81635 字节）两次 GUI 安装都停在
`progress=80` 超过 25 分钟：`docker image ls` 始终没有 `ghcr.io/huginn/huginn:latest`，
`docker pull` 直接跑也只停在 `Waiting`——本网络下拉不完该多架构镜像。按判据记环境限制，
待网络条件允许时重跑（修复本身未在真机跑到「容器 Up」那一刻，所以不能记 PASS）。

> 这一条同时说明**应用中心把拉取镜像失败渲染成「卡在 80%」**，不报错、不超时、不给失败原因；
> 遇到长时间 80% 应先查设备 `docker image ls`，而不是怀疑 compose。

### `fn-huginn` 最终结论：PASS（回归），卸载残留 5 个空目录记为已知限制

镜像通路按「预拉代理 + 重打 tag」解决后，GUI 闭环跑通：

| 步骤 | 结果 |
| --- | --- |
| 镜像准备 | `docker pull ghcr.dockerproxy.net/huginn/huginn:latest` → `docker tag … ghcr.io/huginn/huginn:latest` |
| 安装 | 容器 `Up`，`RestartCount=0`，Rails 迁移正常执行完 |
| 运行身份 | `User=[1001]`（镜像自带），不再是包用户 |
| 入口 | `http://${FNOS_HOST}:3000/` 连测三次 **200** |
| 卸载 | 详情页「打开 ▾」→「卸载」→「删除所有数据」 |
| 清理 | 容器、镜像、端口均释放 |

**为什么最终放弃 `user: ${TRIM_UID}:${TRIM_GID}`**：镜像把整个 Rails 运行目录建成
`default(1001):root` 所有，`/app` 是 775、而 `/app/tmp`、`/app/db`、`/app/log`、
`/app/vendor/bundle` 全是 755。启动链要写这些路径：

```
cp: cannot create regular file '/app/.env': Permission denied
Permission denied @ rb_sysopen - /app/vendor/bundle/ruby/4.0.0/bin/dotenv.lock
```

先试过「单文件挂载 `/app/.env`」，只解决了第一行；Bundler 锁文件暴露了第二个写入点。
逐个挂载既覆盖不全、又会随镜像内部路径变动失效，因此按 `USER-EXCEPTION` 沿用镜像身份
（与 `fn-archivebox` 同类），数据目录通过 ACL 授权给容器 uid。

**已知限制：卸载选「删除所有数据」会残留 5 个空目录**
（`mysql`、`performance_schema`、`sys`、`huginn_production`、`#innodb_redo`）。

- 这些目录由容器以 **uid=1001** 创建并 `chmod 750`，属 `1001:0`；
- 卸载脚本以**包用户**（如 `910:905`）运行，既不是属主也不在组 0，**进不去目录**，
  `find` 无法遍历，`rm -rf` 失败；
- ACL 救不了：ACL mask 由「具名用户 + group 条目」的并集决定，group 位是 `---` 时
  mask 被压成 `r-x`，`u:<包用户>:rwx` 只有 effective `r-x`；而**抬高 mask 需要属主或
  `CAP_FOWNER`**，包用户两者都没有（实测 root 抬高 mask 后可正常删除）。

`cmd/install_callback` 已设置 default ACL、`cmd/uninstall_callback` 已尽力清理并**如实上报**
`RESIDUAL_COUNT`，不会谎报成功。**数据内容本身随容器移除**，只剩空目录壳。

> 待办（本轮未做）：若要彻底消除残留，需让容器进程成为包用户组成员（`group_add`）
> 或改用外部数据库；两者都会改变运行时形态，需单独评估。

## 第 7 批：ghcr.io 应用（2026-11-09～11-10）

`registry-mirrors` 不覆盖 ghcr.io，这一批统一走「**代理预拉 + 重打 tag**」：
`docker pull <代理>/<repo>:<tag>` → `docker tag … ghcr.io/<repo>:<tag>`，
之后 GUI 安装就用 compose 里原本的 ghcr 名字，仓库无需改动。

**可用的 ghcr 代理（实测）**

| 代理 | 结果 |
| --- | --- |
| `ghcr.nju.edu.cn` | 稳定可用（opengist、affine 等小中镜像均通过） |
| `ghcr.dockerproxy.net` | 时好时坏，频繁 `TLS handshake timeout`；huginn 3.02GB 曾成功 |
| `ghcr.m.daocloud.io` | `pull access denied`，不可用 |
| `ghcr.io` 直连 | 240s 卡 `Verifying Checksum`，不可用 |

### 结果汇总

| 应用 | 结果 | 关键观察 |
| --- | --- | --- |
| `fn-affine` | **PASS（302）** | 需 PostgreSQL + Redis；修复 `/app/src` 挂载后 `RestartCount=0`，`schema.gql` 正常生成 |
| `fn-octop` | **PASS（200）** | `Up (healthy)`、`User=865:858`，卸载残留 0 |
| `fn-bettafish` | **PASS（200）** | 4 个入口端口全释放、残留 0；日志有 `Fontconfig error: No writable cache directories` 警告但不影响运行 |
| `fn-ollama` | **PASS（API 200）** | 修复 `HOME` 后 `RestartCount=0`，`/api/version` 返回 `0.40.13`，卸载残留 0 |
| `fn-ollama-webui` | 未测 | 依赖 Ollama 服务；Ollama 已验证可用，但 WebUI 本身本轮未安装 |

### 附：`fn-stirling-pdf`（Docker Hub，同批验证）

**PASS（200）**，但走了不同的处置：`Up (healthy)`、`RestartCount=0`、入口三次 200。

- 失败日志：`ln: failed to create symbolic link '/usr/local/bin/diagnostics': Permission denied`
  （`RestartCount=13`，日志只有这一行）；
- 根因：`/scripts/init-without-ocr.sh` 用 `set -euo pipefail`，无条件给
  `/scripts/stirling-diagnostics.sh` 建 5 个软链到 `/usr/local/bin`（属 root 755），
  包用户必失败并因 `set -e` 当场终止；
- **无法按「挂载可写目录」修**：`/usr/local/bin` 里有 32MB 的 `gs` 及 `ocrmypdf`、
  `unoconvert` 等必需二进制，整目录覆盖会丢工具；镜像内也没有 `sudo`/`su`/`gosu` 可提权；
  该段无任何环境变量开关；
- 处置：撤销 `user:` 并标 `# USER-EXCEPTION: <原因>`，与 `fn-certd`、`fn-it-tools` 同类。
- **已知限制**：容器内 uid 1000 创建的 `data/extraConfigs` 卸载后删不掉（残留 1 项），
  `uninstall_callback` 如实上报 `RESIDUAL_COUNT`。

> 这一类（init 脚本 `set -e` + 硬编码写系统目录）说明：**不是所有「加 `user:` 后失败」
> 都能靠挂载解决**。判定顺序应是——能挂可写目录就挂；挂载会破坏镜像自带工具、
> 或镜像内无提权手段、或无开关跳过时，按 `USER-EXCEPTION` 撤回 `user:` 并如实登记残留。


### 本轮新增的两个「镜像要写运行目录」缺陷

都已按「挂载到包用户可写目录」修好，与 huginn 属同一类，但修复点不同：

| 应用 | 失败日志 | 修复 |
| --- | --- | --- |
| `fn-affine` | `EACCES: permission denied, mkdir '/app/src'` | 挂 `${TRIM_PKGVAR}/data/src:/app/src`（NestJS 生成 `src/schema.gql` 用） |
| `fn-ollama` | `could not create directory mkdir /.ollama` | 数据挂 `/data`，`HOME=/data`、`OLLAMA_MODELS=/data/.ollama/models` |

> **ollama 的坑值得记住**：`environment` 里写 `HOME=${TRIM_PKGVAR}/data` 是错的——
> `TRIM_PKGVAR` 是**宿主路径**，容器内没有 `/vol2/...`，于是 ollama 去 `mkdir /vol2` 并失败
> （真机 `RestartCount=937`）。环境变量里只能用**容器内路径**，宿主路径只用于 `volumes:` 左侧。

### 环境补充：数据库与 Redis 凭据

`fn-affine` / `fn-bettafish` 需要外部 PostgreSQL；设备上已有 `fn-postgres`（宿主 `55432`），
另外 `fn-affine` 还需要 Redis（`6379`，密码在 `/vol2/@appconf/redis/extra.conf` 的 `requirepass`）。
口令一律通过本地静态服务的 `/_bootstrap/params.json` 注入页面脚本填表，**不进对话记录与文档**。

## 第 8 批：`PUID/PGID` 方案是否可以替代 `user:`（2026-11-16）

### 起因：审计与校验都漏了「没写 `user:`」的应用

linuxserver 系列（`fn-qbittorrent`、`fn-calibre-web`、`fn-code-server`、`fn-freshrss`、
`fn-heimdall`、`fn-nextcloud` 等）的 compose **没有 `user:`**，而是用镜像约定的
`PUID=${TRIM_UID}` / `PGID=${TRIM_GID}` 让服务进程降权。这类写法的问题：

- `check --apps` 只校验「写了 `user:` 的行」，**完全不检查没写 `user:` 的应用**，
  所以它们能通过校验；
- 镜像 `Config.User` 为空（默认 root），按审计口径属 A 类，但用 PUID 又确实降了权——
  判定上处于灰区，**必须真机确认残留**才能定性。

### 真机结论：`fn-qbittorrent` 与 `user:` 等效，残留为 0

| 观察点 | 结果 |
| --- | --- |
| 容器状态 | `Up About a minute`、`RestartCount=0` |
| 主进程 | `s6-svscan` 以 **root** 运行（`Config.User=[]`） |
| 服务进程 | `qbittorrent-nox` 以 **abc** 运行，即 `PUID=856`/`PGID=849` 生效 |
| 数据目录属主 | `@appdata/fn-qbittorrent`、`data`、`config`、`downloads`、`config/qBittorrent` **全部 856:849**，无 root 属主文件 |
| 入口 | `http://${FNOS_HOST}:8181/` 连测三次 **200** |
| 卸载后 | 容器已删、镜像已删、`@appdata`/`@appconf`/`@apphome` **条目数均为 0**、`8181`/`48181` 均已释放 |

**判定**：`PUID`/`PGID` 与 `user:` 在本用例上**等效**——都让写文件的进程以包用户身份运行，
因此卸载时包用户能删干净自己创建的文件。s6 主进程仍是 root，但它不写用户数据。

> 与 `fn-huginn` 的对比很关键：huginn 残留 5 个空目录，是因为写文件的是**镜像内固定的
> uid 1001**、不是包用户；而 PUID 方案把那个 uid **换成了包用户**，所以没有残留。
> 真正的判据不是「有没有 `user:`」，而是「**写数据目录的进程 uid 是不是包用户**」。

### 由此定下的校验规则（`check --apps`）

一个 Docker 应用必须满足以下**任一**条件才算通过：

1. `user: "${TRIM_UID}:${TRIM_GID}"`；或
2. `# USER-EXCEPTION: <原因>` 标记（确需 root 的镜像）；或
3. **同时**声明 `PUID=${TRIM_UID}` 与 `PGID=${TRIM_GID}`（linuxserver/s6 类镜像的官方降权方式）。

三条都不满足时报警，提示补 `user:`、补 PUID/PGID 或写例外原因。

**分级策略（2026-11-16 定）**：校验结果分两级，避免存量问题阻塞 CI——

| 级别 | 触发条件 | 行为 |
| --- | --- | --- |
| **error**（阻塞） | 写了 `user:` 但值不是 `${TRIM_UID}:${TRIM_GID}`，且上方无 `# USER-EXCEPTION` | `exit 1`，属「写错了」，必须当场改 |
| **warn**（不阻塞） | 没写 `user:`，也没 PUID/PGID 或例外 | 只打印 `[warn]` 清单，`exit 0` |

之所以把后者降为告警：修复它必须先确认**镜像默认身份**（要联网查 registry）再逐个真机复测，
属于分批推进的存量问题；直接硬失败会让整条 CI 红掉而无法继续提交其它改动。
当前告警数是 71，其中经镜像身份核对**只有 21 个是真缺陷**（其余镜像自带非 root），
清单与证据见下一节。等这些改完，可再把告警调回硬失败。

### 规则上线后暴露的真实缺陷：21 个应用以 root 写数据（`fn-twikoo` 真机确证）

新规则一上线就报出 **71 个应用不合格**。逐层筛掉误报后，真实待处理是 **21 个**：

| 筛选步骤 | 数量 | 说明 |
| --- | --- | --- |
| 规则初次报错 | 71 | 只看 compose，不看镜像身份，误报多 |
| 减去镜像自带非 root | −44 | 容器本来就不以 root 运行，无需改（如 `2fauth`=`1000:1000`、`cyberchef`=`101`、`umami`=`nextjs`） |
| 减去受保护的既有应用 | −6 | `fn-bitwarden`/`fn-halo`/`fn-new-api` 等 14 个既有应用不改 |
| **真实待处理** | **21** | 镜像默认 root + 无 `user:` + 无 PUID/PGID + 无 USER-EXCEPTION |

**真机确证（`fn-twikoo`，最简结构：单挂载 + 单端口）**

| 观察点 | 结果 |
| --- | --- |
| 镜像 `Config.User` | 空（默认 root） |
| 容器内进程 | `uid=0(root)` |
| 入口 | `http://${FNOS_HOST}:40063/` → **200**，`RestartCount=0` |
| 包用户 | `835:828` |
| `@appdata/fn-twikoo`（平台建） | **835:828** ✅ |
| `@appdata/fn-twikoo/data`（**容器建**） | **0:0（root）** ❌ |
| `data/db.json` 等 5 个文件 | **0:0（root）** ❌ |
| 卸载（删除所有数据）后 | `@appdata` **残留 1 项**，`db.json` 仍为 `0:0` |

> 这条证据链把「为什么必须让写数据目录的进程用包用户身份」坐实了：平台建的目录属主是对的，
> 但**容器自己 mkdir 出来的子目录和文件是 root**，卸载回调以包用户运行删不掉，用户就会看到
> 「选了删除所有数据却还有残留」。

**与 PUID 方案的对比**（`fn-qbittorrent`，同一天验证）：

| | `fn-twikoo`（无降权） | `fn-qbittorrent`（PUID/PGID） |
| --- | --- | --- |
| 容器内写数据的进程 | `root` | `abc`（= 包用户 856） |
| `data` 子目录属主 | **0:0** | **856:849** |
| 卸载后残留 | **1 项**（`db.json`） | **0 项** |

21 个待处理清单（镜像默认 root，需逐个补 `user:` 或 PUID/PGID，或写例外原因）：
`fn-2fauth`、`fn-ghost`、`fn-mongo-express`、`fn-obsidian-livesync`、`fn-postgres`、
`fn-synapse`、`fn-tailchat`、`fn-teamspeak`、`fn-trendradar`、`fn-twikoo`、`fn-typecho`、
`fn-uptime-kuma`、`fn-vexdb`、`fn-waline`、`fn-wallos`、`fn-web-check`、
`fn-wechatmarkdowneditor`、`fn-yesplaymusic`、`fn-yourls`、`fn-zfile`、`fn-neko`（变量镜像，需单独判）。

### 整改结果（2026-11-16，提交 `fd0c154b`）

**19 个已改**（排除 `fn-neko` 变量镜像、`fn-postgres` 用户自建应用）：

- 每个应用补 `user: "${TRIM_UID}:${TRIM_GID}"`；
- `install_callback` 预建 compose 里所有 `${TRIM_PKGVAR}` **目录型**挂载源（单文件挂载跳过，
  避免把 `conf/local.ini` 之类当目录建），并统一补上 `TRIM_PKGVAR` 空值护栏。

**`fn-twikoo` 修复前后对照（同一设备、同一用例）**

| 观察点 | 修复前 | 修复后 |
| --- | --- | --- |
| `Config.User` | `[]`（默认 root） | **`835:828`** |
| 容器内进程 | `uid=0(root)` | **`uid=835 gid=828`** |
| `data/db.json` 属主 | **`0:0`** | **`835:828`** |
| 入口 | 200 | 200 |
| 卸载后 `@appdata`/`@appconf`/`@apphome` | **1 项残留**（root 的 `db.json`） | **均为 0 项** |

> 附带发现：修复后重新安装时，**上一次遗留的 root 残留也被新容器改写成了包用户属主**，
> 卸载时一并清除。说明「先装旧版留下残留 → 再装修复版」能自愈历史残留，
> 但不必作为标准流程（正常路径是修好后一次装对）。

**告警数**：71 → **52**。剩余 52 条中，经镜像身份核对仍属「镜像自带非 root」的占多数，
真正待复核的是 `fn-neko`（变量镜像）与少量未核查项。

### 第二批真机复测（2026-11-16）

| 应用 | 结果 | 关键数据 |
| --- | --- | --- |
| `fn-twikoo` | **PASS** | 修复前 `data/db.json` 属 `0:0`、卸载残留 1 项；修复后 `Config.User=835:828`、容器内 `uid=835`、`db.json` 属 `835:828`、入口 200、**卸载残留 0** |
| `fn-uptime-kuma` | **PASS** | `Up (healthy)`、`Config.User=833:826`（与包用户一致）、`data` 属主 `833:826`、入口 **302**、**卸载残留 0**、端口已释放 |

两个应用的 `@appdata`/`@appconf`/`@apphome` 卸载后条目数均为 **0**，确认批量补 `user:` 的做法有效。






## 明细## 明细

### A 类：镜像默认 root 且 compose 未写 `user:`（96 个）

| 应用 | 镜像 |
| --- | --- |
| `fn-adguardhome` | `adguard/adguardhome:v0.107.79` |
| `fn-affine` | `ghcr.io/toeverything/affine:0.27.4` |
| `fn-ai-portal` | `1panel/ai-portal:v1.0.10` |
| ~~`fn-alist`~~ | `xhofe/alist:v3.66.0` —— 已按用户决定**永久移除**（见需求文档「不做适配清单」），实测镜像 `Config.User` 为空即以 root 运行、compose 无 `user:`，A 类判定本身正确 |
| `fn-answer` | `apache/answer:2.0.3` |
| `fn-archivebox` | `archivebox/archivebox:0.9.77` |
| `fn-artalk` | `artalk/artalk-go:2.10` |
| `fn-astrbot` | `soulter/astrbot:v4.29.3` |
| `fn-beszel` | `henrygd/beszel:0.21.1` |
| `fn-bettafish` | `ghcr.io/666ghj/bettafish:v3.0.0` |
| `fn-bililive-go` | `chigusa/bililive-go:v0.8.3` |
| `fn-bitwarden` | `vaultwarden/server:latest` |
| `fn-blinko` | `blinkospace/blinko:1.8.8` |
| `fn-bytebase` | `bytebase/bytebase:3.24.0` |
| `fn-calibre-web` | `linuxserver/calibre-web:0.6.27` |
| `fn-certd` | `greper/certd:1.46.0` |
| `fn-certimate` | `certimate/certimate:v0.4.36` |
| `fn-changedetectionio` | `dgtlmoon/changedetection.io:0.60.10` |
| `fn-chatgpt-next-web` | `yidadaa/chatgpt-next-web:v2.16.1` |
| `fn-clawswarm` | `1panel/clawswarm:v1.0.5` |
| `fn-cloudbeaver` | `dbeaver/cloudbeaver:26.2.3` |
| `fn-cloudreve` | `cloudreve/cloudreve:4.19.1` |
| `fn-code-server` | `linuxserver/code-server:4.143.1` |
| `fn-comfyui` | `1panel/comfyui:v0.33.1` |
| `fn-convertx` | `c4illin/convertx:v0.20.0` |
| `fn-copaw` | `agentscope/qwenpaw:v2.2.2` |
| `fn-cordys-crm` | `1panel/cordys-crm:v1.9.6` |
| `fn-dbhub` | `bytebase/dbhub:1.5.0` |
| `fn-dbx` | `t8y2/dbx:0.6.61` |
| `fn-discuz` | `tencentci/discuz:v3.4` |
| `fn-domain-admin` | `mouday/domain-admin:v1.6.78` |
| `fn-dosgame` | `firezmc/dosgame-web-docker:v3.9.6` |
| `fn-easyimage2` | `ddsderek/easyimage:v2.8.7` |
| `fn-emlog` | `emlog/emlog:pro-latest` |
| `fn-filecodebox` | `lanol/filecodebox:2.8.5` |
| `fn-flarum` | `crazymax/flarum:2.0.2` |
| `fn-forgejo` | `codeberg.org/forgejo/forgejo:16.0.7` |
| `fn-freshrss` | `linuxserver/freshrss:1.30.4` |
| `fn-gatus` | `twinproduction/gatus:v5.38.0` |
| `fn-gitea` | `commitgo/gitea-ee:27.3.9` |
| `fn-glance` | `glanceapp/glance:v0.8.7` |
| `fn-gotify` | `gotify/server:3.1.1` |
| `fn-halo` | `registry.fit2cloud.com/halo/halo-pro:2.24` |
| `fn-heimdall` | `linuxserver/heimdall:2.8.4` |
| `fn-it-tools` | `corentinth/it-tools:2024.10.22-7ca5933` |
| `fn-jellyfin` | `jellyfin/jellyfin:10.11.11` |
| `fn-jsonhero` | `henryclw/jsonhero-web:latest` |
| `fn-kirara-agent` | `lss233/kirara-agent-framework:v3.2.0` |
| `fn-kkfileview` | `keking/kkfileview:4.1.0` |
| `fn-kodbox` | `kodcloud/kodbox:1.70.03` |
| `fn-koishi` | `koishijs/koishi:v1.16.0` |
| `fn-langbot` | `rockchin/langbot:v4.11.4` |
| `fn-laya-server` | `1panel/laya-server:v0.1.2` |
| `fn-linkding` | `sissbruecker/linkding:1.47.0-plus` |
| `fn-llama-cpp` | `ghcr.io/ggml-org/llama.cpp:server` |
| `fn-localai` | `localai/localai:v3.12.1-aio-cpu` |
| `fn-logto` | `svhd/logto:1.45.0` |
| `fn-lsky-pro` | `halcyonazure/lsky-pro-docker:latest` |
| `fn-maddy-mail` | `foxcpp/maddy:0.9.6` |
| `fn-manticoresearch` | `manticoresearch/manticore:29.9.0` |
| `fn-maxkb` | `1panel/maxkb:v2.10.8-lts` |
| `fn-mblog` | `kingwrcy/mblog:1.1.0` |
| `fn-metabase` | `metabase/metabase:v0.65.2` |
| `fn-mkdocs-material` | `squidfunk/mkdocs-material:9.8.0` |
| `fn-mliev-dwz` | `docker.cnb.cool/mliev/dwz/dwz-server:v2.24.1` |
| `fn-music-tag-web` | `xhongc/music_tag_web:2.8.0` |
| `fn-new-api` | `calciumion/new-api:latest` |
| `fn-newsnow` | `ghcr.io/ourongxing/newsnow:v0.0.41` |
| `fn-nextcloud` | `linuxserver/nextcloud:35.0.2` |
| `fn-nezha` | `ghcr.io/nezhahq/nezha:v2.6.1` |
| `fn-nginx-proxy-manager` | `jc21/nginx-proxy-manager:2.16.0` |
| `fn-nocobase` | `nocobase/nocobase:2.2.36` |
| `fn-nocodb` | `nocodb/nocodb:0.301.5` |
| `fn-octop` | `ghcr.io/tencentcloud/octop:1.0.2` |
| `fn-ollama` | `ollama/ollama:0.40.13` |
| `fn-ollama-webui` | `ghcr.io/open-webui/open-webui:v0.12.5` |
| `fn-onlyoffice` | `onlyoffice/documentserver:10.0.0.1` |
| `fn-opengist` | `ghcr.io/thomiceli/opengist:1.15.3` |
| `fn-palworld` | `thijsvanloef/palworld-server-docker:v2.8.1` |
| `fn-palworld-server-tool` | `jokerwho/palworld-server-tool:0.12.2` |
| `fn-photoprism` | `photoprism/photoprism:251130-ce` |
| `fn-qbittorrent` | `linuxserver/qbittorrent:5.3.0` |
| `fn-qiandao` | `a76yyyy/qiandao:20250803` |
| `fn-qinglong` | `whyour/qinglong:2.24.0-debian` |
| `fn-quark-auto-save` | `ghcr.io/fish2018/pansou:latest` |
| `fn-roundcube` | `roundcube/roundcubemail:1.7.5-apache` |
| `fn-rsshub` | `diygod/rsshub:chromium-bundled-2026-04-19` |
| `fn-rustdesk` | `rustdesk/rustdesk-server-s6:1.1.16` |
| `fn-showdoc` | `star7th/showdoc:v3.9.5` |
| `fn-siyuan` | `b3log/siyuan:v3.8.9` |
| `fn-sqlbot` | `dataease/sqlbot:v1.10.2` |
| `fn-stirling-pdf` | `frooodle/s-pdf:3.2.2` |
| `fn-sub2api` | `weishaw/sub2api:0.2.19` |
| `fn-sun-panel` | `hslr/sun-panel:1.8.1` |
| `fn-trilium` | `triliumnext/trilium:v0.106.1` |
| `fn-zentao` | `hub.zentao.net/app/zentao:22.1` |

### B 类：镜像默认 root 且 compose 已写 `user:`（21 个）

| 应用 | 镜像 | compose user |
| --- | --- | --- |
| `fn-ai-gateway` | `1panel/ai-gateway:v1.5.1` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-audiobookshelf` | `advplyr/audiobookshelf:2.37.2` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-dataease` | `registry.cn-qingdao.aliyuncs.com/dataease/dataease:v3.1.0` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-dvwa` | `ghcr.io/digininja/dvwa:latest` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-excalidraw` | `excalidraw/excalidraw:latest` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-focalboard` | `mattermost/focalboard:7.11.4` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-gsmanager` | `xiaozhu674/gameservermanager:3.14.2` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-huginn` | `ghcr.io/huginn/huginn:latest` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-komari` | `ghcr.io/komari-monitor/komari:1.6.1` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-komga` | `gotson/komga:1.29.2` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-koodo-reader` | `ghcr.io/koodo-reader/koodo-reader:master` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-mcsmanager-web` | `githubyumao/mcsmanager-web:latest` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-navidrome` | `deluan/navidrome:0.64.2` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-nexus` | `sonatype/nexus3:3.97.3` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-node-red` | `nodered/node-red:5.0.9` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-ntfy` | `binwiederhier/ntfy:v2.34.0` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-openlist` | `openlistteam/openlist:v4.2.9` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-sentinel-dashboard` | `bladex/sentinel-dashboard:1.8.10` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-teable` | `ghcr.io/teableio/teable:latest` | `"${TRIM_UID}:${TRIM_GID}"` |
| `fn-tinyrdm` | `ghcr.io/tiny-craft/tiny-rdm:1.2.7` | `"0:0"` |
| `fn-verdaccio` | `verdaccio/verdaccio:7.0.2` | `"${TRIM_UID}:${TRIM_GID}"` |

### C 类：镜像自带非 root 且 compose 未写 `user:`（31 个）

| 应用 | 镜像 | 镜像 USER |
| --- | --- | --- |
| `fn-2fauth` | `2fauth/2fauth:9.0.0` | `1000:1000` |
| `fn-browserless` | `ghcr.io/browserless/chrome:v2.58.0` | `blessuser` |
| `fn-casdoor` | `casbin/casdoor:v4.25.0` | `1000` |
| `fn-cloudflared` | `cloudflare/cloudflared:2026.10.6` | `65532:65532` |
| `fn-cyberchef` | `ghcr.io/gchq/cyberchef:11.5.0` | `101` |
| `fn-dashy` | `lissy93/dashy:4.9.8` | `1000:1000` |
| `fn-drawio` | `jgraph/drawio:32.6.1` | `tomcat` |
| `fn-ezbookkeeping` | `mayswind/ezbookkeeping:2.1.1` | `1000:1000` |
| `fn-filebrowser` | `filebrowser/filebrowser:v2.63.23` | `user` |
| `fn-firefly-iii` | `fireflyiii/core:version-6.4.2` | `www-data` |
| `fn-jupyter-notebook` | `jupyter/scipy-notebook:latest` | `1000` |
| `fn-keycloak` | `keycloak/keycloak:26.8.1` | `1000` |
| `fn-langflow` | `langflowai/langflow:1.13.0` | `user` |
| `fn-linux-command` | `wcjiang/linux-command:1.22.0` | `static` |
| `fn-lobe-chat` | `lobehub/lobe-chat:1.143.3` | `nextjs` |
| `fn-mattermost` | `mattermost/mattermost-team-edition:12.0.1` | `mattermost` |
| `fn-miniflux` | `miniflux/miniflux:2.3.4` | `65534` |
| `fn-n8n` | `n8nio/n8n:2.46.2` | `node` |
| `fn-nodebb` | `ghcr.io/nodebb/nodebb:4.16.5` | `nodebb` |
| `fn-openclaw` | `1panel/openclaw:2026.10.9` | `node` |
| `fn-openldap` | `bitnamilegacy/openldap:2.6.10` | `1001` |
| `fn-pgadmin4` | `dpage/pgadmin4:9.19` | `5050` |
| `fn-planka` | `ghcr.io/plankanban/planka:2.2.1` | `node` |
| `fn-redis-commander` | `rediscommander/redis-commander:latest` | `1000` |
| `fn-redpanda-console` | `redpandadata/console:v3.13.1` | `redpandaconsole` |
| `fn-rocketmq` | `apache/rocketmq:5.5.0` | `rocketmq` |
| `fn-rustfs` | `rustfs/rustfs:1.0.4` | `rustfs` |
| `fn-screego` | `ghcr.io/screego/server:1.12.6` | `1001` |
| `fn-sftpgo` | `drakkan/sftpgo:v2.7.6-alpine` | `1000:1000` |
| `fn-stalwart-mail` | `stalwartlabs/stalwart:v1.0.1-alpine` | `stalwart` |
| `fn-umami` | `ghcr.io/umami-software/umami:3.4.1` | `nextjs` |

### D 类：查询失败（38 个）

| 应用 | 镜像 | 原因 |
| --- | --- | --- |
| `fn-adminer` | `adminer:6.2.0-standalone` | registry 不可达: fetch failed |
| `fn-ghost` | `ghost:6.73.0` | HTTP 429 (registry) |
| `fn-kibana` | `kibana:9.5.5` | HTTP 429 (registry) |
| `fn-memcached` | `memcached:1.6.22-alpine3.18` | HTTP 429 (registry) |
| `fn-mongo-express` | `mongo-express:1.0.2-20` | HTTP 429 (registry) |
| `fn-neko` | `${IMAGE_NAME}` | SKIP 变量镜像（未解析） |
| `fn-obsidian-livesync` | `couchdb:3.5.3` | HTTP 429 (registry) |
| `fn-odoo` | `odoo:19.0` | HTTP 429 (registry) |
| `fn-phpmyadmin` | `phpmyadmin:5.2.3` | HTTP 429 (registry) |
| `fn-postgres` | `postgres:16.15-alpine` | HTTP 429 (registry) |
| `fn-reader` | `hectorqin/reader:latest` | HTTP 401 (registry) |
| `fn-sonarqube` | `sonarqube:26.10.0.133078-community` | fetch failed |
| `fn-synapse` | `matrixdotorg/synapse:v1.164.1` | registry 不可达: fetch failed |
| `fn-tailchat` | `moonrailgun/tailchat:1.11.18` | registry 不可达: fetch failed |
| `fn-teamspeak` | `teamspeak:3.13.8` | registry 不可达: fetch failed |
| `fn-tomcat` | `bitnamilegacy/tomcat:10.1.43` | registry 不可达: fetch failed |
| `fn-trendradar` | `wantcat/trendradar:6.11.0` | registry 不可达: fetch failed |
| `fn-twenty` | `twentycrm/twenty:v2.53.1` | registry 不可达: fetch failed |
| `fn-twikoo` | `imaegoo/twikoo:2.0.17` | registry 不可达: fetch failed |
| `fn-typecho` | `joyqi/typecho:1.3.0-php8.2-apache` | registry 不可达: fetch failed |
| `fn-upage` | `halohub/upage:2.0.0` | registry 不可达: fetch failed |
| `fn-uptime-kuma` | `louislam/uptime-kuma:2.5.8` | registry 不可达: fetch failed |
| `fn-vane` | `itzcrazykns1337/vane:v1.12.2` | registry 不可达: fetch failed |
| `fn-vexdb` | `shuzhiyinhang/vexdb:3.0.0.28146` | registry 不可达: fetch failed |
| `fn-waline` | `lizheming/waline:1.43.4` | registry 不可达: fetch failed |
| `fn-wallos` | `bellamy/wallos:5.10.2` | registry 不可达: fetch failed |
| `fn-web-check` | `lissy93/web-check:2.3.11` | registry 不可达: fetch failed |
| `fn-wechatmarkdowneditor` | `doocs/md:2.1.0` | registry 不可达: fetch failed |
| `fn-wikijs` | `requarks/wiki:2.5.317` | registry 不可达: fetch failed |
| `fn-wordpress` | `wordpress:7.1.4` | registry 不可达: fetch failed |
| `fn-xiaomusic` | `hanxi/xiaomusic:v0.6.1` | registry 不可达: fetch failed |
| `fn-xiaoya-only` | `xiaoyaliu/alist:latest` | registry 不可达: fetch failed |
| `fn-yesplaymusic` | `fogforest/yesplaymusic:0.4.9` | registry 不可达: fetch failed |
| `fn-yourls` | `yourls:1.10.6` | registry 不可达: fetch failed |
| `fn-zabbix-agent` | `zabbix/zabbix-agent:alpine-7.4.5` | registry 不可达: fetch failed |
| `fn-zabbix-proxy` | `zabbix/zabbix-proxy-mysql:alpine-7.4.5` | registry 不可达: fetch failed |
| `fn-zabbix-server` | `zabbix/zabbix-server-mysql:alpine-7.4.5` | registry 不可达: fetch failed |
| `fn-zfile` | `zhaojun1998/zfile:5.1.0` | registry 不可达: fetch failed |

## 后续任务

| 任务 | 范围 | 验收 |
| --- | --- | --- |
| A 类批量整改（第一批） | 96 个里先跑不同形态（单容器 Web、带数据库、带上传目录）——`fn-glance` 已完成（见上） | 安装成功 + 入口可访问 + 卸载残留 0 |
| A 类批量整改（其余） | 视第一批结果扩展到全量 | 同上；失败者按上游 entrypoint 判定是否归 `# USER-EXCEPTION` |
| C 类属主验证 | 31 个 | 容器能写挂载目录（`touch` 探针），必要时 ACL 授权镜像 uid |
| D 类补查 | 38 个 | 限流窗口过后重跑 `node scripts/audit-image-user.mjs`，缓存会自动续查 |

## 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-11-05 | 建立本审计：186 个 Docker 应用按镜像 `config.User` 与 compose `user:` 交叉分类；登记 A 类 96 个为缺陷候选并给出分批整改方案，说明本轮不改动的原因。 |
| 2026-11-09 | 补第 6 批：`fn-nezha` 全程 GUI 安装验证 PASS，并首次实测「删除所有数据」——三个应用目录条目数归零；标记验收器假阴性缺陷已修（`142849e8`），补充「残留看目录内条目数」的判定口径。 |
| 2026-11-09 | 补 `fn-huginn`：GUI 流程确认真实缺陷（镜像要回写 `/app/.env`，包用户无权写镜像层）并修好；复测因 ghcr 镜像拉不完记 ENV_BLOCKED。新增「回写配置到镜像层」这一类补救方案。 |
| 2026-11-09 | 重测网络：关闭 Clash 后确认 DNS 污染 + 设备无 IPv6 出网；逐源实测出 3 个可用 Hub 镜像源（daocloud 1030MB/141s）与 1 个可用 ghcr 代理（huginn 3.02GB/134s）；纠正上一版「daocloud/hub.rat.dev 超时」的结论。 |
| 2026-11-09 | `fn-huginn` 最终 PASS（改走镜像自带身份 + ACL 授权数据目录）；登记已知限制：卸载「删除所有数据」残留 5 个空目录（容器 uid 创建的 750 目录，包用户无权删除，ACL mask 无法抬起）。 |
| 2026-11-10 | 补第 7 批（ghcr）：`fn-affine` / `fn-octop` / `fn-bettafish` / `fn-ollama` 全部 PASS 且残留为 0；实测出可用 ghcr 代理为 `ghcr.nju.edu.cn`；新增 affine `/app/src`、ollama `HOME` 两处挂载修复，并记下「environment 只能用容器内路径」这一坑。 |
| 2026-11-10 | 补 `fn-stirling-pdf`（Hub）：`ln -sf /usr/local/bin/diagnostics` 在 `set -e` 下致命，且无法用挂载修（会丢 `gs` 等工具），按 USER-EXCEPTION 撤回 `user:` 后 PASS；记下「并非所有加 user: 失败都能靠挂载解决」的判定顺序。另移除 `fn-alist`（用户决定不适配）。 |
| 2026-11-16 | 补第 8 批：`fn-qbittorrent` 真机证明 PUID/PGID 与 `user:` 等效（残留 0）；`fn-twikoo` 真机确证无降权时 data 子目录与文件属 0:0、卸载残留 1 项。`check --apps` 补上「未写 user:」盲区并改为「error 阻塞 / warn 不阻塞」两级，检出 71 条告警（其中 21 个为真缺陷）。 |
| 2026-11-16 | 19 个应用批量补 `user:` + 预建挂载目录（`fd0c154b`）；`fn-twikoo`、`fn-uptime-kuma` 真机复测 PASS 且卸载残留 0，验证批量改法有效。告警 71→52。 |
