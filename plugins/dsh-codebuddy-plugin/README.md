# @tnnevol/dsh-codebuddy

腾讯 CodeBuddy 模型接入插件。在 DSH 里用浏览器 OAuth 登录就能用，不用配 API Key。

## 安装

插件发布在 npm，要求 DSH `0.1.5-rc.2`。安装命令：

```sh
dsh plugin --profile web add @tnnevol/dsh-codebuddy@0.1.5-rc.2
```

装完重启 Web profile 即可。

## 功能

- 接入 CodeBuddy 官方模型目录，列出每个模型的上下文、输出、工具调用、推理和图片能力
- 浏览器 OAuth 登录，全程在设置页完成，不需要手动填 Key
- 对话输入区右侧实时显示额度余量
- 登录、账号信息和用量偏好都在 Web 界面里调整，改完即时生效

更完整的说明见线上文档：<https://fnapps-doc.tnnevol.cn/plugins/dsh-codebuddy>
