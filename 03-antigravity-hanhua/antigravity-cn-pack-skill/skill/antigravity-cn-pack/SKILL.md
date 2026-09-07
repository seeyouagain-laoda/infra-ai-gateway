---
name: antigravity-cn-pack
description: Apply, verify, or roll back an unofficial Chinese localization pack for Google Antigravity on Windows. Use when the user wants Antigravity UI translated to Chinese, Antigravity Chinese language pack maintenance, or recovery after Antigravity updates.
metadata:
  short-description: Localize Google Antigravity to Chinese
---

# Antigravity CN Pack

Use this skill to manage the native ASAR-based Chinese localization pack for Google Antigravity.

## Safety Rules

- Do not restore or use the old proxy-based localization approach.
- Do not modify `language_server.exe`.
- Do not change Antigravity accounts, model providers, projects, proxy settings, or network settings.
- Preserve model and vendor names such as `Claude`, `Gemini`, `GPT`, `OpenAI`, and `Anthropic`.
- Treat `app.asar.bak-cn-auto-*` as rollback points. Never delete them unless the user explicitly asks.

## Default Paths

- Default Antigravity root: `C:\Users\Administrator\AppData\Local\Programs\antigravity`
- Default ASAR: `C:\Users\Administrator\AppData\Local\Programs\antigravity\resources\app.asar`

If the user gives a different Antigravity install path, pass it as the first argument to the scripts.

## Apply

Run:

```powershell
node "<skill-dir>\scripts\apply_antigravity_cn.js"
```

Custom install path:

```powershell
node "<skill-dir>\scripts\apply_antigravity_cn.js" "C:\Path\To\antigravity"
```

The apply script:

- stops Antigravity and `language_server.exe`
- extracts `app.asar`
- injects the Chinese localization patch
- runs `node --check` on patched JavaScript files
- backs up the current `app.asar`
- replaces `app.asar`
- starts Antigravity

## Verify

Run:

```powershell
node "<skill-dir>\scripts\verify_antigravity_cn.js"
```

Verification must confirm:

- `ANTIGRAVITY_CN_PRELOAD_V2`
- `ANTIGRAVITY_CN_NATIVE_MENU_V1`
- `ANTIGRAVITY_CN_MAIN_TEXT_V1`
- `ANTIGRAVITY_CN_TRAY_TEXT_V1`
- no legacy `ANTIGRAVITY_CN_PRELOAD_V1`
- no legacy `ANTIGRAVITY_CN_PACK_V*`

## Roll Back

Run:

```powershell
node "<skill-dir>\scripts\rollback_antigravity_cn.js"
```

The rollback script restores the newest `app.asar.bak-cn-auto-*` backup and restarts Antigravity.

To restore a specific backup:

```powershell
node "<skill-dir>\scripts\rollback_antigravity_cn.js" "C:\Path\To\antigravity" "C:\Path\To\app.asar.bak-cn-auto-YYYYMMDD-HHMMSS"
```

## Recommended Workflow

1. Check that Antigravity exists at the expected path.
2. Run `node --check` on the scripts if they were changed.
3. Apply the patch.
4. Run verification.
5. Report backup path, verification result, and whether Antigravity started.

