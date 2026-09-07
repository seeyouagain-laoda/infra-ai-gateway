# AI 基础设施与反代网关

> AI 基础设施与反代网关：Gemini / Claude 本地反代、Electron 永久汉化、桌面应用 AI 操控。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## 📌 一句话简介

把 Google Gemini + Anthropic Claude 的免费配额反代成标准 OpenAI 兼容 API，跑在 NAS / 自建服务器上，供局域网内所有 AI 客户端（ChatBox / WorkBuddy / OpenClaw）统一调用。同时提供 Antigravity 桌面应用的永久中文汉化方案与 MCP + CDP 双控操控能力。

---

## 📂 目录结构

```
AI 基础设施与反代网关/
├── README.md                          # 本文件：全局导航
├── LICENSE                            # MIT 开源协议
├── .gitignore                         # 统一忽略规则
│
├── 01_Gemini反代与生图服务/            # Gemini 网页端反代（对话/API化）
│   ├── README.md                      # 部署指南（NAS Docker / systemd / nginx）
│   ├── docker-compose.yml             # 容器编排
│   ├── Dockerfile                     # 镜像构建
│   ├── gemini/                        # 配置模板
│   │   ├── config.example.json
│   │   └── gemini-config.example.yaml
│   ├── nginx/
│   │   └── gemini.conf                # HTTPS 反代配置
│   └── systemd/
│       ├── gemini-web2api.service
│       └── mihomo-gemini.service
│
├── 02_Antigravity流式协议转换/         # Antigravity-Manager 终极方案（OAuth 免 Cookie）
│   └── README.md                      # 部署 + 三端接入 + 排障实录
│
├── 03_Antigravity永久汉化/             # Antigravity 永久中文汉化
│   ├── README.md                      # 方案对比 + 操作指南
│   ├── antigravity-cn-pack-skill/     # labixiaoxins 方案（Skill 包）
│   ├── liominsb/                      # liominsb 方案（MutationObserver 引擎）
│   ├── scripts/                       # 设置面板手术注入脚本
│   └── tools/                         # CDP 扫描/校验/调度工具
│
├── 04_桌面应用自动化联动/              # WorkBuddy 操控 Antigravity（MCP + CDP 双控）
│   ├── README.md                      # 技术论文式总结
│   ├── desktop-app-control-skill/     # Skill 包（SKILL.md + 脚本 + 参考文档）
│   ├── docs/                          # 排障报告与备选方案
│   └── scripts/                       # agy 驱动 + UI 操控 + 截图脚本
│
├── 文档/
│   └── 版本迁移指引.md                 # 从旧仓库迁移说明
│
└── 小AI/
    ├── Gemini流式反代助手/
    │   └── SKILL.md                   # 反代流式协议适配与运维专家
    └── 桌面应用汉化助手/
        └── SKILL.md                   # Electron asar 汉化与实机验证专家
```

---

## 🔗 前身仓库（已归档）

本仓库整合自以下 4 个独立仓库，旧仓库已在 README 首屏标注迁移指引：

| 原仓库 | 对应板块 | 状态 |
| :--- | :--- | :---: |
| [gemini-reverse-proxy-nas](https://github.com/seeyouagain-laoda/gemini-reverse-proxy-nas) | `01_Gemini反代与生图服务/` | 🔀 已迁移 |
| [antigravity-manager-gemini-relay](https://github.com/seeyouagain-laoda/antigravity-manager-gemini-relay) | `02_Antigravity流式协议转换/` | 🔀 已迁移 |
| [antigravity-hanhua](https://github.com/seeyouagain-laoda/antigravity-hanhua) | `03_Antigravity永久汉化/` | 🔀 已迁移 |
| [Agent-App-Perfect-Antigravity-WorkBuddy](https://github.com/seeyouagain-laoda/Agent-App-Perfect-Antigravity-WorkBuddy) | `04_桌面应用自动化联动/` | 🔀 已迁移 |

---

## 🚀 快速开始

### 方案一：Antigravity-Manager（推荐，OAuth 免 Cookie）

```bash
docker run -d --name antigravity-manager \
  -p 8045:8045 \
  -e API_KEY=<你的API密钥> \
  -e WEB_PASSWORD=<你的后台密码> \
  -v ~/.antigravity_tools:/root/.antigravity_tools \
  lbjlaq/antigravity-manager:latest
```

详见 → [`02_Antigravity流式协议转换/README.md`](02_Antigravity流式协议转换/README.md)

### 方案二：Gemini 网页端反代（旧方案，仅对话）

详见 → [`01_Gemini反代与生图服务/README.md`](01_Gemini反代与生图服务/README.md)

### 汉化 Antigravity

详见 → [`03_Antigravity永久汉化/README.md`](03_Antigravity永久汉化/README.md)

### 操控 Antigravity（MCP + CDP）

详见 → [`04_桌面应用自动化联动/README.md`](04_桌面应用自动化联动/README.md)

---

## 🤖 小 AI 助手

| 小 AI | 目录 | 职责 |
| :--- | :--- | :--- |
| Gemini流式反代助手 | [`小AI/Gemini流式反代助手/`](小AI/Gemini流式反代助手/SKILL.md) | 反代流式协议适配、端点保活、生图路径重定向 |
| 桌面应用汉化助手 | [`小AI/桌面应用汉化助手/`](小AI/桌面应用汉化助手/SKILL.md) | Electron asar 无头汉化、静态补丁与实机验证 |

---

## ⚠️ 安全与合规

- **所有配置文件已脱敏**：API Key、Cookie、内网 IP 均为 `<占位符>`，部署时按实际环境替换。
- `.env` 文件已加入 `.gitignore`，**永远不要提交真实密钥到仓库**。
- Antigravity-Manager 采用 **CC BY-NC-SA 4.0 许可**，仅限个人使用，禁止商用。
- 本仓库代码（非上游项目）采用 **MIT 许可**。

---

## 📖 相关项目

- [Antigravity-Manager](https://github.com/lbjlaq/Antigravity-Manager) — OAuth 多账号池 + 三协议反代
- [MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo) — Clash.Meta 分流内核
- [gemini-browser-image-gen](https://github.com/seeyouagain-laoda/gemini-browser-image-gen) — 浏览器 CDP 生图（反代管对话，浏览器管生图）
