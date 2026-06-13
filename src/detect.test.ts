import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import {
  deriveUserdataRootFromGlobalStorage,
  matchCurrentUserdata,
  resolveCurrentUserdataRoot,
} from "./detect";
import type { Registry } from "./registry";

const DEFAULT_ROOT = path.join(path.sep, "default");
const STORE_ROOT = path.join(path.sep, "store");
const MANAGED_ROOT = path.join(STORE_ROOT, "u", "personal");
const EXTERNAL_ROOT = path.join(path.sep, "external");

const registry: Registry = {
  version: 1,
  userdatas: [
    { id: "default", kind: "default", label: "Work" },
    {
      id: "personal",
      kind: "managed",
      label: "Personal",
      relativeDataDir: "u/personal",
    },
  ],
};

function globalStoragePath(userdataRoot: string): string {
  return path.join(
    userdataRoot,
    "User",
    "globalStorage",
    "publisher.ext",
    "globalStorage",
  );
}

function matchUserdataRoot(userdataRoot: string) {
  return matchCurrentUserdata({
    globalStoragePath: globalStoragePath(userdataRoot),
    defaultUserdataRoot: DEFAULT_ROOT,
    storeRoot: STORE_ROOT,
    registry,
  });
}

describe("deriveUserdataRootFromGlobalStorage", () => {
  it("derives the userdata root from an extension global storage path", () => {
    const root = deriveUserdataRootFromGlobalStorage(
      path.join(
        path.sep,
        "tmp",
        "custom",
        "User",
        "globalStorage",
        "publisher.ext",
        "globalStorage",
        "settings.json",
      ),
    );
    assert.equal(root, path.join(path.sep, "tmp", "custom"));
  });
});

describe("matchCurrentUserdata", () => {
  it("matches the default userdata", () => {
    const match = matchUserdataRoot(DEFAULT_ROOT);
    assert.deepEqual(match, {
      kind: "known",
      entry: registry.userdatas[0],
    });
  });

  it("matches a managed userdata under the store root", () => {
    const match = matchUserdataRoot(MANAGED_ROOT);
    assert.deepEqual(match, {
      kind: "known",
      entry: registry.userdatas[1],
    });
  });

  it("matches a Windows managed userdata when drive letter casing differs", () => {
    const match = matchCurrentUserdata({
      globalStoragePath:
        "c:\\Users\\ale\\AppData\\Local\\udsw\\vscode\\u\\provona\\User\\globalStorage\\domoarigatomrburato.userdata-switcher",
      defaultUserdataRoot: "C:\\Users\\ale\\AppData\\Roaming\\Code",
      storeRoot: "C:\\Users\\ale\\AppData\\Local\\udsw\\vscode",
      registry: {
        version: 1,
        userdatas: [
          { id: "default", kind: "default", label: "Default" },
          {
            id: "provona",
            kind: "managed",
            label: "Provona",
            relativeDataDir: "u/provona",
          },
        ],
      },
    });

    assert.deepEqual(match, {
      kind: "known",
      entry: {
        id: "provona",
        kind: "managed",
        label: "Provona",
        relativeDataDir: "u/provona",
      },
    });
  });

  it("reports unmanaged userdata for unknown external roots", () => {
    const match = matchUserdataRoot(EXTERNAL_ROOT);
    assert.equal(match.kind, "unmanaged");
  });

  it("ignores malformed managed userdata registry paths", () => {
    const malformedRegistry: Registry = {
      version: 1,
      userdatas: [
        ...registry.userdatas,
        {
          id: "escaped",
          kind: "managed",
          label: "Escaped",
          relativeDataDir: "../outside",
        },
      ],
    };

    const match = matchCurrentUserdata({
      globalStoragePath: globalStoragePath(EXTERNAL_ROOT),
      defaultUserdataRoot: DEFAULT_ROOT,
      storeRoot: STORE_ROOT,
      registry: malformedRegistry,
    });

    assert.equal(match.kind, "unmanaged");
  });
});

describe("resolveCurrentUserdataRoot", () => {
  it("resolves the default userdata root", () => {
    const current = matchUserdataRoot(DEFAULT_ROOT);
    assert.equal(current.kind, "known");

    const root = resolveCurrentUserdataRoot({
      current,
      globalStoragePath: globalStoragePath(DEFAULT_ROOT),
      defaultUserdataRoot: DEFAULT_ROOT,
      storeRoot: STORE_ROOT,
    });
    assert.equal(root, DEFAULT_ROOT);
  });

  it("resolves a managed userdata root", () => {
    const current = matchUserdataRoot(MANAGED_ROOT);
    assert.equal(current.kind, "known");

    const root = resolveCurrentUserdataRoot({
      current,
      globalStoragePath: globalStoragePath(MANAGED_ROOT),
      defaultUserdataRoot: DEFAULT_ROOT,
      storeRoot: STORE_ROOT,
    });
    assert.equal(root, MANAGED_ROOT);
  });

  it("resolves an unmanaged userdata root from global storage", () => {
    const root = resolveCurrentUserdataRoot({
      current: { kind: "unmanaged" },
      globalStoragePath: globalStoragePath(EXTERNAL_ROOT),
      defaultUserdataRoot: DEFAULT_ROOT,
      storeRoot: STORE_ROOT,
    });
    assert.equal(root, EXTERNAL_ROOT);
  });
});
