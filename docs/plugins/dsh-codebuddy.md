# CodeBuddy

`@tnnevol/dsh-codebuddy` 为 DSH 接入腾讯 CodeBuddy 模型目录，通过浏览器 OAuth 登录，无需 API Key。当前插件版本为 `0.1.2-rc.1.3`，适配 DSH `0.1.2-rc.1`。

## 安装

`fn-deepseek-harness` 会在安装和升级时自动安装 npm `rc` 标签对应的版本。其他 DSH 环境可以执行：

```sh
dsh plugin --profile web add @tnnevol/dsh-codebuddy@rc
dsh --profile web --dump-config
```

安装后重启 Web profile。

## 登录

一切交互都在插件 Web 界面中完成。

打开「设置 → CodeBuddy」，点击「添加账号」。插件会在新标签页打开腾讯 CodeBuddy 授权页面，用户完成登录后插件自动轮询换取令牌并持久化。无需输入任何 API Key，也无需使用任何终端命令。

登录成功后，该账号会出现在「账号管理」折叠面板列表中并成为当前账号。展开任意账号面板可查看昵称、UID、企业等详细信息，并可执行「设为当前」或「删除账号」。

## 多账号管理（设置页）

「设置 → CodeBuddy」的「账号管理」列出所有已登录账号，每个账号是一个可展开面板：

- **添加账号**：点击「添加账号」（右侧文字主按钮），可选填写备注名（≤30 字）与网络环境；打开浏览器登录后追加账号并成为当前账号；重复登录同一账号会刷新凭据（备注名保留）不产生重复条目。登录中状态卡上的「复制登录链接」与本机打开的授权页共享同一个 OAuth state，可在任意设备完成同一份授权。
- **卡片等高**：账号卡片网格里，拉取不到账户数据的卡片（`creditOk === false` 的「积分查询失败」、`row.expired` 的「已离线」）此前只渲染一行文字，而正常卡片渲染「额度大字 26px + 进度条 + 两行资源包预留（42px）」约 92px 的正文，于是同一栅格行内底部参差。修法分两层：① 把栅格行高沿 `wrap → Card → .semi-card-body` 用 `height: 100%` 传下去（栅格默认会 stretch 子项，但内部 Card 只设了 `width: 100%`，仍是内容高度）；② 把 `.semi-card-body` 改为纵向 flex，正文用 `flex: 1 1 auto` 吸收剩余高度，两个失败分支改走 `.dsh-codebuddy-account-body-state` 状态块（`min-height: 96px`，与正常正文相当，用 `min-height` 而非固定 `height` 以便内容变多时自然增高）。新增规则一律限定在 `.dsh-codebuddy-account-card-wrap` 下——`.dsh-codebuddy-panel-cards` 是账号页 / 骨架 / 积分统计三处共用的容器类，直接改动 `.dsh-codebuddy-panel-card` 会波及其它页面。
- **面板头部**：账号名 + 状态 Tag（当前/掉线）+ **编辑备注名图标**（始终内联在 semi-collapse-header 中）+ 掉线时的重新登录按钮。手动切换位于展开后的账号信息区，编辑弹框预填当前备注名，清空即恢复昵称。
- **剩余额度**：每个账号头部与详情行都展示 meter 实测的剩余额度；无可用余额的账号，「设为当前」与「选择账号」自动禁用并给出提示。
- **账号掉线**：凭据过期的账号标记「已掉线」并只保留「重新登录」；掉线的是当前账号时顶部提示由其他账号接管。
- **删除账号**：删除本地凭据；删除当前账号自动切换至剩余第一个账号；删除最后一个即退出登录。
- 凭据文件在读取旧版单账号格式时自动迁移为多账号格式，旧登录完整保留为第一个账号。

「**添加账号入口**位于「账号管理」区块标题右侧（包裹在 `.dsh-codebuddy-accounts-head-lead` 里，与标题同处区块头**左端**），右端是次级控件（自动切换 / 自动签到 / 自动旅行 / 刷新），两段由区块头的 `justify-content: space-between` 分列两端。主操作放左端而非右端：右端是开关与刷新这类次级控件，主操作混在其中会被削弱，贴标题则与「这一屏在管什么」直接相邻。原先页面顶部那张独立操作卡已移除。**自动切换账号开关**在右端动作区，与设置页共用同一 localStorage 键（互为镜像）；开启时卡片菜单里的「设为当前账号」不再渲染——那时账号由客户端按剩余额度自动切换，手动指定会被下一次自动切换覆盖，留着只会让人以为设置没生效。账号页同时订阅 `subscribeUsagePref`：面板关闭只是 `return null`、组件并不卸载，不订阅的话在设置页改动开关后本页会一直显示旧状态（自动切换尤其明显，它还决定卡片菜单里入口是否出现）。区块头**常驻渲染**，不随「有账号」条件渲染——否则账号数为 0 时（恰恰最需要添加账号）入口会消失；列表为空时只把卡片网格换成空状态。动作区现含四个控件，窄屏一行放不下，因此设了 `flex-wrap: wrap` 并在 ≤720px 竖排时改为左对齐。

