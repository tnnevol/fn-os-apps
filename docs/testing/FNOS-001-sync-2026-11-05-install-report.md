---
title: FNOS-001 同步批次安装测试报告（2026-11-05）
description: 对 2026-11-04 1Panel 版本同步中「配置连带调整」的 3 个应用做真机安装测试，记录判定、缺陷与修复复测。
feature: FNOS-001
lastVerified: 2026-11-05
---

# FNOS-001 同步批次安装测试报告（2026-11-05）

本轮只覆盖同步报告（`tmp/1panel-docker-sync-report-2026-11-04.md`，仓库外、不随文档发布）里
**除镜像标签外还改了编排/向导契约**的 3 个应用。
其余 93 个只换 `image:` 的应用不在本轮范围（其差异已被上游编排逐字节核对覆盖）。

判定口径与[批量真机验收规程](/testing/FNOS-001-batch-verification)一致：`PASS / FAIL / BLOCKED / UNVERIFIED / BUILD_FAIL`，
**本地构建成功不构成设备结论**。

## 1. 环境与通道

| 项 | 值 |
| --- | --- |
| 目标环境 | 目标测试设备（fnOS；Debian 12 bookworm；内核 `6.18.18.c1186-trim`；Docker `28.5.2`） |
| 安装通道 | fnOS Web UI「应用中心 → 手动安装 → 从电脑上传」，由 **chrome-devtools MCP** 驱动页面脚本 |
| 上传方式 | 拦截 `input.click()` 注入 `File`（见[环境与脚本](/development/environment-and-scripts)「上传 `.fpk`」）；<br>本轮复核确认「只给常驻隐藏 input 赋 `files`」在该 fnOS 版本上**无效**（两个 input 的 `__reactProps` 无 `onChange`） |
| 参数填写 | 页面同源表单填写；密钥类字段由脚本生成随机值；数据库口令经**仅回环可读**的 `/_bootstrap/params.json` 注入，不进对话记录 |
| 中间件 | 设备自带 MySQL（非默认端口），容器经**宿主局域网 IP + 实际端口**访问 |
| 设备地址/账号/口令 | 按纪律不记入文档；`${FNOS_HOST}` 代指目标测试设备 |

镜像在测试前已在设备上预拉取成功，因此本轮**不存在「镜像拉取失败」这一类环境阻塞**。

## 2. 逐应用结果

| 应用 | 改动内容 | 判定 | 关键观察 |
| --- | --- | --- | --- |
| `fn-ai-gateway` | 1.3.0 → 1.5.1：补 `entrypoint`、清空 `CMD`、70s 优雅停机；删 `/etc/localtime` 宿主挂载，改 `TZ` + `TIME_ZONE` | **PASS** | 容器 `healthy`、`RestartCount=0`；入口 `http://${FNOS_HOST}:8080/` 连测三次 `200`，`/health/ready` 亦 `200` |
| `fn-upage` | 1.0.1 → 2.0.0：新增 10 个环境变量（7 个可选向导 + 3 个上游固定值） | **PASS** | 容器 `running`、0 重启；入口 `3000` 返回 `200`（页面标题 `UPage`）；10 个变量全部落到容器 `env`；三条宿主子目录挂载均存在 |
| `fn-dataease` | 2.10.27 → 3.1.0：容器内路径 `2.0 → 3.0`、新增 6 个用途目录、13 条挂载、`install_callback` 预建目录 | **PASS（修复后）** | 修复前 `FAIL`（见缺陷 D-01）；修复后容器 `healthy`、0 重启、入口 `8080` 返回 `200`、`de` 库完成建表 **111 张** |

判定说明：`fn-dataease` 的最终判定取**修复后复测**的结果，缺陷本身另记 D-01，未合并进判定值。

## 3. 配置改动实测口径

不只「装上了」，而是逐项核对本轮真正改动的东西：

| 应用 | 核对项 | 实测证据 |
| --- | --- | --- |
| `fn-ai-gateway` | `entrypoint` 生效 | `Entrypoint=[/usr/bin/ai-gateway]` |
| | `CMD` 已清空 | `Cmd=[]` |
| | 70s 优雅停机 | `Config.StopTimeout=70` |
| | 时区走环境变量 | `TZ=Asia/Shanghai`（向导值） |
| | 未挂宿主 `/etc` | 挂载仅 `.../data -> /opt/ai-gateway/data`，无 `/etc/localtime` |
| | 数据落应用数据目录 | bind `/vol2/@appdata/fn-ai-gateway/data -> /opt/ai-gateway/data`，SQLite 已生成 |
| `fn-upage` | 10 个新变量 | `LLM_PROVIDER=OpenAI`、`LLM_DEFAULT_MODEL`/`LLM_MINOR_MODEL`、`LLM_VISION_*`、`VISION_PROVIDER_*`、`SERPER_API_KEY`、`WEATHER_API_KEY`、`MAX_UPLOAD_SIZE_MB=5` |
| | 3 个上游固定值 | `USAGE_LOG_FILE=true`、`OPERATING_ENV=production`、`LOG_LEVEL=debug` |
| | 宿主数据路径未被改 | bind `.../data/{data,logs,storage}` → `/app/{data,logs,storage}`，三个子目录都在 |
| `fn-dataease` | 挂载目标全为 3.0 | 13 条挂载目标全部 `/opt/dataease3.0/*`（+`/opt/apps/config`），**无** `dataease2.0` 残留路径 |
| | 6 个新目录被预创建 | `@appdata/fn-dataease/data/` 下存在 `appearance driver exportData font geo i18n map plugin report static-resource` |
| | 数据源配置生效 | 种子 `conf/application.yml` 铺入且属主为包用户；容器不再出现 `host=localhost` 连接；`de` 库建表 111 张 |

