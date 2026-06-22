#!/usr/bin/env node

import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const production = process.argv.includes("--production");
const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const outDir = path.join(repoRoot, "out");

rmSync(outDir, { recursive: true, force: true });

await esbuild.build({
  entryPoints: [path.join(repoRoot, "src/extension.ts")],
  bundle: true,
  outfile: path.join(outDir, "extension.js"),
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["vscode"],
  minify: production,
  sourcemap: !production,
});
