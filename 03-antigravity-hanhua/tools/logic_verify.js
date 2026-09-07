/**
 * 逻辑级实跑验证：把 asar 里已汉化的 preload.js / menu.js 补丁代码
 * 在最小 DOM 环境里真实执行，验证英文界面串 -> 中文。
 * 这不是"文件里有中文"的静态检查，而是跑补丁函数看输出。
 */
const fs = require('fs');
const vm = require('vm');
const asar = require(process.env.ASAR_LIB_DIR ? require('path').join(process.env.ASAR_LIB_DIR, 'asar.js') : '@electron/asar/lib/asar.js');

const A = process.env.ANTIGRAVITY_ASAR || (process.env.LOCALAPPDATA ? require('path').join(process.env.LOCALAPPDATA, 'Programs/antigravity/resources/app.asar') : 'app.asar');
const preload = asar.extractFile(A, 'dist/preload.js').toString('utf8');
const menu = asar.extractFile(A, 'dist/menu.js').toString('utf8');

function slice(src, s, e) {
  const i = src.indexOf(s);
  const j = src.indexOf(e);
  if (i < 0 || j < 0) throw new Error('未找到补丁标记: ' + s);
  return src.slice(i, j + e.length);
}

// ---------- 最小 DOM ----------
class TextNode {
  constructor(v) { this.nodeValue = v; this.nodeType = 3; this.parentElement = null; }
  get textContent() { return this.nodeValue; }
}
class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.nodeType = 1;
    this.childNodes = [];
    this.attrs = new Map();
    this.parentElement = null;
    this.value = undefined;
  }
  appendChild(n) { n.parentElement = this; this.childNodes.push(n); return n; }
  hasAttribute(n) { return this.attrs.has(n); }
  getAttribute(n) { return this.attrs.get(n); }
  setAttribute(n, v) { this.attrs.set(n, String(v)); }
  descendants(out = []) {
    for (const c of this.childNodes) {
      if (c.nodeType === 1) { out.push(c); c.descendants(out); }
    }
    return out;
  }
  querySelectorAll() { return this.descendants(); }
  get innerText() {
    let s = '';
    const rec = (n) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) s += c.nodeValue + '\n';
        else rec(c);
      }
    };
    rec(this);
    return s;
  }
}

const html = new Element('html');
const body = new Element('body');
html.appendChild(body);

// 界面里的英文文案（取自用户截图的侧栏 / 菜单 / 输入框）
const UI_TEXT = [
  'New Conversation', 'Conversation History', 'Scheduled Tasks',
  'Projects', 'Settings', 'Feedback', 'Customizations', 'Review',
  'Open', 'Save', 'Copy', 'Paste', 'Undo', 'Redo', 'Select All',
  'Editor', 'Terminal', 'Output', 'Extensions', 'Network', 'Proxy',
  'Theme', 'Appearance', 'Models', 'Account', 'General',
];
const sidebar = new Element('div');
body.appendChild(sidebar);
for (const t of UI_TEXT) {
  const span = new Element('span');
  span.appendChild(new TextNode(t));
  sidebar.appendChild(span);
}
const btn = new Element('button');
btn.setAttribute('aria-label', 'New Conversation');
btn.setAttribute('title', 'Settings');
sidebar.appendChild(btn);
const input = new Element('input');
input.setAttribute('placeholder', 'Ask anything, @ to mention, / for actions');
sidebar.appendChild(input);

// 不应被翻译的内容（模型名、URL、数字、CSS 色值）
const guard = new Element('div');
body.appendChild(guard);
for (const t of ['Gemini 3 Pro', 'Claude Opus 4.6', 'https://example.com/a', '#ff8800', '100.5%', '50 MB']) {
  const s = new Element('span');
  s.appendChild(new TextNode(t));
  guard.appendChild(s);
}

// ---------- 沙箱环境 ----------
const hits = [];
const sandbox = {
  console: { debug: () => {}, log: () => {} },
  setInterval: () => 0,                       // 不让它常驻
  Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
  NodeFilter: { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2, FILTER_SKIP: 3 },
  Element,
  MutationObserver: class { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} },
  document: {
    readyState: 'complete',
    documentElement: html,
    body,
    addEventListener: () => {},
    createTreeWalker(root, whatToShow, filter) {
      const nodes = [];
      const rec = (n) => {
        for (const c of n.childNodes) {
          if (c.nodeType === 3) {
            const parent = c.parentElement;
            let r = 1;
            if (filter && filter.acceptNode) r = filter.acceptNode(c);
            if (r === 1) nodes.push(c);
          } else rec(c);
        }
      };
      rec(root);
      let i = -1;
      return {
        get currentNode() { return nodes[i]; },
        nextNode() { i++; return i < nodes.length ? nodes[i] : null; },
      };
    },
  },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;