**管理面板**」文字按钮与对话区圆环旁的齿轮都能打开全页面管理后台（shell.overlay，hash 路由隔离）。

## 用量与偏好

用量余量展示在对话输入区右侧，紧凑圆环样式：

- 悬停显示「已用额度 / 总量」和重置时间；点击展开浮层按计量窗口列出剩余比例。
- 偏好：**自动切换**（额度不足或被限流时切换账号）、**切换阈值**（剩余百分比滑块，0 关闭主动切换）、**自动签到**（每天自动为全部账号签到领取重置额度）、**显示额度余量**。

## 管理面板

「管理面板」为全页面后台，左上返回按钮关闭，左侧菜单在「账号管理 / Token 统计」间路由（hash 隔离，非动态组件切换）。**账号积分总览已并入账号管理页**（原「积分统计」菜单项已移除）：两处数据同源于 `panelStatus`，同屏展示后读者不必在菜单间来回切换；旧的 `#/codebuddy/credits` 链接由未知子页回落规则落到入口页（账号管理），地址栏同时被改写为规范子页，书签不会白屏。DSH 前端自身没有 hash 路由，面板归属完全由插件的前缀匹配决定：`#/codebuddy` 及其任意子路径都属于面板，裸路由与无法识别的子页在加载时被规范化为具体子页（`replaceState`，不新增历史记录），因此 `/#/codebuddy` 刷新后仍停在面板而不是落回会话页。Token 页面采用面向开发者的观测画布：深色总览、趋势图、活动热力图和分布排行；数据通过 DSH 的 logical session/query/projection 能力读取，不直接依赖 JSONL 文件布局。

