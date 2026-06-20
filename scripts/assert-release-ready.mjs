#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extractChangelogSection } from "./changelog-section.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
process.chdir(repoRoot);

const nextVersion = process.env.npm_new_version;
if (!nextVersion) {
  console.error(
    "assert-release-ready must run via npm version (npm_new_version is unset).",
  );
  process.exit(1);
}

ensureMainBranch();
runGit(["fetch", "origin", "main", "--tags"]);
ensureNotBehindOriginMain();
ensureChangelogEntry(nextVersion);

function ensureMainBranch() {
  const branch = runGit(["branch", "--show-current"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).stdout.trim();
  if (branch !== "main") {
    throw new Error(
      `Release must run from main, not ${branch || "detached HEAD"}.`,
    );
  }
}

function ensureNotBehindOriginMain() {
  const counts = runGit(
    ["rev-list", "--left-right", "--count", "HEAD...origin/main"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  ).stdout.trim();
  const [, behind] = counts.split(/\s+/).map((value) => Number(value));
  if (behind > 0) {
    throw new Error(
      "Release branch is behind origin/main. Pull or rebase first.",
    );
  }
}

function ensureChangelogEntry(version) {
  const changelog = readFileSync("CHANGELOG.md", "utf8");
  extractChangelogSection(changelog, version);
}

function runGit(args, options = {}) {
  const result = spawnSync("git", args, {
    stdio: "inherit",
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  return result;
}
