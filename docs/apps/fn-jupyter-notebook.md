<AppIcon name="fn-jupyter-notebook" alt="Jupyter Notebook 图标" />

# Jupyter Notebook

## 应用简介

Jupyter Notebook 是交互式计算环境，用于数据分析、科学计算与教学演示。

## 主要能力

- 交互式 Python 笔记本。
- 内置科学计算库（SciPy 栈）。
- JupyterLab 界面。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-jupyter-notebook` |
| 目标平台 | x86 |
| 外部依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口与**访问令牌**，安装完成后从应用中心打开，按提示输入令牌登录。

**访问令牌必须修改**：上游默认值是弱占位符（`123456`），转换后已改为**留空并必填**。**请设置一个强随机值**——留空或使用弱值会让你的笔记本环境（可执行任意代码）被他人访问。

**运行身份**：本应用用镜像自带的 `NB_UID`/`NB_GID` 变量指定运行身份，已改为 fnOS 的包用户。**该镜像设计为以 root 启动、再按 `CHOWN_HOME` 递归调整工作目录属主后降权**，因此这里改「变量」而不是直接覆写 `user:`（后者无法在非 root 下完成 chown）。

工作目录为应用数据目录的 `data`（容器内 `/home/jovyan/work`）。数据落在目标 NAS 的应用数据目录（`${TRIM_PKGVAR}`）中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/jupyter/docker-stacks)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-jupyter-notebook)
