// patch_cn_preload_v2122.mjs
// 把 cn-pack 风格的 MutationObserver 翻译引擎注入 dist/preload.js（asar 单文件 surgical rebuild）。
// 仅追加，不动 main/tray/menu。保留既有汉化层与禁用更新层（它们在其他 dist/*.js，本脚本只改 preload.js）。
//
// 用法：
//   ASAR_LIB_DIR=/path/to/@electron/asar/lib ANTIGRAVITY_ASAR=/path/to/app.asar \
//     node patch_cn_preload_v2122.mjs
// 或把 app.asar 路径作为第一个参数传入：node patch_cn_preload_v2122.mjs /path/to/app.asar
//
// 环境变量：
//   ASAR_LIB_DIR   必须。含 asar.js / pickle.js 的目录（@electron/asar 的 lib 子目录）。
//                 Electron asar 4.x 的 pickle 被 exports map 锁死，须用 file:// 直引，不能走普通子路径 import。
//   ANTIGRAVITY_ASAR  app.asar 绝对路径（也可用第一个命令行参数）。
//   ANTIGRAVITY_NODE  node 解释器绝对路径（默认取 PATH 的 node）。仅用于 --check 自校验。
//
// 配套文件（与本脚本同目录）：
//   cn_preload_engine_v2122.js   引擎模板（含 __DICT__ 占位符）
//   translations-v2122.json      417 条词典（translations.json 225 + EXTRA 49 + EXTRA2 150 + EXTRA3 16）

import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import cr from 'node:crypto';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));

const asarLibDir = process.env.ASAR_LIB_DIR;
if (!asarLibDir) {
  console.error('请设置 ASAR_LIB_DIR 指向 @electron/asar/lib 目录（含 asar.js / pickle.js）。');
  process.exit(2);
}
const asarURL = pathToFileURL(join(asarLibDir, 'asar.js')).href;
const pickleURL = pathToFileURL(join(asarLibDir, 'pickle.js')).href;
const api = await import(asarURL);
const { Pickle } = await import(pickleURL);

const ASAR = process.argv[2] || process.env.ANTIGRAVITY_ASAR;
if (!ASAR) {
  console.error('用法：node patch_cn_preload_v2122.mjs <app.asar 路径> 或设置 ANTIGRAVITY_ASAR 环境变量。');
  process.exit(2);
}
if (!fs.existsSync(ASAR)) { console.error('asar not found:', ASAR); process.exit(2); }

// —— 1) 读词典（已合并 417 条）——
const dictPath = join(__dirname, 'translations-v2122.json');
const dict = JSON.parse(fs.readFileSync(dictPath, 'utf8'));
console.log(`dict entries: ${Object.keys(dict).length}`);

// —— 2) 读引擎模板，替换 __DICT__ 占位 ——
const engineTpl = fs.readFileSync(join(__dirname, 'cn_preload_engine_v2122.js'), 'utf8');
if (!engineTpl.includes('__DICT__')) throw new Error('engine template missing __DICT__ placeholder');
const engine = engineTpl.replace('__DICT__', JSON.stringify(dict, null, 2));

// —— 3) 读原 asar + 解析 header ——
const orig = fs.readFileSync(ASAR);
const sizeBuf = orig.subarray(0, 8);
const headerBufLen = Pickle.createFromBuffer(sizeBuf).createIterator().readUInt32();
const headerBuf = orig.subarray(8, 8 + headerBufLen);
const header = JSON.parse(Pickle.createFromBuffer(headerBuf).createIterator().readString());
const dataStart = 8 + headerBufLen;
const dataSection = orig.subarray(dataStart);

// —— 4) 扁平化 + 定位 dist/preload.js ——
function flat(node, base, acc) {
  for (const [name, child] of Object.entries(node.files)) {
    const p = base ? base + '/' + name : name;
    if (child.files) { acc.push({ path: p, node: child, kind: 'dir' }); flat(child, p, acc); }
    else if (child.link) acc.push({ path: p, node: child, kind: 'sym' });
    else if (child.unpacked) acc.push({ path: p, node: child, kind: 'unp' });
    else acc.push({ path: p, node: child, kind: 'fil' });
  }
  return acc;
}
const acc = []; flat(header, '', acc);
function resolve(p) {
  for (const e of acc) if (e.path === p) {
    if (e.kind === 'sym') return resolve(e.node.link);
    return e;
  }
  return null;
}
const tgt = resolve('dist/preload.js');
if (!tgt || tgt.kind !== 'fil') throw new Error('dist/preload.js not a regular file');
const tgtNode = tgt.node;
const tgtOrigOffset = parseInt(tgtNode.offset);
const oldSize = tgtNode.size;

let oldText = dataSection.subarray(tgtOrigOffset, tgtOrigOffset + oldSize).toString('utf8');
// 幂等升级：若已有旧引擎块，先剥离再重新注入（便于扩充词典后重跑）
const END_MARK = '// ANTIGRAVITY_CN_PRELOAD_V2_END';
if (oldText.includes('ANTIGRAVITY_CN_PRELOAD_V2_START')) {
  const s = oldText.indexOf('// ANTIGRAVITY_CN_PRELOAD_V2_START');
  const e = oldText.indexOf(END_MARK);
  if (s >= 0 && e > s) {
    oldText = oldText.slice(0, s) + oldText.slice(e + END_MARK.length);
    console.log('ℹ️ 已剥离旧引擎块，将用新词典重新注入。');
  }
}

