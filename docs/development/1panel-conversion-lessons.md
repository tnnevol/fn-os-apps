# 1Panel → fnOS 转换：踩坑与经验教训

本文记录 FNOS-001 转换过程中**真实踩到并已修复**的问题。每条都包含：现象、根因、修法，以及**如何避免重犯**。

只写实际发生过的，不写设想。发生批次以 T0/T1/T2 标注。

---

## 一、工具链层

### 1.1 `fnpack build` 打包失败仍返回退出码 0（T0）

**现象**

```text
$ fnpack build
Packing failed. Required file manifest is missing
$ echo $?
0
```

**根因**：`fnpack` 不以退出码反映打包结果，且失败时不产出 `.fpk`。

**修法**：构建入口改为三重判定——退出码 0 **且** `.fpk` 存在 **且** 其 `mtime` 不早于本次构建开始时间（排除上次残留）。见 `tooling/fn-os-apps-cli/src/commands/build.ts`。

**为什么重要**：这是**静默失败**。只看退出码的 CI 会在包完全没产出的情况下报"成功"。整个项目后续所有自动化都依赖这道闸。

**如何避免**：任何调用 `fnpack` 的地方都不要裸调，必须走加固后的入口。

---

### 1.2 入口 ID 有 32 字符硬上限（T0）

**现象**

```text
Packing failed. The entry ID "fn-wechatmarkdowneditor.Application" exceeds the 32-character limit.
```

**根因**：`fnpack` 校验 `app/ui/config` 的入口键长度。`fn-` + `<app>` + `.Application` 超过 32 字符即拒绝。

**实测边界**（Lead 独立复现）：

| 入口 ID 长度 | 结果 |
| --- | --- |
| 30 / 31 / 32 | ✅ 通过 |
| 33 及以上 | ❌ 拒绝 |

即 **`<app>` ≤ 17 字符必然通过，≥ 18 字符必然超限**，不存在灰区。换 `.main` 后缀（3+len+5）可放宽到 `<app>` ≤ 24。

**修法**：超限时改用 `<appname>.main`（官方《应用入口》文档示例即用 `myapp.main`；仓库先例 `fn-memos.main`、`fn-xiaoya-only.main`）。

**相邻规则**：入口键还**必须以 `manifest.appname` 为前缀**，否则报 `should start with <appname>`。

**如何避免**：**先算长度再建目录**。已发生的实例：`fn-wechatmarkdowneditor`(35)、`fn-palworld-server-tool`(35)、`fn-nginx-proxy-manager`(34)。

> ⚠️ 此处失败时 `fnpack` **仍返回 0**，靠 1.1 的产物判定才发现。

---

### 1.3 `.fpk` 字节级不可复现（T0）

**现象**：同一份源码连续两次构建，产物大小与哈希都不同。

**根因**：`fnpack` 向包内 `manifest` 注入一行随构建时刻变化的 `checksum`，tar 成员 mtime 亦随之变化。

**修法与结论**：**`.fpk` 的大小与哈希不能作为验收判据，CI 不应做产物哈希断言**。要校验就比对解包内容——内层 `app.tgz` 解开后 `diff -r` 无输出，顶层 `manifest` 仅 `checksum` 一行不同。

**衍生影响**：FnDepot 源索引的 `sha256`/`size` **不能在生成阶段填写**（见 3.1）。

---

### 1.4 归一化名比对：只归一化一侧等于没归一化（Lead）

**现象**：统计"还有哪些应用未转换"时，把 `obsidian_livesync` 报为待转换。**实际它早已交付**（`apps/fn-obsidian-livesync/`，`b539f83` 引入）。

**根因**：仓库存的是**连字符**目录名（`fn-obsidian-livesync`），上游清单写的是**下划线键**（`obsidian_livesync`）。判断「是否已存在」时**只对上游名做了 `_`→`-` 归一化，却没有保证 `repo` 集合本身也归一化**——一步之差，下划线名永远匹配不上。

