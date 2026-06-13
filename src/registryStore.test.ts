import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  addManagedUserdata,
  ensureDefaultUserdata,
  loadRegistry,
  renameUserdata,
  saveRegistry,
} from "./registry";
import { UserdataRegistryStore } from "./registryStore";

const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "userdata-switcher-registry-store-test-"),
);

after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function registryFile(name: string): string {
  return path.join(tempDir, `${name}.json`);
}

describe("UserdataRegistryStore", () => {
  it("initializes the registry with the default userdata entry", () => {
    const file = registryFile("initialized");
    const store = new UserdataRegistryStore(file);

    const registry = store.ensureInitialized();

    assert.deepEqual(registry.userdatas, [
      { id: "default", kind: "default", label: "Default" },
    ]);
    assert.deepEqual(loadRegistry(file), registry);
  });

  it("reloads the latest registry before persisting an update", () => {
    const file = registryFile("stale");
    const store = new UserdataRegistryStore(file);
    const staleRegistry = ensureDefaultUserdata(loadRegistry(file));
    const otherWindowRegistry = addManagedUserdata(staleRegistry, "Personal");
    saveRegistry(file, otherWindowRegistry);

    const updated = store.update((latest) =>
      renameUserdata(latest, "default", "Work"),
    );

    assert.deepEqual(
      updated.userdatas.map((entry) => entry.label),
      ["Work", "Personal"],
    );
    assert.deepEqual(
      loadRegistry(file).userdatas.map((entry) => entry.label),
      ["Work", "Personal"],
    );
  });
});
