#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runNpm } from "./lib/run-npm.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(
  readFileSync(path.join(repoRoot, "package.json"), "utf8"),
);
const vsixPath = path.join(
  repoRoot,
  "dist",
  `${manifest.name}-${manifest.version}-dogfood.vsix`,
);

runNpm(["run", "package:vsix", "--", "--pre-release", "--out", vsixPath]);

const installed = [
  installExtension({
    appName: "VS Code",
    commands: editorCommands("code", [
      "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
    ]),
    vsixPath,
  }),
  installExtension({
    appName: "Cursor",
    commands: editorCommands("cursor", [
      "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
    ]),
    vsixPath,
  }),
].filter(Boolean);

if (installed.length === 0) {
  console.error("Could not find a VS Code or Cursor CLI to install the VSIX.");
  process.exit(1);
}

console.log(`Dogfood VSIX installed in: ${installed.join(", ")}`);

function editorCommands(commandName, macPaths) {
  const platformCommand =
    process.platform === "win32" ? `${commandName}.cmd` : commandName;
  return process.platform === "darwin"
    ? [platformCommand, ...macPaths]
    : [platformCommand];
}

function installExtension({ appName, commands, vsixPath }) {
  const command = findCommand(commands);
  if (!command) {
    console.warn(`Skipping ${appName}: CLI not found.`);
    return undefined;
  }

  runCommand(command, ["--install-extension", vsixPath, "--force"]);
  return appName;
}

function findCommand(commands) {
  for (const command of commands) {
    if (isPath(command) && !existsSync(command)) {
      continue;
    }
    const result = spawnSync(command, ["--version"], {
      stdio: "ignore",
    });
    if (result.status === 0) {
      return command;
    }
  }
  return undefined;
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function isPath(command) {
  return command.includes("/") || command.includes("\\");
}