**为什么危险**：这个 bug **不报错、不告警，只静默给出错误的"待办清单"**。若不是要求"创建前再确认一次"，就会去重复创建一个已经交付的应用——**而禁止项 9 正是为此而写，结果第一个违反它的判据本身就是我写的**。

**修法与结论**：

```python
norm = lambda x: x.replace('_', '-').lower()
repo = {norm(d[3:] if d.startswith('fn-') else d) for d in os.listdir('apps')}
pending = [a for a in upstream if norm(a) not in repo]
```

**两侧都必须过同一个 `norm`**，且 **`repo` 侧必须是归一化后的集合**（不是原始目录名）。仅归一化查询键是无效的。

**如何避免**：任何"名单比对"脚本，**先对两侧同施一个归一化函数**，再比对；并**用已知的反例自检**（例如断言 `obsidian_livesync` 与 `obsidian-livesync` 视为同一个）。

---

### 1.5 `formFields` 在版本级 `data.yml`（T0）

**现象**：按 `appstore/apps/<app>/data.yml` 读向导字段，得到"全部应用都无表单"的错误结论。

**根因**：`formFields` **只在版本级** `appstore/apps/<app>/<version>/data.yml` 的 `additionalProperties` 下；顶层文件只有展示元数据。实测 265 个顶层文件命中数为 **0**。

**修法**：读版本级；多版本按并集取值（实测并集/全部/首个三种取法均得 259，无应用跨版本出现有/无差异）。

**如何避免**：清单的「盘点口径」已写死这一点。

---

### 1.6 可变镜像标签：判据连踩三次（T0/T2）

这是本项目**同一个坑踩了三次**的记录，值得完整保留。

| 次数 | 漏判的标签 | 形态 |
| --- | --- | --- |
| 第 1 次 | `ghcr.io/koodo-reader/koodo-reader:master` | `:master` 不是 `:latest` |
| 第 2 次 | `zabbix/zabbix-java-gateway:alpine-latest` | `latest` 前面是 `-` 不是 `:` |
| 第 3 次 | `ghcr.io/umami-software/umami:${PANEL_DB_TYPE}-v2.20.2` | 标签是变量插值 |

**根因**：最初的判据是"标签**等于** `latest`/`master`/…"，这是个精确匹配。

**修法**：改为**宽匹配**——

```text
标签串包含 latest / master / main / dev / edge / stable / nightly 即命中
或标签含 ${ 即命中（变量插值，同样不可复现）
```

**配套要求**：把可变标签钉到具体版本时，**必须联网确认该 tag 真实存在**，不能凭"同一版本线"推断。实例：

```text
zabbix/zabbix-java-gateway:alpine-latest  →  钉到 alpine-7.4.5
  （Docker Hub 实测 alpine-7.4.5 存在，与同 compose 的 zabbix-server-mysql:alpine-7.4.5 同版本线）
```

---

### 1.7 图标：非正方形与 ICO（T0/T1）

| 情况 | 处理 |
| --- | --- |
| 非正方形（如 173×178） | 新增 `--allow-non-square`：**居中补透明边**到正方形，**不裁剪不拉伸**。默认行为**仍拒绝**，避免静默放宽既有校验 |
| Windows ICO（magic `00000100`） | jimp 无法解码。265 个上游应用全量扫描：**仅 `komga` 一个**是 ICO，且内含最大仅 48×48（低于 64px 下限）——即使加解码依赖，放大到 256 也会严重失真，**已暂缓** |
| `<64px` 的 PNG | 5 个（`browserless` 48、`glance` 50、`linkding` 56、`miniflux` 48、`redpanda-console` 48），未来会触发放大失真警告，**策略待定** |
| JPEG 伪装成 `.png` | 7 个，jimp 能正常解码，无需处理 |

---

## 二、形态判定层

