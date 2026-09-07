#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Antigravity 主程序汉化 - 一键重新应用（升级失效后重跑本脚本即可）
用法: python 重新应用.py
依赖: Node >= 22（自带 WebSocket）、@electron/asar

所有路径均已泛化，不含任何作者私人路径：
  - 主程序位置默认取 %LOCALAPPDATA%/Programs/antigravity/resources
  - Node / asar 默认取 PATH 上的 node / asar，可用环境变量覆盖（见下方 CONFIG）
"""
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime

HERE = os.path.dirname(os.path.abspath(__file__))

# ===================== CONFIG（均可用环境变量覆盖）=====================
# Node 解释器：默认 PATH 上的 node；指定绝对路径请用 ANTIGRAVITY_NODE
NODE = os.environ.get("ANTIGRAVITY_NODE", "node")
# asar 命令行入口：
#   默认 PATH 上的 `asar`（需先 `npm i -g @electron/asar` 或 `npx` 可用）
#   若你有 @electron/asar/bin/asar.mjs 绝对路径，设 ANTIGRAVITY_ASAR_MJS 指向它
ASAR_MJS = os.environ.get("ANTIGRAVITY_ASAR_MJS", "")
# 主程序 resources 目录：默认 Windows 标准安装位置
APP_RES = os.environ.get(
    "ANTIGRAVITY_APP",
    os.path.expandvars(r"%LOCALAPPDATA%\Programs\antigravity\resources"),
)
# 备份目录：放在 LocalAppData 下，重装/清理也不丢
BACKUP_DIR = os.environ.get(
    "ANTIGRAVITY_BACKUP",
    os.path.join(os.path.expandvars(r"%LOCALAPPDATA%"), "AntigravityCNBackup"),
)
# ===============================================================

APP_ASAR = os.path.join(APP_RES, "app.asar")
WORK = os.path.join(os.environ.get("TEMP", "."), "agcnp_work")

PATCH_JS = os.path.join(HERE, "antigravity-cn-pack-skill", "scripts", "patch_unpacked_antigravity_cn.js")
EXTRA_JS = os.path.join(HERE, "tools", "add_extra_dict.js")
CHECK_JS = os.path.join(HERE, "tools", "check_patch.js")

KW = dict(capture_output=True, text=True, encoding="gbk", errors="replace")


def asar_cmd(*args):
    # ASAR_MJS 给定时前置 NODE 调用；否则用 PATH 上的 asar CLI
    if ASAR_MJS:
        return [NODE, ASAR_MJS, *args]
    return ["asar", *args]


def have(cmd):
    # 绝对路径 / 相对路径文件：直接判存在
    if os.path.isabs(cmd) or os.sep in cmd:
        return os.path.exists(cmd)
    # 否则当作 PATH 上的命令
    return shutil.which(cmd) is not None


def run(args, **kw):
    return subprocess.run(args, **{**KW, **kw})


def step(msg):
    print("\n" + "=" * 58)
    print("▶ " + msg)
    print("=" * 58)


def fail(msg):
    print("❌ " + msg)
    sys.exit(1)


def main():
    # 依赖检查（仅校验“文件路径类”依赖与可执行命令）
    if not have(NODE):
        fail(f"找不到 Node：{NODE}\n      请安装 Node >= 22，或设环境变量 ANTIGRAVITY_NODE 指向 node.exe")
    if ASAR_MJS:
        if not os.path.exists(ASAR_MJS):
            fail(f"找不到 asar.mjs：{ASAR_MJS}\n      请确认 ANTIGRAVITY_ASAR_MJS 路径，或清空它改用 PATH 上的 asar")
    elif not have("asar"):
        fail("找不到 asar 命令。请先 `npm i -g @electron/asar`，或设 ANTIGRAVITY_ASAR_MJS 指向 asar.mjs")
    for p in (APP_ASAR, PATCH_JS, EXTRA_JS):
        if not os.path.exists(p):
            fail(f"依赖缺失: {p}")

    # 1) 关进程
    step("1/7 关闭 Antigravity")
    run(["taskkill", "/F", "/IM", "Antigravity.exe"])
    time.sleep(3)

    # 2) 备份原版（仅当当前不是已汉化版本时）
    step("2/7 备份")
    os.makedirs(BACKUP_DIR, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    in_app_bak = os.path.join(APP_RES, f"app.asar.bak-cn-auto-{stamp}")
    shutil.copy2(APP_ASAR, in_app_bak)
    shutil.copy2(APP_ASAR, os.path.join(BACKUP_DIR, f"app.asar.bak-{stamp}"))
    print(f"   ✅ {in_app_bak}")
    print(f"   ✅ {BACKUP_DIR}\\app.asar.bak-{stamp}")

    # 3) 解包到工作副本
    step("3/7 解包到临时副本（不动真身）")
    shutil.rmtree(WORK, ignore_errors=True)
    os.makedirs(WORK, exist_ok=True)
    r = run(asar_cmd("extract", APP_ASAR, WORK))
    if r.returncode != 0:
        fail("解包失败\n" + (r.stdout or "") + (r.stderr or ""))
    print("   ✅ 解包完成")

    # 4) 打社区补丁（已汉化则跳过，保证幂等）
    step("4/7 应用社区汉化补丁")
    preload_path = os.path.join(WORK, "dist", "preload.js")
    with open(preload_path, encoding="utf-8", errors="replace") as fh:
        already = "ANTIGRAVITY_CN_PRELOAD_V2" in fh.read()
    if already:
        print("   ℹ️ 检测到已含社区补丁，跳过重复打补丁（幂等）")
    else:
        r = run([NODE, PATCH_JS, WORK])
        print((r.stdout or "").strip())
        if r.returncode != 0:
            fail("补丁失败 —— 通常是 Antigravity 版本与补丁不匹配（精确字符串未命中）。\n"
                 "      已备份原版，直接还原即可；或等社区更新 patch 脚本。\n" + (r.stderr or ""))

    # 5) 补词条 + 语法校验
    step("5/7 注入补充词条 + node --check")
    r = run([NODE, EXTRA_JS, os.path.join(WORK, "dist", "preload.js")])
    print((r.stdout or "").strip())
    if r.returncode != 0:
        fail("补充词条注入失败\n" + (r.stderr or ""))
    for f in ("preload.js", "menu.js", "main.js", "tray.js", "utils.js"):
        c = run([NODE, "--check", os.path.join(WORK, "dist", f)])
        print(f"   {'✅' if c.returncode == 0 else '❌'} node --check dist/{f}")
        if c.returncode != 0:
            fail("语法校验失败，已中止（app.asar 未被改动）")

    # 6) 重新打包（--unpack-dir 还原原版外置布局）
    step("6/7 重新打包 asar")
    out = os.path.join(os.path.dirname(WORK), "agcnp_new.asar")
    for junk in (out, out + ".unpacked"):
        if os.path.isdir(junk):
            shutil.rmtree(junk, ignore_errors=True)
        elif os.path.exists(junk):
            os.remove(junk)
    r = run(asar_cmd("pack", WORK, out, "--unpack-dir", "node_modules/chrome-devtools-mcp"))
    if r.returncode != 0 or not os.path.exists(out):
        fail("打包失败\n" + (r.stdout or "") + (r.stderr or ""))
    print(f"   ✅ {out}  ({os.path.getsize(out):,} B)")

    # 7) 覆盖 + 校验
    step("7/7 覆盖并校验")
    shutil.copy2(out, APP_ASAR)
    c = run([NODE, CHECK_JS, APP_ASAR])
    print((c.stdout or "").strip())
    if c.returncode != 0:
        fail("覆盖后校验失败 —— 正在还原备份")
        shutil.copy2(in_app_bak, APP_ASAR)
        fail("已还原备份")

    # 清理
    shutil.rmtree(WORK, ignore_errors=True)
    for junk in (out, out + ".unpacked"):
        if os.path.isdir(junk):
            shutil.rmtree(junk, ignore_errors=True)
        elif os.path.exists(junk):
            os.remove(junk)

    print("\n" + "=" * 58)
    print("✅ 汉化完成。双击桌面 Antigravity 快捷方式即可看到中文界面。")
    print("   回滚: 用 " + in_app_bak + " 覆盖 app.asar")
    print("=" * 58)


if __name__ == "__main__":
    main()