## 4. 缺陷

### D-01 `fn-dataease` 3.1.0 缺少数据源配置，容器重启循环、入口不可访问（已修复并复测）

| 项 | 内容 |
| --- | --- |
| 现象 | 安装任务成功、容器进入重启循环（`Restarts` 持续增长），入口 `http://${FNOS_HOST}:8080/` 恒为 `000`；生命周期日志显示 `compose up -d OK`，真正原因只在容器日志里 |
| 根因 | 上游 3.1.0 起把数据源从环境变量**改为外置配置**：`conf/application.yml` 的 `spring.datasource.url` 形如 `jdbc:mariadb://${PANEL_DB_HOST}:${PANEL_DB_PORT}/${PANEL_DB_NAME}`。本次同步只改了挂载路径，**该配置文件未随包**，于是 Spring Boot 回退默认值，容器日志报 `Socket fail to connect to host:address=(host=localhost)(port=3306)` / `Connection refused`——向导里填的地址端口**根本没被读取** |
| 影响面 | 3.1.0 起该应用**必然不可用**（不是「连不上库时功能受限」，而是根本起不来） |
| 处置 | 按转换规约「模式 B-3 最小种子配置」自建 `apps/fn-dataease/app/seed/conf/application.yml`（只写让应用连上向导指定数据库并建表所需的最小集合），并把 `cmd/install_callback` 改为**文件缺失时铺入**、已存在不覆盖 |
| 复测 | 重新 `fnpack build` → 重装：种子铺入 `@appdata/fn-dataease/conf/application.yml`（1432 B，属主 `docker-fn-dataease`）、容器 `healthy`、0 重启、入口 `200`、`de` 库 111 张表 |
| 与同步报告的关系 | 对应其「风险与后续事项」第 2 条，本轮把它从**待确认**升级为**已确认为缺陷并修复** |

## 5. 遗留风险与观察（未在本轮修改）

| 编号 | 内容 | 说明 |
| --- | --- | --- |
| R-01 | 卸载选「删除所有数据」后仍残留数据目录 | 三个应用均命中：`uninstall_callback` **如实上报** `RESIDUAL_COUNT`（如 `fn-ai-gateway` 报 `1`、`fn-dataease` 报 `2`），残留内容是容器以 **root** 写入的文件（`ai-gateway.db`、`upage.db`、`dataease` 的 `cache/`、`logs/`，属主 `root:root`），而回调以包用户运行、无权 unlink。属已知缺陷类「卸载谎报删除」的变体，本轮未改动脚本，测试后由有权限的会话手工清除 |
| R-02 | 可选向导字段留空时 compose 告警 | `fn-upage` 的 `SERPER_API_KEY`、`WEATHER_API_KEY` 未填时，`docker compose` 输出 `variable is not set. Defaulting to a blank string.`；容器仍正常启动，属噪声但会让生命周期日志看起来像有错误。是否改用 `${VAR:-}` 写法留待评估 |
| R-03 | `fn-upage` 上游自身告警 | 容器日志出现 `ERR_ERL_PERMISSIVE_TRUST_PROXY`（`express-rate-limit` 对 `trust proxy` 配置的校验告警），请求仍返回 `200`，属上游应用行为，不计转换缺陷 |
| R-04 | 内部应用数据源真机未覆盖 | 三个应用均只验证到「安装 → 运行 → 入口可访问」；`fn-upage` 的模型调用链路使用**占位值**填参（`LLM_DEFAULT_MODEL`/`LLM_MINOR_MODEL` 填占位模型名、`PROVIDER_API_KEY` 为随机值），标记 `placeholderFilled`，**不能据此认为模型功能可用**；`fn-dataease` 未做登录后的仪表板操作 |

## 6. 设备清理

按规程逐个测试、逐个卸载，卸载后三向复核（桌面图标、入口端口、已安装列表），并额外清理残留：

| 检查 | 结果 |
| --- | --- |
| 三个应用容器 | 全部不存在 |
| `<app>_default` 网络 | 全部已回收（`docker network ls` 无匹配） |
| 入口端口（8080 / 3000 / 8080） | 卸载后 `curl` 均为 `000` |
| `@appdata` 残留 | 三处残留目录均已清除（`fn-dataease`、`fn-upage`、`fn-ai-gateway` 无目录残留） |
| 暂存 `fnos-fpk/*.fpk` | 已删除 |
| 测试用数据库 | 为本轮创建的 `de` 库与临时账号已删除 |
| 其它应用 | 未触碰设备上既有的应用与数据 |

**设备当前状态：已恢复原状。**

## 7. 本轮变更文件

| 文件 | 变更 |
| --- | --- |
| `apps/fn-dataease/app/seed/conf/application.yml` | 新增：自写的最小数据源配置（种子） |
| `apps/fn-dataease/cmd/install_callback` | 增加「缺失时铺入种子配置」逻辑 |
| `docs/apps/fn-dataease.md` | 补充 3.1.0 起必须的外置配置说明，并修正「缺配置」时的实际表现 |
| `docs/development/environment-and-scripts.md` | 把「塞隐藏 input」改写为本轮实测有效的「拦截 `input.click()`」做法，并补口令注入纪律 |

## 8. 变更记录

| 日期 | 变更 |
| --- | --- |
| 2026-11-05 | 建立本报告：覆盖 2026-11-04 同步批次中 3 个配置改动应用的安装测试；登记缺陷 D-01（`fn-dataease` 缺外置数据源配置）与修复复测结果；登记 4 项遗留风险；设备已恢复原状。 |