### 2.1 相对挂载正则漏判单引号写法（T0）

**现象**：`newsnow`、`openldap` 被错分到 T0（实为 T1）。

**根因**：判据写成"行首 `- ` 后接 `./`"，漏掉 `- './data:...'`。两者的挂载写法带单引号。

**修法**：改用**引号无关**的正则 `^\s*-\s*['"]?\./`。

**衍生**：还有一个口径差异要写清——真实 `./` volume 挂载是 **222** 个应用，而该正则命中 **223**（多出的 1 个是 `zitadel`，其 `./data/masterkey.env` 出现在 `env_file:` 段而非 volume）。**两个口径跑完整分级结果完全一致**，不影响分级。

---

### 2.2 "外部数据库"判据过宽（T0）

**现象**：`2fauth`、`ai-gateway`、`gotify`、`zentao` 被误判为需要外部数据库（T2），实际是容器内自带 SQLite / 镜像内置数据库。

**根因**：判据是"env 文本里出现 `DATABASE`"——**把 SQLite 与镜像内置数据库也算成了外部依赖**。

**修法**：**只有 compose 使用 `PANEL_DB_*` 或 `DBHUB_DB_*` 才算外部数据库依赖**。

| 变量 | 含义 |
| --- | --- |
| `PANEL_DB_*` | 需要用户提供外部数据库实例 |
| `DBHUB_DB_*` | 同义，同样是外部数据库（`dbhub` 因此从 T0 移到 T2） |
| `DB_DATABASE=...sqlite` / `GOTIFY_DATABASE_DIALECT=sqlite3` / `MYSQL_INTERNAL=true` | **容器内自带，不算** |

---

### 2.3 "多容器""多挂载"不能靠印象（T2）

**现象**：我在任务描述里写"`tomcat` 6 个 service、多挂载 2—6 条、`:ro` 必须保留"，app-builder 用 YAML 解析器逐个核实后发现：**7 个"多容器"全是单容器**、**4 个实为单挂载**、**`:ro` 出现 0 次**。

**根因**：我按"预期形态"批量推，没做结构化核实。svc 数字来自上游 `data.yml` 的展示元数据，**根本没解析 compose**。

**修法**：**核实形态一律用 YAML 解析器，不用 grep**。已写入规约与任务模板。

> 这类错误不会导致构建失败，只会产出"看起来对但配置错"的应用，**靠任何后置校验都抓不到**。

---

### 2.4 多版本应用：容器内目标可能随版本大变（T2）

**现象**：`dataease` 曾用 **3.1.0 的 13 条挂载**配 **v2.10.27 的镜像**，容器内路径全是 `/opt/dataease3.0/...`，而该镜像里只有 `dataease2.0` 目录。

| 上游版本 | 挂载数 | 容器内路径 |
| --- | --- | --- |
| `2.10.27` | 7 条 | `/opt/dataease2.0/...` |
| `3.1.0` | 13 条 | `/opt/dataease3.0/...` |

**后果**：13 个挂载点全部指向镜像里不存在的目录，数据不落盘。

**关键**：**"构建通过"与"挂载源存在"这两道校验都抓不到它**——前者不解析容器内路径，后者只检查宿主侧源目录。

**修法**：新增通用校验 **断言每个应用的容器内目标与所选用版本的上游逐条一致**，并做反向回归（故意配错版本验证校验会报错）。

---

### 2.5 `type: website` 不能作为"有无界面"的判据（T0）

**现象**：上游 `data.yml` 把 `memcached`、`zabbix-agent` 这类明显无 Web 界面的应用也标成 `type: website`。

**正例**：`fn-memcached` 的字段名就是 `PANEL_APP_PORT_HTTP`（值 11211），**但 11211 是 memcached 的 TCP 协议、没有 HTTP 界面**。

**修法**：「无 Web UI 应用」按 **是否通过 HTTP 提供用户界面**判定，与字段名、有无端口都无关：