// —— 5) 追加引擎（保留原内容，只增不减）——
const newText = oldText.replace(/\s*$/, '') + '\n' + engine;
const newBuf = Buffer.from(newText, 'utf8');
const newSize = newBuf.length;
const sizeDelta = newSize - oldSize;
console.log(`preload.js: ${oldSize} -> ${newSize} (delta ${sizeDelta > 0 ? '+' : ''}${sizeDelta})`);

// —— 6) 重算 integrity ——
const oldInt = tgtNode.integrity;
const algorithm = (oldInt && oldInt.algorithm) || 'SHA256';
const blockSize = (oldInt && oldInt.blockSize) || 4 * 1024 * 1024;
const blocks = [];
for (let off = 0; off < newSize; off += blockSize) {
  const slice = newBuf.subarray(off, Math.min(off + blockSize, newSize));
  blocks.push(cr.createHash('sha256').update(slice).digest('hex'));
}
tgtNode.integrity = {
  algorithm,
  blockSize,
  hash: cr.createHash('sha256').update(newBuf).digest('hex'),
  blocks,
};
tgtNode.size = newSize;

// —— 7) 用原 offset 顺序重建 data section，平移 after-target offset ——
const fileEntries = acc.filter(e => e.kind === 'fil')
  .sort((a, b) => parseInt(a.node.offset) - parseInt(b.node.offset));
const dataParts = fileEntries.map(e => {
  if (e === tgt) return newBuf;
  const o = parseInt(e.node.offset);
  return dataSection.subarray(o, o + e.node.size);
});
const newDataSection = Buffer.concat(dataParts);

for (const e of acc) {
  if (e.kind === 'fil' && BigInt(e.node.offset) > BigInt(tgtNode.offset)) {
    e.node.offset = (BigInt(e.node.offset) + BigInt(sizeDelta)).toString();
  }
}

// —— 8) headerBuf 重序列化（长度变化再平移）——
const hp = Pickle.createEmpty();
hp.writeString(JSON.stringify(header));
let newHeaderBuf = hp.toBuffer();
let hsDelta = newHeaderBuf.length - headerBufLen;
if (hsDelta !== 0) {
  for (const e of acc) {
    if (e.kind === 'fil') e.node.offset = (BigInt(e.node.offset) + BigInt(hsDelta)).toString();
  }
  const hp2 = Pickle.createEmpty();
  hp2.writeString(JSON.stringify(header));
  if (hp2.toBuffer().length !== newHeaderBuf.length) throw new Error('header pickle size unstable; abort');
}

// —— 9) sizeBuf + 拼装落盘 ——
const sp = Pickle.createEmpty();
sp.writeUInt32(newHeaderBuf.length);
const newSizeBuf = sp.toBuffer();
const newAsar = Buffer.concat([newSizeBuf, newHeaderBuf, newDataSection]);
fs.writeFileSync(ASAR, newAsar);

// —— 10) 自校验 ——
const reread = api.extractFile(ASAR, 'dist/preload.js').toString('utf8');
const nodeBin = process.env.ANTIGRAVITY_NODE || 'node';
const checks = {
  markerPresent: reread.includes('ANTIGRAVITY_CN_PRELOAD_V2_START'),
  dictHasSettings: reread.includes('"Settings": "设置"') || reread.includes('"Settings":"设置"'),
  noUpdateLayerIntact: (() => {
    try {
      const u = api.extractFile(ASAR, 'dist/updater.js').toString('utf8');
      return u.includes('setAutoUpdateChecking(false);') && u.includes('autoDownload = false;');
    } catch { return true; } // 无 updater.js 时跳过（视作未改动）
  })(),
  origContentPreserved: reread.includes("exposeInMainWorld('ide', ideAPI)") || reread.includes('exposeInMainWorld("ide", ideAPI)'),
  syntaxOk: (() => {
    const tmp = join(os.tmpdir(), '_preload_recheck.js');
    fs.writeFileSync(tmp, reread);
    const r = (() => { try { execSync(`"${nodeBin}" --check ${tmp}`); return true; } catch { return false; } })();
    fs.unlinkSync(tmp);
    return r;
  })(),
};
const ok = Object.values(checks).every(Boolean);

console.log(JSON.stringify({
  ok,
  archive: { old: orig.length, new: newAsar.length, sha256: cr.createHash('sha256').update(newAsar).digest('hex') },
  preload: { oldSize, newSize, sizeDelta },
  headerBufLen: { old: headerBufLen, new: newHeaderBuf.length, delta: hsDelta },
  checks,
}, null, 2));
if (!ok) { console.error('SELF-CHECK FAILED'); process.exit(3); }
console.log('✅ preload.js 翻译引擎注入完成（保留既有汉化 + 禁用更新层）。');
