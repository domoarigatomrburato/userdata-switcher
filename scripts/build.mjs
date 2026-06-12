#!/usr/bin/env node

import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { runNpm } from "./lib/run-npm.mjs";

const outDir = fileURLToPath(new URL("../out", import.meta.url));

rmSync(outDir, { recursive: true, force: true });
runNpm(["test"]);
runNpm(["exec", "--", "tsc", "-p", "tsconfig.build.json"]);
