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
  updateRegistry,
} from "./registry";

const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "userdata-switcher-registry-test-"),
);
const registryFile = path.join(tempDir, "registry.json");

after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("registry", () => {
  it("auto-seeds the default userdata entry", () => {
    const registry = ensureDefaultUserdata(loadRegistry(registryFile));
    assert.equal(registry.userdatas.length, 1);
    assert.deepEqual(registry.userdatas[0], {
      id: "default",
      kind: "default",
      label: "Default",
    });
    saveRegistry(registryFile, registry);
  });

  it("creates a managed userdata with a stable relative path", () => {
    const registry = loadRegistry(registryFile);
    const updated = addManagedUserdata(registry, "Personal");
    assert.equal(updated.userdatas.length, 2);
    const managed = updated.userdatas.find((entry) => entry.kind === "managed");
    assert.ok(managed);
    assert.equal(managed?.label, "Personal");
    assert.match(managed?.relativeDataDir ?? "", /^userdata\/personal\/data$/);
    saveRegistry(registryFile, updated);
  });

  it("renames a userdata label without changing ids", () => {
    const registry = loadRegistry(registryFile);
    const updated = renameUserdata(registry, "default", "Work");
    assert.equal(updated.userdatas[0]?.label, "Work");
    assert.equal(updated.userdatas[0]?.id, "default");
  });

  it("reloads the latest registry before persisting an update", () => {
    const staleRegistryFile = path.join(tempDir, "stale-registry.json");
    const staleRegistry = ensureDefaultUserdata(
      loadRegistry(staleRegistryFile),
    );
    const otherWindowRegistry = addManagedUserdata(staleRegistry, "Personal");
    saveRegistry(staleRegistryFile, otherWindowRegistry);

    const updated = updateRegistry(staleRegistryFile, (latest) =>
      renameUserdata(latest, "default", "Work"),
    );

    assert.deepEqual(
      updated.userdatas.map((entry) => entry.label),
      ["Work", "Personal"],
    );
    assert.deepEqual(
      loadRegistry(staleRegistryFile).userdatas.map((entry) => entry.label),
      ["Work", "Personal"],
    );
  });
});
