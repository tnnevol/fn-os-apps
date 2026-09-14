# @tnnevol/dsh-codex-auth

DSH 的 ChatGPT / Codex 登录、模型目录和账号用量插件。

## 安装

插件发布在 npm，要求 DSH `0.1.5-rc.2` 。安装命令：

```sh
dsh plugin --profile web add @tnnevol/dsh-codex-auth@0.1.5-rc.2
```

装完重启 Web profile 即可。如果提示 `cannot resolve profile bundle`，重新跑一次上面的安装命令，别只在 `package.json` 里手动补 bundle。

## 功能

- 浏览器授权登录 ChatGPT / Codex，不需要选工作空间，也不用手填 Key
- 设置全局默认模型和思考强度，新建会话自动采用
- 对话输入区右侧显示当前 Codex 模型的用量状态，可展开看剩余额度和重置时间
- 读取并在模型选择器里展示 Codex 模型目录

更完整的说明见线上文档：<https://fnapps-doc.tnnevol.cn/plugins/dsh-codex-auth>
