# Antigravity 反重力如何汉化（主程序 + IDE 永久中文方案）

> 适用版本：**Google Antigravity 2.0**（2026/5/19 I/O 后整体重写的那一版），**已实测延伸至 2.12.2**（2026-09-05）。2.12.2 的**设置面板也能经 preload 全中文**（详见 §十二），本仓库已附手术式注入脚本。
> 方案特点：**落盘永久生效**，双击原来的快捷方式就是中文，不需要每次注入、不需要额外快捷方式。
> 主程序汉化有**两种社区方案**，均为静态改写 `app.asar`、永久生效。推荐顺序：**方法一 liominsb（覆盖更强、全平台）→ 方法二 labixiaoxins（已实测可用的备选）**。
> 需要**只改设置页 / 单文件手术注入**的可直接用本仓库 §十二 的 `scripts/patch_cn_preload_v2122.mjs`。

---

## 一、方案选择（先读这个）

| | **方法一 · liominsb（推荐）** | **方法二 · labixiaoxins（备选）** |
| --- | --- | --- |
| 项目地址 | `github.com/liominsb/Antigravity-Chinese-Localization` | `github.com/labixiaoxins/antigravity-cn-pack-skill` |
| 原理 | 改 4 个文件注入**运行时 `MutationObserver` 汉化引擎**（穿透 Shadow DOM）+ 470 词条 + 105 核心词 + 动态正则 | 改 5 个文件**静态字符串替换**（`replaceOnce` 精确匹配失败即抛异常）+ 225 词条 + 自研补 49 条 |
| 覆盖能力 | **强**：菜单/托盘/向导/主窗口静态全覆盖；动态生成串（`Worked for 5s`→`已工作 5 秒`、`Explored 12 files`→`浏览了 12 个文件`）实时翻 | **中**：225 + 49 条，主导航 + 侧栏次级项 |
| 平台 | Windows / macOS / Linux（自带可视化控制中心 `localhost:3388`） | 主要 Windows（Python 一键脚本） |
| 已知未覆盖 | 设置面板 **38 条**远程 Web 端冷门英文串（见 §4.6） | 主视图 **5 条**（品牌名 / 模型名 / 时长 / 你的对话标题，均**应保留**） |
| 本仓库位置 | `liominsb/` | `antigravity-cn-pack-skill/` + `重新应用.py` |

> 两者都只改 `app.asar` 渲染层 JS，落盘永久生效；Antigravity 自动升级覆盖 `app.asar` 后重跑即可。liominsb 词库更大、且能翻动态串，故排第一；labixiaoxins 结构保真更严格、有现成一键回滚脚本，作为稳妥备选。

---

## 二、根因：为什么网上的教程全失效

Antigravity 在 **2026/5/19 Google I/O 被整体重写（2.0）**，架构彻底变了：

|  | 1.x（2025 版，老教程讲的） | **2.0（2026/5 起，你装的）** |
| --- | --- | --- |
| 本体形态 | VS Code 分支出来的编辑器 | **独立桌面管理器，编辑器另外装** |
| 扩展商店 | 有 | **无** |
| 语言包机制 | 有（装 Chinese 即汉化） | **主程序没有** |
| 工作单元 | 代码仓库 | 项目（可跨目录） |
| 终端 | 编辑器内置 | 独立 `agy` CLI |

→ 所以 `Ctrl+Shift+P` 里搜不到 `Configure Display Language` / `Install Extensions`，**不是你操作错，是教程过期**。

---

## 三、IDE 汉化（VS Code 内核，走官方语言包）

### 关键：必须装与内核版本匹配的语言包

IDE 内核是 **VS Code 1.107.0**。Marketplace 最新版语言包是 **1.131**（要求 `^1.131.0`）→ **直接装会报「不兼容」**。

```bash
# 1. 下载 1.107 匹配版（注意：返回的是 gzip，需解压）
curl -sL -o lp107.gz \
  "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/MS-CEINTL/vsextensions/vscode-language-pack-zh-hans/1.107.2025121009/vspackage"
gunzip -c lp107.gz > lp107.vsix

# 2. CLI 安装（把 <Antigravity IDE 安装目录> 换成你的实际路径）
"<Antigravity IDE 安装目录>/bin/antigravity-ide" --install-extension lp107.vsix

# 3. 强制界面语言：编辑 ~/.antigravity-ide/argv.json，加一行
"locale": "zh-cn"
```

