# ⛔ 本方案已过时（DEPRECATED）——请使用新方案

> **本仓库的 gemini-web2api 网页逆向方案已不再推荐使用。**
>
> 旧方案硬伤：匿名模式限流狠、Pro 模型静默降级、TLS 指纹被风控、TTFB 高达 6.6–44.9s、Cookie 需手工维护。
>
> **✅ 新方案请移步：[antigravity-manager-gemini-relay](https://github.com/seeyouagain-laoda/antigravity-manager-gemini-relay)**
>
> 新方案基于 [Antigravity-Manager](https://github.com/lbjlaq/Antigravity-Manager)（OAuth 免 Cookie + 官方 API 直连 + 多账号池自愈），
> 实测对话 **1.9–4.5s**，且同时白嫖 **Gemini 3.7/3.8 全系 + 生图 + Claude Opus 4.6**。
> 本仓库仅作历史记录保留，Stop maintenance / 不再维护。

---

# Gemini 网页端反代 · 局域网可调用（对话 / API 化）

> 把 Google Gemini **网页端**转成 OpenAI 兼容 API，跑在 NAS / 自建服务器上，供 ChatBox、手机、WorkBuddy 以及各类 Agent 应用在局域网内调用。
>
> **通过 Gemini 反代，局域网 Agent 应用可以使用。对话还有图片。**

> ⚠️ **关于「图片生成」的重要说明（务必先读）**
> 本仓库里的「图片生成」**是通过浏览器来操控生成的，而不是通过在 NAS 里面反代 Gemini 来完成。**
> - NAS 里的 Gemini 反代（本项目）**只负责「对话 / API 化」这一层**（文字对话稳定；但数据中心 IP 走反代生图会被 Google 拦截，基本不可用）。
> - 真正把图生出来的是配套项目 **gemini-browser-image-gen**：Agent 驱动一个带调试端口、已登录的 Chrome，由浏览器在网页端直接生图（复用本机被 Google 认可的住宅出口）。
> - **一句话：反代管对话，浏览器管生图，分工明确、不可混淆。** 反代本身并不生成图片。

---

## 0.1 生产部署现状（2026-08-26 校正，必读）

本文档是**通用化部署指南**。就作者实际部署而言，当前状态如下，供读者校准预期：

- **文字对话反代：稳定可用。** 生产后端已切到 Go 重写版 **`ikhsan3adi/gemini-web2api`**（Docker，监听 `8090`），比下文 Python 参考实现更稳（原生无空 200、上游失败自动重试、可连续多次工具调用）。Python 版 `cyberanrhy/gemini-claude-web2api` 仍可作为参考实现。
- **图片生成经反代：当前基本不可用。** Google 对图像生成强制要求**住宅 / 白名单 ASN 出口**，而数据中心 IP（Oracle 等）一律被拦截。实测订阅内全部美国节点均为数据中心 IP，生图统一返回「您所在的地区尚未开通图片创建功能」。除非换到住宅 ASN 出口，否则**反代生图无解**。
- **生图的可靠路径：浏览器方案。** 直接用配套项目 **gemini-browser-image-gen** —— Agent 通过带调试端口、已登录的 Chrome 直接驱动网页端生图，复用本机被 Google 认可的住宅出口，天然绕开数据中心 IP 限制。两条路径互补：反代管「API 化对话/集成」，浏览器方案管「保真生图」。

---

## 0. 它能解决什么

- 像调用 OpenAI 一样调用 Gemini 网页端（基于 cookie 登录态），**无需 Google API Key**。
- 服务跑在 NAS 上，局域网内 ChatBox / 手机 / Agent 都能连。
- 支持对话、流式、思考模型、工具调用。**图片生成不在此反代内完成**——它由配套的 **gemini-browser-image-gen**（浏览器方案）负责，详见上方说明与 §9。
- 两个项目分工明确：本项目（反代）只管「对话 / API 化」，gemini-browser-image-gen 专门负责「浏览器生图」。

---

## 1. 架构总览

```
┌─ 客户端（局域网）─────────────────────────────────┐
│  ChatBox / 手机 APP / Agent 应用                    │
│    → 通过 HTTPS 域名访问反代端点                     │
└──────────────────────┬────────────────────────────┘
                        │ HTTPS :<NGINX_PORT>
┌─ NAS / 服务器 ────────┼────────────────────────────┐
│  nginx :<NGINX_PORT>  (<YOUR_DOMAIN>)               │
│     │ 反代 → 127.0.0.1:<PROXY_PORT>                 │
│     ▼                                                │
│  gemini-web2api :<PROXY_PORT>  (OpenAI 兼容)         │
│     │ proxy = http://127.0.0.1:<PROXY_OUT_PORT>      │
│     ▼                                                │
│  专用出口代理实例（仅 Gemini 流量，走受支持地区）    │
└───────────────────────────────────────────────────┘

（图片生成的另一条路径，见 §9 / 配套项目）
  Agent 应用（带调试端口、已登录的 Chrome + CDP）
    → 直接驱动 Gemini 网页端生成图片并落盘
```

> 图中 `<...>` 均为占位符，部署时按你的实际环境替换（见各章节示例）。

---

## 2. 前置条件

- 一台能 SSH 的 NAS / Linux 服务器（如飞牛 fnOS、Debian、Ubuntu 等）。
- 已安装 Python 3.11+（用于 venv）。
- 一个**能正常登录 gemini.google.com 的 Google 账号**（网页端未被地区封锁、且所在地区支持图片生成）。
- 一个代理订阅，其中包含**受 Google 认可的出口 IP**（数据中心 IP 会被限，详见 §4）。
- 一个域名 + 受信任的 TLS 证书（HTTPS 是手机/模拟器 APP 的硬性要求，见 §8）。
- 一台装了**正式 Chrome** 的 Windows / macOS 电脑（用于提取 cookie，见 §3）。

---

## 3. 准备 Gemini Cookie（登录态）

Gemini 网页端依赖登录态 cookie。

> ⚠️ **Chrome for Testing / 无头测试版 Chrome 被 Google 禁止登录**，必须用你日常使用的正式 Chrome。

步骤：

1. 用**带远程调试端口**的正式 Chrome 打开 `https://gemini.google.com`，在屏幕上完成登录。
2. 通过 CDP（`http://127.0.0.1:<CDP_PORT>`）连接，调用 `Storage.getCookies`（browser 级）拿到全部 Google cookie。
3. 转成 **Netscape 格式**写入 `cookie.txt`。

`cookie.txt` 需包含关键字段（节选）：

```
# Netscape HTTP Cookie File
gemini.google.com	TRUE	/	FALSE	<EXP>	__Secure-1PSID	<PSID_VALUE>
gemini.google.com	TRUE	/	FALSE	<EXP>	__Secure-1PSIDTS	<PSID_VALUE>
.google.com	TRUE	/	FALSE	<EXP>	__Secure-3PSID	<PSID_VALUE>
...（共约 30+ 条 Google 域 cookie）
```

> 关键字段：`__Secure-1PSID` / `__Secure-1PSIDTS` / `SID` / `HSID` / `SSID` / `APISID` / `SAPISID` / `NID` 等。缺少 `1PSIDTS` 可能触发风控验证。
> cookie 会过期（通常数月），失效时聊天返回空/401，需重新提取（见 §11）。

### 3.1 推荐的上游项目

GitHub 上 Gemini 网页→API 方案中，推荐 **`cyberanrhy/gemini-claude-web2api`**（Python 参考实现）：

- cookie 认证、OpenAI 兼容；
- `proxy` 字段原生支持（指定出网代理）；
- 纯 Python，适合无显示器的 NAS。

> 也可替换为任意等价的网页端反代项目，只要对外暴露 OpenAI 兼容的 `/v1/chat/completions` 即可。
>
> **生产更推荐 Go 重写版 `ikhsan3adi/gemini-web2api`**（Docker 镜像 `ghcr.io/ikhsan3adi/gemini-web2api`）：性能与健壮性更好（流式更快、原生无空 200、上游失败自动重试、可连续多次工具调用），cookie 烤进镜像、命令行参数即可启动（`--port 8090 --proxy http://127.0.0.1:<PROXY_OUT_PORT>`），更适合 7×24 运行。作者实际部署即采用此版本（见 §0.1）。

---

## 4. 关键：出口 IP 与地区限制（必读，最容易踩坑）

1. **数据中心 IP 会被地区封锁**：Gemini 网页端对数据中心 IP 有地区限制（报错类似 `BardErrorInfo 1060`）。反代的出网流量必须走一个**受 Google 认可地区**的出口。
2. **图片生成对出口更严格**：即使网页对话能通，**数据中心 IP（如 Oracle Cloud 等）被 Google 排除在图片生成白名单外**。图片生成需要**住宅 / 被 Google 认可的 ISP 类型出口 IP**。
3. **“页面能打开” ≠ “能对话”**：很多节点 `/app` 页面能打开，但发消息会被 1060 拦截。必须**真实发消息**测试。
4. **“能对话” ≠ “能生图”**：见第 2 点，生图对出口 IP 的要求更高。

→ 因此建议：给反代**单独起一个只走可用地区节点**的代理实例，且**不影响**你的日常代理流量（见 §6）。

---

## 5. 部署反代（两种形态）

### 5.1 容器形态（推荐，Docker Compose）

见仓库内 `docker-compose.yml` + `Dockerfile`（基于上游项目构建）。核心挂载：

- `./gemini/config.json` → 反代配置（含 `proxy` 出口地址）；
- `./gemini/cookie.txt` → 登录态 cookie；
- 端口映射 `<PROXY_PORT>:8081`。

启动：

```bash
docker compose up -d
docker compose logs -f gemini-web2api
```

### 5.2 系统服务形态（Python venv + systemd user）

```bash
cd <DATA_VOLUME>/gemini-web2api
python3.11 -m venv venv
./venv/bin/pip install -r gemini/requirements.txt
```

`gemini/config.json`（示例见 `gemini/config.example.json`）：

```json
{
  "port": <PROXY_PORT>,
  "host": "0.0.0.0",
  "gemini_bl": "<BACKEND_VERSION>",
  "auth_user": null,
  "xsrf_token": "",
  "api_keys": [],
  "cookie_file": "cookie.txt",
  "proxy": "http://127.0.0.1:<PROXY_OUT_PORT>",
  "log_requests": true,
  "default_model": "gemini-3.5-flash"
}
```

> - `api_keys: []`：**不校验密钥**，客户端随便填（如 `123`）即可。
> - `proxy`：反代出网走 §6 的专用实例。
> - `gemini_bl`：Bard/Gemini 后端版本号，随网页端更新，过期可能需更新（观察报错再改）。

注册 systemd 用户服务（见 `systemd/gemini-web2api.service`）：

```bash
systemctl --user daemon-reload
systemctl --user enable --now gemini-web2api.service
systemctl --user status gemini-web2api.service
```

验证反代已起来：

```bash
curl -s http://127.0.0.1:<PROXY_PORT>/v1/models | head -c 400
# 应返回模型列表 JSON
```

---

## 6. 专用出口代理实例（隔离日常流量）

用 mihomo / clash 起一个**独立实例**，mixed-port 设为 `<PROXY_OUT_PORT>`，仅 Gemini 流量走它，且只选已验证可用的地区节点。

```yaml
# gemini/gemini-config.example.yaml（要点）
mixed-port: <PROXY_OUT_PORT>
external-controller: 127.0.0.1:<PROXY_OUT_CTRL_PORT>
secret: <PROXY_SECRET>
allow-lan: false
mode: rule
dns:
  enable: true
  enhanced-mode: redir-host      # 注意：fake-ip 无 TUN 会破坏隧道，用 redir-host
  nameserver:
    - 223.5.5.5
    - 8.8.8.8
proxy-providers:
  gemini-out:
    type: file
    path: ./providers_gemini.yaml   # 你的订阅（只含目标地区节点）
    health-check:
      enable: true
      url: https://gemini.google.com/app
      interval: 7200
proxy-groups:
  - name: gemini-auto
    type: url-test
    use: [gemini-out]
    filter: "<NODE_KEYWORD>"        # 只保留已验证可用的节点关键字
    url: https://gemini.google.com/app
    interval: 7200
  - name: gemini
    type: select
    proxies: [gemini-auto]
rules:
  - DOMAIN-SUFFIX,gemini.google.com,gemini
  - DOMAIN-SUFFIX,google.com,gemini
  - DOMAIN-SUFFIX,gstatic.com,gemini
  - DOMAIN-SUFFIX,googleapis.com,gemini
  - MATCH,DIRECT
```

要点：

- **DNS 用 `redir-host`**（fake-ip 无 TUN 会破坏 hy2 等隧道）。
- 用 `url-test` 组 + 健康检查（url 用 `https://gemini.google.com/app`，间隔 7200s）自动选优。
- **选优池必须只含已验证可用的少数节点**（很多节点“页面能开但发消息被 1060 拦”）。
- 验证出口：`curl -x http://127.0.0.1:<PROXY_OUT_PORT> https://api.ipify.org` 应返回目标地区 IP。
- 若要定期刷新选优，**必须重启该代理进程**（API 重载不重新测速）。用 cron 在指定整点重启；注意 systemd user 服务在 cron 里需带 `XDG_RUNTIME_DIR` + `DBUS_SESSION_BUS_ADDRESS` 环境变量，否则报 `No medium found`。

---

## 7. nginx 暴露为 HTTPS 域名（ChatBox / 手机可用前提）

ChatBox / 手机 APP **禁止明文 HTTP**，必须 HTTPS。用 nginx 把 `<NGINX_PORT>` 暴露为 `<YOUR_DOMAIN>`（可复用你已有的受信任证书）。

`nginx/gemini.conf`（示例见仓库同名文件）：

```nginx
server {
    listen <NGINX_PORT> ssl;
    server_name <YOUR_DOMAIN>;

    ssl_certificate     /etc/nginx/ssl/<YOUR_DOMAIN>.crt;
    ssl_certificate_key /etc/nginx/ssl/<YOUR_DOMAIN>.key;

    # 客户端通常自动拼 /v1/，这里把 chat/completions 归一化
    location = /chat/completions {
        return 301 /v1/chat/completions;
    }
    location /v1/ {
        proxy_pass http://127.0.0.1:<PROXY_PORT>;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

启用并 reload：

```bash
ln -sf /etc/nginx/sites-available/gemini /etc/nginx/sites-enabled/gemini
nginx -t && systemctl reload nginx
```

验证（在能解析该域名的设备上）：

```bash
curl -sk https://<YOUR_DOMAIN>:<NGINX_PORT>/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"gemini-3.5-flash","messages":[{"role":"user","content":"ping"}],"stream":false}'
# 返回真实回复即通
```

> **域名解析**：把 `<YOUR_DOMAIN>` 解析到 NAS 的公网/内网可达地址（IPv6 DDNS 或固定 IP 均可，按你的网络环境选择；若用 IPv6 注意前缀轮换需删旧记录再新增）。

---

## 8. 客户端接入：ChatBox（局域网）

### 8.1 关键结论：Android / 模拟器禁止明文 HTTP

纯 IPv4 局域网 `http://<NAS_LAN_IP>:<PROXY_PORT>` 会让 ChatBox 的「检查 / 获取模型」按钮**变灰**、请求根本发不出（Android 9+ 默认禁明文）。
→ 必须走 **HTTPS 域名**（§7 的 `https://<YOUR_DOMAIN>:<NGINX_PORT>`）。

> 参照：你已有的另一个正常工作的 HTTPS 反代之所以能用，正是因为它走的是受信任证书的 HTTPS 域名。

### 8.2 ChatBox 配置（已验证可用）

| 字段 | 值 |
|------|----|
| 名称 | 自定义，如 `gemini-lan` |
| API 模式 | OpenAI API 兼容 |
| API 主机 | `https://<YOUR_DOMAIN>:<NGINX_PORT>` |
| API 密钥 | 任意值（反代 `api_keys: []` 不校验），如 `123` |
| API 路径 | `chat/completions`（APP 自动拼成 `/v1/chat/completions`）|
| 改善网络兼容性 | **开启** |

验证结果：

- ✅ 获取模型列表成功（弹出全部 Gemini 模型）
- ✅ 检查连接成功
- ✅ 文本请求 / 图片（多模态）输入 / 工具调用请求全部通过
- ✅ 发送对话消息可正常收到回复

> 若用安卓模拟器调试：用 `adb` 安装 ChatBox APK（包名 `xyz.chatboxapp.chatbox`），调试靠截图 + 坐标点击（React Native 取不到文本节点）。

### 8.3 局域网纯 IP 直连（进阶）

若坚持不用域名、只用 `<NAS_LAN_IP>` 直连，需在 NAS 给该 IP 配 HTTPS 自签名证书，并在手机/模拟器**系统 CA 信任区**安装根证书（Android 7+ 默认 APP 不信任用户 CA，通常需 root）。域名 HTTPS 是当前最简方案。

---

## 9. 图片生成

- 网页端对话与生图是否可用，**取决于 §4 的出口 IP 是否被 Google 认可**。其中**图像生成对出口 IP 的要求远高于对话**：即便对话能通，数据中心 IP（Oracle 等）也几乎必然被 Google 排除在生图白名单外。
- 若生图返回「您所在的地区尚未开通图片创建功能」或类似提示，按三步排查：
  1. **出口 IP** 是否为受认可地区 / **住宅 ISP 类型**（数据中心 IP 会被排除，这是绝大多数机场订阅的硬伤）；
  2. **cookie** 是否完整、未降级为 Guest 访客态；
  3. 反代是否完整返回图片 URL（部分项目需补丁递归提取 `lh3.googleusercontent.com` 真实地址，而非占位符）。
- **当前现实（2026-08-26）**：以数据中心 IP 为主的订阅，**反代生图基本无解**。作者实测订阅内全部美国节点均为数据中心 ASN，生图统一被拦截。要让反代生图，唯一出路是换/补一个**住宅 ASN 出口节点**（当前订阅不提供），或走付费官方 Gemini API key。
- **更稳的生图路径（推荐）**：用配套项目 **gemini-browser-image-gen** —— Agent 通过带调试端口、已登录的 Chrome 直接驱动 Gemini 网页端生图并输出文件。该路径复用你本机**被 Google 认可的住宅出口**，天然绕开数据中心 IP 限制，且自带登录校验、内容拦截识别、成图识别与结构化输出。

> 两条路径互补：反代适合“API 化”的对话/集成；浏览器方案适合“保真生图”与无法拿到住宅出口的 NAS 场景。若你也在用反代跑 Agent 任务（工具调用），注意 Gemini 模型对工具执行是**概率性**的（同一任务这次执行、下次可能拒绝），稳定干活建议用 DeepSeek / QilinAI 等真 API。

---

## 10. 踩坑总表（照抄可避坑）

1. **1060 = 地区限制，不是账号问题** → 换受支持地区节点（先看 `/app` 页面是否完整加载）。
2. **代理 API 重载不触发重新测速** → 必须重启进程；cron 整点重启。
3. **后台启动阻塞** → 用 systemd 用户服务管理，避免 `nohup setsid` 持通道 fd。
4. **sudoers 文件 CRLF → sudo 锁死** → 写文件必须 LF 换行（`newline="\n"`）。
5. **cron 里 `systemctl --user` 报 No medium found** → 显式带 `XDG_RUNTIME_DIR` + `DBUS_SESSION_BUS_ADDRESS`。
6. **Chrome for Testing 被 Google 禁止登录** → 改用正式 Chrome + CDP 提取 cookie。
7. **curl `--noproxy '*'` 会覆盖 `-x` 让请求直连**（有 TUN 的服务器上需要，本机测不要加）。
8. **ChatBox Android 禁明文 HTTP** → 必须 HTTPS 域名；`http://IP:PORT` 会让按钮灰。
9. **ChatBox 自动拼 `/v1/`** → 路径只填 `chat/completions`，不要填 `v1/chat/completions`。
10. **节点页面能开但发消息 1060** → 必须真实发消息筛选；选优池只留已验证节点。
11. **fake-ip 无 TUN 破坏隧道** → 专用实例 DNS 用 `redir-host`。
12. **图片生成被数据中心 IP 限制** → 需住宅/认可出口（或走浏览器方案 §9）。
13. **cookie 会过期（数月）** → 失效时聊天返回空/401，重新提取。
14. **反代后端版本号 `gemini_bl` 会过期** → 观察报错更新 `config.json`。

---

## 11. 运维速查

| 操作 | 命令（NAS，用户级服务） |
|------|------------------------|
| 看反代 + 出口代理状态 | `systemctl --user status gemini-web2api <proxy-service>` |
| 重启反代 | `systemctl --user restart gemini-web2api` |
| 重启出口代理 | `systemctl --user restart <proxy-service>` |
| 反代日志 | `journalctl --user -u gemini-web2api -f` |
| 换 cookie | 重登 Google → 提取新 `cookie.txt` → 覆盖 → 重启反代 |
| 测出口 IP | `curl -s -x http://127.0.0.1:<PROXY_OUT_PORT> https://api.ipify.org` |
| 测对话是否通 | `curl -s http://127.0.0.1:<PROXY_PORT>/v1/chat/completions -d '{"model":"gemini-3.5-flash","messages":[{"role":"user","content":"ping"}],"stream":false}'` |
| 测生图是否被限 | 同上把 content 改成「画一只猫」，看是否回「地区未开通」 |

---

## 12. 隐私与脱敏声明

本文档为**通用化版本**，已去除所有个人敏感信息：

- NAS 内网 IP、SSH 用户名/密码、代理密钥、对外域名、DNS 服务商 API 密钥、cookie 值、机场/节点专有名称 —— 均已替换为 `<占位符>` 或泛化描述。
- 所有端口号（`<PROXY_PORT>` / `<NGINX_PORT>` / `<PROXY_OUT_PORT>` 等）为示例值，部署时按需修改。
- 部署时请按你的实际环境填入对应值；不要将真实凭据提交到公开仓库。

---

## 13. 相关项目

- **本项目**：Gemini 网页端反代 + 局域网接入（对话 / 图片生成 API 化）。
- **gemini-browser-image-gen**：Agent 通过可调试的 Chrome（CDP）直接驱动 Gemini 网页端生成图片并输出文件。当 NAS 出口受限、生图被地区限制时，该方案复用本机住宅出口，是最稳的生图路径。

---

## 14. Perplexity（pplx-proxy）反代（合并自 reverse-proxy-guide）

> 来源说明：本节由 `reverse-proxy-guide` 仓库合并而来（2026-09-04 仓库整理），补齐 Gemini 之外的 Perplexity 反代要点，避免重复建仓。

`pplx-proxy` 把 Perplexity API 反代成一个本地 OpenAI 兼容端点，并做模型别名管理。

- **容器**：`pplx-proxy`（主），历史上曾挂 `flaresolverr` 解 Cloudflare 挑战。
- ⚠️ **状态覆盖（2026-08 起）**：`flaresolverr` 已**移除/停用**——它会和反代 `/health` 形成死循环、疯狂烧 CPU。当前 EMPTY/挑战类排查直接走 `/health` 配额 + slug 核验，勿重新启用该容器。
- **模型别名**：维护一份别名表（如 `sonar` / `gpt-5.5-terra` 等），健康检查应打 `/v1/models`（而非硬编码），否则订阅更新会覆盖配置。
- **健康检查**：`GET /health` 返回配额/状态；`GET /v1/models` 列出可用模型。

客户端接入（脱敏）：

```
Base URL: http://<NAS-LAN-IP>:<PPLX_PORT>/v1
API Key:  <YOUR_PPLX_KEY>
模型:     <ALIAS_NAME>
```

常见翻车点（与 Gemini 反代通用）：

- 双 nginx 冲突：fnOS 自带 nginx 与反代 nginx 抢 80/443，需错开或反向代理串接。
- fnOS nginx 崩溃：改配置后偶发崩溃，需重启 fnOS 网络栈。
- 证书不信任：换 Let's Encrypt 后客户端仍不信任 → 清客户端证书缓存 / 确认链完整。
- 手机流量连不上：走公网域名时若被运营商拦，兜底用 Tailscale（见 `tailscale-mesh-guide`）。
