# DSH Semi UI

`@tnnevol/dsh-semi-ui` 是插件工作空间内部的共享 UI 包。它封装 Semi Design 组件，并把组件颜色、边框、圆角、浮层和选中状态映射到 DSH 主题变量。

它不是 DSH 运行时插件，不需要加入 `dsh.profile.bundles`。当前工作空间版本为 `0.1.1-rc.2.0`，尚未单独发布到 npm。

## 为什么单独维护

Codex Auth 和 fnOS 插件都需要按钮、浮层、树和选择器。统一封装后，两边不再各自覆盖 Semi 样式，亮色、深色和后续组件调整只需维护一处。

## 组件

| 分类 | 导出 |
| --- | --- |
| 操作 | `DshButton`、`DshIconButton` |
| 浮层 | `DshModal`、`DshDropdown`、`DshTooltip` |
| 选择 | `DshCascader`、`DshTreeSelect`、`DshTree` |
| 图标 | 文件、文件夹、关闭、设置、更新日志等插件常用图标 |
| 主题 | `installSemiDshTheme()`、`SEMI_DSH_THEME_ATTRIBUTE` |

组件仍按需导入。共享包不会自动把整套 Semi UI 挂到 DSH 全局。

## 主题接入

插件客户端启动时安装主题桥接，并在卸载时清理：

```ts
import { installSemiDshTheme } from '@tnnevol/dsh-semi-ui'

export function apply(ctx) {
  ctx.effect(() => installSemiDshTheme(), 'plugin: Semi DSH theme')
}
```

主题层使用 DSH 的语义变量，不自行判断浅色或深色。主要覆盖范围包括：

- 背景、文字、边框和阴影；
- 主按钮的黑白反色；
- Dropdown、Tooltip、Modal 等浮层；
- Cascader、Tree 和 TreeSelect 的选中、半选、悬停与滚动；
- fnOS 文件选择和 Codex 全局模型选择器的局部样式。

## 开发

```sh
pnpm --filter @tnnevol/dsh-semi-ui run check
```

两个插件的 `prebuild` 会先构建该包。新增共享组件时，应从 `src/index.ts` 明确导出，并同时检查 Codex Auth 和 fnOS 插件构建，避免工作空间链接仍指向旧产物。

## 链接

- [源码](https://github.com/tnnevol/fn-os-apps/tree/main/packages/dsh-semi-ui)
- [Semi Design](https://semi.design/zh-CN/)
- [问题反馈](https://github.com/tnnevol/fn-os-apps/issues)