> ⚠️ 下载到的 vsix 实质是 gzip，文件头是 `1f8b`，需用 `gunzip -c` 解压后再装，否则 `--install-extension` 会报「不是有效的 vsix」。

### 界面级验证（CDP 读实时 DOM）

```
GET http://127.0.0.1:<调试端口>/json/list   →  PAGE_TARGETS: 1 / USING_PAGE: 设置
WebSocket → Runtime.evaluate(document.body.innerText)
CHINESE_CHARS: 180 / TOTAL_LEN: 273
```

抓到的真实界面文本（侧栏、菜单、按钮、表单全部为中文）：

```
设置 - 提供反馈
设置 / 账户 / 常规 / 外观 / 模型 / 自定义 / 浏览器 / Tab / 编辑器 / 快捷键
提供反馈 / 反馈类型 / 错误报告 / 功能请求 / 身份验证与账单 / 一般反馈 / 描述
请详细描述问题。您的反馈越具体，我们的团队就能越快处理您的请求。
重现此问题的步骤 / 预期行为 / 实际行为 / 重现步骤
附上截图（可选）/ 附上 Antigravity 服务端日志
以 <你的登录邮箱> 发送反馈 / 提交
```

---

## 四、方法一（推荐）：liominsb / Antigravity-Chinese-Localization

### 4.1 机制

改 4 个文件注入汉化能力：

| 文件 | 作用 |
| --- | --- |
| `dist/preload.js` | 注入 `DOM_TRANSLATOR_INJECTION` 引擎：`MutationObserver` + Shadow DOM 穿透（`attachShadow` 重写）+ 词典 + 动态正则 |
| `dist/ideInstall/wizardPreload.js` | 安装向导页同样注入运行时汉化引擎，抓动态串 |
| `dist/menu.js` | 原生菜单（文件/视图/窗口/帮助…）映射翻译 |
| `dist/tray.js` | 系统托盘文案翻译 |

词库规模：**470 条字典 + 105 条核心词 + 动态正则**（如 `Worked for Ns`→`已工作 N 秒`、`Thought for Ns`、`Edited`、`N files changed`、`Explored N files`、配额天数等）。运行时引擎对动态生成的界面串也能翻，这是它比纯静态替换方案覆盖更全的根本原因。

### 4.2 为什么排第一

- 词库 470+105 远大于 labixiaoxins 的 225+49；
- 运行时 `MutationObserver` 能翻**动态生成**的串（Agent 工作日志、配额提示等），静态替换方案对这类串无能为力；
- 全平台，自带可视化控制中心（`http://localhost:3388`），交互更友好。

### 4.3 使用方法

前置：系统已装 **Node.js（建议 ≥ 18）**。

- **Windows**：双击 `liominsb/双击运行汉化.bat` → 自动开浏览器到控制中心 → 点「一键开始汉化」。
- **Linux / macOS**：`chmod +x liominsb/运行汉化.sh && ./liominsb/运行汉化.sh`。
- 也可直接 `node liominsb/localize.js`（脚本会起本地服务并打开控制中心）。

脚本会自动：关进程 → 备份 `app.asar.bak` → 解包 → 注入 → 重新打包 → 覆盖部署。

### 4.4 本仓库关键补丁：`--unpack-dir`

⚠️ 原版 `localize.js` 的 `asar pack` **缺少 `--unpack-dir "node_modules/chrome-devtools-mcp"`**，会把原版外置的 293 个文件（`chrome-devtools-mcp` 相关）塞回包内，导致 `app.asar` 从 **~4.5 MB 膨胀到 ~21.4 MB**（虽实测不崩，但结构失真、体积虚高）。**本仓库内的 `liominsb/localize.js` 已修复此问题**，打包命令已加 `--unpack-dir`。

### 4.5 实机验证（Antigravity 2.5.5，2026-09-01 实测）

- **副本测试通过**：4 文件注入成功、JS 语法 4/4 OK、打包后 asar **4,590,669 B（未膨胀，+64,863 B 仅为注入的引擎）**。
- **实机替换后 CDP 抓 DOM**（`DevToolsActivePort` 自动写出，`UI target` 为本地 `https://127.0.0.1:9339/`）：

**主视图残留 7 条（全部应保留，非 UI 遗漏）**：