| 情况 | `app/ui/config` | `manifest` |
| --- | --- | --- |
| 有 HTTP 界面 | 写 `.url` | 保留 `desktop_*` |
| TCP / 非 HTTP 服务 | 写 `{}` | **删掉** `desktop_uidir` 与 `desktop_applaunchname` |
| 无端口 | 同上 | 同上 |

---

## 三、语义与落盘层

### 3.1 `data-share`：声明了不等于用得上（T1）

**这是既有应用里最普遍的一个"形同虚设"**。

**现象**：仓库里 10 个应用（`fn-halo`、`fn-moviepilot`、`fn-reader` 等）在 `config/resource` 声明了 `data-share`，但：

```text
grep TRIM_DATA_SHARE_PATHS apps/   →  0 处命中
/vol4/@appshare/                    →  空
```

**根因**：共享目录与私有数据目录是**两个不同位置**，应用实际全挂在 `${TRIM_PKGVAR}`：

```text
/var/apps/fn-halo/shares/fn-halo  →  /vol4/@appshare/fn-halo   共享目录（文件管理器可见）
/var/apps/fn-halo/var             →  /vol4/@appdata/fn-halo    私有数据目录
```

**后果**：**用户看到的共享目录永远是空的，应用也不读它。**

**修法（D 组规则）**：

1. **恰好声明 1 个**共享目录（`TRIM_DATA_SHARE_PATHS` 是 `:` 分隔多值，不能作单个挂载源）
2. **不需要 `permission`**——官方文档：「一般情况下不需要写 `permission`……系统会自动为应用运行用户授予所需的 ACL 访问权限」
3. 挂载源用 `${TRIM_APPDEST_VOL}/@appshare/fn-<app>/<子目录>`
4. **卷号必须用变量，不能写死** `/vol<N>/`——`<N>` 是安装时用户选择的存储卷，写死会在选错卷时失效。仓库先例 `apps/fn-xiaoya-only` 已在用 `${TRIM_APPDEST_VOL}`
5. **不要用 `TRIM_DATA_SHARE_PATHS`**：多值分隔无法作单个挂载源，且其能否在 compose 中展开尚未验证

> 另注：实际目录名是 `shares`（复数），官方文档写作 `share`，以实际为准。

---

### 3.2 权限：`PUID=1000` 在 fnOS 上必然失败（T1）

**现象**：上游 linuxserver 系镜像硬编码 `PUID=1000`/`PGID=1000`。

**真机取证**：

```text
fnOS 包用户 UID 是动态分配的，不是 1000：
  docker-fn-it-tools 928    docker-fn-halo 969    docker-fn-reader 975
uid 1000 = 普通登录用户 tnnevol

数据目录：/vol4/@appdata/fn-halo  owner=docker-fn-halo(969)  mode=770
```

目录属主是**包用户**、权限 **770**（组与其他用户无权），容器以 uid 1000 写入**必然失败**。

**修法**：改用 `${TRIM_UID}` / `${TRIM_GID`。同样适用于 `UID`/`GID` 变量写法（`synapse`、`navidrome`）。

**⚠️ 重要边界**：`TRIM_UID`/`TRIM_GID` 能否在 compose 中展开**未经真机验证**。官方文档只列出这两个变量，**没有任何 compose 示例使用它们**（官方 Docker 案例只有 `${TRIM_APPDEST}` 与 `${TRIM_SERVICE_PORT}`）。若未注入会**静默传空值**：

```text
warning: The "TRIM_UID" variable is not set. Defaulting to a blank string.
PUID: ""
exit=0          ← 不报错
```

**属静默失败**，构建与解析环节都拦不住。目前使用者：`code-server`、`freshrss`、`siyuan`、`synapse`、`tinyrdm`、`komari`、`node-red`、`dashy`、`easyimage2`、`nextcloud`、`ntfy`、`gitea`。

