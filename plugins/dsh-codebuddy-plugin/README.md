# @tnnevol/dsh-codebuddy

腾讯 CodeBuddy 模型接入插件（DeepSeek Harness / dsh），由
[`dsh-llm-codebuddy`](https://github.com/shatyuka/dsh-llm-codebuddy) 移植进
fn-os-apps monorepo。

- 在 `ctx.llm` 上注册一条 `codebuddy` 路由，提供 CodeBuddy 官方（非 OpenAI
  兼容）目录端点报告的模型列表；
- 浏览器 OAuth 登录，**无需任何 API Key**；
- 实时额度余量展示在对话输入区右侧（与 Codex 插件一致），构建在共享的
  `@tnnevol/dsh-semi-ui` 组件门面上；
- 登录、账号信息与用量偏好都在 Web 界面完成，无需终端。

## 登录与账号

一切都在插件 Web 界面中交互：

打开 **设置（Settings）→ CodeBuddy**：

- 点击 **登录**，插件会在新标签页打开腾讯 CodeBuddy 授权页；完成授权后插件
  自动轮询换取令牌并持久化，无需手动输入任何 Key；
- 登录后面板显示昵称、UID、企业等账号信息，并提供 **退出登录**；
- 登录/退出即时生效：正在运行的 Harness 会在下一次请求时自动读入新凭据，
  无需重启。

## 用量偏好

同样在「设置 → CodeBuddy」中调整：

- **显示额度余量** — 是否在对话输入区右侧展示用量圆环；
- **自定义额度上限** — 覆盖服务端上报的总量，按此值计算百分比；
- **余量告警百分比** — 已用百分比达到该值时圆环变红。

用量圆环悬停显示「已用额度 / 总量」与重置时间，点击展开按计量窗口列出的
剩余比例详情。

## 模型目录

CodeBuddy 的模型目录来自其非 OpenAI 兼容的目录端点，包含每个模型的上下文
容量、输出上限、工具调用、推理与图片输入能力；企业账号额外合并控制台的自
定义模型。目录只读展示在 DSH 模型选择器中，无需单独维护。