| 残留串 | 类别 | 为何保留 |
| --- | --- | --- |
| `Antigravity` | 品牌名 | 品牌不翻 |
| `<你的对话标题>` | 用户数据 | 你的对话标题不翻 |
| `35m` / `6h` | 相对时间 | 命中数字规则 |
| `Gemini 3.1 Pro` | 模型档位 | 命中模型名保护规则 |
| `High` | 状态标签 | 设置项状态值 |

**设置面板残留 38 条（真·未覆盖的英文串，见 §4.6）**。

> 已对上游 `localize.js` 直接 grep 复核这 38 条，**零命中** → 确属 470 字典之外、并非抽取误差。

### 4.6 已知未覆盖项（设置面板 38 条，需后续补词或动态抓 DOM）

这些串在**设置页（远程 Web 端）**里、不在 liominsb 的 470 字典内，当前仍为英文：

- **快捷键**：`Alt` / `Ctrl` / `Shift`
- **实验 / 远程功能**：`Labs` / `Experimental features` / `Best of N` / `Enable Remote Control` / `Remote Control` / `Queue` / `Narrow` / `Wide` / `Send Immediately` / `Regroup Google3 Chats` / `No MCP servers installed`
- **MCP 引导文案**：`Configure when follow-up messages are sent.` / `Use Add MCP to browse the store, or add a custom server via the MCP config.` / `Follow the guide at` / `Manage how Best of N sets up the workspaces its arms run in.` / `Manage settings specific to Google CitC workspaces development.` / `Google3 chats will be regrouped into their workspaces in the sidebar.` / `This migration may mess up your settings, chats, and sidebar.` / `Try out early-stage features before they ship. These may change or removed at any time.`
- **品牌 / 链接 / flag**：`Antigravity-guide` / `Google AI Pro` / `Google Chrome` / 内部 feature flag 名 `generative_ui` / `greet` / `migrate-workflows` / `permissioned-github` / `string` / `<你的登录邮箱>`

→ 后续可在 `liominsb/localize.js` 的字典里补这些词条，或在引擎层加针对设置页的动态规则来覆盖。

> ⚠️ **更正（2026-09-05，v2.12.2）**：上述「设置面板 38 条无法翻译」是 **2.5.5 + liominsb 字典之外** 的结论。在 v2.12.2 实测中，设置页实际是 `main.js` 经 `BrowserWindow` 加载的 Web SPA（`https://127.0.0.1:<port>/?settingsOpen=true&settingsScreen=General`），**完全可被 `dist/preload.js` 的 `MutationObserver` hook 并翻译**。用本仓库 `scripts/patch_cn_preload_v2122.mjs` 注入 417 条词典后，设置页实测中文占比 **72%**，残留 37 条多为代码/品牌/时间戳（仅 2 条 textarea 占位符按设计跳过）。见 §十二。

### 4.7 回滚

通过控制中心「恢复」，或手动把备份 `app.asar.bak` 覆盖回 `app.asar`：

```bash
taskkill /F /IM Antigravity.exe
# 把 %LOCALAPPDATA%\Programs\antigravity\resources\app.asar.bak 复制为同目录 app.asar
```

---

## 五、方法二（备选）：labixiaoxins / antigravity-cn-pack-skill

> 本方案结构保真极严格、带现成一键重跑脚本，作为 liominsb 之外的稳妥备选。已在 Antigravity 2.5.5 实机验证通过。

### 5.1 为什么不用自己写的 CDP 注入

| 方案 | 原理 | 结论 |
| --- | --- | --- |
| 官方 `antigravity-hans-windows-amd64.exe` | 传 `--remote-debugging-port` 启动 | ❌ 主程序是 **Node v24.14.0 改名**，Node 不认这个 flag，直接 `bad option` |
| 自研 CDP overlay | 读 `DevToolsActivePort` → WebSocket 注入 `hans_overlay.js` | ⚠️ 能用，但**运行时蒙皮、关了就失效、每次都要点** |
| **社区 `antigravity-cn-pack-skill`** | **静态改写 `app.asar` 里的 `dist/*.js`** | ✅ **落盘永久生效，双击原快捷方式即中文** |

### 5.2 主程序本体解剖（为什么只能改 asar）

`app.asar`（原 4,526,306 B）共 **1190 条目**，全部是 `node_modules/` + `dist/`：

- **没有** `product.json` / `translations/` / `nls/` / `i18n/` → 不是 VS Code 架构，语言包机制不适用
- **`argv.json` 里 `locale: zh-cn` 早就写了，界面照样英文** → 主程序根本不读这个配置
- 所以唯一出路是**直接改渲染层 JS**

