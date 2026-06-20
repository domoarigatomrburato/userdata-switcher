#!/usr/bin/env node

import { readFileSync } from "node:fs";
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

function main() {
  const version = process.argv[2];
  if (!version) {
    console.error("Usage: changelog-section.mjs <version>");
    process.exit(1);
  }

  const changelog = readFileSync(path.join(repoRoot, "CHANGELOG.md"), "utf8");
  process.stdout.write(`${extractChangelogSection(changelog, version)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
