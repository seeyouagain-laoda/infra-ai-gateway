const asar = require(process.env.ASAR_LIB_DIR ? require('path').join(process.env.ASAR_LIB_DIR, 'asar.js') : '@electron/asar/lib/asar.js');
const A = process.env.ANTIGRAVITY_ASAR || process.argv[2] || (process.env.LOCALAPPDATA ? require('path').join(process.env.LOCALAPPDATA, 'Programs/antigravity/resources/app.asar') : 'app.asar');

const targets = ['dist/preload.js', 'dist/menu.js', 'dist/main.js', 'dist/tray.js', 'dist/utils.js'];
const markers = {
  'dist/preload.js': ['ANTIGRAVITY_CN_PRELOAD_V2', 'MutationObserver', '新对话', '对话历史', '定时任务', '设置'],
  'dist/menu.js': ['translateNativeMenuCn', '文件', '视图', '窗口', '帮助', '退出'],
  'dist/main.js': ['确认退出', '确定要退出吗？', '可能仍有 Agent 或后台任务正在运行。', '新窗口'],
  'dist/tray.js': ['个 Agent 正在运行', '没有正在运行的 Agent'],
};

let allOk = true;
for (const t of targets) {
  let buf;
  try { buf = asar.extractFile(A, t); }
  catch (e) { console.log('❌ ' + t + ': 读取失败 ' + e.message); allOk = false; continue; }
  const s = buf.toString('utf8');
  const cn = (s.match(/[\u4e00-\u9fff]/g) || []).length;
  console.log('── ' + t + '  (' + buf.length.toLocaleString('en-US') + ' B, 中文字符 ' + cn + ')');
  const ms = markers[t];
  if (ms) {
    for (const m of ms) {
      const ok = s.includes(m);
      if (!ok) allOk = false;
      console.log('     ' + (ok ? '✅' : '❌') + ' ' + m);
    }
  } else {
    console.log('     (无 marker 要求)');
  }
}
console.log('');
console.log(allOk ? '✅ 全部补丁标记校验通过 —— 中文补丁已正确封入 asar' : '❌ 有标记缺失');
process.exit(allOk ? 0 : 1);
