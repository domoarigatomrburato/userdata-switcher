#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(
  readFileSync(path.join(repoRoot, "package.json"), "utf8"),
);
const distDir = path.join(repoRoot, "dist");
const vsixPath = path.join(
  distDir,
  `${manifest.name}-${manifest.version}.vsix`,
);

mkdirSync(distDir, { recursive: true });
rmSync(vsixPath, { force: true });

runNpm([
  "exec",
  "--",
  "vsce",
  "package",
  "--no-dependencies",
  "--out",
  vsixPath,
]);

function runNpm(args) {
  const result = spawnSync(npmCommand(), args, { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}