- **客户端标识**：账号记录登录时所用的客户端（`cli` / `workbuddy`）与其**固定版本号**（CLI 2.145.0、WorkBuddy 5.5.4），卡片上以标签展示。版本是产品发布版本、不随机也不随会话变化——服务端据此归因客户端，随机化会让归因失真。客户端同时决定端点：WorkBuddy 走 `https://www.workbuddy.cn`，不再按环境解析（环境表里没有它，若按环境解析会把请求打到 CodeBuddy 的地址、凭据不被承认）。添加账号时先选客户端；**环境选择器只在 CLI 下出现**，因为 WorkBuddy 与环境无关，留一个改了没作用的控件会误导用户。缺省客户端为 `cli`，历史条目没有该字段时按 CLI 处理。
- **登录失败的可见性**：`runLogin` 的失败原因会写入**本次握手**的 pending 条目（不是实例字段——并发登录会串台），`pollLogin` 据此把「已失败」与「仍在等待授权」区分开并回传 `error`；客户端轮询遇到 `error` 立即停止并显示原因。此前失败与等待都表现为 `done:false`，前端只能一直轮询到 10 分钟超时，用户既看不到原因也不知道该重试——workbuddy 登录「没有反应」正是这个链路。
- **token 载荷的命名容忍**：服务端在不同客户端/网关下可能用 camelCase 或 snake_case 返回同一组字段（`access_token` / `refresh_token` / `expires_in` / `refresh_expires_in`）。`normalizeAuthToken` 对每个字段同时容忍两种写法（参考实现 workbuddy-switch 的 oauth 解析亦如此）：只认一种会解析出 `undefined`，进而发出 `Authorization: Bearer undefined` 并收到 401。缺 `accessToken` 时返回 `undefined` 按失败处理，而不是带着残缺对象继续走；`domain` 缺失归一化为空串，避免字符串 `"undefined"` 进入 `X-Domain`。`AuthToken` 的时长/刷新字段因此标为可选，取用处一律用 `?? 0` / `?? 原值` 兜底——直接用 `undefined` 参与乘法会得到 `NaN`，而 `NaN` 比较恒为 `false`，会让「已过期」判断静默失效。
- **版本号归属三条产品线**，不要混用：`CODEBUDDY_CLI_VERSION` 对应 `@tencent-ai/codebuddy-code`（CLI，当前 2.148.0），用在 `X-IDE-Version` / `User-Agent` / 登录页 `version` 参数；`CODEBUDDY_IDE_VERSION` 对应 **CodeBuddyIDE**（VS Code 扩展，4.9.8），只用在 meter/travel 请求的 `User-Agent`；`CODEBUDDY_CLIENT_VERSIONS.workbuddy` 对应 WorkBuddy 客户端（5.5.4）。三者版本序列互不相关。官方 CLI 发的是**自己的 package.json version**（源码 `getCurrentPackageJson()` 取值），所以 CLI 版本必须跟随上游正式发布更新——核对命令 `npm view @tencent-ai/codebuddy-code dist-tags.latest`，只取正式版、不要 dev/next 预发布号。已实测服务端不把 `X-IDE-Version` 当作鉴权门槛（新旧版本都能通过鉴权），它用于归因，因此滞后不会报错、但会让归因失真。
- **登录协议**：两个客户端共用一套握手（`/v2/plugin/auth/state` 与 `/auth/token`，待登录码同为 11217），只是 `platform` 参数不同（`CLI` / `workbuddy`）；服务端把该参数原样回填进 `authUrl`，登录页因此指向对应服务。已实测：`requestAuthState('https://www.workbuddy.cn', 'workbuddy')` 生成 `https://www.workbuddy.cn/login?platform=workbuddy&state=…&version=5.5.4`。
- **账号管理**：顶部提供 OAuth 添加账号操作，账号区显示数量、刷新入口（「自动签到」「自动旅行」开关位于刷新按钮左侧）和响应式卡片网格；卡片包含头像、名称/环境、签到状态、旅行状态、剩余额度、资源包进度。卡片右上「…」菜单提供改备注 / 签到（自动签到关闭且未签到时）/ 设为当前（**无可用余额时禁用**）/ 删除；企业账号不显示签到项。签到走 meter 平面 checkin-activity-status / daily-checkin，与 workbuddy-switch 同一协议；签到状态接口为 POST-only（GET 会返回 HTTP 404），插件统一以 POST 查询。
- **资源包台账**：点击账号卡片打开弹框，按「可使用 / 已用完 / 已过期」三组列出该账号的全部资源包（剩余/总量、用量进度、到期时间）。meter 平面只返回生效中的包，因此客户端会把每次探测到的资源包记入本地台账（`dsh-codebuddy:resource-history`），不再返回的包归入「已过期」，删除账号时一并清理。
- **自动签到**：「自动签到」开关（默认开）位于账号管理页的刷新按钮左侧。开启后宿主启动即对全部账号执行一轮自动签到（已签到的跳过），此后每 30 分钟补一次；凭据过期的账号记录为 expired，企业账号跳过，不会重复提交。设置页的偏好区同样提供该开关。
- **派猫猫旅行**：账号卡片的旅行 chip 显示当前状态（未旅行 / 旅行中并倒计时 / 今日已结束 / 暂无猫猫）。**「暂无猫猫」只以派发失败文案 `no active buddy` 为依据**：`status.buddy_id` 表示的是*当前正在旅行的猫猫 id*，未派发时服务端一律返回 0，派发成功后才变成真实 id（实测 0 → 7317310）。曾误用它判断「是否拥有猫猫」，导致从未派发过的账号被永久拦在派发之外——越没派过越被拦，卡片因此一直显示「暂无猫猫」。「自动旅行」开关（默认开，位于「自动签到」右侧）开启后，宿主启动即按状态机推进一轮，此后**派发周期每 30 分钟**补派、**领取周期每 15 分钟**只处理已到点的奖励。两个周期职责分离：派发周期查状态并按状态机推进，领取周期只对 `arrived` 的账号调 claim，不做任何派发，因此跑得再勤也不会重复派发或反复试探地点列表。状态机以服务端 `data.state` 为准：`idle --depart--> traveling --到点--> arrived --claim--> idle`；`idle` 且 `daily_limit_reached` 是官网的「累了，明天再来吧」，当日不再派发。接口为成长中心 `/activity/growth/buddy/travel/{config,status,depart,claim}`，与 meter 平面不同，额外要求 `x-client-platform: web` 与 `origin`/`referer` 语境头。**成长中心仅对个人账号开放**（企业账号返回 403），企业账号自动跳过；没有 Buddy 的账号派发会被拒，记为可重试原因而非当日完成。设置页的偏好区同样提供该开关。
- **积分总览（位于账号管理页顶部）**：原「积分统计」页的指标卡，提供剩余额度、积分包数量、可用账号、已掉线四项总览，带「积分」区块标题。它**不再自己拉取数据**，而是由账号页把同一份 `PanelAccountRow[]` 以 props 传入——两处同源，既省一次 RPC，也避免数据短暂不一致。按账号列出资源包进度与到期时间（长期有效/重置时间）的明细仍在各账号卡片与其「资源包」弹框中。
- **Token 统计**：只统计 DSH 会话中 `codebuddy` 供应商的调用，提供总览、输入/输出/缓存指标、缓存命中率、按日 Token 与调用趋势、Token 活动、按工作区/模型分布和会话排名；支持最近 7/30/90 天。统计通过 `sessionQuery.observeSession()` 读取会话事件，并使用 DSH token-meter 投影保持会话用量语义一致，不上传数据。页面顶部只显示一行「当前数据更新于 yyyy-MM-dd HH:mm:ss」（`generatedAt` 经 dayjs 固定 pattern 格式化）——原先这里重复了页面标题与副标题；不用 `toLocaleString()` 是因为其分隔符与顺序随运行环境 locale 变化，而该时间戳每次刷新都变，格式不稳定不利扫视。dayjs 是插件独有依赖，已在 `tsdown.config.ts` 的 `alwaysBundle` 中登记：DSH 浏览器模块表没有它，漏登记会残留裸 `require('dayjs')` 并在运行时直接报模块缺失。

  - **时间范围**：默认「近 7 天」；选项按面板职责分配——总览给「总计」（回答「一共用了多少」，需要全量）、趋势给「本月」（回答「随时间怎么变」，需要有意义的当前窗口），两者不互换：把总计放到趋势上逐日图会退化成一根巨柱。选择器用 **`ButtonGroup`**（facade 的 `DshButtonGroup`）呈现，而不是 SplitButtonGroup：前者把相邻按钮的圆角相接成一条连续控件，符合「互斥单选一组」的语义。**外观完全沿用 Semi 原生样式，插件侧不写任何 CSS 覆盖**——激活项 `theme="solid" type="primary"`、其余 `theme="borderless"`，底色/圆角/hover/focus 全部交回 Semi 与主题层。

