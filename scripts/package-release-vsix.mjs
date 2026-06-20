#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runNpm } from "./lib/run-npm.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
process.chdir(repoRoot);

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
const releaseVsixPath = path.join(
  repoRoot,
  "dist",
  "release",
  `${manifest.name}-${manifest.version}.vsix`,
);

rmSync(path.dirname(releaseVsixPath), { recursive: true, force: true });
runNpm(["run", "package:vsix", "--", "--out", releaseVsixPath]);
runGit(["push", "origin", "main", "--follow-tags"]);

console.log(
  `Release VSIX: ${path.relative(repoRoot, releaseVsixPath)}. Upload manually to the VS Code Marketplace.`,
);

function runGit(args) {
  const result = spawnSync("git", args, { stdio: "inherit" });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
