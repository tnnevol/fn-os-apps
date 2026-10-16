<AppIcon name="fn-sonarqube" alt="SonarQube 图标" />

# SonarQube

## 应用简介

SonarQube 是代码质量分析平台，检测缺陷、漏洞与代码异味。

## 主要能力

- 静态代码分析与质量门禁。
- 缺陷、漏洞与代码异味检测。
- 多语言支持与历史趋势。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-sonarqube` |
| 目标平台 | x86 |
| 外部依赖 | **外部 PostgreSQL** |

## 安装与使用

安装时设置 Web 访问端口，填写数据库连接信息（地址、端口、库名、用户名、密码分开填写）。

**数据库需用户自备**：安装时填写数据库连接信息。**连接失败时应用会启动但功能不可用（页面报数据库错误）**，请确认地址可达、端口已放行、库名与账号密码正确。

**数据库只支持 PostgreSQL**：SonarQube 自 9.x 起不再支持 MySQL，因此**未提供数据库类型选项**（只有唯一合法值就不做成下拉）。**数据库需使用 UTF-8 字符集。**

**权限说明**：本应用镜像默认以非 root 用户运行，转换后保持原样。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/SonarSource/sonarqube)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-sonarqube)