组上不传 `theme` / `type`：ButtonGroup 合并子 props 的顺序是 `{disabled,size,type}` → `itm.props` → `rest`，而 `theme` 不在其解构出的键里，会落进 `rest` 并排在子 props 之后，组上的值因此覆盖每个子按钮的值、激活态永远显不出来（`size` 被解构出去，可安全传递）。选中态另用 `aria-pressed` 表达，因为纯视觉的 theme 切换对读屏不可见。

**对比度由主题层保证，插件不介入**：Semi 自身的实心按钮写死 `color: rgba(var(--semi-white), 1)`，而 DSH 深色主题下 `--dsw-alias-button-primary-fill` 解析为浅色（→ brand-primary → bluish-50），白字对比度仅 1.08:1。所幸 `packages/dsh-semi-ui` 的 theme.scss 已为 `.semi-button-primary.semi-button-solid` 分浅色/深色指定硬编码的高对比配对（浅色：bluish-1000 底 + bluish-00 字；深色反之），因此这里既不需要覆盖文字色，也不需要隐藏 ButtonGroup 自动插入的分隔线 `<span class="semi-button-group-line-*">`——那是组件正常产物，原型样式下渲染正常。

另外，**组容器上不能设 `gap`**：分段控件靠相邻圆角相接表达「一组」，有间隙就断了。曾有一条遗留布局规则带 `gap: 8px`（早于 ButtonGroup 改造），是「按钮之间有空隙」的实际来源，已删除并在测试中锁住。「本月」解析为 `days = 今天几号`，正好落在本月 1 号（服务端起点是 `startOfLocalDay(now - (days-1)*DAY_MS)`），无需服务端支持「月」这种单位；「总计」走 `allTime` 而非大 `days`——`days` 有 365 上限，超过一年的历史会被静默截断，而总计的语义是全部。缓存以**范围键**为键而非 `days`：`month` 在 30 号时与 `30d` 天数相同但请求不同，用 `days` 会互相污染。
  - **图例 item 最小高度 20px**：ECharts 图例的高度由 `itemHeight` 决定，且**色块是 roundRect、按 (itemWidth, itemHeight) 直接铺开、不保持宽高比**——实测只把 `itemHeight` 调到 20 会把 10×10 的色块拉成 10×20 的竖条，而 `symbolKeepAspect: true` 对 roundRect **无效**（path 完全不变）。因此必须让 `itemWidth === itemHeight`（20×20）。另外图例变宽后更早折行：实测英文长标签（Cache write）约 340px 起折、中文约 260px 起折，折行后图例高 66px 会压住固定的 `grid.top: 32`；用 ECharts 的 `media` 在 `maxWidth: 420` 时把 `grid.top` 抬到 68，单行保持紧凑、折行自动让位。
  - **周期选择器落在每个面板内部**（总览 / 趋势 / 工作区分布 / 模型分布 / 会话排行各一个）：这些面板回答不同问题，读者常需要让它们停在不同的时间窗口上对比，全局选择器会强迫所有面板同时跳变。Token 活动热力图固定为最近一年（服务端 `ACTIVITY_RANGE_DAYS` 与 `days` 无关），因此不提供周期选择器。
  - **按范围缓存**：面板多起来后各自裸调 RPC 会线性放大开销（服务端每次都重放全部会话，实测 200 会话约 50ms）。客户端 `TokenStatsStore` 按 `days` 缓存并复用在途请求，同范围共享一份数据、切回旧范围零成本命中；范围不同才真正多取一次——这是功能本身要求的，因为服务端对 workspaces/models/sessions 的累积带范围过滤，无法从大范围响应推导小范围结果。
  - **会话排名只显示标题，不显示会话 id**：`user/message` 事件的正文在 `data.content`（**不是** `data.message`——那是 `assistant/message` 的形状），DSH 注入的 system-reminder / 运行时上下文也以同一类型出现，取标题时必须跳过。取不到真实用户输入时标题为空串，由客户端用本地化占位呈现，绝不把 uuid 顶上来。
  - **热力图铺满内容区**：一年恒为 53 周（365 天补位后总是 371 格），列数固定。原先把列宽写死 12px，整块宽度被钉死在 844px，卡片更宽时右侧留白。现由 `activity-grid.ts` 按可用宽度算出格子边长，写进 `--dcb-cell-size`，月份行 / 热力图 / 星期列共用同一个值（星期列宽固定，「一/三/五」的行对齐无法由纯 CSS 从列宽反推）。边长有上下限：低于 9px 会看不清（交外层横向滚动），高于 22px 会显得笨重（此时留白比继续放大好看）。可用宽 ≥ 711px 时正好铺满。
  - **分段条按占比降序 + 给小项保留可见下限**：占比最大的分段排最左（真实数据里缓存读常占 95% 以上，排在中间会让视觉重心偏移；降序后主项紧贴阅读起点）。排序同时作用于条形与图例。每段先占 `--dcb-segment-min`（8px）的可见宽度，剩余空间才按数值比例分配——大项仍占绝大多数，小项始终可辨。`SEGMENT_MIN_WIDTH`（TS，供测试验算）与 `--dcb-segment-min`（CSS，真正生效）必须一致，测试会核对两者取值。实现上用 flex-grow 语义，`flex-basis: 0` 是必需的——否则内容宽度会参与分配，最小宽度被满足后各段比例就不再等于数值比例。
  - **趋势图柱体最小高度**：`barMinHeight: 30`。真实数据里输出仅 0.15%，按比例算出的高度会被四舍五入成 0px，该分段从图上消失（图例有、柱体没有）。堆叠模式下 ECharts 对**每个分段**独立生效（源码按 `stackStartValue` 计算），因此每个堆叠系列都要设置。
  - **指标配色单一事实来源**：输入/输出/缓存读三个指标在总览分段条、趋势图、分布图里必须同色，否则同一份数据在各面板间颜色跳变。三色定义在 `.dsh-codebuddy-panel-tokens` 的 `--dcb-series-*`，所有面板统一引用；**不使用黑/灰阶作为数据色**（灰是「无数据/次要文本」的语义，用作系列色会让该系列看起来被禁用）。缓存写原先占用品红，该色值现由活动热力图复用（`--dcb-mint: var(--dcb-magenta)`），因此**不能随系列一起删除**——已改名为中性的 `--dcb-magenta`。
  - **统计口径含缓存读、不含缓存写**：缓存读是真实发生的用量（实测占总量 98.7%），保留为独立指标并参与总量与命中率；缓存写在本环境下 7309 条 CodeBuddy 用量事件中出现 **0 次**（服务端不上报该字段），计入只会多出一个恒为 0 的项，因此从统计中移除。连带影响：`CodeBuddyTokenBucket` 不再有 `write` 字段；只有缓存写、没有输入/输出/缓存读的事件会被**丢弃**（否则记录数增加而总量不增，让「平均每次调用」偏小）；`translate.ts` 的 `mapUsage` **不变**——它产出 harness 约定的 `TokenUsage`，DSH 自身的轨迹视图依赖 `cacheReadTokens`/`cacheWriteTokens`，收窄的只是统计口径。

