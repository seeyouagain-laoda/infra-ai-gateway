"use strict";

const fs = require("fs");
const path = require("path");

const root = process.argv[2];
if (!root) {
  console.error("Usage: node patch_unpacked_antigravity_cn.js <extracted-app-root>");
  process.exit(2);
}

const packDir = __dirname;
const translationPath = [
  path.join(packDir, "translations.json"),
  path.join(packDir, "..", "assets", "translations.json"),
].find((file) => fs.existsSync(file));
if (!translationPath) {
  throw new Error("Missing translations.json next to the script or in ../assets");
}
const translations = JSON.parse(
  fs.readFileSync(translationPath, "utf8"),
);

const dist = path.join(root, "dist");
const files = {
  preload: path.join(dist, "preload.js"),
  menu: path.join(dist, "menu.js"),
  main: path.join(dist, "main.js"),
  tray: path.join(dist, "tray.js"),
  utils: path.join(dist, "utils.js"),
};

for (const [name, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing expected ${name} file: ${file}`);
  }
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, content) {
  fs.writeFileSync(file, content, "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function removeMarkedBlock(source, marker) {
  const start = `// ${marker}_START`;
  const end = `// ${marker}_END`;
  return source.replace(
    new RegExp(`\\n?${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}\\n?`, "g"),
    "\n",
  );
}

function cleanupLegacy(source) {
  let out = source;
  for (const marker of [
    "ANTIGRAVITY_CN_PRELOAD_V1",
    "ANTIGRAVITY_CN_PRELOAD_V2",
    "ANTIGRAVITY_CN_NATIVE_MENU_V1",
    "ANTIGRAVITY_CN_MAIN_TEXT_V1",
    "ANTIGRAVITY_CN_TRAY_TEXT_V1",
  ]) {
    out = removeMarkedBlock(out, marker);
  }
  out = out.replace(/\n?\/\/ ANTIGRAVITY_CN_PACK_V\d+_START[\s\S]*?\/\/ ANTIGRAVITY_CN_PACK_V\d+_END\n?/g, "\n");
  return out;
}

function replaceOnce(source, needle, replacement, label) {
  if (source.includes(replacement)) {
    return source;
  }
  if (!source.includes(needle)) {
    throw new Error(`Could not find patch target: ${label}`);
  }
  return source.replace(needle, replacement);
}

function patchPreload() {
  const marker = "ANTIGRAVITY_CN_PRELOAD_V2";
  let source = cleanupLegacy(read(files.preload));
  const injection = `
// ${marker}_START
;(() => {
  const MARKER = "${marker}";
  const dict = ${JSON.stringify(translations, null, 2)};
  const attrs = ["aria-label", "title", "placeholder", "data-tooltip", "alt"];
  const skipTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA"]);
  const protectedModel = /^(?:Claude|Gemini|GPT|GPT-OSS|OpenAI|Anthropic|Grok|DeepSeek|Qwen|Llama|Mistral)\\b[\\w\\s.()\\-:+/]*$/i;
  const urlLike = /^(?:https?:\\/\\/|mailto:|file:|[\\w.-]+@[\\w.-]+\\.[A-Za-z]{2,})/i;
  const cssLike = /^(?:#[0-9a-f]{3,8}|rgb\\(|rgba\\(|hsl\\(|hsla\\(|var\\(|calc\\()/i;
  const numericLike = /^[\\d\\s.,:%+\\-/()]+$/;

  function preserveWhitespace(original, translated) {
    const leading = original.match(/^\\s*/)?.[0] || "";
    const trailing = original.match(/\\s*$/)?.[0] || "";
    return leading + translated + trailing;
  }

  function shouldSkip(text) {
    const value = String(text || "").trim();
    if (!value) return true;
    if (value.length > 180) return true;
    if (urlLike.test(value)) return true;
    if (cssLike.test(value)) return true;
    if (numericLike.test(value)) return true;
    if (protectedModel.test(value)) return true;
    if (/^[A-Z]:\\\\/.test(value)) return true;
    return false;
  }

  function dynamicTranslate(value) {
    let match = value.match(/^Select model, current:\\s*(.+)$/);
    if (match) return "选择模型，当前：" + match[1];

    match = value.match(/^Refreshes in\\s+(?:(\\d+)\\s+hours?)?(?:,?\\s*)?(?:(\\d+)\\s+minutes?)?$/i);
    if (match) {
      const parts = [];
      if (match[1]) parts.push(match[1] + " 小时");
      if (match[2]) parts.push(match[2] + " 分钟");
      return "将在 " + (parts.length ? parts.join(" ") : "稍后") + " 后刷新";
    }

    match = value.match(/^(\\d+(?:\\.\\d+)?)% of the customization budget is available\\.$/);
    if (match) return match[1] + "% 的自定义预算可用。";

    match = value.match(/^Send feedback as\\s+(.+)$/);
    if (match) return "发送反馈，账号：" + match[1];

    match = value.match(/^(\\d+)\\s+agents?\\s+running$/i);
    if (match) return match[1] + " 个 Agent 正在运行";

    return null;
  }

  function translate(value) {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    if (dict[trimmed]) return preserveWhitespace(value, dict[trimmed]);
    if (shouldSkip(trimmed)) return value;
    const dynamic = dynamicTranslate(trimmed);
    if (dynamic) return preserveWhitespace(value, dynamic);
    return value;
  }

  function translateElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
    if (skipTags.has(el.tagName)) return;
    for (const attr of attrs) {
      if (el.hasAttribute(attr)) {
        const current = el.getAttribute(attr);
        const next = translate(current);
        if (next !== current) el.setAttribute(attr, next);
      }
    }
    if ((el.tagName === "INPUT" || el.tagName === "BUTTON") && typeof el.value === "string") {
      const next = translate(el.value);
      if (next !== el.value) el.value = next;
    }
  }

  function translateText(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || skipTags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const current = node.nodeValue;
      const next = translate(current);
      if (next !== current) node.nodeValue = next;
    }
  }

  function translateTree(root) {
    try {
      translateText(root);
      if (root.nodeType === Node.ELEMENT_NODE) {
        translateElement(root);
        root.querySelectorAll("*").forEach(translateElement);
      } else if (root.querySelectorAll) {
        root.querySelectorAll("*").forEach(translateElement);
      }
    } catch (error) {
      console.debug(MARKER, error);
    }
  }

  function installAttributePatch() {
    const original = Element.prototype.setAttribute;
    if (original.__antigravityCnPatched) return;
    Element.prototype.setAttribute = function patchedSetAttribute(name, value) {
      const next = attrs.includes(name) ? translate(String(value)) : value;
      return original.call(this, name, next);
    };
    Element.prototype.setAttribute.__antigravityCnPatched = true;
  }

  function start() {
    installAttributePatch();
    translateTree(document.documentElement || document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          const current = mutation.target.nodeValue;
          const next = translate(current);
          if (next !== current) mutation.target.nodeValue = next;
        } else if (mutation.type === "attributes") {
          translateElement(mutation.target);
        } else {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              const current = node.nodeValue;
              const next = translate(current);
              if (next !== current) node.nodeValue = next;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              translateTree(node);
            }
          });
        }
      }
    });
    observer.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: attrs,
    });
    setInterval(() => translateTree(document.documentElement || document.body), 1500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
// ${marker}_END
`;
  write(files.preload, source.trimEnd() + "\n" + injection);
}

function patchMenu() {
  const marker = "ANTIGRAVITY_CN_NATIVE_MENU_V1";
  let source = cleanupLegacy(read(files.menu));
  source = source.replace(/\n?\s*translateNativeMenuCn\(menu\);\n\s*\/\/ Re-apply the menu so the change takes effect\./g, "\n    // Re-apply the menu so the change takes effect.");
  const helper = `
// ${marker}_START
function translateNativeMenuCn(menu) {
    const dict = {
        File: '文件',
        Edit: '编辑',
        View: '视图',
        Window: '窗口',
        Help: '帮助',
        Docs: '文档',
        'New Window': '新窗口',
        'Check for Updates': '检查更新',
        'Toggle Developer Tools': '切换开发者工具',
        Quit: '退出',
        Close: '关闭',
        Copy: '复制',
        Paste: '粘贴',
        Cut: '剪切',
        Undo: '撤销',
        Redo: '重做',
        'Select All': '全选',
        Reload: '重新加载',
        Minimize: '最小化',
    };
    const visit = (items) => {
        for (const item of items || []) {
            if (item.label && dict[item.label]) {
                item.label = dict[item.label];
            }
            if (item.submenu) {
                visit(item.submenu.items);
            }
        }
    };
    visit(menu.items);
}
// ${marker}_END
`;
  source = replaceOnce(
    source,
    "    // Re-apply the menu so the change takes effect.\n    electron_1.Menu.setApplicationMenu(menu);",
    "    translateNativeMenuCn(menu);\n    // Re-apply the menu so the change takes effect.\n    electron_1.Menu.setApplicationMenu(menu);",
    "menu setApplicationMenu",
  );
  write(files.menu, source.trimEnd() + "\n" + helper);
}

function patchMain() {
  const marker = "ANTIGRAVITY_CN_MAIN_TEXT_V1";
  let source = cleanupLegacy(read(files.main));
  const replacements = [
    ["label: 'New Window'", "label: '新窗口'"],
    ["label: 'No agents running'", "label: '没有正在运行的 Agent'"],
    ["label: 'Quit'", "label: '退出'"],
    ["buttons: ['Cancel', 'Quit']", "buttons: ['取消', '退出']"],
    ["title: 'Confirm Quit'", "title: '确认退出'"],
    ["message: 'Are you sure you want to quit?'", "message: '确定要退出吗？'"],
    ["detail: 'There may be agents or background tasks running.'", "detail: '可能仍有 Agent 或后台任务正在运行。'"],
  ];
  for (const [needle, replacement] of replacements) {
    source = replaceOnce(source, needle, replacement, `main ${needle}`);
  }
  write(files.main, source.trimEnd() + `\n// ${marker}_START\n// Native main-process Chinese labels are patched above.\n// ${marker}_END\n`);
}

function patchTray() {
  const marker = "ANTIGRAVITY_CN_TRAY_TEXT_V1";
  let source = cleanupLegacy(read(files.tray));
  const needle =
`            countItem.label =
                (count > 0 ? \`\${count}\` : 'No') +
                    ' agent' +
                    (count === 1 ? '' : 's') +
                    ' running';`;
  const replacement =
`            countItem.label = count > 0
                ? \`\${count} 个 Agent 正在运行\`
                : '没有正在运行的 Agent';`;
  source = replaceOnce(source, needle, replacement, "tray active-agent label");
  write(files.tray, source.trimEnd() + `\n// ${marker}_START\n// Tray running-agent labels are patched above.\n// ${marker}_END\n`);
}

function cleanupUtils() {
  write(files.utils, cleanupLegacy(read(files.utils)));
}

patchPreload();
patchMenu();
patchMain();
patchTray();
cleanupUtils();

console.log("Antigravity CN pack patched extracted app:", root);
