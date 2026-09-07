"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const appRoot =
  process.argv[2] ||
  "C:\\Users\\Administrator\\AppData\\Local\\Programs\\antigravity";
const asarPath = path.join(appRoot, "resources", "app.asar");

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function quoteCmdArg(arg) {
  const value = String(arg);
  if (/^[A-Za-z0-9_./:@%+=,~\\-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function runViaCmd(command, args) {
  const line = [command, ...args].map(quoteCmdArg).join(" ");
  run("cmd.exe", ["/d", "/s", "/c", line]);
}

function contains(root, rel, text) {
  const file = path.join(root, rel);
  return fs.existsSync(file) && fs.readFileSync(file, "utf8").includes(text);
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "antigravity-cn-verify-"));
try {
  runViaCmd("npx", ["asar", "extract", asarPath, tempRoot]);
  const checks = [
    ["preload marker", contains(tempRoot, "dist/preload.js", "ANTIGRAVITY_CN_PRELOAD_V2")],
    ["menu marker", contains(tempRoot, "dist/menu.js", "ANTIGRAVITY_CN_NATIVE_MENU_V1")],
    ["main marker", contains(tempRoot, "dist/main.js", "ANTIGRAVITY_CN_MAIN_TEXT_V1")],
    ["tray marker", contains(tempRoot, "dist/tray.js", "ANTIGRAVITY_CN_TRAY_TEXT_V1")],
    ["no old preload marker", !contains(tempRoot, "dist/preload.js", "ANTIGRAVITY_CN_PRELOAD_V1")],
    ["no old pack marker", !contains(tempRoot, "dist/utils.js", "ANTIGRAVITY_CN_PACK_V")],
  ];
  for (const [name, ok] of checks) {
    console.log(`${ok ? "OK" : "FAIL"} ${name}`);
  }
  if (checks.some(([, ok]) => !ok)) process.exit(1);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