---

### 3.3 `user: root` 上游默认值（T1）

**现象**：`komari`、`node-red`、`tinyrdm` 上游以 `user: "0:0"` 或 `user: root` 运行。

**危害**：违反规约禁止项；且 root 写下的文件属主是 root，**后续卸载删除数据时包用户可能删不掉**。

**修法**：改为 `user: "${TRIM_UID}:${TRIM_GID}"`。

---

### 3.4 `touch` 空文件当种子配置会让应用坏掉（T1）

**现象**：单文件挂载若只用 `touch` 造空文件：

| 应用 | 空文件的后果 |
| --- | --- |
| `focalboard` | 空串**不是合法 JSON** → 配置解析失败 |
| `obsidian_livesync` | `require_valid_user = true` 丢失 → **未认证请求可访问公开端点（安全弱化）** |
| `dashy` | 上游自带示例仪表盘 → 面板空白 |
| `glance` | 无 `pages` → 什么都不渲染 |
| `phpmyadmin` | 上传限制与隐藏系统库配置失效（**功能退化但不报错**） |

**根因**：上游 `data/` 目录**自带真实初始内容**，不是空目录。

**修法**：**自写最小可用配置**放 `app/seed/`，由 `install_callback` 在文件不存在时拷入。

**为什么不搬上游的种子文件**：禁止项 4 的立法目的是「不搬运上游的表达」（YAML 注释、README 措辞、表单文案）。而上游 `glance.yml`/`conf.yml` 里含**具体 RSS 源与示例仪表盘**——那是示例数据，本就不该搬。**自己写最小配置同时满足两边**。

**校验判据要升级**：断言"挂载源存在"不够，还要断言"文件非空且格式合法"。

---

### 3.5 Docker 对绑定挂载的**目录**同样要求源存在（T1）

**现象**：误以为只有单文件挂载需要预创建源，实测目录型挂载源缺失时 Docker 会以 root 建一个属主错误的目录。5 个应用受影响。

**修法**：`install_callback` **从 compose 挂载源反推**处理，分三类——有种子内容的单文件（拷贝）、无内容的单文件（`touch`）、目录（`mkdir -p`）。不再手工维护目录列表（那正是漏项根源）。

---

### 3.6 上游数据落盘缺陷必须修正而非照搬（T1）

**`2fauth` 实例**：

```yaml
volumes:
  - ./data:/2fauth
environment:
  - DB_DATABASE="/srv/database/database.sqlite"   # /srv/database 不在 /2fauth 挂载内
```

数据库落在**容器可写层**，容器重建即丢——**而这正是 T1 要修的问题，照搬等于没做 T1**。

**其他同类修正**：

| 类型 | 实例 |
| --- | --- |
| 固定弱凭据 | `2fauth` 的 `APP_KEY=SomeRandomStringOf32CharsExactly`（所有安装共享同一加密密钥） |
| 弱默认口令 | `tomcat`/`onlyoffice`/`openldap`/`newsnow`/`laya-server`/`archivebox`/`ai-gateway`/`octop`/`pgadmin4`/`qiandao`/`tinyrdm`/`waline` |
| 自指但无对应服务 | `cordys-crm` 的 `jdbc:mysql://${CONTAINER_NAME}`（compose 里没有 MySQL 服务，转换后指向自己必然连不上） |
| 宿主绝对路径挂载 | `ai-gateway` 的 `/etc/1panel`、`showdoc` 的 `/showdoc_data`、`glance` 的 `/etc/timezone`+`/etc/localtime` |
| 变量插值镜像 | `umami` 的 `${PANEL_DB_TYPE}-v2.20.2` |

---

### 3.7 数据库向导字段：合并式与分离式不能混用（T2）

上游对数据库连接的两种消费方式：

