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
const options = parseOptions(process.argv.slice(2));
const vsixPath = options.out
  ? path.resolve(repoRoot, options.out)
  : path.join(distDir, `${manifest.name}-${manifest.version}.vsix`);
const FORBIDDEN_PACKAGE_FILES = new Set([
  ".gitignore",
  "AGENTS.md",
  "CONTEXT.md",
  "CONTRIBUTING.md",
  "biome.json",
  "knip.json",
  "tsconfig.build.json",
  "tsconfig.json",
]);

mkdirSync(path.dirname(vsixPath), { recursive: true });
rmSync(vsixPath, { force: true });

verifyPackageFiles(listPackageFiles());

runNpm([
  "exec",
  "--",
  "vsce",
  "package",
  ...(options.preRelease ? ["--pre-release"] : []),
  "--no-dependencies",
  "--out",
  vsixPath,
]);

function parseOptions(args) {
  const parsed = {
    out: undefined,
    preRelease: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--pre-release") {
      parsed.preRelease = true;
      continue;
    }
    if (arg === "--out") {
      const out = args[index + 1];
      if (!out) {
        throw new Error("Missing value for --out.");
      }
      parsed.out = out;
      index += 1;
      continue;
    }
    throw new Error(`Unknown package-vsix option: ${arg}`);
  }

  return parsed;
}

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
    file.startsWith("test/") ||
    file.startsWith("node_modules/") ||
    FORBIDDEN_PACKAGE_FILES.has(file) ||
    file.endsWith(".map") ||
    file.endsWith(".svg") ||
    file.endsWith(".test.js") ||
    file.endsWith(".ts")
  );
}
