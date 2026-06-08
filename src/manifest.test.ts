import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

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

    assert.deepEqual(manifest.contributes?.commands, [
      {
        command: "userdataSwitcher.openWithUserdata",
        title: "Open With Userdata",
        category: "Userdata Switcher",
      },
      {
        command: "userdataSwitcher.createUserdata",
        title: "Create Userdata",
        category: "Userdata Switcher",
      },
      {
        command: "userdataSwitcher.renameCurrentUserdata",
        title: "Rename Current Userdata",
        category: "Userdata Switcher",
      },
      {
        command: "userdataSwitcher.showCurrentUserdata",
        title: "Show Current Userdata",
        category: "Userdata Switcher",
      },
      {
        command: "userdataSwitcher.revealCurrentUserdata",
        title: "Reveal Current Userdata",
        category: "Userdata Switcher",
      },
    ]);
  });

  it("keeps marketplace metadata and packaging output publish-ready", () => {
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
    assert.equal(
      manifest.description,
      "Use separate Cursor or VS Code accounts, themes, and settings in the same workspace.",
    );
    assert.equal(manifest.qna, "marketplace");
    assert.deepEqual(manifest.keywords, [
      "userdata",
      "user-data-dir",
      "vscode",
      "visual studio code",
      "insiders",
      "cursor",
      "account",
      "accounts",
      "launcher",
      "workspace",
      "multi-account",
      "theme",
      "themes",
      "profile",
      "profiles",
    ]);
    assert.deepEqual(manifest.scripts, expectedScripts);
  });
});
