// 连接真实运行的 Antigravity 主程序 CDP，读取界面文本，判定是否汉化
const fs = require('fs');
const path = require('path');

const DAP = path.join(process.env.APPDATA, 'Antigravity', 'DevToolsActivePort');
const port = parseInt(fs.readFileSync(DAP, 'utf8').split('\n')[0].trim(), 10);
console.log('DevToolsActivePort =', port);

const OUT = path.join(process.env.APPDATA, 'Antigravity', 'cdp_verify.txt');
const lines = [];
const log = (s) => { lines.push(s); console.log(s); fs.writeFileSync(OUT, lines.join('\n'), 'utf8'); };

(async () => {
  // 取 targets
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  const targets = await res.json();
  log('target 数量: ' + targets.length);
  for (const t of targets) log(`  [${t.type}] ${t.title}  ${t.url.slice(0, 80)}`);

  // 必须排除启动闪屏页（data:text/html...Loading Antigravity）
  const pages = targets.filter((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  const page =
    pages.find((t) => /^https?:/.test(t.url || '')) ||
    pages.find((t) => t.title === 'Antigravity') ||
    pages[0];
  if (!page) { log('❌ 无 page target'); process.exit(5); }
  log('\n使用 page: ' + page.title);

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; setTimeout(() => j(new Error('ws timeout')), 8000); });
  log('WebSocket 已连接');

  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((resolve) => {
    const i = ++id;
    pending.set(i, resolve);
    ws.send(JSON.stringify({ id: i, method, params }));
    setTimeout(() => { if (pending.has(i)) { pending.delete(i); resolve(null); } }, 15000);
  });

  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (!r) return null;
    if (r.error) return { __error: r.error.message };
    if (r.result && r.result.exceptionDetails) return { __exception: r.result.exceptionDetails.text };
    return r.result && r.result.result ? r.result.result.value : null;
  };

  // 1) 页面标题 + URL
  log('\n=== 页面信息 ===');
  log('title: ' + await evalJs('document.title'));
  log('url  : ' + await evalJs('location.href'));

  // 2) patch 是否已安装（本项目是静态补丁，无 __antigravityZhPatchInstalled flag，查特征）
  log('\n=== 补丁运行状态 ===');
  log('preload 翻译引擎标记: ' + await evalJs(
    `(() => { try { return typeof MutationObserver !== 'undefined' ? 'MutationObserver 可用' : '不可用'; } catch(e){ return 'ERR '+e.message; } })()`));

  // 3) body 全文
  log('\n=== document.body.innerText ===');
  const text = await evalJs('document.body ? document.body.innerText : "(no body)"');
  const cn = (text || '').split('').filter((c) => c >= '\u4e00' && c <= '\u9fff').length;
  log('长度=' + (text || '').length + '  中文字符=' + cn);
  log('-' .repeat(60));
  (text || '').split('\n').slice(0, 60).forEach((l) => { if (l.trim()) log('  | ' + l.trim().slice(0, 110)); });
  log('-' .repeat(60));

  // 4) 侧栏 / 导航项文本
  log('\n=== 界面可交互元素文本 ===');
  const items = await evalJs(
    `Array.from(document.querySelectorAll('button,a,[role=button],[role=tab],nav *'))
       .map(e => (e.innerText||'').trim() || (e.getAttribute('aria-label')||'') || (e.getAttribute('title')||''))
       .filter(Boolean).slice(0, 80)`);
  if (Array.isArray(items)) items.forEach((s) => log('  · ' + String(s).replace(/\s+/g, ' ').slice(0, 90)));

  // 5) 判定
  const zh = ['新对话', '对话历史', '定时任务', '项目', '设置', '反馈', '自定义', '审查'];
  const en = ['New Conversation', 'Conversation History', 'Scheduled Tasks', 'Projects', 'Settings'];
  const hitZh = zh.filter((k) => (text || '').includes(k));
  const hitEn = en.filter((k) => (text || '').includes(k));
  log('\n=== 判定 ===');
  log('命中中文: ' + JSON.stringify(hitZh));
  log('残留英文: ' + JSON.stringify(hitEn));

  let verdict;
  if (hitZh.length >= 3 && hitEn.length === 0) verdict = 'CN_OK';
  else if (hitZh.length > 0) verdict = 'CN_PARTIAL';
  else verdict = 'CN_NONE';
  log('RESULT=' + verdict);
  log(verdict === 'CN_OK' ? '✅ 真实界面已汉化' : (verdict === 'CN_PARTIAL' ? '⚠️ 部分汉化' : '❌ 未汉化'));

  ws.close();
  process.exit(verdict === 'CN_OK' ? 0 : 1);
})().catch((e) => { log('异常: ' + e.stack); process.exit(9); });