| 风格 | 何时用 | 字段 |
| --- | --- | --- |
| **合并** | 上游把整段拼进 URL/DSN（`DATABASE_URL`、JDBC URL、DSN） | `DB_TYPE`/`DB_HOST`（含 `地址:端口/库名`）/`DB_USERNAME`/`DB_PASSWORD` |
| **分离** | 上游**分别消费** host/port/name（`WORDPRESS_DB_HOST`、`DB_SERVER_PORT`） | `DB_TYPE`/`DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USERNAME`/`DB_PASSWORD` |

**判断依据**：看上游 compose 里该变量**怎么被用**——`DB_HOST` 后直接跟 `/库名` 用合并；有独立 `DB_PORT` 变量用分离。

**已发生的错误**：一度让合并式同时生成 `DB_HOST`（含 `地址:端口/库名`）与独立 `DB_NAME`，compose 里又写 `@${DB_HOST}/${DB_NAME}` → 拼成 `...host:port/db/db`，连接失败。

**对分离型误用合并**会把 `host:port/db` 当成 host，同样连接失败。

**统一要求**：不预填地址；`DB_PASSWORD` 用 `password` 类型；`APP_PORT` 与 `DB_PORT` 分开；`type: service` 子字段删除；**`helpText` 必须给出连接串格式示例并说明连接失败的表现**（上游靠平台保证连通性，fnOS 靠用户输入，这是转换后最大的行为差异）。

**`DB_ROOT_PASSWORD` 是规约允许的例外**：仅当应用确实需要 root 凭据时保留为独立字段（`zabbix-server` 初始化建库需要），并写明理由。

---

### 3.8 用户可填路径：放开与收紧各有代价（T1）

| 应用 | 上游字段 | 处理 | 代价 |
| --- | --- | --- | --- |
| `llama-cpp` | `MODEL_DIR` | 改 `MODEL_PATH`，`initValue` 留空 | 路径存在性无法校验（fnOS 向导无此规则类型），**填错会启动失败**——但失败可见，非静默 |
| `trendradar` | `DATA_PATH` | **删掉**，固定到 `${TRIM_PKGVAR}/data/output` | 用户失去自定义能力（上游默认就是 `./data`，无实际损失） |
| `filebrowser` | `MOUNT_PATH` | **固定**到 `${TRIM_PKGVAR}/data/mnt` | **功能被削弱**——"浏览你指定的目录"是它的核心卖点。已在文档留「高级配置」出口 |
| `jellyfin` | `MEDIA_FOLDER_PATH`/`CACHE_FOLDER_PATH` | **保留**为向导字段 | 与上面相反的取舍：用户自填路径是上游的设计，不削弱功能 |

**判断原则**：用户填任意宿主路径 + 无校验 = 数据可能写到意外位置。但**若用户自填路径是该应用的核心功能（如 `jellyfin` 的媒体库），就不该收紧**——收紧的前提是"用户没有非填不可的理由"。

---

## 四、流程与协作层

### 4.1 统计口径错一处，整批结论都要重算

`formFields` 的读取位置（1.4）、"外部数据库"判据（2.2）、可变标签判据（1.5）——**每一处都是"数字看起来对但含义错了"**。它们都曾导致分级或清单出错，且要靠独立复算才发现。

**做法**：任何写入清单的数字，都要能**用脚本独立复算**，并在文档里写明复算口径。

### 4.2 `formFields` 口径订正后，259 数字本身成立

订正了读取位置后**复算一遍**，确认 259 在"版本级 + 容错解析"口径下仍成立——**所以只补口径、不改数字**。不是每次订正都要改数，先复算再决定。

### 4.3 提交作者与 GitHub 头像

GitHub 靠**提交邮箱是否关联到账号**决定是否显示头像。仓库里已有 37 个 `deepseek-ai <greecenew@foxmail.com>` 的提交，那才是能触发头像的邮箱；用未关联的邮箱提交会显示灰色默认头像、且不进 Contributors。

### 4.4 机械校验比人眼可靠

