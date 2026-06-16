import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  COMMAND_CREATE_USERDATA,
  COMMAND_DELETE_USERDATA,
  COMMAND_OPEN_WITH_USERDATA,
  COMMAND_RENAME_CURRENT_USERDATA,
  COMMAND_REVEAL_CURRENT_USERDATA,
  COMMAND_SHOW_CURRENT_USERDATA,
} from "./userdataSwitcherApp";

interface CommandContribution {
  category?: string;
  command: string;
  title: string;
}

interface ExtensionManifest {
  bugs?: { url?: string };
  contributes?: {
    commands?: CommandContribution[];
  };
  description?: string;
  engines?: { node?: string; vscode?: string };
  galleryBanner?: { color?: string; theme?: string };
  homepage?: string;
  keywords?: string[];
  pricing?: string;
  qna?: string;
  scripts?: Record<string, string>;
}

/** Cursor's declared VS Code API level (mid-2026). Keep engines.vscode floor at or below this. */
const CURSOR_DECLARED_VSCODE_API = "1.105.1";
const ENGINES_VSCODE = "^1.90.0";

describe("extension manifest", () => {
  const expectedScripts = {
    "vscode:prepublish": "npm run build",
    check: "knip && biome ci .",
    fix: "knip --fix && biome check --write .",
    test: "tsc -p . && tsx --test src/**/*.test.ts",
    build: "node scripts/build.mjs",
    "package:vsix": "node scripts/package-vsix.mjs",
    dogfood: "node scripts/dogfood.mjs",
    release: "node scripts/release.mjs",
  };

  it("groups command palette entries under the extension category", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as ExtensionManifest;
    const commands = manifest.contributes?.commands ?? [];

    assert.deepEqual(
      commands.map((command) => command.command),
      [
        COMMAND_OPEN_WITH_USERDATA,
        COMMAND_CREATE_USERDATA,
        COMMAND_RENAME_CURRENT_USERDATA,
        COMMAND_SHOW_CURRENT_USERDATA,
        COMMAND_REVEAL_CURRENT_USERDATA,
        COMMAND_DELETE_USERDATA,
      ],
    );
    assert.ok(
      commands.every((command) => command.category === "Userdata Switcher"),
    );
    assert.ok(commands.every((command) => command.title.trim()));
  });

  it("declares a VS Code engine floor without engines.node", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as ExtensionManifest;

    assert.deepEqual(manifest.engines, { vscode: ENGINES_VSCODE });
    assert.ok(
      vscodeApiSatisfiesEngine(CURSOR_DECLARED_VSCODE_API, ENGINES_VSCODE),
      `engines.vscode ${ENGINES_VSCODE} must not exceed Cursor API ${CURSOR_DECLARED_VSCODE_API}`,
    );
  });

  it("keeps marketplace metadata publish-ready", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as ExtensionManifest;

    assert.equal(
      manifest.homepage,
      "https://github.com/domoarigatomrburato/userdata-switcher#readme",
    );
    assert.equal(
      manifest.bugs?.url,
      "https://github.com/domoarigatomrburato/userdata-switcher/issues",
    );
    assert.deepEqual(manifest.galleryBanner, {
      color: "#1f1f1f",
      theme: "dark",
    });
    assert.equal(manifest.pricing, "Free");
    assert.ok(manifest.description);
    assert.match(
      manifest.description,
      /Cursor AI subscriptions.*VS Code themes/,
    );
    assert.equal(manifest.qna, "marketplace");
    assertKeywordsInclude(manifest.keywords, [
      "userdata",
      "user-data-dir",
      "vscode",
      "visual studio code",
      "cursor",
      "ai",
      "subscription",
      "subscriptions",
      "account",
      "accounts",
      "launcher",
      "workspace",
      "multi-account",
      "theme",
      "themes",
    ]);
    assert.ok(!manifest.keywords?.includes("profile"));
    assert.ok(!manifest.keywords?.includes("profiles"));
    assert.deepEqual(manifest.scripts, expectedScripts);
  });
});

function vscodeApiSatisfiesEngine(
  hostVersion: string,
  engineRange: string,
): boolean {
  const match = /^\^(\d+)\.(\d+)\.(\d+)$/.exec(engineRange);
  if (!match) {
    return false;
  }
  const floor = match.slice(1, 4).map(Number) as [number, number, number];
  const host = hostVersion.split(".").map(Number) as [number, number, number];
  for (let index = 0; index < 3; index += 1) {
    if (host[index] > floor[index]) {
      return true;
    }
    if (host[index] < floor[index]) {
      return false;
    }
  }
  return true;
}

function assertKeywordsInclude(
  keywords: string[] | undefined,
  expected: readonly string[],
): void {
  assert.ok(keywords);
  for (const keyword of expected) {
    assert.ok(keywords.includes(keyword), `missing keyword: ${keyword}`);
  }
}
