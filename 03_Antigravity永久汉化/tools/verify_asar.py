import json, struct, os

def load(p):
    with open(p,'rb') as f:
        f.read(12)                                   # pickle 头
        n = struct.unpack('<I', f.read(4))[0]        # offset 12: JSON 字节数
        raw = f.read(n)                              # offset 16: JSON 正文
    return json.loads(raw.decode('utf-8')), os.path.getsize(p)

def walk(node, prefix, out):
    for name, v in node.get('files', {}).items():
        p = f"{prefix}/{name}"
        if v.get('files'):
            walk(v, p, out)
        else:
            out.append((p, v.get('unpacked', False)))

def report(path, label):
    hdr, fsize = load(path)
    out=[]; walk(hdr, '', out)
    unp=[x for x in out if x[1]]
    exts={}
    for p,_ in unp:
        e=os.path.splitext(p)[1].lower() or '(none)'
        exts[e]=exts.get(e,0)+1
    nat=[p for p,_ in unp if os.path.splitext(p)[1].lower() in ('.node','.dll','.so','.dylib','.exe')]
    print(f"--- {label} ---")
    print(f"  asar 体积      : {fsize:,} B")
    print(f"  文件条目        : {len(out)}")
    print(f"  unpacked 条目   : {len(unp)}")
    print(f"  unpacked 扩展名  : {exts}")
    print(f"  native 模块     : {len(nat)}")
    return set(p for p,_ in unp), len(out), fsize

import sys
# 用法：python verify_asar.py <原版备份 asar> <重建后 asar>
# 默认退化为相对文件名（手动指定路径即可，避免硬编码个人目录）
orig = sys.argv[1] if len(sys.argv) > 1 else "app.asar.ORIGINAL"  # ① 原版官方备份
new  = sys.argv[2] if len(sys.argv) > 2 else "app.asar"          # ② 重建后(含中文补丁)
u_o,n_o,s_o = report(orig, "① 原版官方备份")
print()
u_n,n_n,s_n = report(new, "② 重建后(含中文补丁)")

print()
print("=== 结构对比 ===")
print(f"  文件条目一致        : {n_o==n_n}   ({n_o} vs {n_n})")
print(f"  unpacked 集合一致    : {u_o==u_n}")
if u_o!=u_n:
    print("    仅原版:", sorted(u_o-u_n)[:6]); print("    仅新版:", sorted(u_n-u_o)[:6])
print(f"  体积差              : {s_n-s_o:+,} B")
