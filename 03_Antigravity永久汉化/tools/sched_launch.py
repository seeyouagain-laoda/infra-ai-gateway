import subprocess, datetime, os, sys, time

# 主程序 exe 路径：默认 Windows 标准安装位置，可用 ANTIGRAVITY_EXE 覆盖（已泛化，不含私人路径）
EXE = os.environ.get(
    "ANTIGRAVITY_EXE",
    os.path.expandvars(r"%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe"),
)
TN = "AntigravityCnVerify"
KW = dict(capture_output=True, text=True, encoding="gbk", errors="replace")


def run(args):
    r = subprocess.run(args, **KW)
    return r.returncode, (r.stdout or "").strip(), (r.stderr or "").strip()


def alive():
    rc, out, _ = run(["tasklist", "/FI", "IMAGENAME eq Antigravity.exe"])
    return "Antigravity.exe" in out


def port():
    p = os.path.join(os.environ.get("APPDATA", ""), "Antigravity", "DevToolsActivePort")
    try:
        return int(open(p, encoding="utf-8").read().split()[0])
    except Exception:
        return None


st = (datetime.datetime.now() + datetime.timedelta(minutes=1)).strftime("%H:%M")
print("计划任务启动时间:", st)

rc, out, err = run(["schtasks", "/Create", "/SC", "ONCE", "/ST", st,
                    "/TN", TN, "/TR", EXE, "/F"])
print("Create RC=", rc)
print(out)
if err:
    print("ERR:", err)

if rc != 0:
    sys.exit(1)

print("\n立即触发 /Run ...")
rc, out, err = run(["schtasks", "/Run", "/TN", TN])
print("Run RC=", rc, out, err)

print("\n等待最多 100s 观察进程是否存活 ...")
ok = False
for i in range(50):
    time.sleep(2)
    if alive():
        print(f"  t+{(i+1)*2}s  Antigravity.exe 存活 ✅")
        ok = True
        break

if ok:
    print("\n等待 CDP 端口 ...")
    for i in range(40):
        q = port()
        if q:
            print("  DevToolsActivePort =", q)
            break
        time.sleep(2)
    else:
        print("  未拿到端口")

# 清理计划任务
rc, out, err = run(["schtasks", "/Delete", "/TN", TN, "/F"])
print("\n清理计划任务 RC=", rc, out, err)

sys.exit(0 if ok else 2)
