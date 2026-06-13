#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runNpm } from "./lib/run-npm.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const bump = process.argv[2];
const allowedBumps = new Set(["major", "minor", "patch"]);

if (!allowedBumps.has(bump)) {
  console.error("Usage: npm run release -- <major|minor|patch>");
  process.exit(1);
}

process.chdir(repoRoot);

const manifest = readManifest();
const currentVersion = manifest.version;
const nextVersion = incrementVersion(currentVersion, bump);
const tagName = `v${nextVersion}`;
const releaseDir = path.join(repoRoot, "dist", "release");
const releaseVsixPath = path.join(
  releaseDir,
  `${manifest.name}-${nextVersion}.vsix`,
);

ensureMainBranch();
ensureCleanWorktree();
runGit(["fetch", "origin", "main:refs/remotes/origin/main", "--tags"]);
ensureNotBehindOriginMain();
ensureTagDoesNotExist(tagName);
ensureChangelogEntry(nextVersion);

runNpm(["version", bump, "--no-git-tag-version"]);
runNpm(["run", "fix"]);
runNpm(["run", "check"]);
runNpm(["test"]);
runNpm(["run", "build"]);
prepareReleaseDirectory();
runNpm(["run", "package:vsix", "--", "--out", releaseVsixPath]);

ensureCleanExcept(["package-lock.json", "package.json"]);
runGit(["add", "package-lock.json", "package.json"]);
runGit(["commit", "-m", `Release ${nextVersion}`]);
runGit(["tag", "-a", tagName, "-m", `Release ${nextVersion}`]);
runGit(["push", "origin", "main"]);
runGit(["push", "origin", tagName]);

console.log(
  `Released ${nextVersion}. Upload ${path.relative(
    repoRoot,
    releaseVsixPath,
  )} manually to the VS Code Marketplace.`,
);

function readManifest() {
  return JSON.parse(readFileSync("package.json", "utf8"));
}

function incrementVersion(version, release) {
  const parts = version.split(".").map((part) => Number.parseInt(part, 10));
  if (
    parts.length !== 3 ||
    parts.some((part) => !Number.isInteger(part) || part < 0)
  ) {
    throw new Error(`Expected major.minor.patch version, got ${version}.`);
  }

  const [major, minor, patch] = parts;
  if (release === "major") {
    return `${major + 1}.0.0`;
  }
  if (release === "minor") {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

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

function ensureCleanWorktree() {
  const status = gitStatus();
  if (status.length > 0) {
    throw new Error(`Release requires a clean worktree:\n${status.join("\n")}`);
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
  const [ahead, behind] = counts.split(/\s+/).map((value) => Number(value));
  if (behind > 0) {
    throw new Error(
      "Release branch is behind origin/main. Pull or rebase first.",
    );
  }
  if (ahead > 0) {
    console.warn(`Release branch is ${ahead} commit(s) ahead of origin/main.`);
  }
}

function ensureTagDoesNotExist(tagName) {
  const result = spawnSync(
    "git",
    ["rev-parse", "--verify", "--quiet", tagName],
    {
      stdio: "ignore",
    },
  );
  if (result.status === 0) {
    throw new Error(`Tag already exists: ${tagName}`);
  }
}

function ensureChangelogEntry(version) {
  const changelog = readFileSync("CHANGELOG.md", "utf8");
  if (!changelog.includes(`## ${version}`)) {
    throw new Error(
      `Add a CHANGELOG.md entry for ## ${version} before release.`,
    );
  }
}

function prepareReleaseDirectory() {
  rmSync(releaseDir, { recursive: true, force: true });
  mkdirSync(releaseDir, { recursive: true });
}

function ensureCleanExcept(expectedFiles) {
  const unexpected = gitStatus().filter((line) => {
    const file = line.slice(3);
    return !expectedFiles.includes(file);
  });
  if (unexpected.length > 0) {
    throw new Error(
      `Release validation changed unexpected files:\n${unexpected.join("\n")}`,
    );
  }
}

function gitStatus() {
  const result = runGit(["status", "--short"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return result.stdout.trim().split(/\r?\n/).filter(Boolean);
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
