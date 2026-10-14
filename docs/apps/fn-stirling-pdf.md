<AppIcon name="fn-stirling-pdf" alt="Stirling PDF 图标" />

# Stirling PDF

## 应用简介

Stirling PDF 是本地托管的 PDF 工具箱，支持合并、拆分、转换、加水印与 OCR 等操作。

## 主要能力

- 合并、拆分、旋转与压缩 PDF。
- 格式转换、加水印与页面调整。
- 内置 OCR 与多种批处理能力。

## 运行要求

| 项目 | 值 |
| --- | --- |
| 应用目录 | `apps/fn-stirling-pdf` |
| 目标平台 | x86 |
| 额外依赖 | 无 |

## 安装与使用

安装时设置 Web 访问端口，安装完成后从应用中心打开并上传 PDF 进行处理。

OCR 训练数据与自定义配置分别保存在目标 NAS 应用数据目录下的 `trainingData`、`extraConfigs` 子目录中，卸载时选择「保留数据」可在重装后恢复。

## 相关链接

- [上游项目](https://github.com/Stirling-Tools/Stirling-PDF)
- [应用目录](https://github.com/tnnevol/fn-os-apps/tree/main/apps/fn-stirling-pdf)
