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
  galleryBanner?: { color?: string; theme?: string };
  homepage?: string;
  keywords?: string[];
  pricing?: string;
  scripts?: Record<string, string>;
}

describe("extension manifest", () => {
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
    assert.deepEqual(manifest.keywords, [
      "userdata",
      "profile",
      "profiles",
      "cursor",
      "launcher",
      "vscode",
    ]);
    assert.equal(
      manifest.scripts?.["package:vsix"],
      "node -e \"require('node:fs').mkdirSync('dist', { recursive: true })\" && " +
        "vsce package --no-dependencies --out dist/userdata-switcher-$" +
        "{npm_package_version}.vsix",
    );
  });
});
