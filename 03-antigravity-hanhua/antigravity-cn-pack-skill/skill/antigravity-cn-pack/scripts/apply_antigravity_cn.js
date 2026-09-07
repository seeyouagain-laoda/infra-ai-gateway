"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const appRoot =
  process.argv[2] ||
  "C:\\Users\\Administrator\\AppData\\Local\\Programs\\antigravity";
const resourcesDir = path.join(appRoot, "resources");
const asarPath = path.join(resourcesDir, "app.asar");
const exePath = path.join(appRoot, "Antigravity.exe");
const patchScript = path.join(__dirname, "patch_unpacked_antigravity_cn.js");

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "-" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    windowsHide: true,
    ...options,
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

function runMaybe(command, args) {
  spawnSync(command, args, {
    stdio: "ignore",
    shell: false,
    windowsHide: true,
  });
}

function assertFile(file) {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing required file: ${file}`);
  }
}

function removeDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function main() {
  assertFile(asarPath);
  assertFile(patchScript);

  console.log("Stopping Antigravity processes...");
  for (const name of ["Antigravity.exe", "language_server.exe"]) {
    runMaybe("taskkill.exe", ["/IM", name, "/F", "/T"]);
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "antigravity-cn-"));
  const unpacked = path.join(tempRoot, "app");
  const patchedAsar = path.join(tempRoot, "app.asar");
  try {
    console.log("Extracting app.asar...");
    runViaCmd("npx", ["asar", "extract", asarPath, unpacked]);

    console.log("Applying Chinese localization patch...");
    run(process.execPath, [patchScript, unpacked]);

    console.log("Checking patched JavaScript syntax...");
    for (const rel of ["dist/preload.js", "dist/menu.js", "dist/main.js", "dist/tray.js", "dist/utils.js"]) {
      run(process.execPath, ["--check", path.join(unpacked, rel)]);
    }

    console.log("Packing patched app.asar...");
    runViaCmd("npx", ["asar", "pack", unpacked, patchedAsar]);

    const backupPath = path.join(resourcesDir, `app.asar.bak-cn-auto-${stamp()}`);
    console.log(`Backing up current app.asar to ${backupPath}`);
    fs.copyFileSync(asarPath, backupPath);

    console.log("Replacing app.asar...");
    fs.copyFileSync(patchedAsar, asarPath);

    if (fs.existsSync(exePath)) {
      console.log("Starting Antigravity...");
      spawnSync("cmd.exe", ["/c", "start", "", exePath], {
        stdio: "ignore",
        shell: false,
        windowsHide: true,
      });
    } else {
      console.log(`Antigravity.exe not found at ${exePath}; patch applied but app was not started.`);
    }

    console.log("Antigravity Chinese localization pack applied.");
  } finally {
    removeDir(tempRoot);
  }
}

main();
