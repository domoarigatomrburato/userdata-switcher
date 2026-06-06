import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveUserdataRootFromGlobalStorage,
  matchCurrentUserdata,
} from "../src/detect";
import type { Registry } from "../src/registry";

describe("deriveUserdataRootFromGlobalStorage", () => {
  it("derives the userdata root from an extension global storage path", () => {
    const root = deriveUserdataRootFromGlobalStorage(
      "/tmp/custom/User/globalStorage/publisher.ext/globalStorage/state.vscdb",
    );
    assert.equal(root, "/tmp/custom");
  });
});

describe("matchCurrentUserdata", () => {
  const registry: Registry = {
    version: 1,
    userdatas: [
      { id: "default", kind: "default", label: "Work" },
      {
        id: "personal",
        kind: "managed",
        label: "Personal",
        relativeDataDir: "userdata/personal/data",
      },
    ],
  };

  it("matches the default userdata", () => {
    const match = matchCurrentUserdata({
      globalStoragePath:
        "/Users/alice/Library/Application Support/Cursor/User/globalStorage/publisher.ext/globalStorage",
      defaultUserdataRoot: "/Users/alice/Library/Application Support/Cursor",
      storeRoot: "/store",
      registry,
    });
    assert.deepEqual(match, {
      kind: "known",
      entry: registry.userdatas[0],
    });
  });

  it("matches a managed userdata under the store root", () => {
    const match = matchCurrentUserdata({
      globalStoragePath: "/store/userdata/personal/data/User/globalStorage/publisher.ext/globalStorage",
      defaultUserdataRoot: "/Users/alice/Library/Application Support/Cursor",
      storeRoot: "/store",
      registry,
    });
    assert.deepEqual(match, {
      kind: "known",
      entry: registry.userdatas[1],
    });
  });

  it("reports unmanaged userdata for unknown external roots", () => {
    const match = matchCurrentUserdata({
      globalStoragePath: "/external/User/globalStorage/publisher.ext/globalStorage",
      defaultUserdataRoot: "/Users/alice/Library/Application Support/Cursor",
      storeRoot: "/store",
      registry,
    });
    assert.equal(match.kind, "unmanaged");
  });
});
