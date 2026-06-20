#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export function extractChangelogSection(changelog, targetVersion) {
  const header = `## ${targetVersion}`;
  const start = changelog.indexOf(header);
  if (start === -1) {
    throw new Error(`No CHANGELOG.md entry for ## ${targetVersion}.`);
  }

  const afterHeader = changelog.slice(start + header.length);
  const nextHeaderMatch = afterHeader.match(/\n## /);
  const section = (
    nextHeaderMatch ? afterHeader.slice(0, nextHeaderMatch.index) : afterHeader
  ).trim();

  if (!section) {
    throw new Error(`CHANGELOG.md entry for ## ${targetVersion} is empty.`);
  }

  return section;
}

function parseOutPath(args) {
  const outIndex = args.indexOf("--out");
  if (outIndex === -1) {
    return undefined;
  }
  const out = args[outIndex + 1];
  if (!out) {
    throw new Error("Missing value for --out.");
  }
  const unknown = args.filter((arg) => arg !== "--out" && arg !== out);
  if (unknown.length > 0) {
    throw new Error(`Unknown option: ${unknown[0]}`);
  }
  return path.resolve(repoRoot, out);
}

function main() {
  const [version, ...rest] = process.argv.slice(2);
  const outPath = parseOutPath(rest);

  if (!version) {
    console.error("Usage: changelog-section.mjs <version> [--out <path>]");
    process.exit(1);
  }

  const changelogPath = path.join(repoRoot, "CHANGELOG.md");
  const section = extractChangelogSection(
    readFileSync(changelogPath, "utf8"),
    version,
  );

  if (outPath) {
    writeFileSync(outPath, `${section}\n`, "utf8");
  } else {
    process.stdout.write(`${section}\n`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
