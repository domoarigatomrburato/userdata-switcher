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
  contributes?: {
    commands?: CommandContribution[];
  };
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
});
