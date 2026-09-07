"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const appRoot =
  process.argv[2] ||
  "C:\\Users\\Administrator\\AppData\\Local\\Programs\\antigravity";
const explicitBackup = process.argv[3];
const resourcesDir = path.join(appRoot, "resources");
const asarPath = path.join(resourcesDir, "app.asar");
const exePath = path.join(appRoot, "Antigravity.exe");

function runMaybe(command, args) {
  spawnSync(command, args, {
    stdio: "ignore",
    shell: false,
    windowsHide: true,
  });
}

function latestBackup() {
  const backups = fs
    .readdirSync(resourcesDir)
    .filter((name) => /^app\.asar\.bak-cn-auto-\d{8}-\d{6}$/.test(name))
    .map((name) => {
      const file = path.join(resourcesDir, name);
      return { file, mtime: fs.statSync(file).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  return backups[0]?.file;
}

const backupPath = explicitBackup || latestBackup();
if (!backupPath || !fs.existsSync(backupPath)) {
  console.error("No Antigravity CN backup found.");
  console.error("Expected backup pattern: resources/app.asar.bak-cn-auto-YYYYMMDD-HHMMSS");
  process.exit(1);
}

console.log("Stopping Antigravity processes...");
for (const name of ["Antigravity.exe", "language_server.exe"]) {
  runMaybe("taskkill.exe", ["/IM", name, "/F", "/T"]);
}

console.log(`Restoring ${backupPath}`);
fs.copyFileSync(backupPath, asarPath);

if (fs.existsSync(exePath)) {
  console.log("Starting Antigravity...");
  spawnSync("cmd.exe", ["/c", "start", "", exePath], {
    stdio: "ignore",
    shell: false,
    windowsHide: true,
  });
}

console.log("Antigravity CN patch rolled back.");
