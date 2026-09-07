# 从旧仓库迁移到 infra-ai-gateway 说明

本仓库将以下 4 个零散仓库整合为一个统一的 **AI 基础设施与反代网关**：

## 映射关系

| 旧仓库 | 迁移后路径 | 说明 |
| :--- | :--- | :--- |
| `gemini-reverse-proxy-nas` | `01-gemini-reverse-proxy/` | 完整的 Gemini 网页逆向反代配置（Docker、nginx、systemd） |
| `antigravity-manager-gemini-relay` | `02-antigravity-manager/` | Antigravity-Manager 终极部署方案（OAuth 免 Cookie） |
| `antigravity-hanhua` | `03-antigravity-hanhua/` | Antigravity 2.x 主程序永久汉化方案（liominsb + labixiaoxins） |
| `Agent-App-Perfect-Antigravity-WorkBuddy` | `04-desktop-app-control/` | WorkBuddy 操控 Antigravity 的 MCP + CDP 双控方案 |

## 为什么要整合？

1. **业务强相关**：这 4 个仓库全部围绕「Google Antigravity / Gemini / Claude 本地反代与操控」展开，拆成 4 个仓库割裂了完整的技术链路。
2. **统一维护**：配置模板（Docker、nginx、systemd）集中管理，避免在不同仓库间复制粘贴导致版本不同步。
3. **安全统一**：集中审查 `.gitignore` 和敏感信息，避免单一仓库遗漏导致 Token 泄露。
4. **一目了然**：外部访客进入一个仓库即可看到从「反代部署 → 汉化配置 → 智能体操控」的完整闭环方案。