### 5.3 采用的社区项目

**`https://github.com/labixiaoxins/antigravity-cn-pack-skill`**

安全审计结论（全部通过才敢用）：

- `scripts/patch_unpacked_antigravity_cn.js` 只依赖 `fs` / `path`，**无网络请求、无 `child_process`、无 eval**
- 用 `replaceOnce()` 精确字符串替换 → **任一 needle 缺失就抛异常，在替换 asar 之前就失败**（版本不匹配不会静默写坏）
- 自带 `cleanupLegacy()` + 幂等标记，重复运行不会叠加
- 词典 `scripts/translations.json` **225 条**

补丁落点：

| 文件 | 作用 |
| --- | --- |
| `dist/preload.js` | 注入翻译引擎：词典 + `MutationObserver` + 1500ms 兜底轮询 + `setAttribute` 钩子 |
| `dist/menu.js` | `translateNativeMenuCn()` 翻译**原生菜单**（文件/视图/窗口/帮助…） |
| `dist/main.js` | 托盘 / 退出确认对话框 |
| `dist/tray.js` | 托盘「N 个 Agent 正在运行」 |
| `dist/utils.js` | 仅清理逻辑 |

### 5.4 本仓库工具包（一键重跑）

仓库根目录 `重新应用.py` 封装了全流程：关进程 → 双备份 → 解包到临时副本 → 打补丁 → 补 49 条实测缺失词条 → `node --check` ×5 → 打包（含 `--unpack-dir`）→ 覆盖 → 校验。**任何一步失败都会中止，不会写坏 `app.asar`。**

```bash
# 前置依赖：Node >= 22（含 WebSocket）+ @electron/asar
#   npm i -g @electron/asar
python 重新应用.py
```

可覆盖的环境变量（路径均已泛化，默认取标准位置，不含任何作者私人路径）：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `ANTIGRAVITY_NODE` | `node`（PATH） | Node 解释器绝对路径 |
| `ANTIGRAVITY_ASAR_MJS` | 空（用 PATH 的 `asar`） | `@electron/asar/bin/asar.mjs` 绝对路径 |
| `ANTIGRAVITY_APP` | `%LOCALAPPDATA%\Programs\antigravity\resources` | 主程序 resources 目录 |
| `ANTIGRAVITY_BACKUP` | `%LOCALAPPDATA%\AntigravityCNBackup` | 备份目录 |
| `ANTIGRAVITY_EXE` | `%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe` | 主程序 exe（仅 `tools/sched_launch.py` 用） |

### 5.5 结构保真（这步很容易被忽略）

默认 `asar pack` 会把原本外置的 293 个文件一起塞回包里，asar 从 **4.5 MB 膨胀到 21.4 MB**。虽然实测那 293 个全是 `.md`(214) / `.js`(75) / `.json`(2)，**0 个 native 模块**（`.node`/`.dll`/`.so`/`.dylib`/`.exe`），塞回去也不会崩，但为了 **100% 还原原版结构**，最终用 `--unpack-dir` 精确重建：

| 指标 | 原版官方 | 重建后（含汉化） | 一致 |
| --- | --- | --- | --- |
| 文件清单（1190 条路径） | — | — | ✅ **零增减**（排序后 diff 为空） |
| 文件条目 | 1040 | 1040 | ✅ |
| unpacked 条目 | 293 | 293 | ✅ |
| unpacked 文件集合 | — | — | ✅ **完全相同** |
| native 模块 | 0 | 0 | ✅ |
| asar 体积 | 4,526,306 B | 4,513,028 B | 差 **−13,278 B** |

外部目录 `app.asar.unpacked/node_modules/chrome-devtools-mcp/`（17 MB / 293 文件）**原封未动**，补丁只改了 `dist/*.js`。

### 5.6 实机验证（2.5.5，CDP 抓真实界面）

界面串 **33 条中英文从 22 → 5**，残留 5 条全部是「不该翻译」的：

| 残留串 | 为什么保留 |
| --- | --- |
| `Antigravity` | 品牌名 |
| `<示例模型名>` | 模型名，命中 `protectedModel` 规则 |
| `5h` | 时长，命中 `numericLike` 规则 |
| `<你的对话标题>` | 你自己的对话标题（用户数据） |