## 模型目录

CodeBuddy 的模型目录来自其非 OpenAI 兼容的 `/v3/config` 端点，包含每个模型的上下文容量、输出上限、工具调用、推理和图片输入能力。企业账号额外合并控制台自定义模型。切换账号后会广播模型目录更新，模型选择器和消息框额度即时同步，不需要刷新页面。

模型目录只读展示在 DSH 的模型选择器中，无需在插件面板单独维护。

## 图片输入

CodeBuddy 支持图片输入的模型（`supportsImages`）在插件中以原生 `image_url` 数据 URI 发送图片内容，无需 DSH 的 OCR/读图工具兜底；模型不支持图片时，DSH 才会把图片降级为文本交给读图工具。图片字节通过 DSH 的 durable attachment 服务（`ctx.attachments`）读取，不进会话记录。

- **会话内联图片**（粘贴/拖拽上传）：DSH 以 `ImageBlock` 交给模型 → 插件原生上传，无需 `read_image`。
- **`read_image` 工具结果图片**：后续轮次中插件会把工具结果里嵌入的图片一并原生上传给 CodeBuddy，模型可直接看到图片内容而无需重复读图。

## 状态管理与持久化

浏览器侧的偏好与本地台账用 **nanostores**（+ `@nanostores/persistent`、`@nanostores/react`）承载，插件源码里**不再有直接的 `localStorage` 读写**。选它的三点理由：体积小且零依赖；`@nanostores/persistent` **内置跨标签同步**（同时监听 `storage` 与 `pageshow`，后者覆盖「浏览器从 bfcache 恢复页面」——手写实现只监听 `storage` 会漏掉）；私密模式下库自动退回内存存储，不必像原先那样每处都包 `try/catch`。另有 `useTestStorageEngine()` 可注入假 storage，让持久化逻辑能在 Node 环境里直接测。

