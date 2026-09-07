// ANTIGRAVITY_CN_PRELOAD_V2_START
;(() => {
  const MARKER = "ANTIGRAVITY_CN_PRELOAD_V2";
  const dict = __DICT__;
  const attrs = ["aria-label", "title", "placeholder", "data-tooltip", "alt"];
  const skipTags = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "CODE", "PRE", "TEXTAREA"]);
  const protectedModel = /^(?:Claude|Gemini|GPT|GPT-OSS|OpenAI|Anthropic|Grok|DeepSeek|Qwen|Llama|Mistral)\b[\w\s.()\-:+/]*$/i;
  const urlLike = /^(?:https?:\/\/|mailto:|file:|[\w.-]+@[\w.-]+\.[A-Za-z]{2,})/i;
  const cssLike = /^(?:#[0-9a-f]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|var\(|calc\()/i;
  const numericLike = /^[\d\s.,:%+\-/()]+$/;

  function preserveWhitespace(original, translated) {
    const leading = original.match(/^\s*/)?.[0] || "";
    const trailing = original.match(/\s*$/)?.[0] || "";
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
    if (/^[A-Z]:\\/.test(value)) return true;
    return false;
  }

  function dynamicTranslate(value) {
    let match = value.match(/^Select model, current:\s*(.+)$/);
    if (match) return "选择模型，当前：" + match[1];

    match = value.match(/^Refreshes in\s+(?:(\d+)\s+hours?)?(?:,?\s*)?(?:(\d+)\s+minutes?)?$/i);
    if (match) {
      const parts = [];
      if (match[1]) parts.push(match[1] + " 小时");
      if (match[2]) parts.push(match[2] + " 分钟");
      return "将在 " + (parts.length ? parts.join(" ") : "稍后") + " 后刷新";
    }

    match = value.match(/^(\d+(?:\.\d+)?)% of the customization budget is available\.$/);
    if (match) return match[1] + "% 的自定义预算可用。";

    match = value.match(/^Send feedback as\s+(.+)$/);
    if (match) return "发送反馈，账号：" + match[1];

    match = value.match(/^(\d+)\s+agents?\s+running$/i);
    if (match) return match[1] + " 个 Agent 正在运行";

    // —— 补充动态串（实时界面扫描残留）——
    let m;
    m = value.match(/^Thought for\s+(\d+)\s*(?:s|sec|seconds)?$/i);
    if (m) return "思考了 " + m[1] + " 秒";
    m = value.match(/^Worked for\s+(\d+)\s*(s|m|sec|min|minute|minutes)?$/i);
    if (m) return "耗时 " + m[1] + (m[2] && m[2][0] === "m" ? " 分" : " 秒");
    m = value.match(/^Load older messages,?\s+showing\s+(\d+)\s+of\s+(\d+)$/i);
    if (m) return "加载更早的消息（" + m[1] + " / " + m[2] + "）";

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
// ANTIGRAVITY_CN_PRELOAD_V2_END