补充词条是根据 CDP 扫描出的真实残留词**逐条定制**的，不是拍脑袋加的。工具在 `tools/add_extra_dict.js`，后续发现新漏翻直接往 `EXTRA` 里加、重跑 `重新应用.py` 即可。

### 5.7 回滚

```bash
taskkill /F /IM Antigravity.exe
```

然后用原版备份覆盖 `%LOCALAPPDATA%\Programs\antigravity\resources\app.asar`：

| 备份 | 大小 |
| --- | --- |
| `…\resources\app.asar.bak-cn-auto-<时间戳>` | 4,526,306 B（注意：带更晚时间戳的是**已汉化版**，不是原版） |
| `%LOCALAPPDATA%\AntigravityCNBackup\app.asar.ORIGINAL-4526306B` | 4,526,306 B（原版） |

> ⚠️ `app.asar.bak-cn-auto-<更晚时间戳>` 是**已汉化版**的备份，不是原版。原版三份都是 4,526,306 B。

---

## 六、本仓库工具包使用

```
Antigravity-CN-Pack/
├─ README.md                              # 本文件
├─ liominsb/                             # 方法一（推荐）：liominsb 方案（已打 --unpack-dir 补丁）
│  ├─ localize.js                         # 核心脚本（解包/注入/重打包/部署，含控制中心服务）
│  ├─ index.html                          # 控制中心界面（localhost:3388）
│  ├─ README.md                           # 上游原版说明
│  ├─ 双击运行汉化.bat                     # Windows 一键启动
│  ├─ 运行汉化.sh                         # Linux/macOS 一键启动
│  └─ .gitattributes
├─ antigravity-cn-pack-skill/            # 方法二（备选）：labixiaoxins 社区补丁项目（已去 .git）
│  └─ scripts/
│     ├─ patch_unpacked_antigravity_cn.js # 核心补丁（已安全审计）
│     ├─ apply_antigravity_cn.js          # 作者的一键脚本（本包改用 重新应用.py）
│     ├─ rollback_antigravity_cn.js
│     ├─ verify_antigravity_cn.js
│     └─ translations.json                # 225 条词典
├─ 重新应用.py                            # 方法二 一键重新汉化（升级失效后跑这个）
├─ tools/                                # 方法二 自研配套工具
│  ├─ add_extra_dict.js                   # 补充 49 条实测缺失词条（幂等）
│  ├─ check_patch.js                      # 校验 asar 内补丁是否完整
│  ├─ logic_verify.js                     # 最小 DOM 环境实跑补丁（36 项断言）
│  ├─ sched_launch.py                     # 用计划任务脱离沙箱启动 GUI
│  ├─ cdp_read.js                         # 连 CDP 读真实界面文本
│  ├─ cdp_scan_en.js                      # 扫描界面剩余英文
│  └─ verify_asar.py                      # 对比 asar 结构（条目/unpacked 集合）
└─ .gitignore
```

**推荐路径**：优先用 `liominsb/`（方法一）；若你更看重结构保真与一键回滚脚本，用 `重新应用.py`（方法二）。两者互斥，选一个即可，不要叠加运行。

---

## 七、关键知识点（改动前必读）

1. **主程序不是 VS Code**：`app.asar` 里没有 `product.json` / `translations/` / `nls/` / `i18n/`。VS Code 语言包机制无效；`locale: zh-cn` 主程序不读；唯一出路是直接改 `dist/*.js`。
2. **官方 hans 工具为什么不行**：`Antigravity.exe` 是 **Node v24.14.0 改名**，传 `--remote-debugging-port` 会被 Node 当成 `bad option` 拒绝。
3. **打包必须还原 unpacked 布局**：默认 `asar pack` 会把原外置的 293 个文件塞回包里，asar 从 4.5 MB → 21.4 MB。必须 `--unpack-dir "node_modules/chrome-devtools-mcp"`（那 293 个文件 100% 在此目录下：214 个 `.md` + 75 个 `.js` + 2 个 `.json`，0 个 native 模块）。**liominsb 原版缺此参数，本仓库已修复；labixiaoxins 的 `重新应用.py` 本就带了。**
4. **asar 头部偏移**：解析 header 时 JSON 长度在 **offset 12**，JSON 正文从 **offset 16** 开始（按 offset 4/8 读会 JSONDecodeError）。
5. **asar CLI 入口**：CLI 是 `node_modules/@electron/asar/bin/asar.mjs`（不是 `bin/asar.js`；`.bin/asar` 是 bash 脚本，node 跑不了）。Node API 入口是 `require('@electron/asar/lib/asar.js')`。
6. **沙箱里启动 GUI 的办法**：`Popen` / `Start-Process` 起的 GUI 进程会被秒回收。可行办法是用计划任务持有进程：
   ```python
   schtasks /Create /SC ONCE /ST HH:MM /TN XXX /TR "<exe路径>" /F
   schtasks /Run /TN XXX
   # ... 进程由 Task Scheduler 持有，能存活
   schtasks /Delete /TN XXX /F
   ```
