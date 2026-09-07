# Antigravity-Manager：Gemini + Claude 本地反代终极方案（NAS Docker）

> **本文章和教程由 AI（WorkBuddy）生成**，人类仅提供需求与验收。
>
> ## 项目归属与致谢（本方案基于以下开源项目/服务搭建）
> - **核心网关**：[lbjlaq/Antigravity-Manager](https://github.com/lbjlaq/Antigravity-Manager) — OAuth 多账号池 + 三协议反代（本教程主体）
> - **网络出口**：[MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo)（Clash.Meta 内核）— 分流与出口 IP 质量
> - **Agent 框架**：[OpenClaw](https://openclaw.ai) — NAS/主机双端智能体，消费本网关 API
> - **客户端**：WorkBuddy（本地 AI 工作台）
> - **账号来源**：Google Antigravity IDE（免费 Gemini/CC 配额）
> - **上游模型**：Google Gemini 3.7/3.8 系 + Anthropic Claude 4.6 系
> - **参考**：[paxx1m/gemini-web2api](https://github.com/paxx1m/gemini-web2api)（旧方案，本教程第八节记录其退役原因）

> 用 Antigravity-Manager 替代 gemini-web2api 类网页逆向方案：
> OAuth 免 Cookie、官方 API 直连、多账号池自愈轮换，实测对话 **1.9–4.5s**。脱敏无密钥。

---

## 目录

1. [背景：旧方案为什么不完美](#一背景旧方案为什么不完美)
2. [方案选型：三个候选横向对比](#二方案选型三个候选横向对比)
3. [部署过程：严格按官方教程](#三部署过程严格按官方教程)
4. [关键配置详解](#四关键配置详解)
5. [模型清单与踩坑记录](#五模型清单与踩坑记录)
6. [实测数据](#六实测数据)
7. [三端接入明细](#七三端接入明细)
8. [旧方案下线明细](#八旧方案下线明细)
9. [回滚方案](#九回滚方案)
10. [日常维护与风险](#十日常维护与风险)

---

## 一、背景：旧方案为什么不完美

旧方案为 **gemini-web2api**（逆向 Gemini 网页版 StreamGenerate 协议，转 OpenAI 兼容 API），NAS 上双实例并存：

- `gemini-web2api-go` 容器（Go 重写版）
- 宿主机 Python 版 gemini-web2api（监听 8090，经 nginx 8446 对外即 "gmini"）

### 实测发现的四个硬伤

| # | 问题 | 实测证据 | 后果 |
|---|---|---|---|
| 1 | **匿名模式（无 Cookie）** | 容器日志 `Cookie: none (anonymous)` | 走未登录通道，限流最狠；`gemini-3.1-pro` **静默降级成 Flash**（Pro 只是 UI 标签，后端没切换） |
| 2 | **TLS 指纹未开启** | 日志 `Impersonate: none (stdlib)` | Go 版的核心卖点是模拟 Chrome/Edge TLS 指纹绕 WAF，裸 stdlib 指纹容易被 Google 风控盯上 |
| 3 | **双实例内耗** | 容器 + 宿主 Python 同时打同一个 Google 端点 | 互相抢限流额度 |
| 4 | **速度慢** | 全节点实测 TTFB **6.6–44.9s**（26 个日/新节点） | 网页逆向链路太长，且无账号级调度 |

另外一个普遍性问题（社区报告证实）：**「能打开网页 ≠ 能出对话」**——健康检查只测 `gemini.google.com` 网页可达性会大量误报。

---

## 二、方案选型：三个候选横向对比

### 2.1 候选清单

| 候选 | 逆向入口 | 协议 | 生图 | 多账号 | 部署重量 |
|---|---|---|---|---|---|
| **gemini-web2api**（CF Worker 版） | Gemini 网页聊天版 | OpenAI Chat/Responses | ❌ | Cookie 轮换 | 零服务器（CF 免费 10 万请求/天） |
| **AIStudio2API** | AI Studio Playground | OpenAI/Responses/**Anthropic**/Gemini 四协议 | Nano Banana + **Veo 视频** + TTS | 权益感知调度 | 🔴 重：每账号一个 Camoufox 浏览器（0.5–1G 内存） |
| **Antigravity-Manager** ✅ | **Antigravity IDE 后端（OAuth Session → 官方 API）** | OpenAI/Anthropic/Gemini 三协议 | **Imagen 3**（size/quality 全参数） | **OAuth 自动授权 + 403 封禁检测跳号 + 429 毫秒自愈 + 配额仪表盘** | ✅ **Docker 最小 256MB** |

### 2.2 选型理由

1. **模型真实度**：web2api 走消费者网页通道（路由黑盒、Pro 降级）；AIStudio2API 和 Antigravity-Manager 走开发者通道（真参数）。
2. **鉴权方式**：Antigravity-Manager 用 **OAuth Token 自动续期**，没有 Cookie 过期问题（web2api 系的通病）。
3. **资源**：NAS 是老平台（A8-5550M / 7G 内存），AIStudio2API 的 Camoufox 每号一个浏览器吃不消；Antigravity-Manager Docker 最小 256MB。
4. **额外收益**：同一个网关顺带反代 **Claude 全系**（Anthropic Session），一份部署两个用途。
5. **活跃度**：v4.6.8（2026-09-06 更新），837 commits，社区活跃。

> ⚠️ 许可注意：Antigravity-Manager 采用 CC BY-NC-SA 4.0，**仅限个人使用，禁止商用**。

---

## 三、部署过程：严格按官方教程

### 3.1 预检

```bash
# 端口检查（8045 必须空闲）
ss -ltn | grep 8045        # → 8045 空闲 ✅
# Docker 状态
docker info | grep "Server Version"   # → 28.5.2 ✅
```

### 3.2 官方 docker run（原样执行，仅替换密钥值）

```bash
docker run -d --name antigravity-manager \
  -p 8045:8045 \
  -e API_KEY=<你的API密钥> \
  -e WEB_PASSWORD=<你的后台密码> \
  -e ABV_MAX_BODY_SIZE=104857600 \
  -v ~/.antigravity_tools:/root/.antigravity_tools \
  lbjlaq/antigravity-manager:latest
```

| 环境变量 | 说明 |
|---|---|
| `API_KEY` | **必填**。所有协议 AI 请求的鉴权密钥（客户端用） |
| `WEB_PASSWORD` | 管理后台登录密码（不设则复用 API_KEY；设置后后台只能用它登录） |
| `ABV_MAX_BODY_SIZE` | 请求体上限，100MB 支持大图片 |

### 3.3 部署验证（不要假设，逐项核实）

```bash
# 环境变量核对（改过配置/重试过部署必做）
docker inspect antigravity-manager --format '{{range .Config.Env}}{{println .}}{{end}}'
# 日志确认
docker logs antigravity-manager --tail 8
# Web 后台 + API
curl -o /dev/null -w '%{http_code}' http://127.0.0.1:8045/      # → 200
curl -H "Authorization: Bearer <API_KEY>" http://127.0.0.1:8045/v1/models
```

> **踩坑记录**：SSH 传输多行命令时反斜杠折行符可能被吞掉，导致 `docker run` 报 `exit 125`（镜像名被拆错）。但容器可能已正确启动——**务必用 `docker inspect` 核对 Env 和挂载后再决定是否重跑**，不要盲目重试。

### 3.4 添加账号（OAuth）

1. 管理后台 → **账号 → 添加账号 → OAuth**
2. 弹窗预生成授权链接 → 复制到浏览器打开 → 登录 Google 账号授权
3. 回调页显示「✅ 授权成功」即完成（未自动完成可点「我已授权，继续」）
4. 重复可添加多个账号组成账号池（建议 ≥3 个分摊配额）

> 授权链接含一次性回调端口，**始终用弹窗里生成的最新链接**。

---

## 四、关键配置详解

### 4.1 全局上游代理（决定生死的配置）

Manager 容器跑在 **bridge 网络**里，`127.0.0.1` 指向容器自己——**不能**填 `127.0.0.1:7890`（实测 000 失败）。必须填 NAS 局域网 IP：

```
http://<NAS局域网IP>:7890     # NAS mihomo 主实例（allow-lan: true，监听 *:7890）
```

实测：经此代理 `gemini.google.com` 200 @0.37s，`api.anthropic.com` 可达（404 根路径为正常响应）。

> 为什么不用 mihomo-gemini 专例（7895）：它 `allow-lan: false` 只绑 127.0.0.1，容器够不着；而主实例 7890 的分流规则里 Google→Gemini 专组、Anthropic→proxy，路由效果相同。

### 4.2 代理池 vs 全局上游代理

| | 全局上游代理 | 代理池 |
|---|---|---|
| 定位 | 单一兜底出口 | 带健康检查+优先级的出口管理 |
| 适用 | 只有一条出口、图省事 | **推荐**：可加多条出口、按账号绑定、故障自动摘除 |

**实际采用：代理池**，配置：

| 字段 | 值 |
|---|---|
| 名称 | `nas-mihomo` |
| 代理地址 | `http://<NAS局域网IP>:7890` |
| 优先级 | 0 |
| 最大账号数 | 0（不限） |
| **健康检查地址** | **`https://gemini.google.com/`** ← 关键！ |

> **健康检查为什么用 gemini.google.com 而不是 www.google.com**：出口 IP 能到谷歌 ≠ Gemini 放行（Gemini 对 IP 限制更严，历史测试中 6 个节点 gstatic 全通但 Gemini 拒开）。健康检查必须探真正的瓶颈点，IP 被 Gemini 拉黑时池子才能第一时间摘除。
> 填好代理池记得**打开池子总开关**，并关闭全局上游代理避免配置打架。

### 4.3 访问授权模式

- 模式设为「**全局（除健康检查外）**」：所有 API 请求都要带 `Authorization: Bearer <API_KEY>`
- 建议开启「允许局域网访问」（0.0.0.0）供局域网内其他设备调用，但要注意 API Key 保管

### 4.4 密码体系（官方优先级）

1. 环境变量 `WEB_PASSWORD`（最高优先级，改密码须重建容器）
2. 配置文件 `~/.antigravity_tools/gui_config.json` 的 `admin_password`
3. 回退 `API_KEY`

---

## 五、模型清单与踩坑记录

### 5.1 可用模型（实测 94 个）

| 类别 | 模型 ID | 用途 |
|---|---|---|
| **Gemini 对话** | `gemini-3.8-flash-high` / `-medium` / `-low` / `-tiered` | **最新旗舰**（3.8 已上线） |
| | `gemini-3.7-flash`（含 high/medium/low/tiered） | 稳定主力 |
| | `gemini-3-pro-high` / `gemini-3.1-pro-high` | 旗舰推理王 |
| **生图** | `gemini-3.1-flash-image`（另有 3-pro-image 的 2K/4K/多比例变体） | 返回 base64 图 |
| **Claude** | `claude-opus-4.6-thinking`、`claude-opus-4.6`、`claude-sonnet-4-6-thinking` 等 | Anthropic Session 直连 |

### 5.2 踩坑记录（重要！）

| 坑 | 现象 | 解法 |
|---|---|---|
| **过时模型映射** | 调 `gemini-3-flash` 返回 "Gemini 3.5 Flash is no longer available. Please switch to Gemini 3.7 Flash" | 上游改名了，**用 3.7/3.8 系列 ID**，别用 3-flash |
| **pro-image 配额** | `gemini-3-pro-image` 报 503 "No accounts available with quota" | Pro 账号的该模型配额受限，**改用 `gemini-3.1-flash-image`**（实测 21.8s 出图） |
| **401 错误** | 客户端报 HTTP 401 | 实测矩阵：无 key=401、错 key=403、对 key=200。401 = 客户端没带 key；改密码后**管理台要重新登录** |
| **403 账号风控（VALIDATION_REQUIRED）** | 单账号报 `403 PERMISSION_DENIED / VALIDATION_REQUIRED`，标记「反代已取消，已跳过自动刷新」 | ①错误弹窗点「点击去验证」→浏览器用**该账号**登录完成安全验证（首选，2分钟）②无效则装 gcloud：`gcloud auth login --update-adc`（失败先 `gcloud auth revoke <邮箱>`）③兜底：删号重新 OAuth（用常用浏览器）。**根因与配额无关（仪表盘99%为剩余额度），指向同出口IP挂多账号+高频程序化调用触发 Google 安全验证**，验证后建议分流出口/降低单号调用频率 |

### 5.3 实测速度（对比旧方案）

| 模型 | 新方案（Antigravity-Manager） | 旧方案（gmini web2api） |
|---|---|---|
| Gemini Flash 档 | **1.9–2.7s** | 6.6–44.9s |
| Gemini Pro 档 | **3.9–4.5s** | 更慢且常降级 |
| Claude Opus 4.6 | **4.0s** | 旧方案无此能力 |
| 生图 | 21.8s（base64 返回） | 无 |

---

## 六、三端接入明细

> 以下 `<NAS_IP>` 统一指 NAS 局域网 IP，`<API_KEY>` 指 Manager 的 API 密钥。

### 6.1 NAS OpenClaw（`/home/<user>/.openclaw/openclaw.json`）

`models.providers` 新增：

```json
"antigravity": {
  "baseUrl": "http://<NAS_IP>:8045/v1",
  "apiKey": "<API_KEY>",
  "api": "openai-completions",
  "models": [
    { "id": "gemini-3.8-flash-high", "name": "Gemini 3.8 Flash High (最新旗舰)", "contextWindow": 1048576, "maxTokens": 32768, "reasoning": true },
    { "id": "gemini-3.7-flash",      "name": "Gemini 3.7 Flash (稳定主力)",      "contextWindow": 1048576, "maxTokens": 32768 },
    { "id": "gemini-3-pro-high",     "name": "Gemini 3 Pro High (旗舰推理)",     "contextWindow": 1048576, "maxTokens": 32768, "reasoning": true },
    { "id": "claude-opus-4.6-thinking", "name": "Claude Opus 4.6 Thinking",      "contextWindow": 200000,  "maxTokens": 32768, "reasoning": true },
    { "id": "gemini-3.1-flash-image",   "name": "Gemini 3.1 Flash Image (生图)",  "contextWindow": 1048576, "maxTokens": 8192 }
  ]
}
```

`agents.defaults.models` 白名单同步加入 `antigravity/<模型id>: {}` 五条，并**删除全部 `gmini/*` 条目与 gmini provider**。改完 `systemctl --user restart openclaw-gateway`。

### 6.2 主机 OpenClaw（`C:\Users\<user>\.openclaw\openclaw.json`）

与 6.1 完全相同的增删（本机 gmini 走的是公网域名反代，一并删除）。本机网关用启动脚本重启后生效。

### 6.3 WorkBuddy（`~/.workbuddy/models.json`）

删除 3 条旧 gmini 配置（vendor=gmini），新增 5 条：

```json
{
  "id": "gemini-3.8-flash-high",
  "name": "Antigravity-Gemini-3.8-Flash-High(最新旗舰)",
  "vendor": "antigravity",
  "url": "http://<NAS_IP>:8045/v1/chat/completions",
  "apiKey": "<API_KEY>",
  "supportsToolCall": true,
  "supportsImages": false,
  "supportsReasoning": true,
  "maxTokens": 32768
}
```

同格式再加 `gemini-3.7-flash`、`gemini-3-pro-high`、`claude-opus-4.6-thinking`、`gemini-3.1-flash-image` 五条。

### 6.4 备份位置（改坏了一键回滚）

| 端 | 备份文件 |
|---|---|
| NAS OpenClaw | `~/.openclaw/openclaw.json.bak_before_antigravity` / `.bak_before_38cleanup` |
| 主机 OpenClaw | `~/.openclaw/openclaw.json.bak_before_antigravity_20260907` |
| WorkBuddy | `~/.workbuddy/models.json.bak_before_antigravity_20260907` |

---

## 七、旧方案下线明细

| 组件 | 状态 |
|---|---|
| `gemini-web2api-go` 容器 | ✅ **已删除**（镜像保留可随时回滚） |
| 宿主机 Python gemini-web2api（8090） | ⏸ 暂保留未启用，确认新方案稳定后可停 |
| nginx 8446 反代（gmini 入口） | ⏸ 暂保留，同上 |
| mihomo-gemini 专例（7895/9095） | ⏸ 暂保留（mihomo 主实例已能承担同路由） |
| 三端 gmini 配置 | ✅ **全部删除**（NAS/主机 OpenClaw + WorkBuddy） |

---

## 八、回滚方案

1. 容器重建（改密码/参数时官方做法）：
   ```bash
   docker rm -f antigravity-manager
   # 重新 docker run（数据卷 ~/.antigravity_tools 内账号/配置不丢）
   ```
2. OpenClaw 回滚：`cp openclaw.json.bak_before_antigravity openclaw.json && systemctl --user restart openclaw-gateway`
3. WorkBuddy 回滚：`cp models.json.bak_before_antigravity_20260907 models.json`
4. 旧容器回滚：`docker run -d --name gemini-web2api-go --network host gemini-web2api-go:3.7`（镜像未删）

---

## 九、日常维护与风险

| 事项 | 说明 |
|---|---|
| 账号池规模 | 建议 ≥3 个 Google 账号分摊配额；仪表盘会显示各账号剩余配额并推荐最佳账号 |
| IP 质量 | Manager 出口走 NAS mihomo（Gemini 专组节点）；健康检查盯 gemini.google.com，被拉黑自动摘除 |
| 版本升级 | `docker pull lbjlaq/antigravity-manager:latest && docker rm -f ... && docker run ...`（数据卷不丢） |
| 数据备份 | 定期备份 `~/.antigravity_tools/`（账号 Token、配置全在里面） |
| ⚠️ 合规 | 逆向/OAuth 滥用理论上违反 Google ToS，有封号风险；**CC BY-NC-SA 4.0 许可，禁止商用**；不要用主力 Google 账号 |
| 密钥安全 | API_KEY 泄露 = 别人白嫖你的配额；泄露后在管理台一键换新并重启 |

---

*报告完 — WorkBuddy 2026-09-07*


---

## 十一、外网访问方案（不在局域网也能用）

### 首选：Tailscale（已实测打通）

NAS 与手机/电脑都装 Tailscale 并登录同一账号后，**任意网络下**用 `http://<NAS的Tailscale IP>:8045` 访问管理台与 API：

- NAS Tailscale IP 查询：`tailscale ip -4`
- 手机装 Tailscale App → 登录同账号 → 浏览器访问 `http://<NAS_Tailscale_IP>:8045`

**踩坑**：Tailscale 长期不重启可能出现 tailscale0 丢失 IPv4 地址（`ip -4 addr show tailscale0` 为空）导致 000 连不上，`systemctl restart tailscaled` 即恢复。

优点：零端口暴露、WireGuard 加密、免费 100 设备；不依赖公网 IP/IPv6。备选：Cloudflare Tunnel（可绑域名分享给他人，但 Manager 的 API Key 就是唯一防线，慎开公网）。

---

## 十二、WorkBuddy 接入排障实录（两层错误，三层误判，最终自愈式修复）

### 12.1 第一层：HTTP 400 「Failed to parse the request body as JSON: expected value at line 1 column 1 (proxy: undefined → http://…:8045)」

**现象**：WorkBuddy 5.3.14 自定义模型调用 Manager，全部请求 400，零成功；而 curl / urllib 直连同一端点连 200KB 大请求都正常。

**排障弯路（两次误判）**：

| 误判 | 依据 | 为什么错 |
|---|---|---|
| URL 格式不对（全路径 vs base 风格） | 能用的 pplx 条目都是 base 风格 | 改了没用，症状不变 |
| keep-alive 陈旧连接（Manager 容器重建过） | 13:17 空 body、13:28 传到 147KB 截断的「渐进式损坏」 | 重启后照崩，假设推翻 |

**实锤手段**：Manager 数据卷里的流量日志库 `proxy_logs.db`（表 `request_logs` 含 `request_body` 原文）。拉回本地 sqlite 分析发现——WorkBuddy 发出的是**代理风格绝对地址请求**：

```
POST http://<ip>:8045/v1/chat/completions HTTP/1.1   ← 把端点当 HTTP 代理用
（无 Host 头）
```

**根因**：WorkBuddy 5.3.14 对 `http://IP:端口` 形态的自定义模型走了错误的 proxy 路径（旁证：配置里所有 `https://` 模型全部正常，仅有的两条 `http://IP` 全军覆没）。

**修复**：不给 http 路径，改走 TLS——复用 NAS nginx 8446（旧 gmini 方案的 HTTPS 入口，证书现成），`proxy_pass` 从已死的 8090 改到 Manager 8045；WorkBuddy 侧 URL 统一 `https://<你的域名>:8446/v1`（与一直正常的旧 gmini 同形态）。

**顺带排掉的坑**：

1. fnOS 的 nginx `sites-enabled/gemini` 是**独立副本不是软链**——只改 `sites-available` 无效，两份都要改
2. 这台 nginx 对 `reload` 不生效（`nginx -T` 显示新配置已加载，但老 worker 继续用旧配置接客）——必须 `systemctl restart nginx`

### 12.2 第二层：「Failed to run function tools: TypeError: Cannot read properties of undefined (reading 'split')」

400 消失后，agent 任务（会触发工具调用）开始崩这个错，Gemini 3.7 / 3.8 都中招。

**弯路（第三次误判）**：以为是 WorkBuddy 工具执行器不认标准 OpenAI `call_xxx` 工具 ID（社区有同名案例与 sanitizer 补丁），先关 `supportsToolCall`，又给 CLI 流式适配器手工打了 5.3.14 定制补丁——**都没用**，因为那条代码路径根本不在崩溃链上。

**实锤手段（三层证据链）**：

1. **运行日志**（`~/.workbuddy/logs/<日期>/` 下的 cli_host 日志）——崩溃前 2ms 固定出现：
   ```
   [Warning] [SandboxPermissionGateway] check failed, falling back to legacy path: … (reading 'slice')
   ```
   随后 `'split'` 崩溃；且 `lastPendingTool=PowerShell/call_xxx` → 锁定「执行内置 PowerShell 工具时崩」
2. **代码定位**：PowerShell 工具 `needsApproval` 第一行解构 `let {command} = args` → 权限网关对 `undefined` 做 `.slice` 崩 → fallback 后安全检查对 `undefined` 做 `.split` 崩
3. **决定性证据**——Manager 流量库的 **`response_body`**（模型真实输出）：
   ```json
   {"name":"PowerShell","arguments":"{\"description\":\"Get repositories using gh CLI…\"}"}
   ```
   **模型调用 PowerShell 时没带必填的 `command` 参数，只给了一个 `description`**。同会话前几轮都正常带 command——Gemini 偶发吐坏参数。

**为什么一个坏调用能杀掉整个会话**：WorkBuddy CLI 执行器 `executeFunctionToolCalls` 对批量工具调用的 map 回调**没有任何 try/catch**，单个调用抛异常 → 包成 ToolCallError → 整轮 prompt 直接 refusal。正确行为应该是：把错误作为工具输出喂回模型，让它补上参数重试。

### 12.3 最终修复（自愈式，已实测）

对 `app.asar.unpacked/cli/dist/codebuddy.js` 打两个补丁：

| 补丁 | 内容 | 效果 |
|---|---|---|
| **逐调用容错** | map 回调包 try/catch，异常经 `buildParseErrorResult` 变成一条 `function_output` 错误信息回给模型 | 坏调用不再致命；模型看到 "missing command" 自动补参重试，**会话自愈** |
| **堆栈探针** | ToolCallError 消息注入 `\|\|STACK\|\| <完整堆栈>`（仅致命路径触发） | 以后再出怪错，错误报告直接带崩点 |

**实测**：3 条连续 PowerShell 命令测试用例，39 秒全部执行成功，恢复「测试通过」。

**注意事项**：

- WorkBuddy **官方更新会覆盖** `codebuddy.js`，补丁失效需重打（原始备份：`codebuddy.js.mybak.<日期>`）
- 定制补丁用「精确 needle 匹配，不唯一即退出」写法——版本升级后 needle 变了会安全拒绝，不会写坏文件
- 曾有一次植入事故：提取原始代码块时截短 400 字符导致文件语法损坏，靠备份立即恢复——**改 dist 前必须先备份 + 改完必须 `node --check`**

### 12.4 排障方法论沉淀

| 经验 | 说明 |
|---|---|
| **先拿实锤再动手** | 两次弯路都源于「合理猜测」；翻盘全靠流量日志（request_body / response_body）和运行日志的逐毫秒序列 |
| **WorkBuddy 桌面架构** | agent 不是跑在渲染进程，而是 `WorkBuddy.exe <resources>/app.asar.unpacked/cli/bin/codebuddy --serve` 伪 node 子进程；改 CLI 文件后必须完全重启 WorkBuddy 才生效 |
| **日志位置** | 运行日志：`~/.workbuddy/logs/<日期>/`；Manager 流量库：`/root/.antigravity_tools/proxy_logs.db`（含请求/响应全文，可拉回本地 sqlite 分析） |
| **Manager 的 DB 是金矿** | `request_body` 看客户端真实发了什么，`response_body` 看模型真实回了什么——「客户端的锅还是模型的锅」一查便知 |
| **容错设计** | 任何 agent 框架的工具执行都应逐调用隔离错误——单工具失败是常态（模型抽风/参数不合法），喂回错误即可自愈；整会话崩溃是最差解 |

---

