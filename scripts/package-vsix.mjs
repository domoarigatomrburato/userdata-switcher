#!/usr/bin/env node

import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runNpm } from "./lib/run-npm.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(
  readFileSync(path.join(repoRoot, "package.json"), "utf8"),
);
const distDir = path.join(repoRoot, "dist");
const vsixPath = path.join(
  distDir,
  `${manifest.name}-${manifest.version}.vsix`,
);
const FORBIDDEN_PACKAGE_FILES = new Set([
  ".gitignore",
  "AGENTS.md",
  "CONTEXT.md",
  "CONTRIBUTING.md",
  "biome.json",
  "tsconfig.build.json",
  "tsconfig.json",
]);

mkdirSync(distDir, { recursive: true });
rmSync(vsixPath, { force: true });

verifyPackageFiles(listPackageFiles());

runNpm([
  "exec",
  "--",
  "vsce",
  "package",
  "--no-dependencies",
  "--out",
  vsixPath,
]);

function listPackageFiles() {
  const result = runNpm(["exec", "--", "vsce", "ls", "--no-dependencies"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return result.stdout.trim().split(/\r?\n/).filter(Boolean);
}

function verifyPackageFiles(files) {
  const forbidden = files.filter(isForbiddenPackageFile);
  if (forbidden.length) {
    throw new Error(
      `VSIX package includes development-only files:\n${forbidden.join("\n")}`,
    );
  }
}

function isForbiddenPackageFile(file) {
  return (
    file.startsWith(".github/") ||
    file.startsWith(".vscode/") ||
    file.startsWith("docs/") ||
    file.startsWith("scripts/") ||
    file.startsWith("src/") ||
    file.startsWith("node_modules/") ||
    FORBIDDEN_PACKAGE_FILES.has(file) ||
    file.endsWith(".map") ||
    file.endsWith(".test.js") ||
    file.endsWith(".ts")
  );
}