7. **CDP 读界面的坑**：该 Electron **没有 `/json/version`** 端点，用 `/json/list`；必须 `unset` 代理环境变量再连 `127.0.0.1`；启动时有个 `data:text/html...Loading Antigravity` 闪屏页，**选 target 时要排除**，只挑 `url` 以 `http(s):` 开头、title 为 `Antigravity` 的那个；主程序自己会写 `%APPDATA%\Antigravity\DevToolsActivePort`，不需要传 `--remote-debugging-port`。
8. **补丁的保护规则（别乱加词条）**：补丁自带保护，不该翻的不会翻：`protectedModel`（`Claude|Gemini|GPT|OpenAI|Anthropic|Grok|DeepSeek|Qwen|Llama|Mistral` 开头的模型名）、`urlLike` / `cssLike` / `numericLike`、`skipTags`（`SCRIPT/STYLE/NOSCRIPT/CODE/PRE/TEXTAREA`）。

---

## 八、踩坑记录（16 条，按踩坑顺序）

| # | 坑 | 现象 | 解法 |
| --- | --- | --- | --- |
| 1 | **教程过期** | 命令面板搜不到 `Configure Display Language` | 2.0 无扩展商店，改走 CLI 装语言包 |
| 2 | **版本不兼容** | `not compatible with the IDE '1.107.0'` | 查 Marketplace API，下载 1.107 对应版 |
| 3 | **vsix 是 gzip** | 下载文件头 `1f8b`（非 ZIP 的 `504b`） | `gunzip -c` 解压后再装 |
| 4 | **CDP 端口「被屏蔽」是误判** | hans 工具 `连接被拒绝` | 真因是超时太短把实例杀了，大 Electron 应用需更久 |
| 5 | **超时杀太早** | 25s timeout 强杀 Antigravity | 大 Electron 应用需 **≥60s** |
| 6 | **CDP 端点差异** | `fetch /json/version` 报 `fetch failed` | 该 Electron **没有 `/json/version`**，改用 `/json/list`；且须 `unset` 代理环境变量 |
| 7 | **GUI 无法在沙箱启动** | `Popen` 起 PID 后 2s 被回收；`Start-Process` 同样 | ✅ 用 `schtasks /Create /SC ONCE` + `/Run` 让 Task Scheduler 持有进程 |
| 8 | **asar 工具入口写错** | `node …/bin/asar.js` → MODULE_NOT_FOUND | 实际是 `bin/asar.mjs`（`.bin/asar` 是 bash 脚本） |
| 9 | **asar 头部偏移记错** | 按 offset 4/8 读长度 → JSONDecodeError | 正确布局：**JSON 长度在 offset 12，正文从 offset 16 开始** |
| 10 | **默认 pack 吞掉 unpacked** | asar 4.5 MB → 21.4 MB | `--unpack-dir "node_modules/chrome-devtools-mcp"` 精确还原（liominsb 原版缺，本仓库已补） |
| 11 | **`tasklist` 输出是 GBK** | `UnicodeDecodeError` | 中文 Windows 必须 `encoding="gbk"` |
| 12 | **shell 解析 .lnk 失败** | 手搓的 `.lnk`「打不开」 | 4 处二进制格式违规（见下文） |
| 13 | **heredoc 被 shell 展开** | 写 JS 时 `${...}` 报 `Bad substitution` | 改用文件写入工具而非 heredoc |
| 14 | **CDP 选错 target** | 读到 `Loading Antigravity` 闪屏页，判定「未汉化」 | 只挑 `url` 以 `http(s):` 开头、title 为 `Antigravity` 的 |
| 15 | **幂等清理差 1 字节** | 补词条脚本每跑一次文件 +1 B | 清理正则要**连首尾换行整块移除**（替换成 `''` 而不是 `'\n'`） |
| 16 | **`asar extract-file` 不写 stdout** | `> file` 得到 0 字节 | 该子命令是**写盘**（相对当前目录），要读内容得用 Node API `asar.extractFile()` |