// ---------- 执行 preload 补丁 ----------
const preloadPatch = slice(preload, '// ANTIGRAVITY_CN_PRELOAD_V2_START', '// ANTIGRAVITY_CN_PRELOAD_V2_END');
vm.createContext(sandbox);
console.log('=== 执行 preload 汉化补丁 ===');
vm.runInContext(preloadPatch.replace(/^\/\/.*$/gm, ''), sandbox, { timeout: 10000 });
console.log('  补丁代码长度: ' + preloadPatch.length + ' B，执行无异常 ✅\n');

// ---------- 判定 ----------
const after = body.innerText.split('\n').filter((s) => s.trim());
const map = new Map();
for (let i = 0; i < UI_TEXT.length; i++) map.set(UI_TEXT[i], after[i]);

let pass = 0, fail = 0;
console.log('=== 界面文案翻译结果 ===');
for (const [en, zh] of map) {
  const ok = zh && /[\u4e00-\u9fff]/.test(zh);
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${en.padEnd(26)} -> ${zh}`);
}

console.log('\n=== 属性翻译 (aria-label / title / placeholder) ===');
const attrChecks = [
  ['aria-label', 'New Conversation', '新对话'],
  ['title', 'Settings', '设置'],
  ['placeholder', 'Ask anything, @ to mention, / for actions', '输入任何问题，@ 可引用，/ 可执行操作'],
];
for (const [name, en, want] of attrChecks) {
  const el = name === 'placeholder' ? input : btn;
  const got = el.getAttribute(name);
  const ok = got === want;
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? '✅' : '❌'} ${name.padEnd(12)} "${en.slice(0, 34)}" -> "${got}"`);
}

console.log('\n=== 保护性规则（模型名/URL/数字/色值 不应被翻） ===');
const guardAfter = guard.childNodes.map((c) => c.childNodes[0].nodeValue);
const guardWant = ['Gemini 3 Pro', 'Claude Opus 4.6', 'https://example.com/a', '#ff8800', '100.5%', '50 MB'];
guardAfter.forEach((got, i) => {
  const ok = got === guardWant[i];
  if (ok) pass++; else fail++;
  console.log(`  ${ok ? '✅' : '❌'} 保持不变: "${got}"${ok ? '' : '  (原: ' + guardWant[i] + ')'}`);
});

// ---------- menu.js 原生菜单翻译 ----------
console.log('\n=== 执行 menu.js 原生菜单翻译 ===');
const menuFn = slice(menu, '// ANTIGRAVITY_CN_NATIVE_MENU_V1_START', '// ANTIGRAVITY_CN_NATIVE_MENU_V1_END');
const menuSandbox = { console };
vm.createContext(menuSandbox);
vm.runInContext(menuFn + '\nthis.translateNativeMenuCn = translateNativeMenuCn;', menuSandbox, { timeout: 5000 });
const mockMenu = {
  items: [
    { label: 'File', submenu: { items: [{ label: 'New Window' }, { label: 'Close' }] } },
    { label: 'Edit', submenu: { items: [{ label: 'Undo' }, { label: 'Redo' }, { label: 'Cut' }, { label: 'Copy' }, { label: 'Paste' }, { label: 'Select All' }] } },
    { label: 'View', submenu: { items: [{ label: 'Reload' }, { label: 'Toggle Developer Tools' }] } },
    { label: 'Window', submenu: { items: [{ label: 'Minimize' }] } },
    { label: 'Help', submenu: { items: [{ label: 'Docs' }, { label: 'Check for Updates' }] } },
    { label: 'Quit' },
  ],
};
menuSandbox.translateNativeMenuCn(mockMenu);
const flat = [];
(function walk(items) { for (const it of items) { flat.push(it.label); if (it.submenu) walk(it.submenu.items); } })(mockMenu.items);
const menuExpect = ['文件', '新窗口', '关闭', '编辑', '撤销', '重做', '剪切', '复制', '粘贴', '全选', '视图', '重新加载', '切换开发者工具', '窗口', '最小化', '帮助', '文档', '检查更新', '退出'];
console.log('  菜单项: ' + flat.join(' / '));
const menuOk = JSON.stringify(flat) === JSON.stringify(menuExpect);
if (menuOk) pass++; else fail++;
console.log(`  ${menuOk ? '✅' : '❌'} 19 项菜单全部命中预期中文`);
if (!menuOk) console.log('     预期: ' + menuExpect.join(' / '));

console.log('\n' + '='.repeat(56));
console.log(`总计 ${pass + fail} 项断言，通过 ${pass}，失败 ${fail}`);
console.log(fail === 0 ? '✅ 逻辑级实跑验证全部通过' : '❌ 存在失败断言');
process.exit(fail === 0 ? 0 : 1);
