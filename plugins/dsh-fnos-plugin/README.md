# @tnnevol/dsh-fnos

补齐 DSH 在 fnOS 应用里的系统集成，把主题、授权目录、文件打开和应用交互接上。

## 安装

插件随 `fn-deepseek-harness` 自动安装。其他 DSH 环境手动安装，要求 DSH `0.1.5-rc.2` ：

```sh
dsh plugin --profile web add @tnnevol/dsh-fnos@0.1.5-rc.2
```

装完重启 Web profile 即可。主题、文件授权和 fnOS 应用交互需要在 fnOS 的 iframe 里运行，普通浏览器只能用不依赖系统 SDK 的那部分界面。

## 功能

- 主题跟随 fnOS：DSH 设成跟随系统时，读取并监听 fnOS 当前主题
- 授权目录管理：在设置里查看和取消 NAS 目录访问权限
- 在应用中打开：把文件、链接丢进对应的 fnOS 应用
- 把 DSH 页面标题同步到 fnOS 应用窗口

更完整的说明见线上文档：<https://fnapps-doc.tnnevol.cn/plugins/dsh-fnos>