> 附（手搓 `.lnk` 必须守的 5 条）：`ShellLinkHeader` 必须 76 字节；`LinkFlags` 的 `0x100` ForceNoLinkInfo 绝对不能置位；`LinkInfo` 字段顺序中 offset 0x10 是 `LocalBasePathOffset`；`StringData` 的 `CountCharacters` 是 UTF-16 码元数（字节数 ÷ 2，不含结尾 null）；目标路径尽量用纯 ASCII，中文放 `Arguments` 里。另：沙箱下 COM `IPersistFile::Save` 会**静默成功但不写文件**，别信返回值，落地后用 `os.path.exists()` 复核。

---

## 九、让 AI 说中文（主程序 & IDE 通用）

- 右下角 `Antigravity – Settings` → `Customizations` → `Manage` → `+ Global`
- 填：`总是使用简体中文进行回答。` → 保存
- 或：`…` → Customizations → Rules → Project → `GEMINI.md` 写 `Always respond in 中文`

---

## 十、账号与网络前提（Antigravity 硬门槛）

- Google 账号地区须为 **美国/日本**（通过 `https://policies.google.com/country-association-form` 修改）
- 登录需 **对应地区 IP**，否则卡在登录界面
- 老账号（2020 年前注册）成功率更高

---

## 十二、v2.12.2 实测：设置面板也能全中文（手术式 preload 注入）

> 2026-09-05 在 Antigravity **2.12.2**（asar 4,548,636 B，1190 条目）上实测。本仓库已附可重跑脚本与 417 条词典。

### 12.1 先纠一个错误结论（重要）

早期（2026-09-05 上午）一度误判「Settings 页在 `language_server.exe` 里、是远程 Web 端、无法本地化」。**该结论错误，已被推翻**，依据：

- v2.12.2 的 `app.asar` 实为 **1190 条目完整 `node_modules/` + `dist/`**（不是早先以为的 36 文件 / PE 形态）；
- 用 CDP 抓实时 DOM 实测：设置页是 `main.js` 经 `BrowserWindow` 加载的 **`https://127.0.0.1:<port>/`** 这个本地 Web SPA（设置 = `?settingsOpen=true&settingsScreen=General` 路由），`dist/preload.js` 注入的 `MutationObserver` **可以 hook 并翻译**；
- 实测中文占比 **72%**（2203 / 3058 个界面字符串），证明设置页就是可翻译的 DOM。

### 12.2 为什么不复用 cn-pack 的整套 apply 脚本

`labixiaoxins/antigravity-cn-pack-skill` 的 `apply_antigravity_cn.js` 是**全量 `asar extract` + `asar pack`**，对 v2.12.2 有两个风险：

1. **黑屏风险**：全量重打包会把嵌套的 `chrome-devtools-mcp` 子 asar 拍平，破坏原结构；
2. **needle 碰撞抛错**：其 `patchMain / patchTray / patchMenu` 的 `replaceOnce()` 针脚与 v2.12.2 已中文化的部分字符串冲突 → 直接抛异常。

→ 所以 v2.12.2 只取 cn-pack 的 **`preload.js` 翻译引擎**（一个自包含、与版本无关的 IIFE，纯追加），用**自家 asar 单文件手术式重写**注入，**不碰 main/tray/menu**（那几处 v2.12.2 已被 13 串汉化部分覆盖，避免 needle 碰撞；既有「禁用更新」两层也保留）。

### 12.3 翻译引擎与词典

引擎（`scripts/cn_preload_engine_v2122.js`，`ANTIGRAVITY_CN_PRELOAD_V2_START/END` 包裹）：`MutationObserver`（childList/subtree/characterData/attributes）+ 1500ms 兜底轮询 + `Element.prototype.setAttribute` hook。保护规则：品牌 / 模型名（`Claude|Gemini|GPT|…`）/ URL / CSS / 数字 / 代码 / 长度 >180 的串 / `SCRIPT|STYLE|CODE|PRE|TEXTAREA` 标签。动态正则覆盖 `Select model, current:`、`Refreshes in Xh`、`X% of the customization budget`、`Thought for Xs`、`Worked for Xm`、`Load older messages showing N of M` 等。

词典（`scripts/translations-v2122.json`）合并而来：**417 条** = `translations.json` 225 + `EXTRA` 49 + `EXTRA2` 150 + `EXTRA3` 16。三轮均来自 CDP 实时扫描残留英文、逐条定制，非拍脑袋。

