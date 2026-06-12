import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  COMMAND_CREATE_USERDATA,
  COMMAND_OPEN_WITH_USERDATA,
  COMMAND_RENAME_CURRENT_USERDATA,
  COMMAND_REVEAL_CURRENT_USERDATA,
  COMMAND_SHOW_CURRENT_USERDATA,
} from "./extensionActivation";

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
  galleryBanner?: { color?: string; theme?: string };
  homepage?: string;
  keywords?: string[];
  pricing?: string;
  qna?: string;
  scripts?: Record<string, string>;
}

describe("extension manifest", () => {
  const expectedScripts = {
    "vscode:prepublish": "npm run build",
    check: "biome check --write .",
    test: "tsc -p . && tsx --test src/**/*.test.ts",
    build: "node scripts/build.mjs",
    "package:vsix": "node scripts/package-vsix.mjs",
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
      ],
    );
    assert.ok(
      commands.every((command) => command.category === "Userdata Switcher"),
    );
    assert.ok(commands.every((command) => command.title.trim()));
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

function assertKeywordsInclude(
  keywords: string[] | undefined,
  expected: readonly string[],
): void {
  assert.ok(keywords);
  for (const keyword of expected) {
    assert.ok(keywords.includes(keyword), `missing keyword: ${keyword}`);
  }
}
