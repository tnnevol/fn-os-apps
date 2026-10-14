<AppIcon name="fn-trendradar" alt="TrendRadar 图标" />

# TrendRadar

## 应用简介

TrendRadar 聚合多个平台的热榜，按关键词筛选后推送到通知渠道。

## 主要能力

- 聚合多个平台的热榜内容。
- 按关键词筛选并推送通知。
- 支持定时抓取与运行模式配置。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-trendradar` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，并按需填写执行计划（cron 表达式）、运行模式与「启动时立即执行」。安装完成后从应用中心打开查看结果。

**数据位置固定**：抓取结果保存在目标 NAS 的应用数据目录的 `output` 子目录下，配置文件位于 `config` 子目录（以只读方式挂载）。如需改变输出位置，需修改本应用的 `app/docker/docker-compose.yaml` 后重新打包；上游的 `DATA_PATH` 自定义字段未开放到向导，以避免用户填写任意宿主路径。

## 相关链接

- [上游项目](https://github.com/wangyucode/TrendRadar)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-trendradar)