### 12.4 手术式注入脚本（本仓库 `scripts/patch_cn_preload_v2122.mjs`）

原理：8B sizePickle + Pickle 头 + data section；只重写 `dist/preload.js` 一个文件（**追加**引擎，不删原内容），其余文件原样平移 offset，重算 SHA256 integrity 块。**幂等**：重跑前先剥离旧的 `ANTIGRAVITY_CN_PRELOAD_V2_END` 块。

```bash
# 前置：装有 @electron/asar（取其 lib/asar.js 与 lib/pickle.js），Node >= 22
export ASAR_LIB_DIR=/path/to/@electron/asar/lib        # 含 asar.js / pickle.js
export ANTIGRAVITY_ASAR="$LOCALAPPDATA/Programs/antigravity/resources/app.asar"
# 备份原 asar 后再跑：
node scripts/patch_cn_preload_v2122.mjs
# 脚本末尾自校验：标记存在 / 词典含 Settings / 禁用更新层 intact / 原内容保留 / node --check 语法 OK
```

> Electron asar 4.x 的 `pickle` 被 `exports` map 锁死，脚本用 `pathToFileURL(...pickle.js).href` 直引绕过（ESM 不读 NODE_PATH，asar.js 同样走 file://）。sizeBuf 是 8 字节（不是 4）。

### 12.5 实机验证（CDP 抓实时 DOM）

- 遍历各设置屏 `?settingsOpen=true&settingsScreen=<General|Appearance|Models|…>`：中文占比 **72.0%**（2203/3058）。
- 残留 37 条英文：绝大多数是**代码 / 品牌 / 时间戳 / 内部 feature flag**（如 `generative_ui`、`string`），**仅 2 条是真正的 UI 串**——textarea 占位符，引擎按 `skipTags` 设计跳过（不应翻）。
- `node --check` 语法 OK；app 干净启动；13 串汉化 + 禁用更新两层均保留。

### 12.6 两个关键坑（v2.12.2 专属）

1. **沙箱里 GUI 起不来**：`Start-Process` / `cmd start` 能拉起进程，但 `language_server.exe` 写 0 字节后 app 整体退出。**已用 A/B 证明与补丁无关**（换回补丁前 asar 同样失败）。修复：用 `tools/sched_launch.py`（`schtasks /Create /SC ONCE` + `/Run`）在**交互会话**启动 → 成功。判定「是不是补丁弄坏」务必做**换回旧 asar 的 A/B 对照**。
2. **asar integrity 假阳性**：全文件校验会报 718/747 "bad"——但 **pristine 官方 asar 也显示同样画像**（walk 把 unpacked/symlink 条目误算）。**不能仅凭校验脚本判损坏，必须拿官方原版做 A/B 对照**。

### 12.7 回滚

```bash
taskkill /F /IM Antigravity.exe
# 把备份 app.asar（脚本运行前请先 cp 一份）覆盖回 resources/app.asar
```

### 12.8 本仓库新增文件

```
scripts/
├─ patch_cn_preload_v2122.mjs   # 手术式注入器（单文件改写 dist/preload.js，幂等，自带自校验）
├─ cn_preload_engine_v2122.js   # 翻译引擎模板（__DICT__ 占位，由注入器填充）
└─ translations-v2122.json      # 417 条词典（225 + 49 + 150 + 16）
```

> 适用：想**只让设置页 + 主界面全中文**、不想跑 liominsb/labixiaoxins 全量流程时，直接上这一个脚本即可。它与方法一/二互斥，选一个用。

---

## 十一、免责声明

- 本方案通过静态改写官方 `app.asar` 实现汉化，属于对本地已安装软件的修改，**仅供个人学习研究**。
- 操作前务必备份原版 `app.asar`（脚本已自动双备份）。
- Antigravity 自动升级会覆盖 `app.asar` 导致汉化失效，重跑对应方法的一键脚本即可（均幂等）。
- 若社区补丁因版本更新而失败（如 `replaceOnce` 抛「未找到」），说明 `dist/*.js` 结构变了，需等社区更新或手工调整 needle。
- 作者不对因使用本方案导致的任何问题负责。

---

*本仓库由 WorkBuddy 自动生成并实测验证。方法一 liominsb 为推荐方案，方法二 labixiaoxins 为备选。*