`@nanostores/react` 的 `useStore` 就是 `useSyncExternalStore` 的薄封装，与本仓库既有写法同构，因此设置页、后台面板、输入框指示器都把「手写订阅 effect + setState 镜像」换成了 `useStore($store)`。

两个迁移时踩到的坑，都已写成用例守住：

- **不能改用 `persistentBoolean`**。它按 `'yes'`/`''` 编解码且缺省 `false`，而本插件的布尔偏好是 `'1'`/`'0'` 且**缺省 true**，直接替换会把用户已有设置静默反转。改用 `persistentAtom` + 自定义 codec，存储格式与迁移前完全一致，老数据无需迁移。
- **写入前必须自己归一化**。`persistentAtom.set` 只把**编码后**的值写进 storage，atom 自身保留原始值，于是 `set(7.6)` 会让内存读到 `7.6` 而 storage 里是 `"8"`，刷新后才一致。阈值因此走 `setThreshold()` 先取整再写。批量订阅同理用 `listen` 而非 `subscribe`——后者注册时会立即回调一次，对「变化后同步 host」的场景等于 5 个 store 触发 5 次多余 RPC。

`nanostores` 不在 DSH 的模块表里，已在 `tsdown.config.ts` 的 `alwaysBundle` 中登记，确保内联进 client 产物（否则会残留 `require('nanostores')` 而浏览器端无法解析）。

## 图标约定

左侧菜单与界面装饰使用**彩色图标**，来自 `@douyinfe/semi-icons-lab`——该包的 SVG 内硬编码多色 `fill`，不随前景色变化。

判断依据是实测而非包名：`@douyinfe/semi-icons` 里**全部**图标（**包括 `IconAI*` 系列**）都走 `currentColor`，是单色图标；名字带 AI 并不代表彩色。选图标时用「SVG 内是否有多个硬编码 `#RRGGBB`」来区分，不能靠名字推断。

由此带来两个好处与一个注意点：

- 硬编码 `fill` 不会被 `.semi-navigation-item-icon-info` 的 `color` 覆盖，因此导航选中/悬停时彩色图标颜色保持不变，不会出现「选中变单色」。
- 新增 Lab 图标须同时登记到 `packages/dsh-semi-ui` 的 `components.ts` 与 `index.ts`（后者是显式列表，漏加则导出为空）；`alwaysBundle` 无需改动——实测 `semi-icons-lab` 会随 facade 内联，产物中无裸 `require`。
- 彩色图标自带配色，不要再用 CSS 给它上色，否则多色设计会被覆盖成单色。

## 界面约定

- **悬停提示统一用 Tooltip 组件**，不使用 DOM `title` 属性：原生 `title` 的样式与延迟不受主题控制，且在禁用按钮上不可靠。需要说明禁用原因的按钮用 `DshTooltip` 包裹；不处于该状态时直接渲染按钮，不挂空 Tooltip。
- **文本截断统一用 `DshTypography.Text` 的 `ellipsis`**，不使用 CSS `text-overflow`：`ellipsis` 开启 `showTooltip` 后，Semi 在**真正溢出时**才挂 Tooltip，短文本不会弹出多余气泡，同时省掉手写的 `nowrap`/`overflow`/`text-overflow` 三件套。

