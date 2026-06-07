#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const outDir = fileURLToPath(new URL("../out", import.meta.url));

rmSync(outDir, { recursive: true, force: true });
runNpm(["test"]);
runNpm(["exec", "--", "tsc", "-p", "tsconfig.build.json"]);

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
