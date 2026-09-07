// 扫描真实界面里所有仍为英文的 UI 串（文本节点 + aria-label/title/placeholder）
const fs = require('fs');
const path = require('path');
const DAP = path.join(process.env.APPDATA, 'Antigravity', 'DevToolsActivePort');
const port = parseInt(fs.readFileSync(DAP, 'utf8').split('\n')[0].trim(), 10);

const OUT = path.join(process.env.APPDATA, 'Antigravity', 'cdp_scan_en.txt');
const lines = [];
const log = (s) => { lines.push(s); fs.writeFileSync(OUT, lines.join('\n'), 'utf8'); };

(async () => {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) { log('NO_PAGE'); process.exit(5); }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; setTimeout(() => j(new Error('to')), 8000); });
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res) => {
    const i = ++id; pending.set(i, res);
    ws.send(JSON.stringify({ id: i, method, params }));
    setTimeout(() => { if (pending.has(i)) { pending.delete(i); res(null); } }, 15000);
  });
  const ev = async (e) => {
    const r = await send('Runtime.evaluate', { expression: e, returnByValue: true });
    if (!r || r.error || !r.result) return null;
    if (r.result.exceptionDetails) return { __ex: r.result.exceptionDetails.text };
    return r.result.result.value;
  };

  const scan = await ev(`(() => {
    const out = new Set();
    const skip = new Set(['SCRIPT','STYLE','NOSCRIPT','CODE','PRE','TEXTAREA']);
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n){ const p=n.parentElement; if(!p||skip.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        if(!n.nodeValue||!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT; return NodeFilter.FILTER_ACCEPT; }
    });
    while (w.nextNode()) out.add(w.currentNode.nodeValue.trim());
    for (const a of ['aria-label','title','placeholder','data-tooltip','alt']) {
      document.querySelectorAll('['+a+']').forEach(el => { const v=(el.getAttribute(a)||'').trim(); if(v) out.add(v); });
    }
    return Array.from(out);
  })()`);

  if (!Array.isArray(scan)) { log('扫描失败: ' + JSON.stringify(scan)); process.exit(1); }

  const isEn = (s) => /[A-Za-z]/.test(s) && !/[\u4e00-\u9fff]/.test(s);
  const en = scan.filter(isEn).sort();
  log('界面总串数: ' + scan.length + '   仍为英文: ' + en.length);
  log('='.repeat(60));
  en.forEach((s) => log(s.replace(/\s+/g, ' ')));

  ws.close();
  process.exit(0);
})().catch((e) => { log('异常: ' + e.stack); process.exit(9); });