多次实证：

- 「文档提到的每个 `data/...` 路径都必须是真实挂载源」的断言，抓出 2 处文档路径层级写错
- 「容器内目标与所选版本上游逐条一致」的断言，抓出 `dataease` 混版
- 「种子键必须在该应用 compose 挂载源里」的编译期断言，抓出种子路径少 `data/` 前缀

**共同点**：这类错误都不影响构建通过，只影响运行时正确性，**人眼对十几个应用逐一核对必然漏**。

**做法**：把核对规则写成脚本，并**做反向回归**——故意改错验证校验确实会报错，确认它不是空转。

### 4.5 fnpack 模板文件缺末尾换行

`fnpack create` 生成的 `cmd/` 下 9 个文件**末尾都没有换行符**，会触发仓库的 shfmt 规则报 lint error。生成骨架后需先补 `\n`。补换行属于"修改模板文件内容"，不违反禁止项 1（该条禁止的是**删除**模板文件）——**不要用删除文件的方式绕开 lint**。

---

## 五、尚未解决的边界

| 项 | 状态 |
| --- | --- |
| `TRIM_UID`/`TRIM_GID` 能否在 compose 中展开 | **待真机验证**。若未注入会静默传空值，容器启动失败。影响 12 个应用 |
| `TRIM_APPDEST_VOL` 在 compose 中的展开 | 仓库先例已在用，风险较低，**仍需真机确认**。D 组 6 个应用阻塞在此 |
| 7+ 个外部数据库应用的连通性 | **全部未真机验证**，只做了本地格式校验 |
| `cordys-crm` 的 JDBC URL 裁定改写 | 镜像对该拼法的接受性**未验证** |
| `fn-mysql_v8` 目录名用下划线 vs 文档用连字符 | **有意保留不改**：`appname` 是已发布应用的升级主键，改名会断掉已装用户的升级路径 |
| 既有 10 个应用的 `data-share` 声明未使用 | **已登记未修**，涉及已发布应用，需单独评估 |
| `komga` 的 ICO 图标（48×48） | **暂缓**，需补源图或换图标方案 |
| 8 个可变标签应用 | **阻塞**，需先选定固定版本（`emlog`、`neko`、`dvwa`、`redis-commander`、`teable`、`forgejo`、`openlist`、`gsmanager`） |
| `<64px` 的 5 个上游图标 | 放大失真策略**待定** |

---

## 变更记录

| 日期 | 说明 |
| --- | --- |
| 2026-10-16 | 新增 1.4「归一化名比对：只归一化一侧等于没归一化」——统计待转换应用时，仓库存连字符目录名、上游写**下划线**键，只归一化查询键而 `repo` 集合未归一化，导致**已交付的 `obsidian_livesync` 被误报为待转换**。该 bug **不报错、只静默给出错误的待办清单**，且**第一个违反禁止项 9（不得覆盖已有应用）的判据本身就是本规约写的**。修法：两侧同过一个 `norm` 函数，并用已知反例自检。小节编号顺延（原 1.4/1.5/1.6 → 1.5/1.6/1.7）。 |
| 2026-10-15 | 本文档建立，汇总 T0—T2 转换中实际发生过的踩坑：工具链层（fnpack 静默失败、入口 ID 上限、产物不可复现、`formFields` 在版本级、可变标签连踩三次、图标 ICO/非正方形）、形态判定层、语义与落盘层、流程与协作层，并单列「尚未解决的边界」。 |

## 相关文档

- [转换规约](/development/1panel-conversion) —— 正式规则，以本文为准的补充说明
- [转换清单](/development/1panel-conversion-inventory) —— 265 个应用的分级与盘点口径
- [测试用例](/testing/FNOS-001-test-cases) —— 用例集与状态
- [真机验收记录](/validation/FNOS-001-fnos-nas-2026-10-09) —— 目标 NAS 的实测证据