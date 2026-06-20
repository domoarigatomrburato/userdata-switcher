#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
process.chdir(repoRoot);

runGit(["push", "origin", "main", "--follow-tags"]);

console.log(
  "Pushed release tag. GitHub Actions will publish the release and VSIX.",
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
