# Antigravity CN Pack

Unofficial Chinese localization pack for Google Antigravity.

中文：Google Antigravity 原生汉化包。它通过安全地解包、补丁和重打包 `app.asar` 来汉化 UI，并保留自动备份和一键回滚能力。

> Not affiliated with Google or the Antigravity team. This project does not redistribute Antigravity binaries.

## Why This Exists

- 更完整的中文 UI：覆盖主界面、设置、模型额度、反馈、MCP、扩展市场、快捷键、托盘和退出提示。
- 更安全的方案：不修改 `language_server.exe`，不注入 DLL，不做代理，不接管网络。
- 模型名保护：`Claude`、`Gemini`、`GPT`、`OpenAI`、`Anthropic` 等名称保持原文。
- 可重复应用：Antigravity 更新后可以重新运行补丁。
- 可回滚：每次替换前都会备份原始 `app.asar`。

## Quick Start

Requirements:

- Windows
- Node.js
- Antigravity installed at the default path, or pass a custom install path

```powershell
git clone https://github.com/labixiaoxins/antigravity-cn-pack-skill.git
cd antigravity-cn-pack-skill
npm run apply
npm run verify
```

One-line install after clone:

```powershell
npm run apply && npm run verify
```

Custom Antigravity path:

```powershell
node .\scripts\apply_antigravity_cn.js "C:\Users\Administrator\AppData\Local\Programs\antigravity"
node .\scripts\verify_antigravity_cn.js "C:\Users\Administrator\AppData\Local\Programs\antigravity"
```

Rollback:

```powershell
npm run rollback
```

## What It Changes

The patcher modifies the extracted Electron app files before repacking:

- `dist/preload.js`: runtime UI text, placeholders, titles, aria labels
- `dist/menu.js`: native Electron menu labels
- `dist/main.js`: tray initial labels and quit dialog
- `dist/tray.js`: running-agent tray status

It does not modify:

- `resources/bin/language_server.exe`
- account data
- project data
- network/proxy settings
- model/provider settings

## Codex / Claude Skill

This repo also includes a reusable skill:

```text
skill/antigravity-cn-pack
```

Install locally by copying that folder into one or more skill roots:

```powershell
Copy-Item .\skill\antigravity-cn-pack "$env:USERPROFILE\.codex\skills\antigravity-cn-pack" -Recurse -Force
Copy-Item .\skill\antigravity-cn-pack "$env:USERPROFILE\.agents\skills\antigravity-cn-pack" -Recurse -Force
Copy-Item .\skill\antigravity-cn-pack "$env:USERPROFILE\.claude\skills\antigravity-cn-pack" -Recurse -Force
```

Then invoke:

```text
Use $antigravity-cn-pack to apply and verify the Antigravity Chinese localization pack.
```

## FAQ

**Will this break after Antigravity updates?**

Possibly. Run `npm run apply` again after updates. If Antigravity changes its internal file structure, the script fails before replacing `app.asar`.

**How do I recover?**

Run `npm run rollback`. Backups are named like `app.asar.bak-cn-auto-YYYYMMDD-HHMMSS`.

**Does it translate model names?**

No. Model and vendor names are intentionally protected.

**Does it phone home?**

No. The scripts run locally. `npx asar` may download the `asar` package if it is not already cached.

## Contributing

The fastest way to help is to report untranslated strings with:

- the exact English text
- where it appears in Antigravity
- your suggested Chinese translation

Please do not upload Antigravity binaries, private account data, project data, tokens, or API keys.

## GitHub Topics

Recommended topics:

```text
antigravity google-antigravity localization chinese-localization zh-cn i18n electron asar ai-ide developer-tools codex-skill claude-skill
```
