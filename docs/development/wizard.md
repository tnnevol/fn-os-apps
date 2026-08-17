# 用户向导

向导用于在安装、升级、配置或卸载时收集用户输入。向导文件位于应用目录的 `wizard/` 下：

| 文件 | 用途 |
| --- | --- |
| `wizard/install` | 首次安装配置 |
| `wizard/upgrade` | 升级时重新确认配置 |
| `wizard/config` | 安装后的应用设置 |
| `wizard/uninstall` | 卸载时选择数据处理方式 |

## 字段格式

```json
{
  "type": "text",
  "field": "wizard_port",
  "label": "监听端口",
  "initValue": "3080",
  "rules": [
    {
      "required": true,
      "message": "请输入监听端口"
    }
  ]
}
```

向导字段会以同名环境变量传给生命周期脚本。自定义字段建议使用 `wizard_` 前缀，不要使用保留的 `TRIM_` 前缀。

## 设计建议

- 只询问应用无法自动判断且确实需要的配置。
- 提供合理默认值，非必填字段不要添加 `required` 规则。
- 对端口、地址和枚举值添加校验规则。
- `select` 适合少量固定选项，复杂说明放在 `helpText`。
- 安装、升级和配置向导使用相同字段名，便于兼容已有配置。