```tsx
<DshTypography.Text ellipsis={{ showTooltip: true }}>{name}</DshTypography.Text>
```

  样式类只保留颜色、字号、字重与在 flex/grid 中的收缩能力（`min-width: 0`）。

## 面板布局

布局全部由 **Semi Layout 组件**表达，没有自建 flex 容器。两层 Layout 的嵌套正好对应目标结构：

```
<Layout>                                  含 Sider → Semi 自动加 has-sider → row（左右）
  <Layout.Sider>       菜单
  <Layout className="…-main">             不含 Sider → 默认 column（上下）
    <Layout.Header className="…-toolbar"> 固定，不参与滚动
    <Layout.Content className="…-views">  唯一滚动容器
```

Semi 的 `.semi-layout` 默认 `flex-direction: column`，只有含 Sider 时才加 `.semi-layout-has-sider { flex-direction: row }`，因此「左侧菜单 + 右侧上下」无需手写任何方向。Layout 系列还会渲染语义化标签：Header→`<header>`、Content→`<main>`、Sider→`<aside>`。

滚动行为：滚动容器是 **Content**，Header 在它之外，所以标题固定、只有主体滚动；菜单在 Sider 里也是独立容器，不随主体滚动。两个容易踩的点：

- **`min-height: 0`**：flex 子项默认 `min-height: auto`，不设它就不会收缩到容器高度以下，`overflow` 随之失效（内容把容器撑高、滚动条落到整页上，标题依旧被带走）。
- **内层 Layout 必须 `overflow: hidden`**：若把滚动放在它身上，header 会与内容同处一个滚动上下文而被一起卷走。

横向对齐：Header 取 `width: 100%`（**不设宽度上限**，底部分隔线因此横跨整个面板），其内部内容靠 `padding-inline: max(clamp(16px, 2vw, 32px), calc((100% - 1480px) / 2))` 对齐到与页面内容相同的 1480px 列。`width: 100%` 与 `padding-inline` 并存不溢出，因为 Semi 的 layout.css 已为 `.semi-layout-header` 设 `box-sizing: border-box`（padding 计在 100% 之内）——这条前提已由用例守住。不用「两者共用 `width: min(100%, 1480px)`」的写法，原因有二：① header 若不 通栏，底部那条分隔线在宽屏下会比面板窄一截、两端悬空（主区 1720px 时两侧各空 120px）；② 宽度上限与自带横向 padding 组合时，padding 落在宽度**之内**，而 `.dsh-codebuddy-panel-view` 的 padding 在宽度**之外**，于是主区 >1544px 时标题比卡片多缩进 32px。通栏 + 同一公式计算后，两者左边界在宽/中/窄屏都一致。

固定 header 的分隔用「主题感知描边 + 一层浅阴影」：`border-bottom: 1px solid var(--dsw-alias-border-l2)` + `box-shadow: var(--dsw-shadow-lv1)`，并配 `position: relative; z-index: 1` 让分隔压在上滑的内容之上（`overflow` 不产生层叠上下文，故非定位的滚动容器不会盖过它）。只用阴影不够——`--dsw-shadow-lv*` 是**固定的 5% 纯黑**（`#0000000d`）、不随主题变化，在深色底 `#151517` 上对比度仅 1.009:1 等于看不见；而 `--dsw-alias-border-*` 是主题感知的（浅色 `#000000xx` / 深色 `#ffffffxx`），分隔必须由它承担。另外 DSH 的 `--dsw-elevation-*` 全部只是 `0 0 0 .5px` 的描边环，并非模糊阴影。

## 面板 keep-alive

三个管理页**首次进入后一直保持挂载**，只把非当前页隐藏（`hidden` 属性），切回时不重新拉取。此前用条件渲染 `page === 'x' ? <XPage/> : null`，切走即卸载，页面内的 `useState`（Token 各面板已选范围）与 `useMemo` 里的 `TokenStatsStore`、已拉到的数据、echarts 实例全部销毁，切回只能重新请求并重建图表。

- 用 `hidden` 而非只写 CSS 显示控制：`hidden` 会把子树移出可访问性树且不可聚焦，隐藏页里的按钮不会被 Tab 选中。
- 按 `visited` **惰性挂载**：首次进入某页才真正渲染，避免一进面板就并发拉三页数据。
- 账号数据（`panelStatus`）由账号页与积分页共用，两者都必须带 `rosterTick` 依赖；积分页此前 deps 为空——那是靠「每次进入都重新挂载」掩盖的缺口，keep-alive 后必须补齐。
- 图表需在从隐藏切回可见时主动 `resize`：容器从 0 宽度恢复时 `ResizeObserver` 不保证回调，因此额外用 `MutationObserver` 观察承载页面的 `hidden` 变化。

## 面板刷新

刷新一律是**局部更新**：保留已渲染内容，只叠一层半透明遮罩 + 转圈，而不是把整页换成 `DshSpin`。整页替换会让整个子树卸载重建，页面闪一下、滚动位置丢失，与「刷新」的语义相反。首次加载（尚无任何数据）才整页占位。

- 账号管理 / Token 统计：遮罩覆盖页面容器。
- Token 统计：每个面板有独立的刷新按钮与遮罩，只刷新该面板所属的时间范围。

刷新要满足三条不变式，缺一条就会退化成「全局刷新」：

1. **刷新期间保留旧数据**（后端 store 不清缓存）。清掉会让取数变 `undefined`，面板据此判定「还没数据」而回到初次加载占位，整页闪成转圈——这正是最初的现象。
2. **加载指示按面板隔离**，不按范围共享。五个面板默认都停在 30 天，若 loading 只用 range 做键，刷新总览会让另外四个同范围的面板一起转圈。
3. **切换范围时用等高空壳占位**，且面板内容只用本范围的数据——旧范围的数字顶着新标签显示会让人误读。

整页占位只在「从未取到过任何数据」时出现，且用 **Skeleton 骨架**而不是整屏转圈：转圈会先出现一大片空白再「啪」地换成内容，视觉上像卡了一下；骨架按各页真实结构铺出同形状的占位（账号页是操作卡 + 卡片网格，Token 页是总览卡 + 图表 + 列表），内容到位时就地替换，版面不跳动。骨架必须包在 `<DshSkeleton active>` 里——Semi 的微光动画由祖先类 `.semi-skeleton-active` 选择器驱动，单独用 `Skeleton.Title` 只会得到静态灰块。另外 `--semi-color-fill-0` 在 `.semi-skeleton` 上被重新映射为边框色：默认值是一个悬停底色，放在卡片上太淡、读不出「占位」的语义。刷新失败会弹提示：因为刻意保留旧数据，失败时界面看起来「什么都没发生」，静默失败比报错更糟。

## 后台周期

宿主有三个后台周期，都是**进程级单例**：`dsh web` 每个进程只 apply 一次插件，因此开多个浏览器窗口不会让定时器翻倍（窗口自身的定时器只有输入区用量指示器的 60 秒轮询，属预期）。

| 周期 | 间隔 | 首轮 | 职责 |
| --- | --- | --- | --- |
| 自动切换 | 30 秒 | 不立即执行 | 主动阈值探针，低于阈值切到更健康的账号 |
| 自动签到 | 30 分钟 | 启动立即执行 | 逐账号查状态，未签到的提交 |
| 旅行派发 | 30 分钟 | 启动立即执行 | 查状态并按状态机推进（含到达即领取） |
| 旅行领取 | 15 分钟 | 不立即执行 | 只对 `arrived` 账号 claim，不派发 |

三条约束对所有周期成立：

- **防重入**：一轮要串行访问 N 个账号的远端接口，只要耗时超过间隔，下一轮就会叠加上来，同一账号被并发派发或重复领取。每个周期用 `RunGuard`（对照 workbuddy-switch 的 `RunFlagGuard`）做「检查并置位」，拿不到标志就返回 `skipped` 并直接退出。派发与领取各有独立标志，互不阻塞。
- **按账号去重**：两个旅行周期的守卫互相独立，而 30 与 15 分钟的最小公倍数是 30 分钟——定时器每半小时对齐一次，那一刻两个周期都可能读到同一个 `arrived` 账号。因此领取走 `claimArrived()` 按账号去重：已有领取在途时另一方记为 `claiming` 而非 `error`，避免把健康的一轮算成「全失败」而误推退避。旅行派发的首轮与领取周期也刻意不同时启动。
- **失败退避会自愈**：连续全失败到阈值后进入退避（`BackoffGate`），冷却期满**自动放行重试**，任一轮成功即清零。**不能**写成「到阈值就永久 standby」——那种写法在重算计数之前就返回，计数再无下降机会，周期从此只能靠重启宿主恢复，而远端故障恰恰是会自动恢复的。
- **定时器归属**：所有 `setInterval` 都由 `ctx.effect` 在插件卸载时清理。偏好是异步读取的，回调可能在卸载**之后**落地，因此 `start*Cycle` 额外检查 `disposed` 标志，避免绕过清理留下孤儿定时器。

账号批量探测（面板刷新、签到、积分）以**受限并发**（每批 4 个账号）而非串行执行：串行时每个账号的 2–3 个请求首尾相接，账号一多面板就要等上数百毫秒；结果按账号存储顺序回填，卡片顺序不随响应快慢抖动。
